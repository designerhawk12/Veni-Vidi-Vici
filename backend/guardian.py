from __future__ import annotations

import hashlib
import json
import math
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


WORKSPACE_ID = "techmeet-test"
DEFAULT_DB_PATH = Path(__file__).parent / "data" / "guardian.sqlite3"

TEMPLATES: dict[str, dict[str, Any]] = {
    "send_invitation_batch": {
        "dependencies": ("venue.address", "event.start", "guest_list.version"),
        "roles": ("invitations",),
        "protected": True,
    },
    "send_catering_update": {
        "dependencies": ("venue.address", "headcount", "event.start", "menu.version"),
        "roles": ("catering",),
        "protected": True,
    },
    "reconcile_sponsor_receipt": {
        "dependencies": ("sponsor.amount",),
        "roles": ("invitations", "catering"),
        "protected": False,
    },
}

SCHEMA = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kill_switch INTEGER NOT NULL DEFAULT 0 CHECK (kill_switch IN (0, 1))
);

CREATE TABLE IF NOT EXISTS principals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  kind TEXT NOT NULL CHECK (kind IN ('owner', 'agent', 'service')),
  role TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS facts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  fact_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  status TEXT NOT NULL CHECK (status IN ('owner_confirmed', 'superseded')),
  changed_by TEXT NOT NULL REFERENCES principals(id),
  changed_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, fact_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_current
  ON facts(workspace_id, fact_id) WHERE status = 'owner_confirmed';

CREATE TABLE IF NOT EXISTS action_templates (
  type TEXT PRIMARY KEY,
  dependencies_json TEXT NOT NULL CHECK (json_valid(dependencies_json)),
  protected INTEGER NOT NULL CHECK (protected IN (0, 1))
);

CREATE TABLE IF NOT EXISTS role_allowed_actions (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  role TEXT NOT NULL,
  action_type TEXT NOT NULL REFERENCES action_templates(type),
  PRIMARY KEY (workspace_id, role, action_type)
);

CREATE TABLE IF NOT EXISTS allowlist_domains (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  domain TEXT NOT NULL,
  PRIMARY KEY (workspace_id, domain)
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL REFERENCES action_templates(type),
  proposed_by TEXT NOT NULL REFERENCES principals(id),
  current_revision INTEGER NOT NULL DEFAULT 1,
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_revisions (
  action_id TEXT NOT NULL REFERENCES actions(id),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  params_json TEXT NOT NULL CHECK (json_valid(params_json)),
  params_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'drafted', 'approved', 'stale', 'executing', 'provider_accepted',
    'unknown', 'reconciling', 'acknowledged', 'confirmed', 'failed', 'rejected'
  )),
  stale_reason TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES principals(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (action_id, revision)
);

