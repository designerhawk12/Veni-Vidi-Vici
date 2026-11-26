from __future__ import annotations

import hmac
import os
from pathlib import Path

import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from mcp.server.fastmcp import FastMCP

from backend.api import load_local_env
from backend.guardian import GuardianStore
from backend.mcp_server import call_tool


load_local_env()
store = GuardianStore(seed_demo=False)
role = os.environ.get("MCP_ROLE", "").strip()
if role not in ("invitations", "catering"):
    raise RuntimeError("Set MCP_ROLE=invitations or MCP_ROLE=catering")

token_env = "INVITATIONS_TOKEN" if role == "invitations" else "CATERING_TOKEN"
required_token = os.environ.get(token_env, "")

mcp = FastMCP(
    f"event-guardian-{role}",
    instructions="Scoped event coordination tools. Never approve or confirm owner decisions.",
)


@mcp.tool()
def get_context() -> dict:
    return call_tool(store, "get_context", {"role": role})


@mcp.tool()
def propose_action(action_type: str, params: dict, required: bool = False) -> dict:
    return call_tool(store, "propose_action", {
        "role": role,
        "type": action_type,
        "params": params,
        "required": required,
    })


@mcp.tool()
def revise_action(action_id: str, params: dict) -> dict:
    return call_tool(store, "revise_action", {
        "role": role,
        "action_id": action_id,
        "params": params,
    })


@mcp.tool()
def list_obligations() -> dict:
    return call_tool(store, "list_obligations", {"role": role})


@mcp.tool()
def claim_status(claim: str) -> dict:
    return call_tool(store, "claim_status", {"role": role, "claim": claim})


@mcp.tool()
def reserve_budget(amount: int, category: str = "event-reservation") -> dict:
    return call_tool(store, "reserve_budget", {
        "role": role,
        "amount": amount,
        "category": category,
    })


@mcp.tool()
def get_goals() -> dict:
    return call_tool(store, "get_goals", {"role": role})


@mcp.tool()
def get_review() -> dict:
    return call_tool(store, "get_review", {})


class BearerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not required_token or len(required_token) < 32:
            return JSONResponse(
                {"error": "MCP_UNCONFIGURED", "message": f"{token_env} must contain at least 32 characters."},
                status_code=503,
            )
        header = request.headers.get("Authorization", "")
        supplied = header.removeprefix("Bearer ").strip()
        if not header.startswith("Bearer ") or not hmac.compare_digest(supplied, required_token):
            return JSONResponse(
                {"error": "UNAUTHENTICATED", "message": "A valid role bearer token is required."},
                status_code=401,
            )
        return await call_next(request)


app = mcp.streamable_http_app()
app.add_middleware(BearerMiddleware)


if __name__ == "__main__":
    host = os.environ.get("MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("MCP_PORT", "8010"))
    if host not in ("127.0.0.1", "localhost", "::1") and os.environ.get("MCP_ALLOW_PRIVATE_BIND") != "true":
        raise RuntimeError("Non-loopback MCP bind requires MCP_ALLOW_PRIVATE_BIND=true on a private, unpublished network.")
    uvicorn.run(app, host=host, port=port, ws="none")
