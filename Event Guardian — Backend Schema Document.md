# Event Guardian — Backend Schema Document


> **1 December 2026 delivery scope (PDF review, 25 November):** One reusable Goal Guardian engine, one synthetic TechMeet event, one owner, exactly two independent LLM-driven role agents (Invitations and Catering/Resources), Guardian MCP plus one email connector MCP, and one consolidated owner dashboard. The owner confirms venue facts; transport is not a separate role or required workflow. The minimum reviewer uses one read-only call and shared goal/policy, priority, resource-impact, progress/drift and trigger logic. All external actions use the deterministic gateway; evidence, exact approval, role isolation, deduplication, kill switch and persistent audit remain required. Required evaluation: focused positive/negative controls and reviewer-on/off comparison on identical fixtures. First stretch: grounded cross-agent conflict; optional deeper comparisons, broader qualitative policy, explicit expiry/revocation and hash-chained audit. Excluded for this release: calendar, temporary exceptions/restoration, waivers, incremental context deltas, separate context page, multi-event/production onboarding, exhaustive benchmarks, additional orchestration or custom models. Earlier design catalogue examples and scenario IDs are retained only as background or deferred where explicitly labelled. All implementation claims remain unverified.

**Version:** 0.2 · 1 December scope · **Date:** 25 November 2026 **Source:** *Goal Guardian — Event Coordination, final integrated specification (rev 2, 24 Nov 2026, narrowed by the 25 Nov PDF review)*, sections 11 and 12. **Status:** Design proposal. The DDL below is an **untested sketch** in SQLite dialect, consolidating the specification's illustrative tables and its stated extensions (goals, policies, progress, forecasts, reviews, dispositions, triggers, exceptions, obligation and action metadata). The revised DDL was syntax-checked in an in-memory SQLite database; migrations, seed data, concurrency and application invariants remain untested.

Tags: **\[Spec\]** from the specification · **\[Judgment\]** a modelling choice added here.

---

## 1. Design rules

1. **SQLite in WAL mode** for the prototype; Postgres only if needed \[Spec\]. No graph or vector database.
2. **Every row is workspace-scoped** (`workspace_id`). One workspace = one event.
3. **Integer versions, never timestamps, for comparisons** (risk R13).
4. **Money is stored as integer minor units (paise)**, never floats. ₹1,00,000 = `10000000`. \[Spec: integer currency units\]
5. **Facts and action revisions are immutable once written.** Change creates a new version or revision.
6. **Records reference IDs and versions**, not growing transcripts.
7. **Authority is encoded in data**: only `owner` principals create approvals, confirm facts, goals and hard policies; reviews are inserted only by the `reviewer` service principal.
8. **Append-only audit log** (hash chaining optional).
9. **Deviation from the specification \[Judgment\]:** the specification's `facts` table includes a `proposed` status inside the same version sequence. Here, non-owner proposals live in `fact_proposals`, so `facts` contains only confirmed versions with contiguous integers. This keeps "current version" and version comparison unambiguous.
10. **`budget.committed` \[Judgment\]:** the specification lists `budget.committed` as a dependency fact. It is derived from the budget ledger, not owner-typed: it resolves to `workspaces.ledger_version`, which increments on every ledger change. An action bound to a ledger version goes stale if the ledger moves, which is what the budget check needs.

---

## 2. Entity overview

| Domain | Tables |
| --- | --- |
| Tenancy and identity | `workspaces`, `principals`, `role_scopes`, `role_allowed_actions`, `allowlist_domains`, `vendors` |
| Shared state | `facts`, `fact_proposals`, `goals`, `policies` |
| Actions and authority | `action_templates`, `actions`, `action_revisions`, `action_deps`, `approvals`, `execution_claims` |
| Obligations and evidence | `event_plans`, `readiness_requirements`, `obligations`, `evidence`, `outbound_messages`, `inbound_messages` |
| Resources | `budget_entries`, `resource_forecasts` |
| Reasoning layer | `task_progress`, `reviews`, `review_dispositions`, `review_triggers` |
| Operations | `model_calls`, `audit_log`, `eval_runs` |

Relationships in brief: a **workspace** has many facts, goals, policies, actions. An **action** has many immutable **revisions**; each revision has **dependency edges** to specific fact versions and may have **approvals** bound to its exact params hash. An approved revision may produce one **execution claim**, which produces **outbound messages**, **evidence** and **obligations**. **Obligations** close only through matching **evidence**. A **review** targets an action revision (or a progress window) and may receive **dispositions** from the owner.

