from __future__ import annotations

import hmac
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import time
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qs, urlparse

from backend.guardian import GuardianError, GuardianStore
from backend import advisor
from backend.mcp_server import call_tool
from backend.mcp_server import TOOLS, handle_request
from backend.imap_connector import poll_vendor_mailbox, polling_loop


def load_local_env(allowed_names: set[str] | None = None) -> Path | None:
    env_path = Path(os.environ.get(
        "GUARDIAN_ENV_FILE",
        Path(__file__).resolve().parent.parent / ".env.local",
    )).expanduser()
    if not env_path.exists():
        return None
    if env_path.stat().st_mode & 0o077:
        os.chmod(env_path, 0o600)
    for line_number, raw_line in enumerate(env_path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise RuntimeError(f"Invalid environment entry at {env_path}:{line_number}.")
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            raise RuntimeError(f"Invalid environment variable name at {env_path}:{line_number}.")
        if value.startswith(("'", '"')):
            quote = value[0]
            if len(value) < 2 or value[-1] != quote:
                raise RuntimeError(f"Unclosed quote at {env_path}:{line_number}.")
            value = value[1:-1]
        if "\n" in value or "\r" in value:
            raise RuntimeError(f"Multiline environment values are not supported ({env_path}:{line_number}).")
        if allowed_names is None or name in allowed_names:
            os.environ.setdefault(name, value)
    return env_path


def initialize_local_env(path: Path | None = None) -> Path:
    target = path or Path(__file__).resolve().parent.parent / ".env.local"
    if target.exists():
        raise RuntimeError(f"{target} already exists; refusing to overwrite credentials.")
    target.parent.mkdir(parents=True, exist_ok=True)
    values = {
        "GUARDIAN_API_ENABLED": "true",
        "GUARDIAN_API_TARGET": "http://127.0.0.1:8000",
        "GUARDIAN_ALLOWED_RECIPIENT_DOMAINS": "example.test,vendor.test",
        "OWNER_TOKEN": secrets.token_urlsafe(32),
        "INVITATIONS_TOKEN": secrets.token_urlsafe(32),
        "CATERING_TOKEN": secrets.token_urlsafe(32),
        "VENDOR_TOKEN": secrets.token_urlsafe(32),
    }
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as file:
        for name, value in values.items():
            file.write(f"{name}={value}\n")
    return target


def configured_tokens() -> dict[str, tuple[str, str]]:
    entries = {
        "owner": ("OWNER_TOKEN", "owner"),
        "invitations": ("INVITATIONS_TOKEN", "invitations-agent"),
        "catering": ("CATERING_TOKEN", "catering-agent"),
        "vendor": ("VENDOR_TOKEN", "catering-vendor"),
    }
    configured: dict[str, tuple[str, str]] = {}
    for role, (variable, principal_id) in entries.items():
        token = os.environ.get(variable, "")
        if token:
            configured[role] = (token, principal_id)
    if set(configured) != set(entries):
        missing = [entries[role][0] for role in entries if role not in configured]
        raise RuntimeError(f"Set the required bearer-token environment variables: {', '.join(missing)}")
    values = [token for token, _ in configured.values()]
    if any(token.startswith("replace-with-") for token in values):
        raise RuntimeError("Replace the example bearer-token placeholders with generated secrets.")
    if any(len(token) < 32 for token in values):
        raise RuntimeError("Bearer tokens must be at least 32 characters long.")
    if len(set(values)) != len(values):
        raise RuntimeError("All bearer tokens must be distinct.")
    return configured


def validate_integration_config() -> None:
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    if smtp_host and os.environ.get("SMTP_USE_TLS", "true").lower() != "true":
        if smtp_host not in ("localhost", "127.0.0.1", "::1"):
            raise RuntimeError("SMTP_USE_TLS must be true for non-local SMTP servers.")
    if os.environ.get("IMAP_HOST", "").strip() and os.environ.get("IMAP_USE_SSL", "true").lower() != "true":
        raise RuntimeError("IMAP_USE_SSL must be true; plaintext IMAP is not supported.")


class GuardianHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    store: GuardianStore
    tokens: dict[str, tuple[str, str]]


class GuardianHandler(BaseHTTPRequestHandler):
    server_version = "EventGuardian/0.1"
    max_body_bytes = 1_000_000

    @property
    def store(self) -> GuardianStore:
        return cast(GuardianHTTPServer, self.server).store

    @property
    def tokens(self) -> dict[str, tuple[str, str]]:
        return cast(GuardianHTTPServer, self.server).tokens

    def do_GET(self) -> None:
        try:
            _, role = self._principal()
            self._require_role(role, "owner")
            parsed = urlparse(self.path)
            if parsed.path == "/api/state":
                self._send_json(200, self.store.state())
                return
            if parsed.path == "/api/readiness":
                self._send_json(200, self.store.readiness())
                return
            if parsed.path == "/api/insights":
                cards = advisor.get_insights(self.store)
                self._send_json(200, cards)
                return
            if parsed.path == "/api/review":
                self._send_json(200, self.store.evaluate_review())
                return
            if parsed.path == "/api/context":
                role_values = parse_qs(parsed.query).get("role", ["invitations"])
                role = role_values[0]
                if role not in ("invitations", "catering"):
                    raise GuardianError("INVALID_REQUEST", "role must be invitations or catering.", 400)
                self._send_json(200, call_tool(self.store, "get_context", {"role": role}))
                return
            if parsed.path == "/api/priorities":
                role_values = parse_qs(parsed.query).get("role", ["invitations"])
                role = role_values[0]
                if role not in ("invitations", "catering"):
                    raise GuardianError("INVALID_REQUEST", "role must be invitations or catering.", 400)
                self._send_json(200, call_tool(self.store, "recommend_priorities", {"role": role}))
                return
            if parsed.path == "/api/audit":
                since_values = parse_qs(parsed.query).get("since", ["0"])
                try:
                    since = max(0, int(since_values[0]))
                except ValueError as error:
                    raise GuardianError("INVALID_CURSOR", "Audit cursor must be an integer.", 400) from error
                self._send_json(200, {"items": self.store.audit(since)})
                return
            if parsed.path == "/api/audit/verify":
                self._send_json(200, self.store.verify_audit())
                return
            if parsed.path == "/api/events":
                since_values = parse_qs(parsed.query).get("since", ["0"])
                try:
                    since = max(0, int(since_values[0]))
                except ValueError as error:
                    raise GuardianError("INVALID_CURSOR", "SSE cursor must be an integer.", 400) from error
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self.end_headers()
                last_sent = since
                deadline = time.monotonic() + 25
                try:
                    while time.monotonic() < deadline:
                        items = self.store.audit(last_sent)
                        for item in items:
                            payload = json.dumps(item, sort_keys=True)
                            self.wfile.write(f"event: state-change\ndata: {payload}\n\n".encode("utf-8"))
                            last_sent = item["seq"]
                        if not items:
                            self.wfile.write(b": keep-alive\n\n")
                        self.wfile.flush()
                        time.sleep(1)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                return
            raise GuardianError("NOT_FOUND", "Route was not found.", 404)
        except GuardianError as error:
            self._send_error(error)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_error(GuardianError("INVALID_JSON", "Request body must be valid JSON.", 400))

    def do_POST(self) -> None:
        try:
            principal_id, role = self._principal()
            path = urlparse(self.path).path
            payload = self._body()
            if path == "/api/mcp":
                if role not in ("invitations", "catering", "owner"):
                    raise GuardianError("SCOPE", "Only owner or role agents may call MCP tools.", 403)
                method = payload.get("method")
                req_id = payload.get("id")
                if method == "tools/list":
                    self._send_json(200, {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"tools": TOOLS},
                    })
                    return
                if method not in ("initialize", "tools/call"):
                    response = handle_request(self.store, payload)
                    if response is not None:
                        self._send_json(200, response)
                        return
                if method == "initialize":
                    self._send_json(200, {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {"tools": {}},
                            "serverInfo": {"name": "event-guardian-mcp-http", "version": "0.1.0"},
                        },
                    })
                    return
                if method == "tools/call":
                    params = payload.get("params") or {}
                    name = params.get("name", "")
                    arguments = params.get("arguments") or {}
                    if role == "invitations":
                        arguments["role"] = "invitations"
                    elif role == "catering":
                        arguments["role"] = "catering"
                    response = handle_request(self.store, {
                        "id": req_id,
                        "method": "tools/call",
                        "params": {"name": name, "arguments": arguments},
                    })
                    self._send_json(200, response)
                    return
                raise GuardianError("NOT_FOUND", "Unsupported MCP JSON-RPC method.", 404)

            if path == "/api/agents/run":
                self._require_role(role, "owner")
                agent_role = payload.get("role")
                if agent_role not in ("invitations", "catering"):
                    raise GuardianError("INVALID_REQUEST", "role must be invitations or catering.", 400)
                if not os.environ.get("GEMINI_API_KEY", ""):
                    raise GuardianError(
                        "ROLE_AGENT_UNAVAILABLE",
                        "GEMINI_API_KEY is not configured.",
                        503,
                    )
                try:
                    token_name = "INVITATIONS_TOKEN" if agent_role == "invitations" else "CATERING_TOKEN"
                    url_name = "INVITATIONS_MCP_URL" if agent_role == "invitations" else "CATERING_MCP_URL"
                    agent_env = {
                        name: os.environ[name]
                        for name in ("PATH", "PYTHONPATH", "GUARDIAN_ENV_FILE", "GEMINI_API_KEY", token_name, url_name)
                        if name in os.environ
                    }
                    process = subprocess.run(
                        [sys.executable, "-m", "backend.live_agents", "--role", agent_role],
                        cwd=Path(__file__).resolve().parent.parent,
                        env=agent_env,
                        capture_output=True,
                        text=True,
                        timeout=60,
                        check=False,
                    )
                    if process.returncode != 0:
                        raise RuntimeError(f"Role agent process exited with status {process.returncode}.")
                    result = json.loads(process.stdout)
                except (OSError, subprocess.TimeoutExpired, TimeoutError, urllib.error.URLError, json.JSONDecodeError, RuntimeError) as error:
                    raise GuardianError(
                        "ROLE_AGENT_UNAVAILABLE",
                        f"Role agent could not complete its isolated MCP/model request ({type(error).__name__}).",
                        503,
                    ) from error
                self._send_json(201, result)
                return

            if path == "/api/imap/poll":
                self._require_role(role, "owner")
                self._send_json(200, {"processed": poll_vendor_mailbox(self.store)})
                return

            if path == "/api/chat":
                message = str(payload.get("message", ""))
                reply = advisor.get_chat(self.store, message)
                self._send_json(200, {"reply": reply})
                return

            if path == "/api/evidence/replies":
                self._require_role(role, "vendor")
                if set(payload) != {"token", "decision"}:
                    result = self.store.submit_vendor_reply(
                        principal_id, payload.get("token"), None
                    )
                else:
                    result = self.store.submit_vendor_reply(
                        principal_id, payload["token"], payload["decision"]
                    )
                self._send_json(201 if result["outcome"] == "ACCEPTED" else 202, result)
                return

            if path == "/api/actions":
                if role not in ("invitations", "catering"):
                    raise GuardianError("AGENT_REQUIRED", "Only an agent may propose an action.", 403)
                if not isinstance(payload.get("type"), str) or not isinstance(payload.get("params"), dict):
                    raise GuardianError("INVALID_REQUEST", "Expected string type and object params.", 400)
                required = payload.get("required", False)
                if not isinstance(required, bool):
                    raise GuardianError("INVALID_REQUEST", "required must be a boolean.", 400)
                result = self.store.create_action(
                    principal_id,
                    payload["type"],
                    payload["params"],
                    required,
                )
                self._send_json(201, result)
                return

            if path == "/api/facts/proposals":
                if role not in ("invitations", "catering"):
                    raise GuardianError("AGENT_REQUIRED", "Only an agent may propose a fact change.", 403)
                fact_id = payload.get("fact_id")
                reason = payload.get("reason", "")
                if not isinstance(fact_id, str) or "value" not in payload or not isinstance(reason, str):
                    raise GuardianError("INVALID_REQUEST", "fact_id, value, and reason are required.", 400)
                self._send_json(201, self.store.propose_fact_change(principal_id, fact_id, payload["value"], reason))
                return

            proposal_match = re.fullmatch(r"/api/facts/proposals/([0-9a-f-]+)/(accept|reject)", path)
            if proposal_match:
                self._require_role(role, "owner")
                self._send_json(
                    200,
                    self.store.resolve_fact_proposal(
                        principal_id, proposal_match.group(1), proposal_match.group(2) == "accept"
                    ),
                )
                return

            dispatch_match = re.fullmatch(r"/api/actions/([0-9a-f-]+)/dispatch", path)
            if dispatch_match:
                if role not in ("owner", "invitations", "catering"):
                    raise GuardianError("SCOPE", "Principal cannot dispatch to local mail catcher.", 403)
                revision = payload.get("revision")
                simulate_timeout = bool(payload.get("simulate_timeout", False))
                if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                    raise GuardianError("INVALID_REQUEST", "revision must be a positive integer.", 400)
                self._send_json(
                    201,
                    self.store.dispatch_to_local_catcher(
                        principal_id, dispatch_match.group(1), revision, simulate_timeout
                    ),
                )
                return

            reconcile_match = re.fullmatch(r"/api/outbound/([0-9a-f-]+)/reconcile", path)
            if reconcile_match:
                self._require_role(role, "owner")
                found = payload.get("found", True)
                if not isinstance(found, bool):
                    raise GuardianError("INVALID_REQUEST", "found must be a boolean.", 400)
                self._send_json(200, self.store.reconcile_outbound(principal_id, reconcile_match.group(1), found))
                return

            fact_match = re.fullmatch(r"/api/facts/(.+)", path)
            if fact_match:
                self._require_role(role, "owner")
                if "value" not in payload:
                    raise GuardianError("INVALID_REQUEST", "A value field is required.", 400)
                result = self.store.change_fact(principal_id, fact_match.group(1), payload["value"])
                self._send_json(200, result)
                return

            approval_match = re.fullmatch(r"/api/actions/([0-9a-f-]+)/approve", path)
            if approval_match:
                self._require_role(role, "owner")
                revision = payload.get("revision")
                if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                    raise GuardianError("INVALID_REQUEST", "revision must be a positive integer.", 400)
                expires_at = payload.get("expires_at")
                if expires_at is not None and not isinstance(expires_at, str):
                    raise GuardianError("INVALID_REQUEST", "expires_at must be an ISO timestamp string.", 400)
                self._send_json(
                    201,
                    self.store.approve_action(
                        principal_id, approval_match.group(1), revision, expires_at
                    ),
                )
                return

            revoke_match = re.fullmatch(r"/api/actions/([0-9a-f-]+)/revoke", path)
            if revoke_match:
                self._require_role(role, "owner")
                revision = payload.get("revision")
                reason = payload.get("reason", "")
                if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                    raise GuardianError("INVALID_REQUEST", "revision must be a positive integer.", 400)
                self._send_json(
                    200,
                    self.store.revoke_approval(
                        principal_id, revoke_match.group(1), revision, reason
                    ),
                )
                return

            rejection_match = re.fullmatch(r"/api/actions/([0-9a-f-]+)/reject", path)
            if rejection_match:
                self._require_role(role, "owner")
                revision = payload.get("revision")
                reason = payload.get("reason")
                if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                    raise GuardianError("INVALID_REQUEST", "revision must be a positive integer.", 400)
                if not isinstance(reason, str) or not reason.strip():
                    raise GuardianError("INVALID_REQUEST", "A rejection reason is required.", 400)
                self._send_json(
                    201,
                    self.store.reject_action(
                        principal_id, rejection_match.group(1), revision, reason
                    ),
                )
                return

            revision_match = re.fullmatch(r"/api/actions/([0-9a-f-]+)/revisions", path)
            if revision_match:
                if role not in ("invitations", "catering"):
                    raise GuardianError("AGENT_REQUIRED", "Only an agent may revise an action.", 403)
                if not isinstance(payload.get("params"), dict):
                    raise GuardianError("INVALID_REQUEST", "params must be a JSON object.", 400)
                self._send_json(
                    201,
                    self.store.create_revision(principal_id, revision_match.group(1), payload["params"]),
                )
                return

            claim_match = re.fullmatch(r"/api/actions/([0-9a-f-]+)/claim", path)
            if claim_match:
                revision = payload.get("revision")
                if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                    raise GuardianError("INVALID_REQUEST", "revision must be a positive integer.", 400)
                result = self.store.claim_action(principal_id, claim_match.group(1), revision)
                self._send_json(200 if result.get("outcome") == "DENY" else 202, result)
                return

            if path == "/api/killswitch":
                self._require_role(role, "owner")
                enabled = payload.get("enabled")
                if not isinstance(enabled, bool):
                    raise GuardianError("INVALID_REQUEST", "enabled must be a boolean.", 400)
                self._send_json(200, self.store.set_kill_switch(principal_id, enabled))
                return

            if path == "/api/review/dispositions":
                self._require_role(role, "owner")
                disposition = payload.get("disposition")
                reason = payload.get("reason", "")
                if not isinstance(disposition, str) or not isinstance(reason, str):
                    raise GuardianError("INVALID_REQUEST", "disposition and reason must be strings.", 400)
                self._send_json(201, self.store.record_review_disposition(principal_id, disposition, reason))
                return

            review_task_match = re.fullmatch(r"/api/review/tasks/([0-9a-f-]+)/resolve", path)
            if review_task_match:
                self._require_role(role, "owner")
                self._send_json(200, self.store.resolve_review_task(principal_id, review_task_match.group(1)))
                return

            if path == "/api/workspace/clear":
                self._require_role(role, "owner")
                self._send_json(200, self.store.clear_workspace(principal_id))
                return

            if path == "/api/workspace/rename":
                self._require_role(role, "owner")
                name = payload.get("name")
                if not isinstance(name, str):
                    raise GuardianError("INVALID_REQUEST", "name must be a string.", 400)
                self._send_json(200, self.store.rename_workspace(principal_id, name))
                return

            if path == "/api/facts":
                self._require_role(role, "owner")
                fact_id = payload.get("id")
                if not isinstance(fact_id, str) or "value" not in payload:
                    raise GuardianError("INVALID_REQUEST", "id and value are required.", 400)
                self._send_json(201, self.store.create_fact(principal_id, fact_id, payload["value"]))
                return

            if path == "/api/obligations":
                self._require_role(role, "owner")
                name = payload.get("name")
                fact_id = payload.get("fact_id")
                vendor_name = payload.get("vendor_name")
                vendor_email = payload.get("vendor_email", "vendor@vendor.test")
                if (
                    not isinstance(name, str)
                    or not isinstance(fact_id, str)
                    or not isinstance(vendor_name, str)
                    or not isinstance(vendor_email, str)
                ):
                    raise GuardianError("INVALID_REQUEST", "Invalid obligation payload.", 400)
                self._send_json(
                    201, self.store.create_obligation(principal_id, name, fact_id, vendor_name, vendor_email)
                )
                return

            if path == "/api/workspace/setup":
                self._require_role(role, "owner")
                name = payload.get("name")
                venue = payload.get("venue")
                event_start = payload.get("event_start")
                headcount = payload.get("headcount")
                budget_cap = payload.get("budget_cap")
                vendor_name = payload.get("vendor_name", "")
                if (
                    not isinstance(name, str)
                    or not isinstance(venue, str)
                    or not isinstance(event_start, str)
                    or not isinstance(headcount, int)
                    or isinstance(headcount, bool)
                    or not isinstance(budget_cap, int)
                    or isinstance(budget_cap, bool)
                    or not isinstance(vendor_name, str)
                ):
                    raise GuardianError("INVALID_REQUEST", "Invalid workspace setup payload.", 400)
                self._send_json(
                    200,
                    self.store.setup_workspace(
                        principal_id, name, venue, event_start, headcount, budget_cap, vendor_name
                    ),
                )
                return

            raise GuardianError("NOT_FOUND", "Route was not found.", 404)
        except GuardianError as error:
            if (
                error.code in ("INVALID_JSON", "INVALID_REQUEST")
                and urlparse(self.path).path == "/api/evidence/replies"
            ):
                try:
                    principal_id, role = self._principal()
                except GuardianError as auth_error:
                    self._send_error(auth_error)
                    return
                if role == "vendor":
                    try:
                        result = self.store.submit_vendor_reply(principal_id, None, None)
                    except GuardianError as reply_error:
                        self._send_error(reply_error)
                        return
                    self._send_json(202, result)
                    return
            self._send_error(error)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_error(GuardianError("INVALID_JSON", "Request body must be valid JSON.", 400))

    def _principal(self) -> tuple[str, str]:
        header = self.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise GuardianError("UNAUTHENTICATED", "A bearer token is required.", 401)
        supplied = header[7:]
        for role, (token, principal_id) in self.tokens.items():
            if hmac.compare_digest(supplied, token):
                return principal_id, role
        raise GuardianError("UNAUTHENTICATED", "Bearer token is invalid.", 401)

    @staticmethod
    def _require_role(actual: str, expected: str) -> None:
        if actual != expected:
            code = f"{expected.upper()}_REQUIRED"
            message = (
                "This operation is restricted to the event owner."
                if expected == "owner"
                else f"This operation is restricted to the {expected} role."
            )
            raise GuardianError(code, message, 403)

    def _body(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise GuardianError("INVALID_CONTENT_LENGTH", "Content-Length must be an integer.", 400) from error
        if length < 0 or length > self.max_body_bytes:
            raise GuardianError("BODY_TOO_LARGE", "Request body exceeds the allowed size.", 413)
        raw = self.rfile.read(length)

        def reject_non_json_constant(value: str) -> None:
            raise ValueError(f"{value} is not valid JSON.")

        try:
            payload = json.loads(raw or b"{}", parse_constant=reject_non_json_constant)
        except (ValueError, UnicodeDecodeError) as error:
            raise GuardianError("INVALID_JSON", "Request body must be valid JSON.", 400) from error
        if not isinstance(payload, dict):
            raise GuardianError("INVALID_REQUEST", "Request body must be a JSON object.", 400)
        return payload

    def _send_json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, error: GuardianError) -> None:
        body: dict[str, Any] = {"error": error.code, "message": error.message}
        if error.next_step:
            body["next_step"] = error.next_step
        self._send_json(error.status, body)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}", file=sys.stderr)


