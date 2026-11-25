from __future__ import annotations

import concurrent.futures
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.api import GuardianHandler, GuardianHTTPServer
from backend.guardian import GuardianError, GuardianStore, canonical_params, params_digest


class GuardianStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = GuardianStore(Path(self.temp_dir.name) / "guardian.sqlite3")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def invite(self, recipient: str = "guest@example.test") -> dict:
        return self.store.create_action(
            "invitations-agent",
            "send_invitation_batch",
            {"recipients": [recipient], "venue": "Venue A"},
            required=True,
        )

    def test_hash_canonicalizes_keys_and_recipient_order(self) -> None:
        first = {"venue": " Venue   A ", "recipients": ["b@example.test", "a@example.test"], "count": 1.0}
        second = {"count": 1, "recipients": ["a@example.test", "b@example.test"], "venue": "Venue A"}
        self.assertEqual(params_digest(first), params_digest(second))
        self.assertEqual(canonical_params(first), canonical_params(second))

    def test_fact_change_invalidates_only_dependent_action_and_approval(self) -> None:
        invitation = self.invite()
        self.store.approve_action("owner", invitation["id"], 1)
        sponsor = self.store.create_action(
            "catering-agent", "reconcile_sponsor_receipt", {"receipt_id": "r-1"}
        )

        result = self.store.change_fact("owner", "venue.address", "Venue B")
        state = self.store.state()
        statuses = {action["id"]: action["status"] for action in state["actions"]}

        self.assertEqual(result["version"], 2)
        self.assertEqual(statuses[invitation["id"]], "stale")
        self.assertEqual(statuses[sponsor["id"]], "drafted")
        self.assertEqual(result["invalidated"], [{"action_id": invitation["id"], "revision": 1}])
        self.assertEqual(
            self.store.audit()[-1]["payload"]["invalidated_revisions"],
            [{"action_id": invitation["id"], "revision": 1}],
        )

    def test_owner_approval_is_bound_to_exact_revision_and_claim_is_single_use(self) -> None:
        invitation = self.invite()
        approval = self.store.approve_action("owner", invitation["id"], 1)
        self.assertEqual(approval["bound_versions"]["venue.address"], 1)

        claim = self.store.claim_action("invitations-agent", invitation["id"], 1)
        self.assertEqual(claim["status"], "claimed")
        self.assertFalse(claim["dispatch_configured"])

        duplicate = self.store.claim_action("invitations-agent", invitation["id"], 1)
        self.assertEqual(duplicate["outcome"], "DENY")
        self.assertEqual(duplicate["code"], "DUPLICATE")

    def test_stale_action_is_denied_after_fact_change(self) -> None:
        invitation = self.invite()
        self.store.approve_action("owner", invitation["id"], 1)
        self.store.change_fact("owner", "venue.address", "Venue B")

        result = self.store.claim_action("invitations-agent", invitation["id"], 1)
        self.assertEqual(result["outcome"], "DENY")
        self.assertEqual(result["code"], "STALE_FACT")

    def test_agent_cannot_approve_or_confirm_facts(self) -> None:
        invitation = self.invite()
        with self.assertRaises(GuardianError) as approval_error:
            self.store.approve_action("invitations-agent", invitation["id"], 1)
        with self.assertRaises(GuardianError) as fact_error:
            self.store.change_fact("catering-agent", "venue.address", "Venue B")
        self.assertEqual(approval_error.exception.code, "OWNER_REQUIRED")
        self.assertEqual(fact_error.exception.code, "OWNER_REQUIRED")

    def test_role_allowlist_and_kill_switch_fail_closed(self) -> None:
        with self.assertRaises(GuardianError) as role_error:
            self.store.create_action(
                "invitations-agent", "send_catering_update", {"venue": "Venue A"}
            )
        self.assertEqual(role_error.exception.code, "TYPE_NOT_ALLOWED")

        invitation = self.invite()
        self.store.approve_action("owner", invitation["id"], 1)
        self.store.set_kill_switch("owner", True)
        result = self.store.claim_action("invitations-agent", invitation["id"], 1)
        self.assertEqual(result["code"], "KILL_SWITCH_ON")

    def test_non_allowlisted_recipients_are_denied(self) -> None:
        invitation = self.invite("someone@example.com")
        self.store.approve_action("owner", invitation["id"], 1)
        result = self.store.claim_action("invitations-agent", invitation["id"], 1)
        self.assertEqual(result["code"], "RECIPIENT_NOT_ALLOWLISTED")

    def test_unknown_fact_cannot_be_confirmed_or_change_version(self) -> None:
        with self.assertRaises(GuardianError) as missing_error:
            self.store.change_fact("owner", "not.registered", "value")
        with self.assertRaises(GuardianError) as unchanged_error:
            self.store.change_fact("owner", "venue.address", "Venue A")
        self.assertEqual(missing_error.exception.code, "FACT_NOT_FOUND")
        self.assertEqual(unchanged_error.exception.code, "UNCHANGED_FACT")

    def test_concurrent_claims_persist_exactly_one_single_use_claim(self) -> None:
        invitation = self.invite()
        self.store.approve_action("owner", invitation["id"], 1)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results = list(
                executor.map(
                    lambda _: self.store.claim_action("invitations-agent", invitation["id"], 1),
                    range(2),
                )
            )

        self.assertEqual(sum(result.get("status") == "claimed" for result in results), 1)
        self.assertEqual(sum(result.get("code") == "DUPLICATE" for result in results), 1)


class GuardianApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server = GuardianHTTPServer(("127.0.0.1", 0), GuardianHandler)
        self.server.store = GuardianStore(Path(self.temp_dir.name) / "api.sqlite3")
        self.server.tokens = {
            "owner": ("o" * 40, "owner"),
            "invitations": ("i" * 40, "invitations-agent"),
            "catering": ("c" * 40, "catering-agent"),
        }
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

    def request(self, method: str, path: str, role: str | None = None, payload: dict | None = None):
        headers = {}
        data = None
        if role:
            headers["Authorization"] = f"Bearer {self.server.tokens[role][0]}"
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=3) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_owner_auth_and_agent_scope_are_enforced_over_http(self) -> None:
        status, response = self.request("GET", "/api/state")
        self.assertEqual(status, 401)
        self.assertEqual(response["error"], "UNAUTHENTICATED")

        status, response = self.request("GET", "/api/state", "invitations")
        self.assertEqual(status, 403)
        self.assertEqual(response["error"], "OWNER_REQUIRED")

        status, response = self.request("GET", "/api/state", "owner")
        self.assertEqual(status, 200)
        self.assertEqual(response["workspace_id"], "techmeet-test")

    def test_http_action_approval_and_claim_flow_does_not_dispatch(self) -> None:
        status, action = self.request(
            "POST",
            "/api/actions",
            "invitations",
            {"type": "send_invitation_batch", "params": {"recipient": "guest@example.test"}},
        )
        self.assertEqual(status, 201)

        status, approval = self.request(
            "POST",
            f"/api/actions/{action['id']}/approve",
            "owner",
            {"revision": 1},
        )
        self.assertEqual(status, 201)
        self.assertEqual(approval["bound_versions"]["venue.address"], 1)

        status, claim = self.request(
            "POST",
            f"/api/actions/{action['id']}/claim",
            "invitations",
            {"revision": 1},
        )
        self.assertEqual(status, 202)
        self.assertEqual(claim["status"], "claimed")
        self.assertFalse(claim["dispatch_configured"])


if __name__ == "__main__":
    unittest.main()