---

## 3. DDL

### 3.1 Pragmas, tenancy and identity

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE workspaces (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  demo_clock_at  TEXT,                          -- frozen clock for reproducible demos
  kill_switch    INTEGER NOT NULL DEFAULT 0 CHECK (kill_switch IN (0,1)),
  ledger_version INTEGER NOT NULL DEFAULT 0,    -- resolves the 'budget.committed' dependency
  created_at     TEXT NOT NULL
);

CREATE TABLE principals (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  kind         TEXT NOT NULL CHECK (kind IN ('owner','agent','service')),
  role         TEXT CHECK (role IN ('catering','invitations','reviewer')),
  display_name TEXT NOT NULL,
  token_hash   TEXT,                            -- hash only; token itself never stored
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TEXT NOT NULL,
  CHECK (kind <> 'agent' OR role IN ('catering','invitations')),
  CHECK (kind <> 'service' OR role = 'reviewer')
);

CREATE TABLE role_scopes (                      -- what each role may read via get_context
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  role         TEXT NOT NULL,
  scope_kind   TEXT NOT NULL CHECK (scope_kind IN ('fact_prefix','record_kind')),
  pattern      TEXT NOT NULL,                   -- e.g. 'venue.', 'event.', 'own_actions'
  PRIMARY KEY (workspace_id, role, scope_kind, pattern)
);

CREATE TABLE role_allowed_actions (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  role         TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  PRIMARY KEY (workspace_id, role, action_type)
);

CREATE TABLE allowlist_domains (               -- test-domain recipient allowlist
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  domain       TEXT NOT NULL,
  PRIMARY KEY (workspace_id, domain)
);

CREATE TABLE vendors (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('catering','other'))
);
```

### 3.2 Shared state: facts, proposals, goals, policies

```sql
CREATE TABLE facts (                            -- confirmed versions only, contiguous integers
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  id           TEXT NOT NULL,                   -- e.g. 'venue.address'
  version      INTEGER NOT NULL CHECK (version >= 1),
  value_json   TEXT NOT NULL CHECK (json_valid(value_json)),
  status       TEXT NOT NULL CHECK (status IN ('owner_confirmed','superseded')),
  source       TEXT,
  changed_by   TEXT NOT NULL REFERENCES principals(id),
  changed_at   TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id, version)
);
CREATE UNIQUE INDEX uq_fact_current ON facts(workspace_id, id) WHERE status = 'owner_confirmed';

CREATE VIEW facts_current AS
  SELECT * FROM facts WHERE status = 'owner_confirmed';

CREATE TABLE fact_proposals (                   -- non-owner or external suggestions; never truth
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id),
  fact_id             TEXT NOT NULL,
  base_version        INTEGER,                  -- version the proposer saw
  proposed_value_json TEXT NOT NULL CHECK (json_valid(proposed_value_json)),
  proposed_by         TEXT NOT NULL REFERENCES principals(id),
  source              TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','accepted','rejected','withdrawn')),
  decided_by          TEXT REFERENCES principals(id),
  decided_at          TEXT,
  resulting_version   INTEGER,
  created_at          TEXT NOT NULL
);