CREATE TABLE IF NOT EXISTS action_deps (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  action_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  fact_id TEXT NOT NULL,
  fact_version INTEGER NOT NULL,
  PRIMARY KEY (action_id, revision, fact_id),
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);
CREATE INDEX IF NOT EXISTS ix_deps_by_fact
  ON action_deps(workspace_id, fact_id, fact_version);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  action_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  params_hash TEXT NOT NULL,
  bound_versions_json TEXT NOT NULL CHECK (json_valid(bound_versions_json)),
  approver TEXT NOT NULL REFERENCES principals(id),
  approved_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'invalidated', 'used', 'revoked')),
  reason TEXT,
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);
CREATE INDEX IF NOT EXISTS ix_approvals_active
  ON approvals(action_id, revision) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS execution_claims (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  action_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  approval_id TEXT REFERENCES approvals(id),
  agent_id TEXT NOT NULL REFERENCES principals(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('claimed', 'dispatched', 'completed', 'unknown', 'failed')),
  claimed_at TEXT NOT NULL,
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_live_claim
  ON execution_claims(action_id, revision)
  WHERE status IN ('claimed', 'dispatched', 'unknown');

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  event TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS revision_params_immutable
BEFORE UPDATE OF params_json, params_hash ON action_revisions
BEGIN SELECT RAISE(ABORT, 'action revision parameters are immutable'); END;
CREATE TRIGGER IF NOT EXISTS fact_value_immutable
BEFORE UPDATE OF value_json, version ON facts
BEGIN SELECT RAISE(ABORT, 'fact versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS approval_owner_only
BEFORE INSERT ON approvals
WHEN (SELECT kind FROM principals WHERE id = NEW.approver) IS NOT 'owner'
BEGIN SELECT RAISE(ABORT, 'approver must be an owner principal'); END;
"""

SEED_FACTS: dict[str, Any] = {
    "venue.address": "Venue A",
    "event.start": "2026-11-29T09:00:00+05:30",
    "guest_list.version": 1,
    "headcount": 120,
    "menu.version": 1,
    "sponsor.amount": 2500000,
}


class GuardianError(Exception):
    def __init__(self, code: str, message: str, status: int = 409, next_step: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.next_step = next_step


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> bool:
        try:
            return bool(super().__exit__(exc_type, exc_value, traceback))
        finally:
            self.close()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def canonical_params(params: dict[str, Any]) -> str:
    def normalize(value: Any) -> Any:
        if isinstance(value, str):
            return " ".join(value.split())
        if isinstance(value, float):
            if not math.isfinite(value):
                raise ValueError("Action parameters cannot contain non-finite numbers.")
            if value.is_integer():
                return int(value)
        if isinstance(value, list):
            return [normalize(item) for item in value]
        if isinstance(value, dict):
            return {key: normalize(item) for key, item in value.items()}
        return value

    normalized = normalize(params)
    if isinstance(normalized.get("recipients"), list):
        normalized["recipients"] = sorted(
            normalized["recipients"],
            key=lambda item: str(item).casefold(),
        )
    return canonical_json(normalized)


def params_digest(params: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_params(params).encode("utf-8")).hexdigest()


@contextmanager
def transaction(connection: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    connection.execute("BEGIN IMMEDIATE")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise


class GuardianStore:
    def __init__(self, db_path: str | Path | None = None):
        self.db_path = Path(db_path or os.environ.get("DB_PATH", DEFAULT_DB_PATH))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.db_path, timeout=10, isolation_level=None, factory=ClosingConnection
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)
        with self.connect() as connection, transaction(connection):
            exists = connection.execute(
                "SELECT 1 FROM workspaces WHERE id = ?", (WORKSPACE_ID,)
            ).fetchone()
            if exists:
                return
            connection.execute(
                "INSERT INTO workspaces(id, name) VALUES(?, ?)",
                (WORKSPACE_ID, "TechMeet 2026"),
            )
            principals = (
                ("owner", "owner", None),
                ("invitations-agent", "agent", "invitations"),
                ("catering-agent", "agent", "catering"),
                ("reviewer", "service", "reviewer"),
            )
            connection.executemany(
                "INSERT INTO principals(id, workspace_id, kind, role) VALUES(?, ?, ?, ?)",
                [(principal_id, WORKSPACE_ID, kind, role) for principal_id, kind, role in principals],
            )
            connection.executemany(
                "INSERT INTO action_templates(type, dependencies_json, protected) VALUES(?, ?, ?)",
                [
                    (action_type, canonical_json(config["dependencies"]), int(config["protected"]))
                    for action_type, config in TEMPLATES.items()
                ],
            )
            for action_type, config in TEMPLATES.items():
                connection.executemany(
                    "INSERT INTO role_allowed_actions(workspace_id, role, action_type) VALUES(?, ?, ?)",
                    [(WORKSPACE_ID, role, action_type) for role in config["roles"]],
                )
            connection.executemany(
                "INSERT INTO allowlist_domains(workspace_id, domain) VALUES(?, ?)",
                [(WORKSPACE_ID, "example.test"), (WORKSPACE_ID, "vendor.test")],
            )
            timestamp = utc_now()
            connection.executemany(
                """INSERT INTO facts
                   (workspace_id, fact_id, version, value_json, status, changed_by, changed_at)
                   VALUES(?, ?, 1, ?, 'owner_confirmed', 'owner', ?)""",
                [
                    (WORKSPACE_ID, fact_id, canonical_json(value), timestamp)
                    for fact_id, value in SEED_FACTS.items()
                ],
            )
            self._audit(
                connection,
                "system",
                "workspace_seeded",
                {"workspace_id": WORKSPACE_ID, "facts": sorted(SEED_FACTS)},
            )

    def _audit(
        self, connection: sqlite3.Connection, actor: str, event: str, payload: dict[str, Any]
    ) -> None:
        connection.execute(
            "INSERT INTO audit_log(workspace_id, ts, actor, event, payload_json) VALUES(?, ?, ?, ?, ?)",
            (WORKSPACE_ID, utc_now(), actor, event, canonical_json(payload)),
        )

    def current_facts(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT fact_id, version, value_json, changed_at
                   FROM facts WHERE workspace_id = ? AND status = 'owner_confirmed'
                   ORDER BY fact_id""",
                (WORKSPACE_ID,),
            ).fetchall()
            return [
                {
                    "id": row["fact_id"],
                    "version": row["version"],
                    "value": json.loads(row["value_json"]),
                    "changed_at": row["changed_at"],
                }
                for row in rows
            ]

    def change_fact(self, principal_id: str, fact_id: str, value: Any) -> dict[str, Any]:
        if not fact_id or len(fact_id) > 100:
            raise GuardianError("INVALID_FACT_ID", "Fact id must contain 1–100 characters.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            current = connection.execute(
                """SELECT version, value_json FROM facts
                   WHERE workspace_id = ? AND fact_id = ? AND status = 'owner_confirmed'""",
                (WORKSPACE_ID, fact_id),
            ).fetchone()
            if current is None:
                raise GuardianError("FACT_NOT_FOUND", "Only an existing confirmed fact can be changed.", 404)
            serialized = canonical_json(value)
            if serialized == current["value_json"]:
                raise GuardianError("UNCHANGED_FACT", "The confirmed fact already has this value.", 409)
            old_version = current["version"]
            new_version = old_version + 1
            connection.execute(
                """UPDATE facts SET status = 'superseded'
                   WHERE workspace_id = ? AND fact_id = ? AND version = ?""",
                (WORKSPACE_ID, fact_id, old_version),
            )
            connection.execute(
                """INSERT INTO facts
                   (workspace_id, fact_id, version, value_json, status, changed_by, changed_at)
                   VALUES(?, ?, ?, ?, 'owner_confirmed', ?, ?)""",
                (WORKSPACE_ID, fact_id, new_version, serialized, principal_id, utc_now()),
            )
            dependents = connection.execute(
                """SELECT d.action_id, d.revision, d.fact_version
                   FROM action_deps d
                   JOIN action_revisions r
                     ON r.action_id = d.action_id AND r.revision = d.revision
                   WHERE d.workspace_id = ? AND d.fact_id = ? AND d.fact_version < ?
                     AND r.status IN ('drafted','approved','provider_accepted','acknowledged','confirmed')""",
                (WORKSPACE_ID, fact_id, new_version),
            ).fetchall()
            for dependent in dependents:
                reason = f"{fact_id} v{dependent['fact_version']} → v{new_version}"
                connection.execute(
                    """UPDATE action_revisions SET status = 'stale', stale_reason = ?
                       WHERE action_id = ? AND revision = ?""",
                    (reason, dependent["action_id"], dependent["revision"]),
                )
                connection.execute(
                    """UPDATE approvals SET status = 'invalidated', reason = ?
                       WHERE action_id = ? AND revision = ? AND status = 'active'""",
                    (reason, dependent["action_id"], dependent["revision"]),
                )
            self._audit(
                connection,
                principal_id,
                "fact_change",
                {
                    "fact_id": fact_id,
                    "from_version": old_version,
                    "to_version": new_version,
                    "invalidated_revisions": [
                        {"action_id": item["action_id"], "revision": item["revision"]}
                        for item in dependents
                    ],
                },
            )
            return {
                "id": fact_id,
                "version": new_version,
                "value": value,
                "invalidated": [
                    {"action_id": item["action_id"], "revision": item["revision"]}
                    for item in dependents
                ],
            }

    def create_action(
        self, principal_id: str, action_type: str, params: dict[str, Any], required: bool = False
    ) -> dict[str, Any]:
        if action_type not in TEMPLATES:
            raise GuardianError("UNKNOWN_ACTION_TYPE", "Action type is not registered.", 400)
        if not isinstance(params, dict):
            raise GuardianError("INVALID_PARAMETERS", "Action parameters must be a JSON object.", 400)
        with self.connect() as connection, transaction(connection):
            principal = self._principal(connection, principal_id)
            if principal["kind"] != "agent":
                raise GuardianError("AGENT_REQUIRED", "Only an agent may propose an action.", 403)
            permitted = connection.execute(
                """SELECT 1 FROM role_allowed_actions
                   WHERE workspace_id = ? AND role = ? AND action_type = ?""",
                (WORKSPACE_ID, principal["role"], action_type),
            ).fetchone()
            if permitted is None:
                raise GuardianError("TYPE_NOT_ALLOWED", "This agent role cannot propose that action type.", 403)

            action_id = str(uuid.uuid4())
            created_at = utc_now()
            connection.execute(
                """INSERT INTO actions(id, workspace_id, type, proposed_by, required, created_at)
                   VALUES(?, ?, ?, ?, ?, ?)""",
                (action_id, WORKSPACE_ID, action_type, principal_id, int(required), created_at),
            )
            self._create_revision(connection, action_id, principal_id, params, 1, created_at)
            self._audit(
                connection,
                principal_id,
                "action_proposed",
                {"action_id": action_id, "revision": 1, "type": action_type},
            )
            return self._action_detail(connection, action_id)

    def create_revision(
        self, principal_id: str, action_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        if not isinstance(params, dict):
            raise GuardianError("INVALID_PARAMETERS", "Action parameters must be a JSON object.", 400)
        with self.connect() as connection, transaction(connection):
            principal = self._principal(connection, principal_id)
            action = connection.execute(
                "SELECT * FROM actions WHERE id = ? AND workspace_id = ?",
                (action_id, WORKSPACE_ID),
            ).fetchone()
            if action is None:
                raise GuardianError("ACTION_NOT_FOUND", "Action was not found.", 404)
            if principal["kind"] != "agent" or action["proposed_by"] != principal_id:
                raise GuardianError("SCOPE", "Only the proposing agent may revise this action.", 403)
            revision = action["current_revision"] + 1
            connection.execute(
                "UPDATE actions SET current_revision = ? WHERE id = ?",
                (revision, action_id),
            )
            self._create_revision(connection, action_id, principal_id, params, revision, utc_now())
            self._audit(
                connection,
                principal_id,
                "action_revised",
                {"action_id": action_id, "revision": revision},
            )
            return self._action_detail(connection, action_id)

    def _create_revision(
        self,
        connection: sqlite3.Connection,
        action_id: str,
        principal_id: str,
        params: dict[str, Any],
        revision: int,
        created_at: str,
    ) -> None:
        action_type = connection.execute(
            "SELECT type FROM actions WHERE id = ?", (action_id,)
        ).fetchone()["type"]
        connection.execute(
            """INSERT INTO action_revisions
               (action_id, revision, params_json, params_hash, status, idempotency_key, created_by, created_at)
               VALUES(?, ?, ?, ?, 'drafted', ?, ?, ?)""",
            (
                action_id,
                revision,
                canonical_params(params),
                params_digest(params),
                str(uuid.uuid4()),
                principal_id,
                created_at,
            ),
        )
        for fact_id in TEMPLATES[action_type]["dependencies"]:
            fact = connection.execute(
                """SELECT version FROM facts
                   WHERE workspace_id = ? AND fact_id = ? AND status = 'owner_confirmed'""",
                (WORKSPACE_ID, fact_id),
            ).fetchone()
            if fact:
                connection.execute(
                    """INSERT INTO action_deps
                       (workspace_id, action_id, revision, fact_id, fact_version)
                       VALUES(?, ?, ?, ?, ?)""",
                    (WORKSPACE_ID, action_id, revision, fact_id, fact["version"]),
                )

    def approve_action(self, principal_id: str, action_id: str, revision: int) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            action = connection.execute(
                """SELECT a.type, a.current_revision, r.params_hash, r.status
                   FROM actions a JOIN action_revisions r ON r.action_id = a.id
                   WHERE a.id = ? AND a.workspace_id = ? AND r.revision = ?""",
                (action_id, WORKSPACE_ID, revision),
            ).fetchone()
            if action is None:
                raise GuardianError("ACTION_NOT_FOUND", "Action revision was not found.", 404)
            if action["current_revision"] != revision or action["status"] != "drafted":
                raise GuardianError("APPROVAL_MISMATCH", "Only the current drafted revision can be approved.")
            versions = self._bound_versions(connection, action_id, revision)
            required_facts = TEMPLATES[action["type"]]["dependencies"]
            if any(fact_id not in versions for fact_id in required_facts):
                raise GuardianError("DEPENDENCIES_MISSING", "One or more required facts are not confirmed.", next_step="Confirm the missing facts before approval.")
            if not self._versions_are_current(connection, versions):
                raise GuardianError("STALE_FACT", "The action depends on outdated fact versions.", next_step="Create a new action revision against current facts.")
            approval_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO approvals
                   (id, workspace_id, action_id, revision, params_hash, bound_versions_json, approver, approved_at, status)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'active')""",
                (
                    approval_id,
                    WORKSPACE_ID,
                    action_id,
                    revision,
                    action["params_hash"],
                    canonical_json(versions),
                    principal_id,
                    utc_now(),
                ),
            )
            connection.execute(
                """UPDATE action_revisions SET status = 'approved'
                   WHERE action_id = ? AND revision = ?""",
                (action_id, revision),
            )
            self._audit(
                connection,
                principal_id,
                "approval",
                {"approval_id": approval_id, "action_id": action_id, "revision": revision},
            )
            return {"id": approval_id, "action_id": action_id, "revision": revision, "status": "active", "bound_versions": versions}

    def claim_action(self, principal_id: str, action_id: str, revision: int) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            principal = self._principal(connection, principal_id)
            if principal["kind"] != "agent":
                raise GuardianError("AGENT_REQUIRED", "Only an agent may request an execution claim.", 403)
            workspace = connection.execute(
                "SELECT kill_switch FROM workspaces WHERE id = ?", (WORKSPACE_ID,)
            ).fetchone()
            if workspace["kill_switch"]:
                return self._deny(connection, principal_id, action_id, revision, "KILL_SWITCH_ON", "Dispatch is disabled by the owner.")

            row = connection.execute(
                """SELECT a.type, a.current_revision, r.params_json, r.params_hash,
                          r.status, r.stale_reason, r.idempotency_key, t.protected
                   FROM actions a
                   JOIN action_revisions r ON r.action_id = a.id
                   JOIN action_templates t ON t.type = a.type
                   WHERE a.id = ? AND a.workspace_id = ? AND r.revision = ?""",
                (action_id, WORKSPACE_ID, revision),
            ).fetchone()
            if row is None:
                raise GuardianError("ACTION_NOT_FOUND", "Action revision was not found.", 404)
            permitted = connection.execute(
                """SELECT 1 FROM role_allowed_actions
                   WHERE workspace_id = ? AND role = ? AND action_type = ?""",
                (WORKSPACE_ID, principal["role"], row["type"]),
            ).fetchone()
            if permitted is None:
                return self._deny(connection, principal_id, action_id, revision, "TYPE_NOT_ALLOWED", "This agent role cannot execute that action type.")
            duplicate = connection.execute(
                "SELECT id FROM execution_claims WHERE idempotency_key = ?",
                (row["idempotency_key"],),
            ).fetchone()
            if duplicate:
                return self._deny(connection, principal_id, action_id, revision, "DUPLICATE", "This action revision already has an execution claim.", "Reconcile the existing claim; do not retry dispatch.")
            if row["current_revision"] != revision:
                return self._deny(connection, principal_id, action_id, revision, "APPROVAL_MISMATCH", "Only the current action revision may execute.")
            if row["status"] == "stale":
                return self._deny(connection, principal_id, action_id, revision, "STALE_FACT", row["stale_reason"] or "A bound fact changed.", "Create a new action revision and request owner approval.")
            if row["status"] != "approved" and row["protected"]:
                return self._deny(connection, principal_id, action_id, revision, "NO_ACTIVE_APPROVAL", "No active owner approval exists.", "Request approval for the exact current revision.")
            versions = self._bound_versions(connection, action_id, revision)
            required_facts = TEMPLATES[row["type"]]["dependencies"]
            if any(fact_id not in versions for fact_id in required_facts):
                return self._deny(connection, principal_id, action_id, revision, "DEPENDENCIES_MISSING", "One or more required facts are missing.", "Confirm all required facts before execution.")
            approval = None
            if row["protected"]:
                approval = connection.execute(
                    """SELECT * FROM approvals
                       WHERE action_id = ? AND revision = ? AND status = 'active'
                       ORDER BY approved_at DESC LIMIT 1""",
                    (action_id, revision),
                ).fetchone()
                if approval is None:
                    return self._deny(connection, principal_id, action_id, revision, "NO_ACTIVE_APPROVAL", "No active owner approval exists.", "Request approval for the exact current revision.")
                if approval["params_hash"] != row["params_hash"]:
                    return self._deny(connection, principal_id, action_id, revision, "PARAMS_CHANGED", "Current parameters differ from the approved parameters.", "Create a new revision and obtain approval.")
                if json.loads(approval["bound_versions_json"]) != versions:
                    return self._deny(connection, principal_id, action_id, revision, "APPROVAL_MISMATCH", "Approval fact versions do not match the action dependencies.")
            if not self._versions_are_current(connection, versions):
                return self._deny(connection, principal_id, action_id, revision, "STALE_FACT", "At least one bound fact is no longer current.", "Create a new action revision against current facts.")
            recipient_error = self._recipient_error(connection, json.loads(row["params_json"]))
            if recipient_error:
                return self._deny(connection, principal_id, action_id, revision, "RECIPIENT_NOT_ALLOWLISTED", recipient_error, "Use only configured test-domain recipients.")

            claim_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO execution_claims
                   (id, workspace_id, action_id, revision, approval_id, agent_id, idempotency_key, status, claimed_at)
                   VALUES(?, ?, ?, ?, ?, ?, ?, 'claimed', ?)""",
                (
                    claim_id,
                    WORKSPACE_ID,
                    action_id,
                    revision,
                    approval["id"] if approval else None,
                    principal_id,
                    row["idempotency_key"],
                    utc_now(),
                ),
            )
            connection.execute(
                """UPDATE action_revisions SET status = 'executing'
                   WHERE action_id = ? AND revision = ?""",
                (action_id, revision),
            )
            if approval:
                connection.execute(
                    "UPDATE approvals SET status = 'used' WHERE id = ?", (approval["id"],)
                )
            self._audit(
                connection,
                principal_id,
                "execution_claim",
                {"claim_id": claim_id, "action_id": action_id, "revision": revision},
            )
            return {
                "claim_id": claim_id,
                "action_id": action_id,
                "revision": revision,
                "status": "claimed",
                "dispatch_configured": False,
                "message": "Authorized claim persisted. No connector is configured and no external action was dispatched.",
            }

    def _deny(
        self,
        connection: sqlite3.Connection,
        principal_id: str,
        action_id: str,
        revision: int,
        code: str,
        message: str,
        next_step: str | None = None,
    ) -> dict[str, Any]:
        payload = {
            "action_id": action_id,
            "revision": revision,
            "code": code,
            "message": message,
        }
        if next_step:
            payload["next_step"] = next_step
        self._audit(connection, principal_id, "gateway_denial", payload)
        return {"outcome": "DENY", **payload}

    def set_kill_switch(self, principal_id: str, enabled: bool) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            connection.execute(
                "UPDATE workspaces SET kill_switch = ? WHERE id = ?",
                (int(enabled), WORKSPACE_ID),
            )
            self._audit(connection, principal_id, "kill_switch", {"enabled": enabled})
            return {"enabled": enabled}

    def state(self) -> dict[str, Any]:
        with self.connect() as connection:
            workspace = connection.execute(
                "SELECT kill_switch FROM workspaces WHERE id = ?", (WORKSPACE_ID,)
            ).fetchone()
            actions = connection.execute(
                """SELECT a.id, a.type, a.current_revision, a.required, r.status,
                          r.stale_reason, r.params_json, r.params_hash
                   FROM actions a JOIN action_revisions r
                     ON r.action_id = a.id AND r.revision = a.current_revision
                   WHERE a.workspace_id = ? ORDER BY a.created_at""",
                (WORKSPACE_ID,),
            ).fetchall()
            return {
                "workspace_id": WORKSPACE_ID,
                "kill_switch": bool(workspace["kill_switch"]),
                "facts": self.current_facts(),
                "actions": [
                    {
                        "id": row["id"],
                        "type": row["type"],
                        "revision": row["current_revision"],
                        "required": bool(row["required"]),
                        "status": row["status"],
                        "stale_reason": row["stale_reason"],
                        "parameters": json.loads(row["params_json"]),
                        "params_hash": row["params_hash"],
                    }
                    for row in actions
                ],
            }

    def audit(self, since: int = 0) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT seq, ts, actor, event, payload_json FROM audit_log
                   WHERE workspace_id = ? AND seq > ? ORDER BY seq""",
                (WORKSPACE_ID, since),
            ).fetchall()
            return [
                {
                    "seq": row["seq"],
                    "timestamp": row["ts"],
                    "actor": row["actor"],
                    "event": row["event"],
                    "payload": json.loads(row["payload_json"]),
                }
                for row in rows
            ]

    def _action_detail(self, connection: sqlite3.Connection, action_id: str) -> dict[str, Any]:
        row = connection.execute(
            """SELECT a.id, a.type, a.current_revision, a.required, r.params_json,
                      r.params_hash, r.status, r.stale_reason
               FROM actions a JOIN action_revisions r
                 ON r.action_id = a.id AND r.revision = a.current_revision
               WHERE a.id = ?""",
            (action_id,),
        ).fetchone()
        deps = self._bound_versions(connection, action_id, row["current_revision"])
        return {
            "id": row["id"],
            "type": row["type"],
            "revision": row["current_revision"],
            "required": bool(row["required"]),
            "parameters": json.loads(row["params_json"]),
            "params_hash": row["params_hash"],
            "status": row["status"],
            "stale_reason": row["stale_reason"],
            "dependencies": deps,
        }

    def _bound_versions(
        self, connection: sqlite3.Connection, action_id: str, revision: int
    ) -> dict[str, int]:
        rows = connection.execute(
            """SELECT fact_id, fact_version FROM action_deps
               WHERE workspace_id = ? AND action_id = ? AND revision = ? ORDER BY fact_id""",
            (WORKSPACE_ID, action_id, revision),
        ).fetchall()
        return {row["fact_id"]: row["fact_version"] for row in rows}

    def _versions_are_current(
        self, connection: sqlite3.Connection, versions: dict[str, int]
    ) -> bool:
        for fact_id, version in versions.items():
            row = connection.execute(
                """SELECT version FROM facts
                   WHERE workspace_id = ? AND fact_id = ? AND status = 'owner_confirmed'""",
                (WORKSPACE_ID, fact_id),
            ).fetchone()
            if row is None or row["version"] != version:
                return False
        return True

    def _recipient_error(self, connection: sqlite3.Connection, params: dict[str, Any]) -> str | None:
        recipients = params.get("recipients")
        if recipients is None and isinstance(params.get("recipient"), str) and "@" in params["recipient"]:
            recipients = [params["recipient"]]
        if recipients is None:
            return None
        if not isinstance(recipients, list) or not recipients:
            return "Recipient list must contain at least one test address."
        domains = {
            row["domain"]
            for row in connection.execute(
                "SELECT domain FROM allowlist_domains WHERE workspace_id = ?", (WORKSPACE_ID,)
            )
        }
        for recipient in recipients:
            if not isinstance(recipient, str) or recipient.count("@") != 1:
                return "Every recipient must be a valid test email address."
            domain = recipient.rsplit("@", 1)[1].lower().rstrip(".")
            if domain not in domains:
                return f"Recipient domain {domain!r} is not allowlisted."
        return None

    def _principal(self, connection: sqlite3.Connection, principal_id: str) -> sqlite3.Row:
        row = connection.execute(
            """SELECT id, kind, role FROM principals
               WHERE id = ? AND workspace_id = ? AND active = 1""",
            (principal_id, WORKSPACE_ID),
        ).fetchone()
        if row is None:
            raise GuardianError("SCOPE", "Principal is not active in this workspace.", 403)
        return row

    def _require_owner(self, connection: sqlite3.Connection, principal_id: str) -> sqlite3.Row:
        principal = self._principal(connection, principal_id)
        if principal["kind"] != "owner":
            raise GuardianError("OWNER_REQUIRED", "This operation is restricted to the event owner.", 403)
        return principal
