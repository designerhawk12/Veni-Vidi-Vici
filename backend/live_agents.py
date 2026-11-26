from __future__ import annotations

import asyncio
import json
import os
import urllib.request
from typing import Any

def _gemini_text(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 256},
    }).encode("utf-8")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.0-flash:generateContent"
    )
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        payload = json.loads(response.read())
    return payload["candidates"][0]["content"]["parts"][0]["text"].strip()


async def _call_role_tool(role: str, tool: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as error:
        raise RuntimeError("Install requirements.txt to enable official MCP client support") from error

    token_name = "INVITATIONS_TOKEN" if role == "invitations" else "CATERING_TOKEN"
    token = os.environ.get(token_name, "")
    if len(token) < 32:
        raise RuntimeError(f"{token_name} is not configured with a valid role token")
    default_port = "8010" if role == "invitations" else "8011"
    url_name = "INVITATIONS_MCP_URL" if role == "invitations" else "CATERING_MCP_URL"
    url = os.environ.get(url_name, f"http://127.0.0.1:{default_port}/mcp")
    async with streamablehttp_client(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
        sse_read_timeout=30,
    ) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool, arguments or {})
            if result.isError:
                details = "; ".join(
                    item.text for item in result.content if hasattr(item, "text")
                )
                raise RuntimeError(f"Role MCP tool {tool} failed: {details}")
            texts = [item.text for item in result.content if hasattr(item, "text")]
            if not texts:
                raise RuntimeError(f"Role MCP tool {tool} returned no JSON result")
            return json.loads(texts[0])


def run_role_agent(role: str) -> dict[str, Any]:
    """Run one bounded, fresh-session agent that only acts through its MCP server."""
    if role not in ("invitations", "catering"):
        raise ValueError("role must be invitations or catering")
    if not os.environ.get("GEMINI_API_KEY", ""):
        raise RuntimeError("GEMINI_API_KEY is not configured")

    context = asyncio.run(_call_role_tool(role, "get_context"))
    prompt = (
        f"You are the isolated {role} agent for a synthetic event. "
        "Use only the supplied context and return JSON with keys "
        '"action_type" and "params". For invitations use only '
        "send_invitation_batch. For catering use send_catering_update or "
        "reserve_budget. Never approve, execute, or claim success. "
        f"Context: {json.dumps(context, sort_keys=True)}"
    )
    raw = _gemini_text(prompt)
    raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
    proposal = json.loads(raw)
    action_type = proposal.get("action_type")
    params = proposal.get("params")
    if not isinstance(action_type, str) or not isinstance(params, dict):
        raise RuntimeError("live agent returned an invalid proposal")
    allowed = (
        {"send_invitation_batch"}
        if role == "invitations"
        else {"send_catering_update", "reserve_budget"}
    )
    if action_type not in allowed:
        raise RuntimeError("live agent proposed an action outside its role")
    return asyncio.run(_call_role_tool(role, "propose_action", {
        "type": action_type,
        "params": params,
        "required": False,
    }))


if __name__ == "__main__":
    import argparse

    from backend.api import load_local_env

    parser = argparse.ArgumentParser()
    parser.add_argument("--role", choices=("invitations", "catering"), required=True)
    args = parser.parse_args()
    token_name = "INVITATIONS_TOKEN" if args.role == "invitations" else "CATERING_TOKEN"
    url_name = "INVITATIONS_MCP_URL" if args.role == "invitations" else "CATERING_MCP_URL"
    load_local_env({"GEMINI_API_KEY", token_name, url_name})
    print(json.dumps(run_role_agent(args.role), sort_keys=True))