CREATE TABLE goals (
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  goal_id         TEXT NOT NULL,                -- e.g. 'event_success'
  version         INTEGER NOT NULL CHECK (version >= 1),
  objective       TEXT NOT NULL,
  success_json    TEXT NOT NULL CHECK (json_valid(success_json)),
  priority_tier   TEXT NOT NULL CHECK (priority_tier IN ('required','important','optional')),
  status          TEXT NOT NULL CHECK (status IN ('proposed','owner_confirmed','superseded')),
  owner_id        TEXT REFERENCES principals(id),
  source          TEXT,
  created_at      TEXT NOT NULL,
  confirmed_at    TEXT,
  PRIMARY KEY (workspace_id, goal_id, version),
  CHECK (status <> 'owner_confirmed' OR (owner_id IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_goal_current ON goals(workspace_id, goal_id) WHERE status = 'owner_confirmed';

CREATE TABLE policies (
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  policy_id       TEXT NOT NULL,                -- e.g. 'cap', 'capacity', 'P1', 'P2'
  version         INTEGER NOT NULL CHECK (version >= 1),
  text            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('hard','soft')),
  scope_json      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(scope_json)),
  hard_predicate_json TEXT CHECK (hard_predicate_json IS NULL OR json_valid(hard_predicate_json)),
  status          TEXT NOT NULL CHECK (status IN ('proposed','owner_confirmed','superseded')),
  confirmed_by    TEXT REFERENCES principals(id),
  confirmed_at    TEXT,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (workspace_id, policy_id, version),
  -- an LLM interpretation never becomes enforceable without a confirmed structured predicate
  CHECK (status <> 'owner_confirmed' OR kind = 'soft' OR hard_predicate_json IS NOT NULL),
  CHECK (status <> 'owner_confirmed' OR confirmed_by IS NOT NULL)
);
CREATE UNIQUE INDEX uq_policy_current ON policies(workspace_id, policy_id) WHERE status = 'owner_confirmed';
```

### 3.3 Actions, dependencies, approvals, claims

```sql
CREATE TABLE action_templates (
  type                TEXT PRIMARY KEY,         -- 'send_invitation_batch', ...
  protected           INTEGER NOT NULL CHECK (protected IN (0,1)),
  depends_on_json     TEXT NOT NULL CHECK (json_valid(depends_on_json)),  -- list of fact ids
  required_obligation TEXT,                     -- e.g. 'vendor_confirmation_matching_venue_version'
  review_required     INTEGER NOT NULL DEFAULT 0 CHECK (review_required IN (0,1)),
  critical            INTEGER NOT NULL DEFAULT 1 CHECK (critical IN (0,1))
);

CREATE TABLE actions (                          -- logical action; params live in revisions
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id),
  type             TEXT NOT NULL REFERENCES action_templates(type),
  proposed_by      TEXT NOT NULL REFERENCES principals(id),
  current_revision INTEGER NOT NULL DEFAULT 1,
  is_required      INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0,1)),  -- readiness
  due_at           TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE action_revisions (
  action_id       TEXT NOT NULL REFERENCES actions(id),
  revision        INTEGER NOT NULL CHECK (revision >= 1),
  params_json     TEXT NOT NULL CHECK (json_valid(params_json)),
  params_hash     TEXT NOT NULL,                -- SHA-256 of canonicalised params
  status          TEXT NOT NULL CHECK (status IN (
                    'drafted','approved','stale','executing','provider_accepted',
                    'unknown','reconciling','acknowledged','confirmed','failed','rejected')),
  stale_reason    TEXT,                         -- e.g. 'venue.address v2->v3'
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by      TEXT NOT NULL REFERENCES principals(id),
  created_at      TEXT NOT NULL,
  PRIMARY KEY (action_id, revision)
);

CREATE TABLE action_deps (                      -- explicit edges from the template
  workspace_id TEXT NOT NULL,
  action_id    TEXT NOT NULL,
  revision     INTEGER NOT NULL,
  fact_id      TEXT NOT NULL,
  fact_version INTEGER NOT NULL,                -- version the revision was prepared against
  PRIMARY KEY (action_id, revision, fact_id),
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);
CREATE INDEX ix_deps_by_fact ON action_deps(workspace_id, fact_id, fact_version);

CREATE TABLE approvals (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id),
  action_id           TEXT NOT NULL,
  revision            INTEGER NOT NULL,
  params_hash         TEXT NOT NULL,            -- exact params approved
  bound_versions_json TEXT NOT NULL CHECK (json_valid(bound_versions_json)),  -- {fact_id: version}
  approver            TEXT NOT NULL REFERENCES principals(id),
  approved_at         TEXT NOT NULL,
  expires_at          TEXT,
  status              TEXT NOT NULL CHECK (status IN ('active','invalidated','used','revoked')),
  reason              TEXT,
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);
CREATE INDEX ix_approvals_active ON approvals(action_id, revision) WHERE status = 'active';

