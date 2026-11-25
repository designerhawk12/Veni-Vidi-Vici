# Event Guardian — Technical Requirements Document (TRD)


> **1 December 2026 delivery scope (PDF review, 25 November):** One reusable Goal Guardian engine, one synthetic TechMeet event, one owner, exactly two independent LLM-driven role agents (Invitations and Catering/Resources), Guardian MCP plus one email connector MCP, and one consolidated owner dashboard. The owner confirms venue facts; transport is not a separate role or required workflow. The minimum reviewer uses one read-only call and shared goal/policy, priority, resource-impact, progress/drift and trigger logic. All external actions use the deterministic gateway; evidence, exact approval, role isolation, deduplication, kill switch and persistent audit remain required. Required evaluation: focused positive/negative controls and reviewer-on/off comparison on identical fixtures. First stretch: grounded cross-agent conflict; optional deeper comparisons, broader qualitative policy, explicit expiry/revocation and hash-chained audit. Excluded for this release: calendar, temporary exceptions/restoration, waivers, incremental context deltas, separate context page, multi-event/production onboarding, exhaustive benchmarks, additional orchestration or custom models. Earlier design catalogue examples and scenario IDs are retained only as background or deferred where explicitly labelled. All implementation claims remain unverified.

**Version:** 0.2 · 1 December scope · **Date:** 25 November 2026 **Source:** *Goal Guardian — Event Coordination, final integrated specification (rev 2, 24 Nov 2026, narrowed by the 25 Nov PDF review)* **Status:** Design proposal. All code sketches are illustrative, not executable migrations. Nothing has been built or benchmarked.

Tags: **\[Spec\]** from the source specification · **\[Judgment\]** a technical choice or estimate added here, to be confirmed · **\[Unverified\]** must be checked before relying on it.

---

## 1. Purpose and scope

This document defines how Event Guardian is built: components, trust boundaries, contracts, algorithms, security, testing and configuration. Product behaviour is in the PRD; screens in the UI/UX brief; storage in the Backend Schema document; sequencing in the Implementation Plan.

**Design stance \[Spec\]:** one backend process with separate functions, permissions and model calls is sufficient. No extra orchestration framework, graph database, vector database, GPU or custom model.

---

## 2. Architecture overview

### 2.1 Components \[Spec §10.1\]

| Component | Responsibility |
| --- | --- |
| State store | Versioned facts, actions, approvals, obligations, evidence, audit log (SQLite for the prototype) |
| Dependency model | Which actions and obligations depend on which facts, from typed templates |
| Invalidation engine | On an owner-confirmed fact change, marks dependent actions and approvals stale; reopens obligations |
| Approval service | Binds approval to exact parameters plus bound fact versions; owner only |
| Obligation ledger | Required follow-ups, closure rules, computed readiness |
| Guardian gateway | Runs all pre-execution checks and is the single execution path |
| Evidence verifier | Readback and vendor-reply matching; statuses attempted, provider-accepted, acknowledged, confirmed |
| Context broker | Role-scoped snapshots, with token accounting |
| Independent reviewer | Merged CG capabilities, read-only, advisory (CG-09 stretch) |
| Goal and priority registry | Owner-confirmed objectives, hard limits, soft preferences, versioned |
| Progress monitor | Task revisions, deadlines, resource signals, deduplicated review triggers |
| Resource analysis | Deterministic budget headroom, forecast and candidate cost computation |
| Guardian MCP server | The only tool surface agents see; per-agent identity |
| Email connector MCP server | Email only, called only by the Guardian |
| Owner console | Human interface for approvals, goals, status, audit |
| Evaluation harness | Runs focused scenarios with reviewer on/off |

### 2.2 Trust boundaries

```
+---------------------------+  MCP   +----------------------------------+
| Agent sessions (x2)       +------->+ Guardian MCP server + gateway    |
| no tool credentials       |        | state, checks, approvals,        |
| scoped context only       |        | reviewer service (read-only)     |
+---------------------------+        +----------------+-----------------+
                                                      | holds credentials
+---------------------------+  HTTPS                  v
| Owner console (browser)   +------->  REST API   +----+---------------------+
| only approver             |                      | Email connector MCP server   |
+---------------------------+                      | email (test)  |
                                                   +----+---------------------+
                                                        v
                                         Test inbox / vendor inbox
```

