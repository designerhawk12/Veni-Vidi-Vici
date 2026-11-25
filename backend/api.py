from __future__ import annotations

import hmac
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qs, urlparse

from backend.guardian import GuardianError, GuardianStore
from backend import advisor


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
    if any(len(token) < 32 for token in values):
        raise RuntimeError("Bearer tokens must be at least 32 characters long.")
    if len(set(values)) != len(values):
        raise RuntimeError("All bearer tokens must be distinct.")
    return configured


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
            if parsed.path == "/api/audit":
                since_values = parse_qs(parsed.query).get("since", ["0"])
                try:
                    since = max(0, int(since_values[0]))
                except ValueError as error:
                    raise GuardianError("INVALID_CURSOR", "Audit cursor must be an integer.", 400) from error
                self._send_json(200, {"items": self.store.audit(since)})
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
                self._send_json(201, self.store.approve_action(principal_id, approval_match.group(1), revision))
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
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    tokens = configured_tokens()
    server = GuardianHTTPServer((host, port), GuardianHandler)
    seed_demo = os.environ.get("GUARDIAN_SEED_DEMO", "false").lower() == "true"
    server.store = GuardianStore(seed_demo=seed_demo)
    server.tokens = tokens
    print(f"Event Guardian API listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Event Guardian API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        serve()
    elif len(sys.argv) > 1 and sys.argv[1] == "reset":
        db_path = Path(os.environ.get("DB_PATH", Path(__file__).parent / "data" / "guardian.sqlite3"))
        if db_path.exists():
            db_path.unlink()
        GuardianStore(db_path, seed_demo=False)
        print(f"Reset empty workspace database at {db_path}")
    else:
        raise SystemExit("Usage: python -m backend.api [serve|reset]")