CREATE TABLE execution_claims (                 -- persisted BEFORE the provider call
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  action_id     TEXT NOT NULL,
  revision      INTEGER NOT NULL,
  approval_id   TEXT NOT NULL REFERENCES approvals(id),
  agent_id      TEXT NOT NULL REFERENCES principals(id),
  status        TEXT NOT NULL CHECK (status IN ('claimed','dispatched','completed','unknown','failed')),
  provider_ref  TEXT,
  result_json   TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  claimed_at    TEXT NOT NULL,
  completed_at  TEXT,
  FOREIGN KEY (action_id, revision) REFERENCES action_revisions(action_id, revision)
);
CREATE UNIQUE INDEX uq_one_live_claim ON execution_claims(action_id, revision)
  WHERE status IN ('claimed','dispatched','unknown');   -- no double dispatch
```

### 3.4 Plan, obligations and evidence

```sql
CREATE TABLE event_plans (                      -- owner-confirmed readiness requirements, versioned
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  version      INTEGER NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('proposed','owner_confirmed','superseded')),
  confirmed_by TEXT REFERENCES principals(id),
  confirmed_at TEXT,
  PRIMARY KEY (workspace_id, version)
);

CREATE TABLE readiness_requirements (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL,
  plan_version     INTEGER NOT NULL,
  requirement_key  TEXT NOT NULL,               -- 'catering_confirmation', 'accurate_invites', ...
  kind             TEXT NOT NULL CHECK (kind IN ('obligation','action')),
  description      TEXT NOT NULL,
  evidence_rule_json TEXT NOT NULL CHECK (json_valid(evidence_rule_json)),
  due_at           TEXT,
  FOREIGN KEY (workspace_id, plan_version) REFERENCES event_plans(workspace_id, version),
  UNIQUE (workspace_id, plan_version, requirement_key)
);

CREATE TABLE obligations (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id),
  requirement_id     TEXT REFERENCES readiness_requirements(id),
  description        TEXT NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('confirmation','verification')),
  depends_json       TEXT NOT NULL CHECK (json_valid(depends_json)),   -- fact ids and versions
  required           INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0,1)),
  due_at             TEXT,
  required_evidence  TEXT NOT NULL,             -- e.g. 'vendor_reply_matching_venue_version'
  evidence_predicate_json TEXT CHECK (evidence_predicate_json IS NULL OR json_valid(evidence_predicate_json)),
  status             TEXT NOT NULL CHECK (status IN ('open','pending_verification','closed')),
  created_from       TEXT,                      -- action or fact change
  created_at         TEXT NOT NULL,
  closed_by_evidence TEXT REFERENCES evidence(id),
  closed_at          TEXT
);
CREATE INDEX ix_obl_open ON obligations(workspace_id, status) WHERE status IN ('open','pending_verification');

CREATE TABLE evidence (
  id                   TEXT PRIMARY KEY,
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id),
  obligation_id        TEXT REFERENCES obligations(id),
  action_id            TEXT,
  revision             INTEGER,
  kind                 TEXT NOT NULL CHECK (kind IN ('provider_ack','vendor_reply','readback','owner_attestation')),
  source               TEXT NOT NULL,
  payload_hash         TEXT NOT NULL,
  matches_versions_json TEXT CHECK (matches_versions_json IS NULL OR json_valid(matches_versions_json)),
  match_result         TEXT NOT NULL DEFAULT 'n/a'
                       CHECK (match_result IN ('matched','mismatch','ambiguous','n/a')),
  observed_at          TEXT NOT NULL
);

CREATE TABLE outbound_messages (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id),
  action_id           TEXT NOT NULL,
  revision            INTEGER NOT NULL,
  vendor_id           TEXT REFERENCES vendors(id),
  correlation_token   TEXT NOT NULL UNIQUE,     -- placed in the subject
  to_json             TEXT NOT NULL CHECK (json_valid(to_json)),
  subject             TEXT NOT NULL,
  provider_message_id TEXT,
  sent_at             TEXT,
  status              TEXT NOT NULL CHECK (status IN ('queued','provider_accepted','unknown','failed'))
);