**Critical rule \[Spec\]:** if any agent can reach email or a vendor tool directly, the gate is theatre. Agents get only the Guardian's tools. Credentials live in the Guardian process, never in prompts, config handed to agents, or logs. The security boundary is credential brokering, not MCP itself.

### 2.3 Request flow summary

1. Agent calls `propose_action` → Guardian creates an immutable action revision with template dependencies.
2. Server assembles review context → deterministic signals → reviewer (read-only) → validated advisory finding.
3. Owner reviews finding and exact parameters in the console → approval bound to params hash and fact versions.
4. Agent calls `execute_action` → gateway checks → atomic claim → connector call → evidence recorded.
5. Readback and vendor-reply matching move the action toward `confirmed` and close obligations.
6. A fact change invalidates only dependent approvals and actions, triggers reviews on pending decisions and reprioritisation.

---

## 3. Technology choices \[Judgment\]

The source fixes SQLite, a small API, no GPU, and MCP. Everything else is a recommendation the team should confirm against the official rules and their strengths.

| Layer | Recommendation | Reason / alternative |
| --- | --- | --- |
| Backend language | Python 3.11+ | Fast to build; mature MCP SDK and Anthropic/OpenAI clients. Alternative: TypeScript/Node if the team prefers one language across console and backend. |
| API framework | FastAPI + Pydantic | Typed schemas double as the review-contract validator. |
| Database | SQLite (WAL mode) via plain `sqlite3` or SQLAlchemy Core | Per spec. Postgres only if needed. |
| MCP | Official MCP SDK; Guardian server over streamable HTTP with per-agent bearer token, or stdio per agent | **\[Unverified\]** confirm which transport and identity mechanism the chosen MCP client supports. |
| Connectors | Email via IMAP/SMTP or Gmail API on test accounts; local mail catcher fallback (e.g. MailHog / Mailpit) | Fallback required by the spec so the demo never depends on a third party. |
| Reviewer model | One structured-output-capable LLM, configurable by env var | Same provider as agents is allowed; correlated errors disclosed. |
| Console | React + Vite + Tailwind, or server-rendered pages with HTMX | Minimal; polish only after Gate 3. |
| Realtime | Server-sent events (SSE) from API to console | Simpler than websockets for one-way updates. |
| Testing | pytest, hypothesis (property tests), Playwright (one smoke path) |  |
| Packaging | One repo, `docker compose` or a single `make dev` | One-command setup and reset. |

Pin dependency versions in the lock file; do not assume any version from this document. **\[Unverified\]**

---

## 4. Component specifications

### 4.1 State store and versioning

- Facts are field-level and integer-versioned (`venue.address` v1, v2, v3). Compare **integers only, never timestamps** (risk R13).
- Exactly one `owner_confirmed` row per `(workspace, fact_id)` is current; earlier ones are `superseded`.
- Non-owner changes go to a proposals queue and create a review task; they never alter confirmed state.
- Every table is workspace-scoped. Records reference IDs and versions rather than transcripts.
- Action revisions are immutable once created; edits create a new revision.

### 4.2 Typed action templates and dependency model \[Spec §11.2\]

| Action type | Depends on | Protected | Required obligation after execution |
| --- | --- | --- | --- |
| `send_invitation_batch` | `venue.address`, `event.start`, `guest_list.version` | Yes | None (delivery readback) |
| `send_catering_update` | `venue.address`, `headcount`, `event.start`, `menu.version` | Yes | Vendor confirmation matching venue version |
| `reserve_budget` | `budget.cap`, `budget.committed` | Yes | None (atomic) |
| `reconcile_sponsor_receipt` | `sponsor.amount` | No | None |

The template declares dependencies, not the agent. An LLM may suggest an extra edge; the owner must confirm it before it counts as critical. A critical action whose dependencies are undeclared or incomplete fails closed (`DEPENDENCIES_MISSING`).

### 4.3 Invalidation engine

