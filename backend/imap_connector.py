from __future__ import annotations

import imaplib
import os
import re
import time
from email import policy
from email.parser import BytesParser

from backend.guardian import GuardianStore


CORRELATION_RE = re.compile(r"\bmsg-[A-Za-z0-9-]+\b")


def parse_vendor_message(raw: bytes) -> tuple[str, str] | None:
    message = BytesParser(policy=policy.default).parsebytes(raw)
    subject = str(message.get("Subject", ""))
    token_match = CORRELATION_RE.search(subject)
    if not token_match:
        return None

    plain_parts: list[str] = []
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_type() == "text/plain" and not part.get_content_disposition():
                content = part.get_content()
                if isinstance(content, str):
                    plain_parts.append(content)
    elif message.get_content_type() == "text/plain":
        content = message.get_content()
        if isinstance(content, str):
            plain_parts.append(content)

    decisions = [
        line.strip().upper()
        for part in plain_parts
        for line in part.splitlines()
        if line.strip() and not line.lstrip().startswith(">")
    ]
    decision = next((line for line in decisions if line in ("CONFIRM", "DECLINE")), None)
    if decision is None:
        return None
    return token_match.group(0), decision


def poll_vendor_mailbox(store: GuardianStore) -> list[dict[str, object]]:
    host = os.environ.get("IMAP_HOST", "").strip()
    if not host:
        return []

    username = os.environ.get("IMAP_USER", "")
    password = os.environ.get("IMAP_PASSWORD", "")
    mailbox = os.environ.get("IMAP_MAILBOX", "INBOX")
    port = int(os.environ.get("IMAP_PORT", "993"))
    ssl = os.environ.get("IMAP_USE_SSL", "true").lower() == "true"
    if not ssl:
        raise RuntimeError("IMAP_USE_SSL must be true; plaintext IMAP is not supported.")
    timeout = float(os.environ.get("IMAP_TIMEOUT_SECONDS", "10"))

    client = imaplib.IMAP4_SSL(host, port, timeout=timeout)
    try:
        client.login(username, password)
        status, _ = client.select(mailbox)
        if status != "OK":
            raise imaplib.IMAP4.error("Could not select configured IMAP mailbox.")
        status, ids = client.search(None, "UNSEEN")
        if status != "OK":
            raise imaplib.IMAP4.error("IMAP search for unseen messages failed.")
        results: list[dict[str, object]] = []
        for message_id in ids[0].split():
            status, data = client.fetch(message_id, "(RFC822)")
            if status != "OK" or not data:
                raise imaplib.IMAP4.error("Could not fetch an unseen IMAP message.")
            raw = data[0][1]
            parsed = parse_vendor_message(raw)
            if not parsed:
                continue
            token, decision = parsed
            result = store.submit_vendor_reply("catering-vendor", token, decision)
            results.append({"message_id": message_id.decode(), "result": result})
            status, _ = client.store(message_id, "+FLAGS", "\\Seen")
            if status != "OK":
                raise imaplib.IMAP4.error("Could not mark processed IMAP message as seen.")
        return results
    finally:
        try:
            client.logout()
        except (imaplib.IMAP4.error, OSError):
            pass


def polling_loop(store: GuardianStore) -> None:
    interval = max(30, int(os.environ.get("IMAP_POLL_INTERVAL_SECONDS", "60")))
    while True:
        try:
            processed = poll_vendor_mailbox(store)
            if processed:
                print(f"IMAP poll processed {len(processed)} vendor replies.")
        except (imaplib.IMAP4.error, OSError, TimeoutError, ValueError) as error:
            print(f"IMAP poll failed ({type(error).__name__}); retrying in {interval} seconds.")
        time.sleep(interval)


if __name__ == "__main__":
    import json

    from backend.api import load_local_env

    load_local_env()
    print(json.dumps({"processed": poll_vendor_mailbox(GuardianStore(seed_demo=True))}, sort_keys=True))