CREATE TABLE inbound_messages (                 -- untrusted data; never exposed to agents via MCP
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id),
  outbound_id      TEXT REFERENCES outbound_messages(id),
  from_address     TEXT NOT NULL,
  received_at      TEXT NOT NULL,
  token_parsed     TEXT,
  decision_parsed  TEXT CHECK (decision_parsed IN ('CONFIRM','DECLINE','UNPARSEABLE')),
  versions_cited_json TEXT CHECK (versions_cited_json IS NULL OR json_valid(versions_cited_json)),
  raw_payload_hash TEXT NOT NULL,
  quarantined_body TEXT,                        -- owner-only; never passed to tool-using agents
  routed_to_owner  INTEGER NOT NULL DEFAULT 0 CHECK (routed_to_owner IN (0,1)),
  evidence_id      TEXT REFERENCES evidence(id)
);
```

### 3.5 Resources and reasoning layer

```sql
CREATE TABLE budget_entries (                   -- the ledger; cap is the fact 'budget.cap'
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  category      TEXT NOT NULL,
  amount_minor  INTEGER NOT NULL CHECK (amount_minor > 0),
  kind          TEXT NOT NULL CHECK (kind IN ('committed','reserved')),
  status        TEXT NOT NULL CHECK (status IN ('active','released','denied')),
  action_id     TEXT,
  revision      INTEGER,
  created_at    TEXT NOT NULL
);

CREATE TABLE resource_forecasts (               -- forecasts are NOT commitments
  id                   TEXT PRIMARY KEY,
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id),
  version              INTEGER NOT NULL DEFAULT 1,
  resource             TEXT NOT NULL CHECK (resource IN ('budget','time')),
  obligation_id        TEXT REFERENCES obligations(id),
  amount_minor         INTEGER,
  amount_min_minor     INTEGER,
  amount_max_minor     INTEGER,
  duration_minutes     INTEGER,
  certainty            TEXT NOT NULL CHECK (certainty IN ('known','estimate','unknown')),
  provenance           TEXT NOT NULL,
  as_of                TEXT NOT NULL,
  included_in_entry_id TEXT REFERENCES budget_entries(id),  -- avoid double counting
  CHECK (certainty = 'unknown' OR amount_minor IS NOT NULL OR duration_minutes IS NOT NULL
         OR (amount_min_minor IS NOT NULL AND amount_max_minor IS NOT NULL))
);

CREATE TABLE task_progress (                    -- bounded event journal for drift review
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id),
  task_id          TEXT NOT NULL,
  role             TEXT NOT NULL,
  goal_ids_json    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(goal_ids_json)),
  priority_tier    TEXT NOT NULL CHECK (priority_tier IN ('required','important','optional')),
  due_at           TEXT,
  depends_json     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(depends_json)),
  revision_id      TEXT,
  revision_reason  TEXT,                        -- why it changed (for counter-evidence)
  revision_class   TEXT CHECK (revision_class IN ('cosmetic','required_correction','new_requirement','owner_directed')),
  outcome          TEXT,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_refs_json)),
  source           TEXT NOT NULL CHECK (source IN ('agent_claim','verified')),
  estimated_effort_minutes INTEGER,
  observed_at      TEXT NOT NULL
);
CREATE INDEX ix_progress_window ON task_progress(workspace_id, task_id, observed_at);

CREATE TABLE reviews (                          -- generated by the read-only service; never an approval
  review_id      TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id),
  target_kind    TEXT NOT NULL CHECK (target_kind IN ('action','progress_window','fact_change')),
  action_id      TEXT,
  revision       INTEGER,
  window_start   TEXT,
  window_end     TEXT,
  trigger_kind   TEXT NOT NULL,
  versions_json  TEXT NOT NULL CHECK (json_valid(versions_json)),   -- policy/goal/fact versions used
  signals_json   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(signals_json)),
  input_hash     TEXT NOT NULL,
  dedupe_key     TEXT NOT NULL,
  model          TEXT,
  model_version  TEXT,
  verdict        TEXT NOT NULL CHECK (verdict IN ('NO_CONCERN_FOUND','WARN','ASK','UNAVAILABLE')),
  findings_json  TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(findings_json)),
  status         TEXT NOT NULL CHECK (status IN ('current','stale','invalid','unavailable')),
  error          TEXT,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_review_current ON reviews(workspace_id, dedupe_key) WHERE status = 'current';

CREATE TABLE review_dispositions (
  id                  TEXT PRIMARY KEY,
  review_id           TEXT NOT NULL REFERENCES reviews(review_id),
  owner_id            TEXT NOT NULL REFERENCES principals(id),
  disposition         TEXT NOT NULL CHECK (disposition IN (
                        'accepted_recommendation','accepted_tradeoff','dismissed',
                        'clarification_requested','resolved')),
  reason              TEXT,
  replacement_action_id TEXT REFERENCES actions(id),
  created_at          TEXT NOT NULL,
  CHECK (disposition NOT IN ('accepted_tradeoff','dismissed') OR reason IS NOT NULL)
);

