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
    {
        "name": "list_obligations",
        "description": "List open obligations and evidence requirements for a role.",
        "inputSchema": {
            "type": "object",
            "properties": {"role": {"type": "string", "enum": ["invitations", "catering"]}},
            "required": ["role"],
        },
    },
    {
        "name": "claim_status",
        "description": "Ask for a computed readiness claim with open requirements.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "claim": {"type": "string"},
            },
            "required": ["role", "claim"],
        },
    },
    {
        "name": "reserve_budget",
        "description": "Create and claim an atomic local budget reservation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "amount": {"type": "integer", "minimum": 1},
                "category": {"type": "string"},
            },
            "required": ["role", "amount"],
        },
    },
    {
        "name": "record_observation",
        "description": "Persist an agent observation as a claim, not verified evidence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "kind": {"type": "string"},
                "data": {"type": "object"},
            },
            "required": ["role", "kind", "data"],
        },
    },
    {
        "name": "get_goals",
        "description": "Read owner-confirmed goals and facts.",
        "inputSchema": {
            "type": "object",
            "properties": {"role": {"type": "string", "enum": ["invitations", "catering"]}},
            "required": ["role"],
        },
    },
    {
        "name": "request_review",
        "description": "Request a read-only advisory review for the current state.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "action_id": {"type": "string"},
            },
        },
    },
    {
        "name": "list_findings",
        "description": "List current role-scoped advisory findings.",
        "inputSchema": {
            "type": "object",
            "properties": {"role": {"type": "string", "enum": ["invitations", "catering"]}},
            "required": ["role"],
        },
    },
    {
        "name": "record_progress",
        "description": "Record a progress claim separately from authoritative evidence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {"type": "string", "enum": ["invitations", "catering"]},
                "task_id": {"type": "string"},
                "revision_id": {"type": "integer"},
                "observation": {"type": "string"},
            },
            "required": ["role", "task_id", "observation"],
        },
    },
    {
        "name": "recommend_priorities",
        "description": "Recommend current work order without changing assignments.",
        "inputSchema": {
            "type": "object",
            "properties": {"role": {"type": "string", "enum": ["invitations", "catering"]}},
            "required": ["role"],
        },
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
        context = {
            "workspace_name": state.get("workspace_name"),
            "kill_switch": state["kill_switch"],
            "facts": facts,
            "actions": actions,
            "open_obligations": readiness["open_obligations"],
        }
        context["token_count"] = max(1, len(json.dumps(context, sort_keys=True)) // 4)
        return context
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
    if name == "list_obligations":
        role = args.get("role", "")
        _principal_for_role(role)
        readiness = store.readiness()
        return {
            "ready": readiness["ready"],
            "open_obligations": readiness["open_obligations"],
            "pending_required_actions": readiness["pending_required_actions"],
        }
    if name == "claim_status":
        role = args.get("role", "")
        _principal_for_role(role)
        readiness = store.readiness()
        if readiness["ready"]:
            return {
                "claim": "ready",
                "answer": readiness["label"],
                "open_items": [],
                "evidence": readiness["evidence"],
            }
        open_items = [
            obligation["name"] for obligation in readiness["open_obligations"]
        ] + [
            action["reason"] or action["type"]
            for action in readiness["pending_required_actions"]
        ]
        return {
            "claim": "not_ready",
            "answer": "Refused: recorded arrangements are not ready.",
            "open_items": open_items,
            "evidence": readiness["evidence"],
        }
    if name == "reserve_budget":
        role = args.get("role", "")
        principal = _principal_for_role(role)
        amount = args.get("amount")
        if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
            raise GuardianError("INVALID_REQUEST", "amount must be a positive integer.", 400)
        category = str(args.get("category", "event-reservation"))
        action = store.create_action(
            principal,
            "reserve_budget",
            {"amount": amount, "category": category},
            required=False,
        )
        claim = store.claim_action(principal, action["id"], 1)
        return {"action": action, "reservation_claim": claim}
    if name == "record_observation":
        role = args.get("role", "")
        principal = _principal_for_role(role)
        kind = args.get("kind")
        data = args.get("data")
        if not isinstance(kind, str) or not isinstance(data, dict):
            raise GuardianError("INVALID_REQUEST", "kind and data are required.", 400)
        return store.record_agent_claim(principal, "observation", {"kind": kind, "data": data})
    if name == "get_goals":
        role = args.get("role", "")
        _principal_for_role(role)
        state = store.state()
        return {
            "workspace_name": state["workspace_name"],
            "facts": [
                fact for fact in state["facts"]
                if not (role == "invitations" and fact["id"] == "sponsor.amount")
            ],
            "review_dispositions": state["review_dispositions"],
        }
    if name == "request_review":
        role = args.get("role", "")
        _principal_for_role(role)
        return store.evaluate_review()
    if name == "list_findings":
        role = args.get("role", "")
        _principal_for_role(role)
        return store.evaluate_review()
    if name == "record_progress":
        role = args.get("role", "")
        principal = _principal_for_role(role)
        task_id = args.get("task_id")
        observation = args.get("observation")
        if not isinstance(task_id, str) or not isinstance(observation, str):
            raise GuardianError("INVALID_REQUEST", "task_id and observation are required.", 400)
        return store.record_agent_claim(
            principal,
            "progress",
            {
                "task_id": task_id,
                "revision_id": args.get("revision_id"),
                "observation": observation,
            },
        )
    if name == "recommend_priorities":
        role = args.get("role", "")
        _principal_for_role(role)
        readiness = store.readiness()
        review = store.evaluate_review()
        return {
            "recommendation": [
                {"priority": "required", "items": [
                    obligation["name"] for obligation in readiness["open_obligations"]
                ]},
                {"priority": "required", "items": [
                    action["reason"] or action["type"]
                    for action in readiness["pending_required_actions"]
                ]},
            ],
            "findings": review["findings"],
            "authority": "advisory",
        }
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