On an owner-confirmed fact change, in one transaction: write the new version; select actions whose bound version is older; set them `stale` with a reason (`venue.address v2->v3`); invalidate their approvals; reopen or create verification obligations for dependent confirmations; flag critical actions with undeclared dependencies; publish a change notice; next scoped snapshot is current; mark dependent reviews stale and enqueue a review trigger if a decision is still pending; append to the audit log. Never touch unrelated actions. **Test both directions:** stale survives (under-invalidation) and everything flagged (over-invalidation).

### 4.4 Approval service

An approval stores `action_revision_id`, canonical `params_hash`, `bound_versions` (fact id to version), approver, timestamps, optional `expires_at` (stretch), status `active | invalidated | used | revoked`.

**Canonicalisation:** sort keys, normalise whitespace, sort recipient lists, normalise numbers, then SHA-256. Fuzz with shuffled inputs (risk R12). Only a principal of kind `owner` may create or revoke approvals; this check lives in the API layer and again in the service.

### 4.5 Guardian gateway

The single execution path. Check order (each failure returns a reason code and next permitted step):

| # | Check | Reason code |
| --- | --- | --- |
| 0 | Kill switch off | `KILL_SWITCH_ON` |
| 1 | Agent in workspace scope | `SCOPE` |
| 2 | Action type allowed for the role | `TYPE_NOT_ALLOWED` |
| 3 | Active approval exists | `NO_ACTIVE_APPROVAL` |
| 4 | Approval belongs to this action revision | `APPROVAL_MISMATCH` |
| 5 | Approval not expired or revoked, if optional controls enabled | `APPROVAL_EXPIRED` |
| 6 | Required dependencies complete | `DEPENDENCIES_MISSING` |
| 7 | Owner-review requirement satisfied (when configured) | `OWNER_REVIEW_REQUIRED` |
| 8 | Canonical params hash equals approved hash | `PARAMS_CHANGED` |
| 9 | Every bound fact version equals current | `STALE_FACT` (names fact) |
| 10 | Confirmed hard policy predicates satisfied | `HARD_POLICY_VIOLATION` |
| 11 | Budget cap, committed and active reservations not exceeded | `BUDGET_CAP_EXCEEDED` / `BUDGET_CONFLICT` |
| 12 | No open blocking obligations | `OPEN_OBLIGATION` |
| 13 | Idempotency key unused | `DUPLICATE` |
| 14 | Recipients on test-domain allowlist (also enforced in connector) | `RECIPIENT_NOT_ALLOWLISTED` |

Gateway outcomes: `DENY`, `REQUIRE_APPROVAL`, `REQUIRE_CLARIFICATION`, `ALLOW_EXECUTION`, `UNKNOWN/RECONCILE`. Review metadata is recorded but **never** treated as authorisation.

**Atomic claim.** Validation and claim are atomic with respect to concurrent local changes: serialise protected sends and local fact edits per workspace during dispatch (a per-workspace lock or `BEGIN IMMEDIATE`), persist the claim **before** calling the provider, then release the lock. Never hold a SQLite transaction across a network call. A crash after dispatch yields `unknown` and requires reconciliation. The kill switch disables future dispatch; it cannot recall an in-flight operation.

### 4.6 Obligation ledger and readiness

- Mandatory obligations are created when the owner confirms the event plan.
- Fields include `required`, `due_at`, evidence predicate; no waiver fields.
- Closure needs matching, current evidence. Provider acceptance alone never closes a confirmation.
- A later fact change reopens affected obligations.

```python
def can_claim_ready(workspace):
    req = owner_confirmed_readiness_requirements(workspace)
    if not req.initialized:
        return Ready(False, reason="REQUIREMENTS_NOT_DEFINED")
    missing = [r for r in req if not current_evidence_satisfies(r)]
    pending = [a for a in required_actions(workspace)
               if not current_required_action_verified(a)]
    return Ready(not missing and not pending, missing=missing, pending=pending)
```

A required action that was never created, is drafted, unknown, failed or stale cannot qualify. There is no waiver path; missing evidence remains open.

### 4.7 Evidence verifier and confirmation matching \[Spec §12.4\]