CREATE TABLE review_triggers (
  trigger_id    TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  type          TEXT NOT NULL CHECK (type IN ('proposal','fact_change','goal_change','deadline','progress_window')),
  target        TEXT NOT NULL,
  state_revision TEXT NOT NULL,
  dedupe_key    TEXT NOT NULL UNIQUE,
  queued_at     TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('queued','running','done','unavailable','skipped')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT
);

```

### 3.6 Operations: model calls, audit log, evaluation

```sql
CREATE TABLE model_calls (                      -- token and latency accounting, all purposes
  id                TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id),
  purpose           TEXT NOT NULL CHECK (purpose IN ('agent','reviewer','retrieval','eval')),
  principal_id      TEXT REFERENCES principals(id),
  model             TEXT,
  settings_json     TEXT CHECK (settings_json IS NULL OR json_valid(settings_json)),
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cache_read_tokens INTEGER,                    -- report separately if the provider exposes it
  latency_ms        INTEGER,
  outcome           TEXT,
  review_id         TEXT REFERENCES reviews(review_id),
  eval_run_id       TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE audit_log (                        -- append-only (hash chaining optional)
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  ts           TEXT NOT NULL,
  actor        TEXT NOT NULL,
  event        TEXT NOT NULL,                   -- 'fact_change','denial','approval','execution','review',...
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE eval_runs (
  id           TEXT PRIMARY KEY,
  config       TEXT NOT NULL CHECK (config IN ('deterministic_guardian','full_guardian')),
  scenario_id  TEXT NOT NULL,                   -- focused scenario IDs
  run_no       INTEGER NOT NULL,
  fixture_id   TEXT NOT NULL,
  model        TEXT,
  settings_json TEXT CHECK (settings_json IS NULL OR json_valid(settings_json)),
  expected     TEXT NOT NULL,                   -- label written BEFORE the run
  observed     TEXT,
  passed       INTEGER CHECK (passed IN (0,1)),
  ambiguous    INTEGER NOT NULL DEFAULT 0 CHECK (ambiguous IN (0,1)),
  metrics_json TEXT CHECK (metrics_json IS NULL OR json_valid(metrics_json)),
  failure_note TEXT,
  started_at   TEXT NOT NULL,
  UNIQUE (config, scenario_id, run_no, fixture_id)
);
```

### 3.7 Integrity triggers

```sql
-- Audit log is append-only.
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

-- Action revisions and fact values are immutable (status/stale_reason may change).
CREATE TRIGGER revision_params_immutable BEFORE UPDATE OF params_json, params_hash ON action_revisions
BEGIN SELECT RAISE(ABORT, 'action revision params are immutable; create a new revision'); END;
CREATE TRIGGER fact_value_immutable BEFORE UPDATE OF value_json, version ON facts
BEGIN SELECT RAISE(ABORT, 'fact versions are immutable'); END;

-- Only owners approve.
CREATE TRIGGER approvals_owner_only BEFORE INSERT ON approvals
BEGIN
  SELECT RAISE(ABORT, 'approver must be an owner principal')
  WHERE (SELECT kind FROM principals WHERE id = NEW.approver) IS NOT 'owner';
END;

-- Only the reviewer service writes reviews: SQLite has no per-role grants,
-- so enforce this in the application layer and test it.

-- An obligation closes only with matching evidence.
CREATE TRIGGER obligation_close_needs_matching_evidence BEFORE UPDATE OF status ON obligations
WHEN NEW.status = 'closed'
BEGIN
  SELECT RAISE(ABORT, 'closing requires matched evidence')
  WHERE NEW.closed_by_evidence IS NULL
     OR (SELECT match_result FROM evidence WHERE id = NEW.closed_by_evidence) IS NOT 'matched';
END;
```

---

**Release schema notes:** No exception table or waiver status/API. Keep separate `task_progress` and `audit_log` records; the dashboard combines them only for display. `review_triggers` supports proposal, confirmed change and deadline triggers with deduplication. `catering` is the Catering/Resources principal. Optional expiry/revocation columns may remain nullable/dormant; do not expose a release UI unless tested. Seed an owner-confirmed step-free access preference and evidence-present/missing fixtures for qualitative review.

## 4. Invariants to enforce in code (beyond the DDL)

| # | Invariant | Where |
| --- | --- | --- |
| I1 | Only an `owner` principal confirms facts, goals, hard policies, plans; agents create `fact_proposals` only | API layer and service |
| I2 | A fact change in one transaction: new `facts` row, old to `superseded`, dependent revisions `stale`, dependent approvals `invalidated`, obligations reopened, audit row | `apply_fact_change` |
| I3 | An approval binds `params_hash` and `bound_versions` of one exact revision; it is valid only while every bound fact is still at that version | Gateway checks 3–9 |
| I4 | At most one live execution claim per revision; claim persisted before the provider call; unknown results go to reconciliation, never a blind retry | `uq_one_live_claim`, gateway |
| I5 | Readiness is computed from owner-confirmed requirements; unknown or missing requirements mean not ready | `can_claim_ready` |
| I6 | Evidence closes an obligation only if token, expected vendor and current fact versions match (`match_result = 'matched'`) | Verifier plus trigger |
| I7 | Reviews cannot create trusted evidence: every returned reference must exist in the server snapshot; numbers are recomputed | Review validator |
| I8 | A review whose `versions_json` no longer match current versions is marked `stale` | Version-change hook |
| I9 | Budget available = cap − active committed and reserved entries; forecasts already included in an entry are excluded | Resource analysis |
| I10 | No connector call unless `workspaces.kill_switch = 0` and recipients are on `allowlist_domains` | Gateway and connector |
| I11 | Agents never read `inbound_messages.quarantined_body` | Context broker |
| I12 | Scope redaction: findings returned to an agent contain only records in that role's `role_scopes` | Context broker |

---

## 5. Status models

**Action revision:** `drafted → approved → executing → provider_accepted → acknowledged → confirmed`; side paths `approved → stale`, `provider_accepted → stale`, `confirmed → stale`, `executing → unknown → reconciling → provider_accepted | failed`, `drafted → rejected`. A stale revision returns to `drafted` only by creating a **new revision**.

**Approval:** `active → used | invalidated | revoked`.

**Obligation:** `open → pending_verification → closed`; `closed → open` when a later fact change voids the evidence.

**Review:** `current → stale`; `invalid` and `unavailable` are terminal and visible.

---

## 6. Key queries

**Current version of a fact**

```sql
SELECT version, value_json FROM facts_current
WHERE workspace_id = :ws AND id = :fact_id;
```

**Revisions that become stale when a fact is confirmed at version N**

```sql
SELECT d.action_id, d.revision
FROM action_deps d
JOIN action_revisions r ON r.action_id = d.action_id AND r.revision = d.revision
WHERE d.workspace_id = :ws
  AND d.fact_id = :fact_id
  AND d.fact_version < :new_version
  AND r.status IN ('drafted','approved','provider_accepted','acknowledged','confirmed');
```

**Are all bound versions still current for an approval?** (gateway check 9)

```sql
SELECT COUNT(*) AS stale_count
FROM approvals a, json_each(a.bound_versions_json) b
JOIN facts_current f ON f.workspace_id = a.workspace_id AND f.id = b.key
WHERE a.id = :approval_id AND f.version <> b.value;
-- gateway proceeds only when stale_count = 0
```

**Budget headroom (minor units)**

```sql
SELECT
  (SELECT CAST(json_extract(value_json, '$.amount_minor') AS INTEGER)
     FROM facts_current WHERE workspace_id = :ws AND id = 'budget.cap')           AS cap,
  (SELECT COALESCE(SUM(amount_minor), 0) FROM budget_entries
     WHERE workspace_id = :ws AND status = 'active')                              AS committed_or_reserved,
  (SELECT COALESCE(SUM(amount_minor), 0) FROM resource_forecasts
     WHERE workspace_id = :ws AND resource = 'budget' AND certainty <> 'unknown'
       AND included_in_entry_id IS NULL)                                          AS unreserved_essential_forecast;
-- available = cap - committed_or_reserved; headroom = available - unreserved_essential_forecast
```

If any essential forecast has `certainty = 'unknown'`, the application must report a range or "unknown", not the precise sum.

**Open mandatory obligations (readiness)**

```sql
SELECT id, description, due_at, status FROM obligations
WHERE workspace_id = :ws AND required = 1 AND status IN ('open','pending_verification');
```

**Drift window (last 3 revisions of a task)**

```sql
SELECT revision_id, revision_class, revision_reason, observed_at
FROM task_progress
WHERE workspace_id = :ws AND task_id = :task
ORDER BY observed_at DESC LIMIT 3;
```

---

## 7. Fixture seed (TechMeet) \[Spec §11.5, §14.3\]

Amounts in minor units (paise). Only a sketch; the reset script must restore every table.

| Item | Seeded values |
| --- | --- |
| Workspace | `techmeet-test`, demo clock frozen three days before the event |
| Principals | 1 owner; agents invitations, catering/resources; service `reviewer` |
| Facts (current before disruption) | `venue.address` = Venue A v2 (prior v1 seeded; Venue B v3 on change), `event.start`, `headcount` = 120, `budget.cap` = `10000000`, `guest_list.version`, `menu.version`, `sponsor.amount` |
| Goal | `event_success@1`: reliable, accessible community meetup for 120 guests |
| Hard policies | `cap` (amount 10000000), `capacity` (minimum attendees 120) with structured predicates, owner-confirmed |
| Soft policies | `P1` convenience and reliable essentials over luxury; `P2` avoid optional refinements that delay mandatory confirmations; `P3` step-free access preference (test missing/present evidence) |
| Priorities | required: venue, catering\_confirmation, accurate\_invites; important: attendee\_convenience; optional: decor\_upgrades, cosmetic\_invitation\_refinements |
| Ledger | `budget_entries` active total `6500000` (committed or reserved) |
| Forecast | essential unreserved `2500000` (estimate); headroom = 10,000,000 − 6,500,000 − 2,500,000 = `1000000` |
| Proposals for the reasoning branch | decorations `2000000` (expected shortfall `1000000`); optional `500000` (expected shortfall `0`) |
| Obligations | catering confirmation (due in 6 hours on the demo clock), accurate invitations verified |
| Vendors / allowlist | `catering@vendor.test`; allowlisted test domains only |
| Sponsor receipt | action `reconcile_sponsor_receipt`, unprotected, depends only on `sponsor.amount` |

Action templates to seed: `send_invitation_batch`, `send_catering_update`, `reserve_budget`, `reconcile_sponsor_receipt` with the dependencies in the TRD.

---

## 8. Migration and operations notes

- **Order of creation:** workspaces, principals, role tables, allowlist, vendors, facts, proposals, goals, policies, templates, actions, revisions, deps, approvals, claims, plans, requirements, obligations, evidence, messages, resources, reasoning tables, model\_calls, audit\_log, eval\_runs, triggers.
- **Circular reference \[Judgment\]:** `obligations.closed_by_evidence` references `evidence`, and `evidence.obligation_id` references `obligations`. In SQLite, either declare one side without an enforced foreign key, or declare both `DEFERRABLE INITIALLY DEFERRED` and insert inside a transaction.
- **Reset script:** recreate the database file (append-only triggers prevent ordinary audit deletion), reload the seed, and recreate the append-only audit log with fixture events.
- **Concurrency:** use `BEGIN IMMEDIATE` for gateway claim and fact-change transactions; never hold a transaction across a network call.
- **Indexes:** add as measured; the partial indexes above cover the hot paths (current facts, active approvals, open obligations, live claims, current reviews).
- **Retention:** synthetic data only; no retention policy needed for the prototype. Delete the database file after the event and rotate any keys used.
- **Postgres path:** replace `json_valid` and `json_each` with `jsonb`; replace `AUTOINCREMENT` with identity columns; partial unique indexes carry over; use row locks or advisory locks per workspace for the claim.

---

## 9. Open schema questions

1. Should `budget.committed` remain a ledger-derived version (as proposed) or become an owner-confirmed fact? The proposal avoids requiring the owner to type ledger totals.
2. Is a separate `readiness_requirements` table needed for the MVP, or can required obligations alone carry the plan? The extra table makes "requirements never created" detectable (scenario S31).
3. Should `inbound_messages.quarantined_body` be stored at all, or only the hash and extracted fields? Storing it helps owner review of ambiguous replies; omitting it reduces injection surface.
4. Which fields should be redacted per role in `list_findings`? Define per-role redaction rules and test them (risk R36).
