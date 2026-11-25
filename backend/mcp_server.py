from __future__ import annotations

import json
import sys
from typing import Any

from backend.guardian import GuardianError, GuardianStore

TOOLS = [
    {
        "name": "get_context",
        "description": "Read scoped event facts, open obligations, and current actions for a role agent.",
        "inputSchema": {
            "type": "object",
            "properties": {"role": {"type": "string", "enum": ["invitations", "catering"]}},
            "required": ["role"],
        },
    },
    {
        "name": "propose_action",
        "description": "Propose a new action revision bound to current confirmed fact versions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "type": {"type": "string"},
                "params": {"type": "object"},
                "required": {"type": "boolean"},
            },
            "required": ["role", "type", "params"],
        },
    },
    {
        "name": "revise_action",
        "description": "Create a new revision for an existing action against current facts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "action_id": {"type": "string"},
                "params": {"type": "object"},
            },
            "required": ["role", "action_id", "params"],
        },
    },
    {
        "name": "execute_action",
        "description": "Request a guarded execution claim from the deterministic gateway.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "action_id": {"type": "string"},
                "revision": {"type": "integer"},
            },
            "required": ["role", "action_id", "revision"],
        },
    },
    {
        "name": "propose_fact_change",
        "description": "Submit a non-owner fact change proposal for organizer review.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "fact_id": {"type": "string"},
                "value": {},
                "reason": {"type": "string"},
            },
            "required": ["role", "fact_id", "value"],
        },
    },
    {
        "name": "get_review",
        "description": "Run the read-only server-side reviewer for budget, drift, and policy checks.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _principal_for_role(role: str) -> str:
    if role == "invitations":
        return "invitations-agent"
    if role == "catering":
        return "catering-agent"
    raise GuardianError("SCOPE", f"Unsupported agent role: {role}", 403)


def call_tool(store: GuardianStore, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "get_context":
        role = args.get("role", "")
        principal = _principal_for_role(role)
        state = store.state()
        readiness = store.readiness()
        # Scope out sponsor.amount for invitations role
        facts = [
            f for f in state["facts"]
            if not (role == "invitations" and f["id"] == "sponsor.amount")
        ]
        actions = [a for a in state["actions"] if a["proposed_by"] == principal]
        return {
            "workspace_name": state.get("workspace_name"),
            "kill_switch": state["kill_switch"],
            "facts": facts,
            "actions": actions,
            "open_obligations": readiness["open_obligations"],
        }
    if name == "propose_action":
        principal = _principal_for_role(args.get("role", ""))
        return store.create_action(principal, args["type"], args["params"], bool(args.get("required", False)))
    if name == "revise_action":
        principal = _principal_for_role(args.get("role", ""))
        return store.create_revision(principal, args["action_id"], args["params"])
    if name == "execute_action":
        principal = _principal_for_role(args.get("role", ""))
        return store.claim_action(principal, args["action_id"], int(args["revision"]))
    if name == "propose_fact_change":
        principal = _principal_for_role(args.get("role", ""))
        return store.propose_fact_change(principal, args["fact_id"], args["value"], str(args.get("reason", "")))
    if name == "get_review":
        return store.evaluate_review()
    raise GuardianError("UNKNOWN_TOOL", f"Unknown MCP tool: {name}", 404)


def handle_request(store: GuardianStore, request: dict[str, Any]) -> dict[str, Any] | None:
    req_id = request.get("id")
    method = request.get("method")
    params = request.get("params") or {}
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "event-guardian-mcp", "version": "0.1.0"},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        try:
            result = call_tool(store, params.get("name", ""), params.get("arguments") or {})
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"content": [{"type": "text", "text": json.dumps(result)}]},
            }
        except GuardianError as error:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "isError": True,
                    "content": [{"type": "text", "text": json.dumps({"error": error.code, "message": error.message})}],
                },
            }
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}


def serve_stdio() -> None:
    store = GuardianStore(seed_demo=False)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        response = handle_request(store, request)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    serve_stdio()