- Each outbound vendor message carries a **correlation token** (e.g. in the subject).
- A reply counts only if token, expected vendor **and** the current fact versions the obligation depends on all match.
- A late "confirmed" referencing the old venue must not close the new obligation.
- Ambiguous or malformed replies route to the owner; never auto-close.
- **Inbound email is untrusted data.** Strict parser extracts only token and `CONFIRM`/`DECLINE`. Raw bodies are never passed to a tool-using agent (risk R18, scenario S16).
- Action status machine: `Drafted → Approved → Executing → ProviderAccepted → Acknowledged → Confirmed`; side states `Stale`, `Unknown → Reconciling`, `Failed`. `Confirmed` returns to `Stale` if a later fact change voids it.

### 4.8 Context broker

`get_context()` (role derived from identity) returns in-scope records only (e.g. invitations sees `venue.address`, `event.start`, own actions, never sponsor financials). Retrieval is a convenience; **the gateway is the enforcement**. Log token counts per call.

### 4.9 Independent reviewer service

A service principal inside the same process with separate permissions: read-only DB access, no connector handle, no write to facts, approvals or obligations except inserting reviews.

```python
def review_proposal(action_id, trigger):
    snapshot = authorized_review_snapshot(action_id, trigger)   # server-selected
    signals  = compute_resource_and_deadline_signals(snapshot)  # deterministic math
    key = digest(snapshot.relevant_versions, snapshot.action_hash,
                 snapshot.goal_versions, signals, trigger.kind)
    if (prior := current_review_for(key)): return prior
    try:
        result = call_read_only_reviewer(snapshot, signals, REVIEW_SCHEMA)
        validated = validate_refs_and_schema(result, snapshot, signals)
    except (Timeout, InvalidReview):
        validated = unavailable_review(key)
    if not relevant_versions_still_current(snapshot):
        return persist_stale_review_and_queue_if_needed(validated)
    review = persist_advisory_review(validated, snapshot, key)
    publish_role_scoped_warning_or_question(review)
    return review
```

**Consolidated capability mapping:**

| Implementation unit | Original capability IDs | Minimum behavior |
|---|---|---|
| Goal-aware reviewer | CG-01, CG-02, CG-07 | One read-only review; cite confirmed goals and one qualitative accessibility policy; ask when evidence is missing. |
| Progress and drift detector | CG-03, CG-10 | One progress window; distinguish cosmetic repetition from necessary corrections. |
| Resource-impact review | CG-04, narrow CG-06 | Deterministic budget math, essential forecast and feasible alternative; general comparison deferred. |
| Priority model | CG-05, CG-11 | Owner-confirmed tiers plus deadline/dependency-aware next step. |
| Shared recommendation format | CG-08 | Concern, evidence, uncertainty, feasible alternative, next step and recorded owner response. |
| Trigger and deduplication | CG-12 | Relevant proposals, confirmed state changes and deadline checks; suppress repeated findings. |
| Cross-agent conflict | CG-09 | First optional stretch; cite both authorized proposals, redact agent-facing findings. |

A single scheduler handles proposals, relevant confirmed changes, and bounded deadline checks against the demo clock; share one deduplication key and disposition handling. Accessibility fixture: the owner confirms a step-free access preference; if venue access evidence is absent, return ASK with the missing field; if documented access satisfies it, no unsupported warning. Hard capacity and budget predicates remain code-enforced.

**Prompt contract:** judge only against supplied owner-confirmed goals; separate hard facts from estimates; evaluate meaningful alternatives and competing obligations; cite only supplied references; flag insufficient evidence; never authorise or execute.

**Validation:** every returned `goal_ref`, `evidence_ref` and `computed_signal_id` must exist in the snapshot; schema must match; numbers are recomputed server-side. Invalid output maps to `UNAVAILABLE` with a logged error. Store concise reasoning and references, not hidden chain of thought. A model cannot create trusted evidence merely by emitting an identifier.

**Scheduling and failure handling \[Spec §10.6\]:** review once per relevant revision; deduplicate by action revision, goal versions, referenced fact versions and signal digest; bounded retries, rate limit and timeout; log unavailable and invalid results distinctly; never present a cached result as current after a relevant change; do not route simple reads or routine arithmetic to the LLM. If unavailable and review is required, require an actual owner decision.

**Redaction:** the reviewer reads the cross-role aggregate it needs; findings returned to an agent are redacted to that role's scope. The owner sees full authorised detail.