def serve() -> None:
    env_file = load_local_env()
    validate_integration_config()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    tokens = configured_tokens()
    if host not in ("127.0.0.1", "localhost", "::1"):
        if os.environ.get("GUARDIAN_ALLOW_PUBLIC_NETWORK") != "true":
            raise RuntimeError(
                "Refusing a public bind. Set HOST=127.0.0.1 or explicitly set "
                "GUARDIAN_ALLOW_PUBLIC_NETWORK=true behind a TLS reverse proxy."
            )
    if os.environ.get("GUARDIAN_ALLOW_PUBLIC_NETWORK") == "true":
        if os.environ.get("GUARDIAN_PRODUCTION_TLS") != "true":
            raise RuntimeError(
                "Public API binding requires GUARDIAN_PRODUCTION_TLS=true "
                "and an external TLS terminator."
            )
    server = GuardianHTTPServer((host, port), GuardianHandler)
    seed_demo = os.environ.get("GUARDIAN_SEED_DEMO", "false").lower() == "true"
    server.store = GuardianStore(seed_demo=seed_demo)
    server.tokens = tokens
    if os.environ.get("IMAP_HOST", "").strip():
        threading.Thread(
            target=polling_loop,
            args=(server.store,),
            name="guardian-imap-poller",
            daemon=True,
        ).start()
    print(f"Event Guardian API listening on http://{host}:{port}")
    if env_file:
        print(f"Loaded local server configuration from {env_file}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Event Guardian API.")
    finally:
        server.server_close()


