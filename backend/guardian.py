from __future__ import annotations

import hashlib
import json
import math
import os
import secrets
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
    "reserve_budget": {
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

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readiness_requirements (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  initialized INTEGER NOT NULL CHECK (initialized IN (0, 1)),
  initialized_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS obligations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  required INTEGER NOT NULL CHECK (required IN (0, 1)),
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  fact_id TEXT NOT NULL,
  required_version INTEGER NOT NULL CHECK (required_version >= 1),
  required_value_json TEXT NOT NULL CHECK (json_valid(required_value_json)),
  status TEXT NOT NULL CHECK (status IN ('open', 'confirmed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS obligation_tokens (
  token TEXT PRIMARY KEY,
  obligation_id TEXT NOT NULL REFERENCES obligations(id),
  fact_version INTEGER NOT NULL CHECK (fact_version >= 1),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  obligation_id TEXT NOT NULL REFERENCES obligations(id),
  token TEXT NOT NULL REFERENCES obligation_tokens(token),
  received_by TEXT NOT NULL REFERENCES principals(id),
  decision TEXT NOT NULL CHECK (decision IN ('CONFIRM', 'DECLINE')),
  fact_version INTEGER NOT NULL CHECK (fact_version >= 1),
  accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
  reason_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_review_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  obligation_id TEXT REFERENCES obligations(id),
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS action_rejections (
  action_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  rejected_by TEXT NOT NULL REFERENCES principals(id),
  reason TEXT NOT NULL,
  rejected_at TEXT NOT NULL,
  PRIMARY KEY (action_id, revision),
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);

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

CREATE TABLE IF NOT EXISTS review_dispositions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  disposition TEXT NOT NULL CHECK (disposition IN (
    'accepted_recommendation', 'accepted_tradeoff', 'dismissed', 'clarification_requested'
  )),
  reason TEXT NOT NULL,
  recorded_by TEXT NOT NULL REFERENCES principals(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_proposals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  fact_id TEXT NOT NULL,
  proposed_value_json TEXT NOT NULL CHECK (json_valid(proposed_value_json)),
  proposed_by TEXT NOT NULL REFERENCES principals(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'accepted', 'rejected')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_reservations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  action_id TEXT NOT NULL REFERENCES actions(id),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'released')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  action_id TEXT NOT NULL REFERENCES actions(id),
  revision INTEGER NOT NULL,
  claim_id TEXT NOT NULL REFERENCES execution_claims(id),
  correlation_token TEXT,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'unknown', 'provider_accepted', 'failed')),
  created_at TEXT NOT NULL
);

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
    def __init__(self, db_path: str | Path | None = None, seed_demo: bool = True):
        self.db_path = Path(db_path or os.environ.get("DB_PATH", DEFAULT_DB_PATH))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.seed_demo = seed_demo
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
            if not exists:
                connection.execute(
                    "INSERT INTO workspaces(id, name) VALUES(?, ?)",
                    (WORKSPACE_ID, "TechMeet 2026" if self.seed_demo else "New Workspace"),
                )
                principals = (
                    ("owner", "owner", None),
                    ("invitations-agent", "agent", "invitations"),
                    ("catering-agent", "agent", "catering"),
                    ("reviewer", "service", "reviewer"),
                    ("catering-vendor", "service", "vendor"),
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
                if self.seed_demo:
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

            connection.executemany(
                "INSERT OR IGNORE INTO action_templates(type, dependencies_json, protected) VALUES(?, ?, ?)",
                [
                    (action_type, canonical_json(config["dependencies"]), int(config["protected"]))
                    for action_type, config in TEMPLATES.items()
                ],
            )
            for action_type, config in TEMPLATES.items():
                connection.executemany(
                    "INSERT OR IGNORE INTO role_allowed_actions(workspace_id, role, action_type) VALUES(?, ?, ?)",
                    [(WORKSPACE_ID, role, action_type) for role in config["roles"]],
                )
            connection.execute(
                """INSERT OR IGNORE INTO principals(id, workspace_id, kind, role)
                   VALUES('catering-vendor', ?, 'service', 'vendor')""",
                (WORKSPACE_ID,),
            )
            connection.execute(
                """INSERT OR IGNORE INTO vendors(id, workspace_id, name, email, kind)
                   VALUES('catering-vendor', ?, 'TechMeet Catering', 'catering@vendor.test', 'catering')""",
                (WORKSPACE_ID,),
            )
            if self.seed_demo:
                created_at = utc_now()
                requirement = connection.execute(
                    """INSERT OR IGNORE INTO readiness_requirements(workspace_id, initialized, initialized_at)
                       VALUES(?, 1, ?)""",
                    (WORKSPACE_ID, created_at),
                )
                if requirement.rowcount:
                    venue = connection.execute(
                        """SELECT version, value_json FROM facts
                           WHERE workspace_id = ? AND fact_id = 'venue.address' AND status = 'owner_confirmed'""",
                        (WORKSPACE_ID,),
                    ).fetchone()
                    connection.execute(
                        """INSERT INTO obligations
                           (id, workspace_id, name, required, vendor_id, fact_id, required_version,
                            required_value_json, status, created_at, updated_at)
                           VALUES('catering-confirmation', ?, 'Catering venue confirmation', 1,
                                  'catering-vendor', 'venue.address', ?, ?, 'open', ?, ?)""",
                        (WORKSPACE_ID, venue["version"], venue["value_json"], created_at, created_at),
                    )
                    self._issue_obligation_token(connection, "catering-confirmation", venue["version"])
                    self._audit(
                        connection,
                        "system",
                        "readiness_plan_seeded",
                        {"obligations": ["catering-confirmation"]},
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
            reopened_obligations = connection.execute(
                """SELECT id FROM obligations
                   WHERE workspace_id = ? AND fact_id = ? AND required = 1""",
                (WORKSPACE_ID, fact_id),
            ).fetchall()
            for obligation in reopened_obligations:
                connection.execute(
                    """UPDATE obligations
                       SET required_version = ?, required_value_json = ?, status = 'open', updated_at = ?
                       WHERE id = ?""",
                    (new_version, serialized, utc_now(), obligation["id"]),
                )
                self._issue_obligation_token(connection, obligation["id"], new_version)
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
                    "reopened_obligations": [item["id"] for item in reopened_obligations],
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
                "reopened_obligations": [item["id"] for item in reopened_obligations],
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
                """SELECT a.type, a.current_revision, r.params_hash, r.status,
                          EXISTS(SELECT 1 FROM action_rejections x
                                 WHERE x.action_id = a.id AND x.revision = r.revision) AS rejected
                   FROM actions a JOIN action_revisions r ON r.action_id = a.id
                   WHERE a.id = ? AND a.workspace_id = ? AND r.revision = ?""",
                (action_id, WORKSPACE_ID, revision),
            ).fetchone()
            if action is None:
                raise GuardianError("ACTION_NOT_FOUND", "Action revision was not found.", 404)
            if action["current_revision"] != revision or action["status"] != "drafted" or action["rejected"]:
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

    def reject_action(
        self, principal_id: str, action_id: str, revision: int, reason: str
    ) -> dict[str, Any]:
        if not isinstance(reason, str) or not reason.strip():
            raise GuardianError("REJECTION_REASON_REQUIRED", "A rejection reason is required.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            action = connection.execute(
                """SELECT a.current_revision, r.status
                   FROM actions a JOIN action_revisions r
                     ON r.action_id = a.id AND r.revision = ?
                   WHERE a.id = ? AND a.workspace_id = ?""",
                (revision, action_id, WORKSPACE_ID),
            ).fetchone()
            if action is None:
                raise GuardianError("ACTION_NOT_FOUND", "Action revision was not found.", 404)
            if action["current_revision"] != revision or action["status"] != "drafted":
                raise GuardianError("APPROVAL_MISMATCH", "Only the current drafted revision can be rejected.")
            connection.execute(
                """INSERT INTO action_rejections
                   (action_id, revision, rejected_by, reason, rejected_at)
                   VALUES(?, ?, ?, ?, ?)""",
                (action_id, revision, principal_id, reason.strip(), utc_now()),
            )
            self._audit(
                connection,
                principal_id,
                "action_rejected",
                {"action_id": action_id, "revision": revision, "reason": reason.strip()},
            )
            return {
                "action_id": action_id,
                "revision": revision,
                "status": "rejected",
                "reason": reason.strip(),
            }

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
            parsed_params = json.loads(row["params_json"])
            recipient_error = self._recipient_error(connection, parsed_params)
            if recipient_error:
                return self._deny(connection, principal_id, action_id, revision, "RECIPIENT_NOT_ALLOWLISTED", recipient_error, "Use only configured test-domain recipients.")
            if parsed_params.get("require_closed_obligations"):
                open_ob = connection.execute(
                    "SELECT id FROM obligations WHERE workspace_id = ? AND required = 1 AND status != 'confirmed' LIMIT 1",
                    (WORKSPACE_ID,),
                ).fetchone()
                if open_ob:
                    return self._deny(connection, principal_id, action_id, revision, "OPEN_OBLIGATION", "A required obligation is still open.", "Close open obligations with verified evidence first.")
            requested_amount = parsed_params.get("amount")
            if isinstance(requested_amount, (int, float)) and not isinstance(requested_amount, bool) and requested_amount > 0:
                cap_row = connection.execute(
                    "SELECT value_json FROM facts WHERE workspace_id = ? AND fact_id = 'sponsor.amount' AND status = 'owner_confirmed'",
                    (WORKSPACE_ID,),
                ).fetchone()
                cap = json.loads(cap_row["value_json"]) if cap_row else 0
                reserved_row = connection.execute(
                    "SELECT COALESCE(SUM(amount), 0) AS total FROM budget_reservations WHERE workspace_id = ? AND status = 'active'",
                    (WORKSPACE_ID,),
                ).fetchone()
                if isinstance(cap, (int, float)) and (reserved_row["total"] + int(requested_amount)) > cap:
                    return self._deny(connection, principal_id, action_id, revision, "BUDGET_CAP_EXCEEDED", "Requested amount exceeds available budget cap.", "Reduce the amount or update the budget cap.")

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
            if row["type"] == "reserve_budget" and isinstance(requested_amount, (int, float)) and not isinstance(requested_amount, bool) and requested_amount > 0:
                connection.execute(
                    """INSERT INTO budget_reservations(id, workspace_id, action_id, amount, status, created_at)
                       VALUES(?, ?, ?, ?, 'active', ?)""",
                    (str(uuid.uuid4()), WORKSPACE_ID, action_id, int(requested_amount), utc_now()),
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

    def record_review_disposition(
        self, principal_id: str, disposition: str, reason: str = ""
    ) -> dict[str, Any]:
        valid = {
            "accepted_recommendation",
            "accepted_tradeoff",
            "dismissed",
            "clarification_requested",
        }
        if disposition not in valid:
            raise GuardianError("INVALID_DISPOSITION", "Review disposition is not valid.", 400)
        cleaned = reason.strip()
        if disposition != "accepted_recommendation" and not cleaned:
            raise GuardianError("INVALID_REQUEST", "A reason is required for this disposition.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            disposition_id = str(uuid.uuid4())
            created_at = utc_now()
            connection.execute(
                """INSERT INTO review_dispositions
                   (id, workspace_id, disposition, reason, recorded_by, created_at)
                   VALUES(?, ?, ?, ?, ?, ?)""",
                (disposition_id, WORKSPACE_ID, disposition, cleaned, principal_id, created_at),
            )
            self._audit(
                connection,
                principal_id,
                "review_disposition",
                {"disposition_id": disposition_id, "disposition": disposition, "reason": cleaned},
            )
            return {
                "id": disposition_id,
                "disposition": disposition,
                "reason": cleaned,
                "recorded_by": principal_id,
                "created_at": created_at,
            }

    def resolve_review_task(self, principal_id: str, task_id: str) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            row = connection.execute(
                """SELECT id, status FROM owner_review_tasks
                   WHERE id = ? AND workspace_id = ?""",
                (task_id, WORKSPACE_ID),
            ).fetchone()
            if row is None:
                raise GuardianError("TASK_NOT_FOUND", "Owner review task was not found.", 404)
            if row["status"] == "resolved":
                return {"id": task_id, "status": "resolved"}
            connection.execute(
                "UPDATE owner_review_tasks SET status = 'resolved' WHERE id = ?",
                (task_id,),
            )
            self._audit(connection, principal_id, "owner_review_task_resolved", {"task_id": task_id})
            return {"id": task_id, "status": "resolved"}

    def _clear_workspace_rows(self, connection: sqlite3.Connection) -> None:
        for table in (
            "outbound_messages",
            "budget_reservations",
            "execution_claims",
            "action_rejections",
            "approvals",
            "action_deps",
            "action_revisions",
            "actions",
            "evidence",
            "obligation_tokens",
            "obligations",
            "owner_review_tasks",
            "readiness_requirements",
            "review_dispositions",
            "fact_proposals",
            "facts",
        ):
            if table in ("action_rejections", "approvals", "action_revisions", "obligation_tokens"):
                if table == "obligation_tokens":
                    connection.execute("DELETE FROM obligation_tokens")
                else:
                    connection.execute(
                        f"DELETE FROM {table} WHERE action_id IN (SELECT id FROM actions WHERE workspace_id = ?)",
                        (WORKSPACE_ID,),
                    )
            else:
                connection.execute(f"DELETE FROM {table} WHERE workspace_id = ?", (WORKSPACE_ID,))

    def clear_workspace(self, principal_id: str) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            self._clear_workspace_rows(connection)
            connection.execute(
                "UPDATE workspaces SET name = 'New Workspace', kill_switch = 0 WHERE id = ?",
                (WORKSPACE_ID,),
            )
            self._audit(connection, principal_id, "workspace_cleared", {"workspace_id": WORKSPACE_ID})
            return {"workspace_id": WORKSPACE_ID, "workspace_name": "New Workspace", "empty": True}

    def setup_workspace(
        self,
        principal_id: str,
        name: str,
        venue: str,
        event_start: str,
        headcount: int,
        budget_cap: int,
        vendor_name: str = "",
    ) -> dict[str, Any]:
        if not name.strip() or not venue.strip() or not event_start.strip():
            raise GuardianError("INVALID_REQUEST", "Event name, venue, and start date are required.", 400)
        if headcount < 1 or budget_cap < 0:
            raise GuardianError("INVALID_REQUEST", "Headcount must be positive and budget non-negative.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            self._clear_workspace_rows(connection)
            connection.execute(
                "UPDATE workspaces SET name = ?, kill_switch = 0 WHERE id = ?",
                (name.strip(), WORKSPACE_ID),
            )
            timestamp = utc_now()
            facts_to_insert = {
                "venue.address": venue.strip(),
                "event.start": event_start.strip(),
                "headcount": headcount,
                "guest_list.version": 1,
                "menu.version": 1,
                "sponsor.amount": budget_cap,
            }
            connection.executemany(
                """INSERT INTO facts
                   (workspace_id, fact_id, version, value_json, status, changed_by, changed_at)
                   VALUES(?, ?, 1, ?, 'owner_confirmed', ?, ?)""",
                [
                    (WORKSPACE_ID, fact_id, canonical_json(value), principal_id, timestamp)
                    for fact_id, value in facts_to_insert.items()
                ],
            )
            if vendor_name.strip():
                connection.execute(
                    "UPDATE vendors SET name = ? WHERE id = 'catering-vendor' AND workspace_id = ?",
                    (vendor_name.strip(), WORKSPACE_ID),
                )
                connection.execute(
                    "INSERT INTO readiness_requirements(workspace_id, initialized, initialized_at) VALUES(?, 1, ?)",
                    (WORKSPACE_ID, timestamp),
                )
                connection.execute(
                    """INSERT INTO obligations
                       (id, workspace_id, name, required, vendor_id, fact_id, required_version,
                        required_value_json, status, created_at, updated_at)
                       VALUES('catering-confirmation', ?, ?, 1,
                              'catering-vendor', 'venue.address', 1, ?, 'open', ?, ?)""",
                    (
                        WORKSPACE_ID,
                        f"{vendor_name.strip()} venue confirmation",
                        canonical_json(venue.strip()),
                        timestamp,
                        timestamp,
                    ),
                )
                self._issue_obligation_token(connection, "catering-confirmation", 1)
            self._audit(
                connection,
                principal_id,
                "workspace_configured",
                {"name": name.strip(), "venue": venue.strip(), "headcount": headcount},
            )
            return {"workspace_id": WORKSPACE_ID, "workspace_name": name.strip(), "empty": False}

    def rename_workspace(self, principal_id: str, name: str) -> dict[str, Any]:
        cleaned = name.strip()
        if not cleaned or len(cleaned) > 120:
            raise GuardianError("INVALID_REQUEST", "Workspace name must be 1–120 characters.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            connection.execute(
                "UPDATE workspaces SET name = ? WHERE id = ?",
                (cleaned, WORKSPACE_ID),
            )
            self._audit(connection, principal_id, "workspace_renamed", {"name": cleaned})
            return {"workspace_id": WORKSPACE_ID, "workspace_name": cleaned}

    def create_fact(self, principal_id: str, fact_id: str, value: Any) -> dict[str, Any]:
        cleaned_id = fact_id.strip()
        if not cleaned_id or len(cleaned_id) > 100 or "/" in cleaned_id:
            raise GuardianError("INVALID_FACT_ID", "Fact id must be 1–100 characters without slashes.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            exists = connection.execute(
                "SELECT 1 FROM facts WHERE workspace_id = ? AND fact_id = ?",
                (WORKSPACE_ID, cleaned_id),
            ).fetchone()
            if exists:
                raise GuardianError("FACT_EXISTS", "This fact already exists; update it instead.", 409)
            serialized = canonical_json(value)
            connection.execute(
                """INSERT INTO facts
                   (workspace_id, fact_id, version, value_json, status, changed_by, changed_at)
                   VALUES(?, ?, 1, ?, 'owner_confirmed', ?, ?)""",
                (WORKSPACE_ID, cleaned_id, serialized, principal_id, utc_now()),
            )
            self._audit(connection, principal_id, "fact_created", {"fact_id": cleaned_id, "version": 1})
            return {"id": cleaned_id, "version": 1, "value": value}

    def create_obligation(
        self, principal_id: str, name: str, fact_id: str, vendor_name: str, vendor_email: str
    ) -> dict[str, Any]:
        cleaned_name = name.strip()
        cleaned_vendor = vendor_name.strip()
        cleaned_email = vendor_email.strip()
        if not cleaned_name or not cleaned_vendor or "@" not in cleaned_email:
            raise GuardianError("INVALID_REQUEST", "Obligation name, vendor name, and valid email are required.", 400)
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            fact = connection.execute(
                """SELECT version, value_json FROM facts
                   WHERE workspace_id = ? AND fact_id = ? AND status = 'owner_confirmed'""",
                (WORKSPACE_ID, fact_id),
            ).fetchone()
            if fact is None:
                raise GuardianError("FACT_NOT_FOUND", "Bound fact must exist before creating an obligation.", 404)
            created_at = utc_now()
            obligation_id = f"obligation-{uuid.uuid4().hex[:8]}"
            connection.execute(
                "UPDATE vendors SET name = ?, email = ? WHERE id = 'catering-vendor' AND workspace_id = ?",
                (cleaned_vendor, cleaned_email, WORKSPACE_ID),
            )
            connection.execute(
                """INSERT OR IGNORE INTO readiness_requirements(workspace_id, initialized, initialized_at)
                   VALUES(?, 1, ?)""",
                (WORKSPACE_ID, created_at),
            )
            connection.execute(
                """INSERT INTO obligations
                   (id, workspace_id, name, required, vendor_id, fact_id, required_version,
                    required_value_json, status, created_at, updated_at)
                   VALUES(?, ?, ?, 1, 'catering-vendor', ?, ?, ?, 'open', ?, ?)""",
                (
                    obligation_id,
                    WORKSPACE_ID,
                    cleaned_name,
                    fact_id,
                    fact["version"],
                    fact["value_json"],
                    created_at,
                    created_at,
                ),
            )
            token = self._issue_obligation_token(connection, obligation_id, fact["version"])
            self._audit(
                connection,
                principal_id,
                "obligation_created",
                {"obligation_id": obligation_id, "fact_id": fact_id, "version": fact["version"]},
            )
            return {"id": obligation_id, "name": cleaned_name, "correlation_token": token}

    def propose_fact_change(
        self, principal_id: str, fact_id: str, value: Any, reason: str = ""
    ) -> dict[str, Any]:
        cleaned_id = fact_id.strip()
        if not cleaned_id or len(cleaned_id) > 100:
            raise GuardianError("INVALID_FACT_ID", "Fact id must contain 1–100 characters.", 400)
        with self.connect() as connection, transaction(connection):
            principal = self._principal(connection, principal_id)
            if principal["kind"] != "agent":
                raise GuardianError("AGENT_REQUIRED", "Only an agent may propose a fact change.", 403)
            proposal_id = str(uuid.uuid4())
            created_at = utc_now()
            connection.execute(
                """INSERT INTO fact_proposals
                   (id, workspace_id, fact_id, proposed_value_json, proposed_by, reason, status, created_at)
                   VALUES(?, ?, ?, ?, ?, ?, 'open', ?)""",
                (proposal_id, WORKSPACE_ID, cleaned_id, canonical_json(value), principal_id, reason.strip(), created_at),
            )
            self._audit(
                connection,
                principal_id,
                "fact_change_proposed",
                {"proposal_id": proposal_id, "fact_id": cleaned_id},
            )
            return {
                "id": proposal_id,
                "fact_id": cleaned_id,
                "value": value,
                "proposed_by": principal_id,
                "reason": reason.strip(),
                "status": "open",
                "created_at": created_at,
            }

    def resolve_fact_proposal(self, principal_id: str, proposal_id: str, accept: bool) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            row = connection.execute(
                "SELECT * FROM fact_proposals WHERE id = ? AND workspace_id = ?",
                (proposal_id, WORKSPACE_ID),
            ).fetchone()
            if row is None:
                raise GuardianError("PROPOSAL_NOT_FOUND", "Fact proposal was not found.", 404)
            if row["status"] != "open":
                raise GuardianError("PROPOSAL_CLOSED", "Fact proposal is already resolved.", 409)
            new_status = "accepted" if accept else "rejected"
            connection.execute(
                "UPDATE fact_proposals SET status = ? WHERE id = ?",
                (new_status, proposal_id),
            )
            self._audit(
                connection,
                principal_id,
                "fact_proposal_resolved",
                {"proposal_id": proposal_id, "fact_id": row["fact_id"], "status": new_status},
            )
            fact_id = row["fact_id"]
            value = json.loads(row["proposed_value_json"])
        if accept:
            exists = any(item["id"] == fact_id for item in self.current_facts())
            if exists:
                self.change_fact(principal_id, fact_id, value)
            else:
                self.create_fact(principal_id, fact_id, value)
        return {"id": proposal_id, "status": new_status}

    def dispatch_to_local_catcher(
        self, principal_id: str, action_id: str, revision: int, simulate_timeout: bool = False
    ) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            principal = self._principal(connection, principal_id)
            if principal["kind"] not in ("agent", "owner"):
                raise GuardianError("SCOPE", "Principal cannot trigger local mail catcher dispatch.", 403)
            claim = connection.execute(
                """SELECT c.id, r.params_json, a.type
                   FROM execution_claims c
                   JOIN action_revisions r ON r.action_id = c.action_id AND r.revision = c.revision
                   JOIN actions a ON a.id = c.action_id
                   WHERE c.action_id = ? AND c.revision = ? AND c.workspace_id = ?
                   ORDER BY c.claimed_at DESC LIMIT 1""",
                (action_id, revision, WORKSPACE_ID),
            ).fetchone()
            if claim is None:
                raise GuardianError("CLAIM_REQUIRED", "An active execution claim is required before local dispatch.", 409)
            params = json.loads(claim["params_json"])
            recipients = params.get("recipients") or ([params["recipient"]] if "recipient" in params else ["local@example.test"])
            recipient = recipients[0] if isinstance(recipients, list) and recipients else "local@example.test"
            status = "unknown" if simulate_timeout else "provider_accepted"
            msg_id = str(uuid.uuid4())
            token = f"msg-{uuid.uuid4().hex[:10]}"
            connection.execute(
                """INSERT INTO outbound_messages
                   (id, workspace_id, action_id, revision, claim_id, correlation_token, recipient, status, created_at)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (msg_id, WORKSPACE_ID, action_id, revision, claim["id"], token, str(recipient), status, utc_now()),
            )
            connection.execute(
                "UPDATE action_revisions SET status = ? WHERE action_id = ? AND revision = ?",
                ("unknown" if simulate_timeout else "provider_accepted", action_id, revision),
            )
            connection.execute(
                "UPDATE execution_claims SET status = ? WHERE id = ?",
                ("unknown" if simulate_timeout else "dispatched", claim["id"]),
            )
            self._audit(
                connection,
                principal_id,
                "local_catcher_dispatch",
                {"message_id": msg_id, "action_id": action_id, "revision": revision, "status": status},
            )
            return {"message_id": msg_id, "status": status, "correlation_token": token, "recipient": str(recipient)}

    def reconcile_outbound(self, principal_id: str, message_id: str, found_in_mailbox: bool) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            self._require_owner(connection, principal_id)
            row = connection.execute(
                "SELECT * FROM outbound_messages WHERE id = ? AND workspace_id = ?",
                (message_id, WORKSPACE_ID),
            ).fetchone()
            if row is None:
                raise GuardianError("NOT_FOUND", "Outbound message was not found.", 404)
            new_status = "provider_accepted" if found_in_mailbox else "failed"
            connection.execute("UPDATE outbound_messages SET status = ? WHERE id = ?", (new_status, message_id))
            connection.execute(
                "UPDATE action_revisions SET status = ? WHERE action_id = ? AND revision = ?",
                (new_status, row["action_id"], row["revision"]),
            )
            connection.execute(
                "UPDATE execution_claims SET status = ? WHERE id = ?",
                ("completed" if found_in_mailbox else "failed", row["claim_id"]),
            )
            self._audit(
                connection,
                principal_id,
                "outbound_reconciled",
                {"message_id": message_id, "status": new_status},
            )
            return {"message_id": message_id, "status": new_status}

    def evaluate_review(self) -> dict[str, Any]:
        with self.connect() as connection:
            facts = {
                row["fact_id"]: {"version": row["version"], "value": json.loads(row["value_json"])}
                for row in connection.execute(
                    "SELECT fact_id, version, value_json FROM facts WHERE workspace_id = ? AND status = 'owner_confirmed'",
                    (WORKSPACE_ID,),
                )
            }
            budget_cap = facts.get("sponsor.amount", {}).get("value", 0)
            if not isinstance(budget_cap, (int, float)):
                budget_cap = 0
            headcount = facts.get("headcount", {}).get("value", 0)
            if not isinstance(headcount, (int, float)):
                headcount = 0
            committed = connection.execute(
                "SELECT COALESCE(SUM(amount), 0) AS total FROM budget_reservations WHERE workspace_id = ? AND status = 'active'",
                (WORKSPACE_ID,),
            ).fetchone()["total"]
            essential_forecast = int(headcount) * 500
            headroom = int(budget_cap) - int(committed) - essential_forecast
            pending_actions = connection.execute(
                """SELECT a.id, a.type, a.current_revision, r.params_json
                   FROM actions a JOIN action_revisions r ON r.action_id = a.id AND r.revision = a.current_revision
                   WHERE a.workspace_id = ? AND r.status = 'drafted'""",
                (WORKSPACE_ID,),
            ).fetchall()
            optional_proposal = 0
            for action in pending_actions:
                amt = json.loads(action["params_json"]).get("amount", 0)
                if isinstance(amt, (int, float)) and amt > optional_proposal:
                    optional_proposal = int(amt)
            shortfall = max(0, optional_proposal - headroom)
            open_obligations = connection.execute(
                "SELECT id, name FROM obligations WHERE workspace_id = ? AND required = 1 AND status != 'confirmed'",
                (WORKSPACE_ID,),
            ).fetchall()

            findings: list[dict[str, Any]] = []
            if optional_proposal > 0 and shortfall > 0:
                findings.append({
                    "code": "BUDGET_SHORTFALL_WARN",
                    "verdict": "WARN",
                    "title": "Optional proposal exceeds forecast headroom",
                    "detail": f"Proposal of {optional_proposal} exceeds headroom ({headroom}) by {shortfall}.",
                    "suggestion": "Defer optional spending or reduce amount to fit headroom.",
                })
            # Flow 7: Drift detection (3+ revisions on send_invitation_batch while obligation open)
            if open_obligations:
                rev_count = connection.execute(
                    """SELECT COUNT(*) AS cnt FROM action_revisions r
                       JOIN actions a ON a.id = r.action_id
                       WHERE a.workspace_id = ? AND a.type = 'send_invitation_batch'""",
                    (WORKSPACE_ID,),
                ).fetchone()["cnt"]
                if rev_count >= 3:
                    findings.append({
                        "code": "DRIFT_DETECTED",
                        "verdict": "WARN",
                        "title": "Repeated invitation revisions while vendor obligation is open",
                        "detail": f"{rev_count} invitation revisions recorded while '{open_obligations[0]['name']}' remains unconfirmed.",
                        "suggestion": "Prioritize closing open vendor obligations before further invitation edits.",
                    })
            # Flow 10: Qualitative policy check (step-free access evidence)
            if facts and "accessibility.step_free" not in facts:
                findings.append({
                    "code": "QUALITATIVE_ACCESS_ASK",
                    "verdict": "ASK",
                    "title": "Step-free access evidence not supplied",
                    "detail": "No confirmed 'accessibility.step_free' fact is recorded for the current venue.",
                    "suggestion": "Confirm venue accessibility or add 'accessibility.step_free' fact in Goals & Facts.",
                })
            return {
                "status": "CURRENT",
                "budget": {
                    "cap": int(budget_cap),
                    "committed": int(committed),
                    "available": int(budget_cap) - int(committed),
                    "essential_forecast": essential_forecast,
                    "headroom": headroom,
                    "optional_proposal": optional_proposal,
                    "shortfall": shortfall,
                },
                "findings": findings,
            }

    def state(self) -> dict[str, Any]:
        with self.connect() as connection:
            workspace = connection.execute(
                "SELECT name, kill_switch FROM workspaces WHERE id = ?", (WORKSPACE_ID,)
            ).fetchone()
            actions = connection.execute(
                """SELECT a.id, a.type, a.current_revision, a.required, a.proposed_by,
                          CASE WHEN EXISTS(
                            SELECT 1 FROM action_rejections x
                            WHERE x.action_id = a.id AND x.revision = r.revision
                          ) THEN 'rejected' ELSE r.status END AS status,
                          r.stale_reason, r.params_json, r.params_hash,
                          (SELECT c.status FROM execution_claims c
                           WHERE c.action_id = a.id AND c.revision = r.revision
                           ORDER BY c.claimed_at DESC LIMIT 1) AS claim_status
                   FROM actions a JOIN action_revisions r
                     ON r.action_id = a.id AND r.revision = a.current_revision
                   WHERE a.workspace_id = ? ORDER BY a.created_at""",
                (WORKSPACE_ID,),
            ).fetchall()
            fact_history = connection.execute(
                """SELECT fact_id, version, value_json, status, changed_at
                   FROM facts WHERE workspace_id = ? ORDER BY fact_id, version""",
                (WORKSPACE_ID,),
            ).fetchall()
            dependency_rows = connection.execute(
                """SELECT d.action_id, d.fact_id, d.fact_version
                   FROM action_deps d JOIN actions a ON a.id = d.action_id
                   WHERE d.workspace_id = ? AND d.revision = a.current_revision
                   ORDER BY d.action_id, d.fact_id""",
                (WORKSPACE_ID,),
            ).fetchall()
            action_dependencies: dict[str, list[dict[str, Any]]] = {}
            for row in dependency_rows:
                action_dependencies.setdefault(row["action_id"], []).append(
                    {"fact": row["fact_id"], "version": row["fact_version"]}
                )
            return {
                "workspace_id": WORKSPACE_ID,
                "workspace_name": workspace["name"],
                "kill_switch": bool(workspace["kill_switch"]),
                "facts": self.current_facts(),
                "fact_history": [
                    {
                        "id": row["fact_id"],
                        "version": row["version"],
                        "value": json.loads(row["value_json"]),
                        "status": row["status"],
                        "changed_at": row["changed_at"],
                    }
                    for row in fact_history
                ],
                "actions": [
                    {
                        "id": row["id"],
                        "type": row["type"],
                        "revision": row["current_revision"],
                        "proposed_by": row["proposed_by"],
                        "required": bool(row["required"]),
                        "status": row["status"],
                        "stale_reason": row["stale_reason"],
                        "claim_status": row["claim_status"],
                        "dependencies": action_dependencies.get(row["id"], []),
                        "parameters": json.loads(row["params_json"]),
                        "params_hash": row["params_hash"],
                    }
                    for row in actions
                ],
                "review_dispositions": [
                    {
                        "id": row["id"],
                        "disposition": row["disposition"],
                        "reason": row["reason"],
                        "recorded_by": row["recorded_by"],
                        "created_at": row["created_at"],
                    }
                    for row in connection.execute(
                        """SELECT id, disposition, reason, recorded_by, created_at
                           FROM review_dispositions WHERE workspace_id = ?
                           ORDER BY created_at DESC, id DESC""",
                        (WORKSPACE_ID,),
                    )
                ],
                "fact_proposals": [
                    {
                        "id": row["id"],
                        "fact_id": row["fact_id"],
                        "value": json.loads(row["proposed_value_json"]),
                        "proposed_by": row["proposed_by"],
                        "reason": row["reason"],
                        "status": row["status"],
                        "created_at": row["created_at"],
                    }
                    for row in connection.execute(
                        """SELECT id, fact_id, proposed_value_json, proposed_by, reason, status, created_at
                           FROM fact_proposals WHERE workspace_id = ? AND status = 'open'
                           ORDER BY created_at DESC""",
                        (WORKSPACE_ID,),
                    )
                ],
                "budget_reservations": [
                    {
                        "id": row["id"],
                        "action_id": row["action_id"],
                        "amount": row["amount"],
                        "status": row["status"],
                        "created_at": row["created_at"],
                    }
                    for row in connection.execute(
                        """SELECT id, action_id, amount, status, created_at
                           FROM budget_reservations WHERE workspace_id = ? AND status = 'active'
                           ORDER BY created_at DESC""",
                        (WORKSPACE_ID,),
                    )
                ],
                "outbound_messages": [
                    {
                        "id": row["id"],
                        "action_id": row["action_id"],
                        "revision": row["revision"],
                        "correlation_token": row["correlation_token"],
                        "recipient": row["recipient"],
                        "status": row["status"],
                        "created_at": row["created_at"],
                    }
                    for row in connection.execute(
                        """SELECT id, action_id, revision, correlation_token, recipient, status, created_at
                           FROM outbound_messages WHERE workspace_id = ?
                           ORDER BY created_at DESC""",
                        (WORKSPACE_ID,),
                    )
                ],
            }

    def readiness(self) -> dict[str, Any]:
        with self.connect() as connection:
            config = connection.execute(
                """SELECT initialized FROM readiness_requirements
                   WHERE workspace_id = ?""",
                (WORKSPACE_ID,),
            ).fetchone()
            current_facts = {
                row["fact_id"]: row["version"]
                for row in connection.execute(
                    """SELECT fact_id, version FROM facts
                       WHERE workspace_id = ? AND status = 'owner_confirmed'""",
                    (WORKSPACE_ID,),
                )
            }
            requirements_initialized = bool(config and config["initialized"])
            obligation_rows = connection.execute(
                """SELECT o.id, o.name, o.vendor_id, v.name AS vendor_name, v.email AS vendor_email,
                          o.fact_id, o.required_version, o.required_value_json, o.status
                   FROM obligations o JOIN vendors v ON v.id = o.vendor_id
                   WHERE o.workspace_id = ? AND o.required = 1 ORDER BY o.id""",
                (WORKSPACE_ID,),
            ).fetchall()
            obligations: list[dict[str, Any]] = []
            open_obligations: list[dict[str, Any]] = []
            for row in obligation_rows:
                current_version = current_facts.get(row["fact_id"])
                evidence = connection.execute(
                    """SELECT 1 FROM evidence
                       WHERE obligation_id = ? AND received_by = ? AND decision = 'CONFIRM'
                         AND accepted = 1 AND fact_version = ? LIMIT 1""",
                    (row["id"], row["vendor_id"], current_version),
                ).fetchone()
                confirmed = bool(
                    row["status"] == "confirmed"
                    and current_version == row["required_version"]
                    and evidence
                )
                token_row = connection.execute(
                    """SELECT token FROM obligation_tokens
                       WHERE obligation_id = ? AND fact_version = ?
                       ORDER BY rowid DESC LIMIT 1""",
                    (row["id"], current_version),
                ).fetchone()
                obligation = {
                    "id": row["id"],
                    "name": row["name"],
                    "status": "confirmed" if confirmed else "open",
                    "required": True,
                    "vendor": {"id": row["vendor_id"], "name": row["vendor_name"], "email": row["vendor_email"]},
                    "required_fact": {
                        "id": row["fact_id"],
                        "version": row["required_version"],
                        "value": json.loads(row["required_value_json"]),
                    },
                    "correlation_token": token_row["token"] if token_row and not confirmed else None,
                }
                obligations.append(obligation)
                if not confirmed:
                    open_obligations.append(obligation)

            pending_actions = [
                {
                    "id": row["id"],
                    "type": row["type"],
                    "revision": row["current_revision"],
                    "status": row["status"],
                    "reason": row["stale_reason"],
                }
                for row in connection.execute(
                    """SELECT a.id, a.type, a.current_revision, r.status, r.stale_reason
                       FROM actions a JOIN action_revisions r
                         ON r.action_id = a.id AND r.revision = a.current_revision
                       WHERE a.workspace_id = ? AND a.required = 1 AND r.status != 'confirmed'
                       ORDER BY a.created_at""",
                    (WORKSPACE_ID,),
                )
            ]
            review_tasks = [
                {
                    "id": row["id"],
                    "obligation_id": row["obligation_id"],
                    "reason_code": row["reason_code"],
                    "created_at": row["created_at"],
                }
                for row in connection.execute(
                    """SELECT id, obligation_id, reason_code, created_at
                       FROM owner_review_tasks
                       WHERE workspace_id = ? AND status = 'open'
                       ORDER BY created_at, id""",
                    (WORKSPACE_ID,),
                )
            ]
            evidence_items = [
                {
                    "id": row["id"],
                    "obligation_id": row["obligation_id"],
                    "decision": row["decision"],
                    "fact_version": row["fact_version"],
                    "accepted": bool(row["accepted"]),
                    "reason_code": row["reason_code"],
                    "received_at": row["created_at"],
                }
                for row in connection.execute(
                    """SELECT id, obligation_id, decision, fact_version, accepted,
                              reason_code, created_at
                       FROM evidence WHERE workspace_id = ?
                       ORDER BY created_at, id""",
                    (WORKSPACE_ID,),
                )
            ]
            fact_version = max(current_facts.values(), default=0)
            ready = bool(requirements_initialized and obligations and not open_obligations and not pending_actions)
            return {
                "ready": ready,
                "requirements_initialized": requirements_initialized,
                "fact_version": fact_version,
                "label": (
                    f"Recorded arrangements ready as of event-facts V{fact_version}"
                    if ready else "Not ready"
                ),
                "open_obligations": open_obligations,
                "obligations": obligations,
                "pending_required_actions": pending_actions,
                "owner_review_tasks": review_tasks,
                "evidence": evidence_items,
            }

    def submit_vendor_reply(
        self, principal_id: str, token: Any, decision: Any
    ) -> dict[str, Any]:
        with self.connect() as connection, transaction(connection):
            vendor = self._require_vendor(connection, principal_id)
            if (
                not isinstance(token, str)
                or not token
                or len(token) > 200
                or decision not in ("CONFIRM", "DECLINE")
            ):
                return self._route_reply_to_owner(
                    connection, principal_id, "AMBIGUOUS_REPLY", None
                )

            token_row = connection.execute(
                """SELECT t.obligation_id, t.fact_version, o.workspace_id, o.vendor_id,
                          o.fact_id, o.required_version, o.status, f.version AS current_version
                   FROM obligation_tokens t
                   JOIN obligations o ON o.id = t.obligation_id
                   LEFT JOIN facts f
                     ON f.workspace_id = o.workspace_id AND f.fact_id = o.fact_id
                    AND f.status = 'owner_confirmed'
                   WHERE t.token = ? AND o.workspace_id = ?""",
                (token, WORKSPACE_ID),
            ).fetchone()
            if token_row is None:
                return self._route_reply_to_owner(
                    connection, principal_id, "UNKNOWN_CORRELATION_TOKEN", None
                )
            obligation_id = token_row["obligation_id"]
            if token_row["vendor_id"] != vendor["id"]:
                return self._route_reply_to_owner(
                    connection, principal_id, "UNEXPECTED_VENDOR", obligation_id
                )

            current = (
                token_row["fact_version"] == token_row["required_version"]
                and token_row["fact_version"] == token_row["current_version"]
            )
            accepted = decision == "CONFIRM" and current
            reason_code = None
            if not current:
                reason_code = "STALE_CORRELATION_TOKEN"
            elif decision == "DECLINE":
                reason_code = "VENDOR_DECLINED"
            if accepted:
                connection.execute(
                    """UPDATE obligations SET status = 'confirmed', updated_at = ?
                       WHERE id = ? AND required_version = ?""",
                    (utc_now(), obligation_id, token_row["fact_version"]),
                )
            evidence_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO evidence
                   (id, workspace_id, obligation_id, token, received_by, decision,
                    fact_version, accepted, reason_code, created_at)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    evidence_id,
                    WORKSPACE_ID,
                    obligation_id,
                    token,
                    principal_id,
                    decision,
                    token_row["fact_version"],
                    int(accepted),
                    reason_code,
                    utc_now(),
                ),
            )
            if reason_code:
                self._route_reply_to_owner(
                    connection, principal_id, reason_code, obligation_id
                )
            self._audit(
                connection,
                principal_id,
                "vendor_reply_recorded",
                {
                    "evidence_id": evidence_id,
                    "obligation_id": obligation_id,
                    "decision": decision,
                    "accepted": accepted,
                    "reason_code": reason_code,
                    "fact_version": token_row["fact_version"],
                },
            )
            return {
                "outcome": "ACCEPTED" if accepted else "ROUTED_TO_OWNER",
                "reason_code": reason_code,
                "obligation_id": obligation_id,
            }

    def _issue_obligation_token(
        self, connection: sqlite3.Connection, obligation_id: str, fact_version: int
    ) -> str:
        token = secrets.token_urlsafe(32)
        connection.execute(
            """INSERT INTO obligation_tokens(token, obligation_id, fact_version, created_at)
               VALUES(?, ?, ?, ?)""",
            (token, obligation_id, fact_version, utc_now()),
        )
        return token

    def _require_vendor(self, connection: sqlite3.Connection, principal_id: str) -> sqlite3.Row:
        vendor = connection.execute(
            """SELECT id, active FROM principals
               WHERE id = ? AND workspace_id = ? AND kind = 'service' AND role = 'vendor'""",
            (principal_id, WORKSPACE_ID),
        ).fetchone()
        if vendor is None or not vendor["active"]:
            raise GuardianError(
                "VENDOR_REQUIRED", "This operation is restricted to the configured demo vendor.", 403
            )
        return vendor

    def _route_reply_to_owner(
        self,
        connection: sqlite3.Connection,
        principal_id: str,
        reason_code: str,
        obligation_id: str | None,
    ) -> dict[str, Any]:
        task_id = str(uuid.uuid4())
        connection.execute(
            """INSERT INTO owner_review_tasks
               (id, workspace_id, obligation_id, reason_code, status, created_at)
               VALUES(?, ?, ?, ?, 'open', ?)""",
            (task_id, WORKSPACE_ID, obligation_id, reason_code, utc_now()),
        )
        self._audit(
            connection,
            principal_id,
            "vendor_reply_routed_to_owner",
            {"task_id": task_id, "obligation_id": obligation_id, "reason_code": reason_code},
        )
        return {
            "outcome": "ROUTED_TO_OWNER",
            "reason_code": reason_code,
            "obligation_id": obligation_id,
            "owner_review_task_id": task_id,
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