### 4.10 Resource analysis

Integer minor currency units (paise) throughout; forecasts kept separate from commitments; no double-counting of forecast needs already covered by a reservation.

```python
def assess_discretionary_cost(cap, committed_or_reserved, unreserved_essential_forecast, proposal):
    available = cap - committed_or_reserved
    headroom  = available - unreserved_essential_forecast
    projected_shortfall = max(0, unreserved_essential_forecast - (available - proposal))
    return dict(hard_cap_ok=0 <= proposal <= available,
                discretionary_headroom=headroom,
                projected_shortfall=projected_shortfall)
```

Fixture check: cap ₹1,00,000, committed ₹65,000, forecast ₹25,000 → available ₹35,000, headroom ₹10,000; proposal ₹20,000 → shortfall ₹10,000; proposal ₹5,000 → shortfall ₹0. Negative headroom is reported even without a proposal. Unknown quotes yield a range or "unknown", never an invented figure.

### 4.11 Progress monitor and drift trigger

Append a progress event on task creation, revision, approval, verification or owner priority change. Keep agent claims distinct from verified observations. Use a **configurable demo clock** for reproducibility. Trigger a review candidate from explicit thresholds (fixture: three optional invitation revisions after adequacy acceptance while a mandatory vendor deadline is near). A trigger is not proof of drift; the reviewer weighs counter-evidence (required corrections, new requirements, owner-directed refinement). Persist dispositions so identical warnings do not recur without new evidence. No continuous surveillance, unlimited model loops or automatic reassignment.

---

## 5. Interface contracts

### 5.1 Guardian MCP tools (agent-facing) \[Spec §13.1\]

| Tool | Input | Output | Notes |
| --- | --- | --- | --- |
| `get_context` | none | Scoped records, goals summary, rules note | Role from identity |
| `propose_action` | `type`, `params` | `action_id`, `revision`, status, dependencies | Template declares deps |
| `execute_action` | `action_id`, `approval_id` | Result or structured denial `{code, message, next_step}` | Through gateway |
| `list_obligations` | none | Open and pending items in scope |  |
| `claim_status` | `claim` | Computed answer with open items | e.g. "event is ready?" |
| `reserve_budget` | `category`, `amount` | Reservation or denial | Internally creates an exact action and calls the gateway |
| `record_observation` | `kind`, `data` | Ack | Treated as a claim, not evidence |
| `get_goals` | none | Owner-confirmed goals, policy, priorities | P0 may fold into `get_context` |
| `request_review` | `action_id` | Review or `UNAVAILABLE` | Deduplicated; cannot grant execution; P0 may fold into `propose_action` |
| `list_findings` | none | Role-scoped concerns and next steps | Redacted |
| `record_progress` | `task_id`, `revision_id`, `observation` | Ack | Claims vs verified |
| `recommend_priorities` | none | Eligible next tasks with rationale | No reassignment |

Agents **cannot** approve, confirm goals, alter hard policies, dismiss mandatory owner review, manufacture evidence or waive obligations. Per-role allowlists: Catering/Resources (`send_catering_update`, `reserve_budget`); Invitations (`send_invitation_batch`). Both may submit fact proposals within scope; only the owner confirms venue facts.

### 5.2 Email connector MCP server (Guardian-only)

| Server | Tools | Constraint |
| --- | --- | --- |
| Email | `send_email`, `search_mailbox`, `read_thread` | Test accounts; recipient allowlist enforced in the connector |

### 5.3 Owner console REST API \[Judgment\]

| Method and path | Purpose |
| --- | --- |
| `GET /api/state` | Board: actions, statuses, readiness, stale markers |
| `POST /api/facts/{id}` | Owner confirms a new fact version (triggers invalidation) |
| `GET /api/proposals`, `POST /api/proposals/{id}/decision` | Review non-owner fact proposals |
| `GET /api/approvals/pending`, `POST /api/approvals` | List and create approval for an exact revision |
| `GET/POST /api/goals`, `GET/POST /api/policies` | View and confirm versioned goals and policies |
| `GET /api/reviews`, `POST /api/reviews/{id}/disposition` | Advisory findings and owner disposition |
| `GET /api/obligations` | Obligations and evidence (no waiver mutation) |
| `GET /api/readiness` | Computed readiness with evidence list |
| `GET /api/audit?since=` | Audit viewer |
| `POST /api/killswitch` | Disable or enable all dispatch |
| `GET /api/events` (SSE) | Live updates |