def show_config_status() -> None:
    env_file = load_local_env()
    tokens = configured_tokens()
    del tokens
    print(f"Local environment file: {'loaded' if env_file else 'not found'}")
    for name in (
        "GEMINI_API_KEY",
        "SMTP_HOST",
        "SMTP_USER",
        "IMAP_HOST",
        "IMAP_USER",
    ):
        print(f"{name}: {'configured' if os.environ.get(name) else 'not configured'}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "init-env":
        env_file = initialize_local_env()
        print(f"Created owner-readable credentials at {env_file}; values were not printed.")
    elif len(sys.argv) > 1 and sys.argv[1] == "config-status":
        show_config_status()
    elif len(sys.argv) > 1 and sys.argv[1] == "serve":
        serve()
    elif len(sys.argv) > 1 and sys.argv[1] == "reset":
        load_local_env()
        db_path = Path(os.environ.get("DB_PATH", Path(__file__).parent / "data" / "guardian.sqlite3"))
        if db_path.exists():
            db_path.unlink()
        seed_demo = os.environ.get("GUARDIAN_SEED_DEMO", "true").lower() == "true"
        GuardianStore(db_path, seed_demo=seed_demo)
        print(f"Reset {'seeded demo' if seed_demo else 'empty workspace'} database at {db_path}")
    else:
        raise SystemExit("Usage: python -m backend.api [serve|reset]")
