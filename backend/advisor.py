"""
Event Guardian – LLM Advisor module
------------------------------------
Provides two functions called by api.py:
  get_insights(store)  → list of risk insight cards
  get_chat(store, message) → one assistant reply string

Both call Google Gemini (gemini-2.0-flash) if GEMINI_API_KEY is set.
When the key is absent, they return graceful placeholder responses so the
frontend still renders without any API key configured.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent?key={key}"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_context(state: dict[str, Any]) -> str:
    """Render the current event state as a compact JSON block for the prompt."""
    return json.dumps(state, ensure_ascii=False, separators=(",", ":"), indent=2)


def _call_gemini(prompt: str) -> str:
    """POST to Gemini and return the text of the first candidate."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set")

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
    }).encode("utf-8")

    url = GEMINI_URL.format(key=GEMINI_API_KEY)
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
        data = json.loads(resp.read())

    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


# ---------------------------------------------------------------------------
# Insight card generation
# ---------------------------------------------------------------------------

INSIGHTS_SYSTEM = """\
You are an event-operations risk advisor embedded in an event-management platform.
You receive the current state of an event in JSON and must return ONLY a JSON array
of 2-4 insight objects. Each object has:
  - "level": "ok" | "warning" | "critical"
  - "title": short headline (≤8 words)
  - "detail": one sentence explaining the risk or status
  - "obligation_id": the obligation id this relates to, or null

Rules:
- Base everything strictly on the data given; never invent facts.
- If readiness is fully met, include one "ok" card confirming it.
- Highlight stale evidence, unconfirmed obligations, or version mismatches.
- Output ONLY the JSON array, no markdown, no extra text.
"""


def get_insights(store: Any) -> list[dict[str, Any]]:
    """Return 2-4 insight cards for the current event state."""
    try:
        state = store.state()
        readiness = store.readiness()
        context = _build_context({"state": state, "readiness": readiness})

        prompt = f"{INSIGHTS_SYSTEM}\n\nEvent state:\n{context}\n\nInsight cards:"
        raw = _call_gemini(prompt)

        # Strip possible markdown code fences
        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        cards: list[dict[str, Any]] = json.loads(raw)

        # Validate basic shape
        valid = []
        for card in cards:
            if isinstance(card, dict) and "level" in card and "title" in card and "detail" in card:
                card.setdefault("obligation_id", None)
                card["level"] = card["level"] if card["level"] in ("ok", "warning", "critical") else "warning"
                valid.append(card)
        return valid if valid else _fallback_insights(readiness)

    except Exception:  # noqa: BLE001
        # Key missing, network error, or parse failure – return informative placeholders
        try:
            readiness = store.readiness()
        except Exception:  # noqa: BLE001
            readiness = {}
        return _fallback_insights(readiness)


def _fallback_insights(readiness: dict[str, Any]) -> list[dict[str, Any]]:
    """Static placeholders shown when no API key is configured."""
    ready = readiness.get("ready", False)
    open_count = len(readiness.get("open_obligations", []))
    cards: list[dict[str, Any]] = [
        {
            "level": "ok" if ready else "warning",
            "title": "Event readiness" if ready else f"{open_count} obligation(s) unresolved",
            "detail": (
                "All obligations are fulfilled and evidence is version-matched."
                if ready
                else "One or more obligations are still open. Check the evidence trail below."
            ),
            "obligation_id": None,
        },
        {
            "level": "warning",
            "title": "AI insights unavailable",
            "detail": "Set GEMINI_API_KEY in your environment to enable live risk analysis.",
            "obligation_id": None,
        },
    ]
    return cards


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

CHAT_SYSTEM = """\
You are an event-operations assistant embedded in Event Guardian, an event-management
platform that tracks obligations, evidence, and version-controlled facts.
You have access to the current event state (JSON) and answer questions concisely
(1-3 sentences). You never invent facts not present in the data.
If the user's question is unrelated to the event, say so politely.
"""


def get_chat(store: Any, message: str) -> str:
    """Return one assistant reply to the user's message."""
    if not message or not message.strip():
        return "Please type a question about the event."

    try:
        state = store.state()
        readiness = store.readiness()
        context = _build_context({"state": state, "readiness": readiness})

        prompt = (
            f"{CHAT_SYSTEM}\n\nCurrent event state:\n{context}\n\n"
            f"User question: {message.strip()}\n\nAssistant:"
        )
        return _call_gemini(prompt)

    except RuntimeError:
        return (
            "AI assistant is not configured. "
            "Add your GEMINI_API_KEY environment variable to enable it."
        )
    except Exception as exc:  # noqa: BLE001
        return f"Could not reach the AI service: {exc}"