Console endpoints require an owner session token. Agent tokens are rejected on every mutating endpoint here.

### 5.4 Review response contract \[Spec §11.6\]

```json
{
  "review_id": "review-42",
  "target_action_id": "decor-proposal-2",
  "target_revision": 2,
  "verdict": "WARN",
  "findings": [{
    "kind": "OPPORTUNITY_COST",
    "feature_ids": ["CG-01","CG-02","CG-04","CG-05","CG-08"],
    "goal_refs": ["event_success@1","P1@1"],
    "evidence_refs": ["budget.cap@1","budget.committed@4","essential_forecast@2"],
    "summary": "The optional purchase fits the cap but risks funding essential arrangements.",
    "computed_signal_id": "forecast-shortfall-10k",
    "uncertainties": ["Essential forecast may change after current vendor quotes."],
    "alternatives": ["Defer the upgrade", "Reduce amount to within forecast headroom"],
    "next_step": "Ask owner to review the trade-off"
  }],
  "review_status": "current"
}
```

Valid verdicts: `NO_CONCERN_FOUND`, `WARN`, `ASK`, `UNAVAILABLE`. Review statuses: `current`, `stale`, `invalid`, `unavailable`.

---

## 6. Non-functional requirements

### 6.1 Security and safety

- **Credential brokering:** connector credentials only in the Guardian process, loaded from environment variables; never in prompts, agent config or logs.
- **Agent identity:** distinct per agent session (bearer token per agent, or one stdio process per agent with its own env var). Verify no cross-session shared history or cache (R15); log context size at agent start.
- **Allowlist:** outbound addresses checked against test domains in both gateway and connector. Kill switch disables all connectors.
- **Prompt injection:** inbound email is data; strict parsing; raw content never reaches tool-using agents.
- **Audit:** append-only (hash chaining optional); every denial, approval, execution, review and disposition recorded.
- **Privacy:** synthetic fixtures only; no real names or addresses.
- **Secrets:** `.env` ignored by git; rotate keys after the event; hide credentials in recordings.
- **Known limit \[Spec\]:** manual or external actions outside the controlled path cannot be blocked, only disclosed and reconciled.

### 6.2 Reliability and consistency

- Idempotency keys on every protected action; no blind retry after `unknown`; scheduled readback.
- Persist the execution claim before dispatch; reconcile on crash.
- Concurrent budget reservations: one denied, ledger stays consistent.
- Concurrent fact change during a running review: result stored as `stale`, not shown as current.

### 6.3 Performance targets \[Judgment, unmeasured\]

| Operation | Target |
| --- | --- |
| Fact change → invalidation visible in console | under 1 s |
| Gateway deny decision (no network) | under 200 ms |
| Reviewer call | timeout around 20–30 s, 1 retry, then `UNAVAILABLE` |
| Full reset to seeded fixture | under 60 s |

These are planning targets; measure and report actuals, including reviewer latency and tokens.

### 6.4 Observability and cost accounting

Record for every model call: purpose (agent, reviewer, retrieval), model and version, sampling settings, input/output tokens, cache-hit tokens when exposed, latency, outcome. Report totals including reviewer and retrieval calls. Never claim savings from shorter summaries alone.

---

## 7. Testing strategy

| Level | What | Examples |
| --- | --- | --- |
| Unit | Canonical hashing, version comparison, resource math, readiness | Shuffled params hash identically; ₹5,000 proposal gives zero shortfall |
| Property | Invalidation both directions; no approval reuse across revisions | Hypothesis tests over random dependency graphs |
| Integration | Gateway end to end with local mail catcher | S2, S4, S5, S9, S12 |
| Scenario | Focused controls plus reviewer ON/OFF | See focused suite below |
| Reviewer | Fixture cases with prelabelled outcomes, positive controls | S17 warns; S18 does not; S20 not mislabelled as drift; S25 hard gate still denies |
| Security | Tool-list audit before every run; side-channel search | Agent config lists no direct email tools |
| Smoke | One Playwright path: change venue, observe stale markers, approve, send |  |

Use the original scenario IDs where applicable, not the entire S1–S32 matrix. Run a focused, prelabelled suite: valid send; stale send from fresh session; unaffected receipt; edited/changed approval; missing dependencies; open or missing mandatory requirements; wrong/current vendor replies; duplicate/unknown result; scope/credentials/allowlist/kill switch; concurrent budget reservation; ₹20,000 shortfall and ₹5,000 positive control; cosmetic drift versus required correction; narrow qualitative policy with missing and sufficient evidence; priority recommendation; stale/invalid/unavailable review; favorable advice cannot bypass a hard denial. Compare reviewer ON vs OFF on identical reasoning fixtures with the same gateway, facts, resource math, trigger inputs and owner UI; OFF suppresses LLM judgment, not hard checks. Record expected/observed outcomes, denominators, failed runs, correctness, latency and model usage; no results until measured. Ordinary-agent and competent-workflow comparisons and wider repetitions are optional research, not release gates.

**Fixtures:** one synthetic event (TechMeet, 120 guests, venues A/B/C, ₹1,00,000 cap, sponsor receipt, vendors) with a reset script that restores every table.

**Controls:** an ordinary valid send succeeds; unaffected action continues; stale approval blocked; fresh history-less agent blocked by state; missing evidence keeps obligation open; conflicting budget requests deny one; unknown provider result produces `unknown` with no duplicate; undeclared critical dependency fails closed; reused approval with different params denied `PARAMS_CHANGED`.

---

## 8. Configuration and repository layout \[Judgment\]

### 8.1 Environment variables

| Variable | Purpose |
| --- | --- |
| `DB_PATH` | SQLite file |
| `OWNER_SESSION_SECRET` | Console session signing |
| `AGENT_TOKENS_JSON` | Per-agent bearer tokens (hashed in DB) |
| `EMAIL_MODE` | `gmail` or `mailcatcher` |
| `SMTP_*` / `IMAP_*` / Gmail OAuth variables | Connector credentials (Guardian process only) |
| `ALLOWED_RECIPIENT_DOMAINS` | Test-domain allowlist |
| `REVIEW_MODEL`, `REVIEW_API_KEY` | Reviewer model and key |
| `REVIEW_TIMEOUT_S`, `REVIEW_MAX_RETRIES`, `REVIEW_RATE_LIMIT` | Review bounds |
| `DEMO_CLOCK_ISO` | Frozen clock for reproducibility |
| `KILL_SWITCH_DEFAULT` | Initial kill-switch state |

Provide `.env.example` with no real values.

### 8.2 Suggested layout

```
/backend
  /core        facts, versions, invalidation, approvals, obligations, gateway
  /review      snapshot builder, resource math, reviewer client, validator
  /mcp         guardian_server, connectors/email, vendor_inbox
  /api         console REST + SSE
  /eval        focused scenarios, reviewer toggle, metrics
/console       web UI
/fixtures      techmeet seed, reset script
/docs          runbook, architecture diagram
```

---

## 9. Technical risks and open items

| Risk | Mitigation |
| --- | --- |
| Gate bypass via a direct tool or credential (R6) | Agents see only Guardian tools; review tool lists before every run |
| Wrong or missing dependency edges (R7) | Typed templates; tests both ways; fail closed |
| Race conditions and duplicate sends (R11) | Per-workspace serialisation, idempotency keys, no blind retry |
| Version confusion (R13) | Integers only |
| Inbound prompt injection (R18) | Strict parsing; data not instructions |
| Reviewer hallucination or shadow authorisation (R32, R33) | Reference validation; recomputed math; read-only; gate unchanged |
| Reviewer context leakage between roles (R36) | Service identity; scoped redaction; leakage tests |
| Stale review shown as current (R37) | Versioned inputs; revalidate on return |
| OAuth friction (R9) | Local mail catcher fallback; test accounts early |

**\[Unverified\] before building:** MCP client support for per-agent identity and elicitation; Gmail token behaviour in test mode; the official rules on pre-existing code and allowed APIs; the real team size and time window.
