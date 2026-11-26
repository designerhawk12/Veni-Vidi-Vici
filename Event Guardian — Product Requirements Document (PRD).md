# Event Guardian — Product Requirements Document (PRD)


> **1 December 2026 delivery scope (PDF review, 25 November):** One reusable Goal Guardian engine, one synthetic TechMeet event, one owner, exactly two independent LLM-driven role agents (Invitations and Catering/Resources), Guardian MCP plus one email connector MCP, and one consolidated owner dashboard. The owner confirms venue facts; transport is not a separate role or required workflow. The minimum reviewer uses one read-only call and shared goal/policy, priority, resource-impact, progress/drift and trigger logic. All external actions use the deterministic gateway; evidence, exact approval, role isolation, deduplication, kill switch and persistent audit remain required. Required evaluation: focused positive/negative controls and reviewer-on/off comparison on identical fixtures. First stretch: grounded cross-agent conflict; optional deeper comparisons, broader qualitative policy, explicit expiry/revocation and hash-chained audit. Excluded for this release: calendar, temporary exceptions/restoration, waivers, incremental context deltas, separate context page, multi-event/production onboarding, exhaustive benchmarks, additional orchestration or custom models. Earlier design catalogue examples and scenario IDs are retained only as background or deferred where explicitly labelled. Implementation status and validation evidence are summarized in the matrix below; provider-backed rehearsal and user evaluation remain outstanding.

**Product:** Event Guardian (user-facing) · **Engine:** Goal Guardian (reusable core) **Track:** Make MCP Matter (Track 1) · **Version:** 0.2 · 1 December scope · **Date:** 25 November 2026 **Source:** *Goal Guardian — Event Coordination, final integrated specification (rev 2, 24 Nov 2026, narrowed by the 25 Nov PDF review)* **Status:** Product requirements and implementation tracking. Automated coverage is local regression evidence, not proof of production readiness or user validation. Priorities (P0/P1/P2), effort and targets are planning judgments the team must confirm.

Tags used: **\[Spec\]** carried over from the source specification · **\[Assumption\]** added in this document and needing confirmation · **\[Unverified\]** must be checked before relying on it.

---

## 1. Product summary

Event Guardian is a goal-aware coordination assistant for event teams whose work is split across several independent agents (invitations, catering/resources) and one human owner. It keeps a **versioned source of truth** outside any agent session, **blocks stale or unapproved actions at the execution boundary**, separates **"attempted" from "confirmed"**, and adds an **independent common-sense reviewer** that questions actions that are allowed but not worthwhile.

**One-line pitch \[Spec\]:** Event Guardian helps event teams make decisions that still serve the original event objective, prevents outdated or unauthorized actions across independent agents, and verifies that changes have actually been reflected in connected tools.

**Core distinction \[Spec\]:** a conventional check asks *"is this action allowed?"*; the independent reviewer asks *"is this a good idea given the known objective?"*. The gateway keeps final authority over execution. The owner keeps authority over discretionary decisions.

**Flagship workflow:** disruption recovery (venue changes mid-planning). Disruption recovery is the headline demo, not the whole product.

---

## 2. Problem and opportunity

When a key fact changes (the venue), some finished work becomes invalid and nothing stops agents or helpers from acting on the old plan. Sending an update email also does not prove the vendor accepted it.

| # | Failure mode | Class |
| --- | --- | --- |
| F1 | Stale action executed (old address sent) | Execution |
| F2 | "Sent" mistaken for "confirmed" | Execution |
| F3 | Over- or under-invalidation of finished work | Execution |
| F4 | Fresh agent repeats a stale step | Execution |
| F5 | Shared budget double-spend | Execution |
| F6 | Premature "ready" claim | Execution |
| F7 | Permissible but misaligned action | Reasoning |
| F8 | Goal drift | Reasoning |
| F9 | Local optimisation conflicts between agents | Reasoning |
| F10 | Unexamined alternatives, diminishing returns | Reasoning |
| F11 | Unresolved semantic requirements (e.g. "keep it accessible") | Reasoning |
| F12 | Outdated priorities after a disruption | Reasoning |

F7–F12 are proposed reasoning failure modes, not empirically established shortcomings of every existing event product **\[Spec\]**.

**Honest positioning \[Spec\]:** a venue-change cascade alone is not novel; event and workflow tools already offer dependency tracking. The hypothesis under test is the *combination*: enforcement at the action boundary, confirmation tracking, scoped context for history-less agents, and independent objective-aware review. If a competent baseline matches the result, the claim is narrowed.

---

## 3. Target users

**Intended user \[Spec\]:** a professional or semi-professional organiser running several concurrent events (small agencies, club or fest committees).

**Open decision:** choose **one** persona for the pitch. **\[Assumption\]** working placeholder: *"a small agency owner running three events at once who delegates to AI role agents."* Replace after 3–5 organiser conversations.

| Actor | Description | Authority |
| --- | --- | --- |
| **Owner** | The human event lead. Confirms facts, goals, priorities, approvals. | Sole approver; can accept/dismiss advisory warnings; cannot override hard invariants via ordinary approval. |
| **Role agents (×2)** | Invitations and Catering/Resources. Isolated sessions, no tool credentials. | Propose actions, read scoped context, report observations (claims, not evidence). Cannot approve, confirm goals, waive obligations or call connectors. |
| **Reviewer service** | Independent, read-only LLM review plus deterministic analysis. | Advisory only. No connector credentials, no approval, no goal changes. |
| **Gateway** | Deterministic execution path. | Final authority to execute or deny. |
| **Vendor (simulated)** | A team-controlled second inbox. | External counterparty; replies are untrusted data. |

**Known gaps \[Spec\]:** no interviews or demand data exist; real planners do not typically run four autonomous agents today; the multi-agent setup is a plausible near-future workflow, not a current habit.

---

## 4. Goals, non-goals and success criteria

### 4.1 Product goals

1. Stop stale or unapproved actions reaching real tools (via the controlled path).
2. Invalidate only what a change affects; leave unrelated work valid.
3. Make readiness a computed fact backed by evidence, never an assertion.
4. Surface grounded, advisory warnings on rule-compliant but counterproductive proposals, drift and conflicts, with alternatives.
5. Keep the owner in control of every discretionary decision.
6. Be honest: every claim is measured on synthetic fixtures and disclosed with limits.

### 4.2 Non-goals \[Spec\]

- Real vendors, guests, money or venues; autonomous legal or financial decisions.
- Graph database, vector database, custom models, KV-cache manipulation.
- Detecting manual actions taken outside the controlled path (disclosed limit).
- General-purpose agent firewall features (secret scanning, shell blocking, tool-definition pinning).
- Twelve separate agents. The twelve common-sense capabilities are functions of **one** reasoning service.

### 4.3 Success criteria

No numeric outcome targets exist in the source; the team must set them after the feasibility test. What the source *does* fix are acceptance conditions and the metrics to report.

**Binary acceptance conditions (controlled synthetic scenarios):**

- Zero stale external operations reach the provider through the controlled path (S2, S4, S12, S25).
- Zero false readiness claims when mandatory obligations are open (S6, S31).
- Only the vendor reply matching token, vendor and current fact versions closes an obligation (S7).
- A favourable review never bypasses a hard denial (S25).
- Unaffected actions remain valid after a change (S3).

**Extended metrics (optional):** concern recall, warning precision, false-warning rate, numeric correctness, grounding, alternative usefulness, drift detection quality, priority recommendation quality, intervention timing, stale-review handling, overhead (calls, tokens, latency, owner interruptions, setup effort), hard-safety regressions.

**Decision gate \[Spec\]:** if a plain dependency workflow plus a server-side check matches execution results, and a well-prompted agent matches reasoning results, narrow the claim to usability, integration and measured overhead.

---

## 5. Product principles

1. **Code enforces, models advise.** Permissions, versions, caps and evidence rules are deterministic code.
2. **Owner authority.** Only the owner confirms facts, goals, hard policies and approvals. Outside sources and LLM output cannot silently override the owner.
3. **State outside sessions.** A fresh agent with no history sees the current plan and is blocked by state, not memory.
4. **Fail closed.** Missing authority or unknown critical dependency requires resolution before a protected write.
5. **Attempted ≠ confirmed.** Provider acceptance is not real-world completion.
6. **Computed readiness.** "Ready" means recorded arrangements satisfy owner-confirmed requirements, as of a stated revision, not that the event will succeed.
7. **Advice is not permission.** Review verdicts are `NO_CONCERN_FOUND`, `WARN`, `ASK` or `UNAVAILABLE`; none grants execution.
8. **Honest scope.** Every feature is labelled implemented, simulated, partial or not built.

---

## 6. Scope

### 6.1 Final product (P0)

One TechMeet fixture (120 guests), two isolated agents, one email workflow (invitation delivery and catering confirmation on controlled inboxes), one consolidated dashboard, local budget ledger and all required foundations in the scope statement. The reviewer covers budget impact, drift, priorities and a narrow qualitative accessibility policy with evidence and alternatives.

### 6.2 Stretch and exclusions

First stretch: one cross-agent conflict between invitations and catering/resources. General trade-off analysis, broader semantics, explicit expiry/revocation and audit hash chaining are optional. All excluded items in the scope statement are outside the December release.

---

## 7. Functional requirements

Priority: **P0** demo cannot exist without it · **P1** strongly improves credibility · **P2** nice to have.

### 7.1 Shared state and facts

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-ST-01 | Store facts as field-level, integer-versioned records (e.g. `venue.address` v3). | P0 |
| FR-ST-02 | Distinguish `proposed` from `owner_confirmed`; a non-owner change creates a review task and never alters confirmed state. | P0 |
| FR-ST-03 | Record who changed what and when; expose current-version lookup. | P0 |
| FR-ST-04 | Keep goals, policies, resource forecasts and progress as versioned records outside agent prompts. | P0 |
| FR-ST-05 | One-command reset to the exact seeded fixture in under a minute. | P0 |

### 7.2 Dependencies and selective invalidation

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-DEP-01 | Typed action templates declare which facts an action depends on; agents propose parameters but not dependencies. | P0 |
| FR-DEP-02 | On an owner-confirmed fact change, mark exactly the dependent actions stale and invalidate their approvals. | P0 |
| FR-DEP-03 | Reopen or create verification obligations for dependent confirmations. | P0 |
| FR-DEP-04 | Leave unrelated work (e.g. sponsor receipt) valid. Test both under- and over-invalidation. | P0 |
| FR-DEP-05 | Critical actions with undeclared dependencies fail closed to owner acknowledgement. An LLM may suggest an edge; the owner must confirm it. | P0 |

### 7.3 Approvals

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-AP-01 | Approval binds the canonical hash of exact parameters plus bound fact versions. | P0 |
| FR-AP-02 | Approving revision 1 never authorises revision 2; edits create a new immutable revision. | P0 |
| FR-AP-03 | Only the owner can approve; agents attempting self-approval are rejected. | P0 |
| FR-AP-04 | Support approval optional expiry and explicit revocation, rechecked at execution if enabled. | P1 |
| FR-AP-05 | The approval UI shows recipient, address, revision and every bound parameter. | P0 |

### 7.4 Execution gateway

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-GW-01 | Single execution path; agents hold no connector credentials. | P0 |
| FR-GW-02 | Checks: scope, action type allowlist, active approval, approval match, expiry if implemented, complete dependencies, owner-review requirement, params hash, fact versions, open blocking obligations, duplicate key. | P0 |
| FR-GW-03 | Every denial returns a machine-readable reason code and the next permitted step. | P0 |
| FR-GW-04 | Provider timeout yields status `unknown` and a readback; never a blind retry. | P0 |
| FR-GW-05 | Budget reservation is an atomic local ledger transaction through the same gateway; conflicting reservations: one is denied. | P0 |
| FR-GW-06 | Outbound recipients restricted to a test-domain allowlist enforced in the connector; kill switch disables all dispatch. | P0 |

### 7.5 Obligations, evidence and readiness

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-OB-01 | Mandatory obligations are created when the owner confirms the event plan, not only after an action occurs. | P0 |
| FR-OB-02 | An obligation closes only with matching evidence. No waiver operation; missing evidence remains open. | P0 |
| FR-OB-03 | Action statuses: drafted, approved, stale, executing, provider-accepted, unknown, acknowledged, confirmed, failed. | P0 |
| FR-OB-04 | Match vendor replies by correlation token, expected vendor and current fact versions; an old-venue reply never closes a new-venue obligation. | P0 |
| FR-OB-05 | Ambiguous or malformed replies route to the owner. Inbound email is untrusted data; extract minimal fields only. | P0 |
| FR-OB-06 | `claim_status` returns a computed answer with open items; unknown requirements mean not ready. | P0 |
| FR-OB-07 | Dashboard wording: "recorded arrangements ready as of revision X". | P0 |

### 7.6 Scoped context

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-CX-01 | `get_context` returns a role-scoped snapshot; the invitations agent never receives sponsor financial details. | P0 |
| FR-CX-03 | Token accounting per call, including reviewer and retrieval calls. | P1 |

### 7.7 Independent common-sense reviewer (CG-01 to CG-12)

One read-only service with deterministic context assembly, resource arithmetic and a progress monitor. The IDs are traceability labels, not separate modules.

| Implementation unit | Original capability IDs | Minimum behavior |
|---|---|---|
| Goal-aware reviewer | CG-01, CG-02, CG-07 | One read-only review; cite confirmed goals and one qualitative accessibility policy; ask when evidence is missing. |
| Progress and drift detector | CG-03, CG-10 | One progress window; distinguish cosmetic repetition from necessary corrections. |
| Resource-impact review | CG-04, narrow CG-06 | Deterministic budget math, essential forecast and feasible alternative; general comparison deferred. |
| Priority model | CG-05, CG-11 | Owner-confirmed tiers plus deadline/dependency-aware next step. |
| Shared recommendation format | CG-08 | Concern, evidence, uncertainty, feasible alternative, next step and recorded owner response. |
| Trigger and deduplication | CG-12 | Relevant proposals, confirmed state changes and deadline checks; suppress repeated findings. |
| Cross-agent conflict | CG-09 | First optional stretch; cite both authorized proposals, redact agent-facing findings. |
 It never grants permission, waives obligations, changes facts or overrides hard rules.

| ID | Capability | Pri | Minimum acceptance |
| --- | --- | --- | --- |
| CG-01 | Independent common-sense judge | P0 | Rule-compliant but misaligned proposal yields a grounded warning; aligned proposal is not flagged merely for costing money; malformed or unavailable review is visibly marked unavailable. |
| CG-02 | Active goal alignment | P0 | Review cites the real goal; a deliberate owner revision is respected after versioning; outdated reviews are not reused. |
| CG-03 | Goal drift detection | P0 | Warn before another optional refinement when evidence supports drift; do not warn when revisions fix venue details or required accessibility. |
| CG-04 | Opportunity-cost reasoning | P0 | Exact fixture arithmetic; ₹20,000 optional proposal flags a ₹10,000 forecast shortfall; ₹5,000 does not; unknown estimates produce a qualification. |
| CG-05 | Goal prioritisation | P0 basic / P1 richer | Owner-confirmed tiers (required, important, optional); never treats a soft preference as a hard prohibition. |
| CG-06 | Resource-impact review (merged into CG-04) | P0 narrow / P1 broader | Budget case required; broader comparisons optional. |
| CG-07 | Semantic policy evaluation | P0 basic / P1 broader | One step-free access policy; cite supplied evidence; missing evidence triggers ASK; documented satisfaction does not create a false warning; hard budget/capacity violations are denied by code. |
| CG-08 | Alternative recommendation | P0 basic / P1 broader | At least one grounded, actionable alternative; alternatives are drafts needing their own approval. |
| CG-09 | Cross-agent conflict detection | P1 first stretch | Identifies conflict with references to both proposals; no scope leakage. |
| CG-10 | Diminishing returns | P0 via drift fixture / P1 general | Distinguish cosmetic repetition from required fixes. |
| CG-11 | Task reprioritisation | P0 basic / P1 broader | Order respects dependencies and deadlines; no unauthorised reassignment. |
| CG-12 | Proactive intervention | P0 | Warning appears before the action or deadline; deduplicated; no alert loop. |

### 7.7.1 Review contract

- Verdicts: `NO_CONCERN_FOUND`, `WARN`, `ASK`, `UNAVAILABLE`.
- Server assembles the review context; the proposing agent cannot choose it.
- Server validates every returned reference against the supplied snapshot and recomputes numbers.
- Reviews are versioned and marked stale if relevant versions change.
- On model failure, show *unavailable*; for actions configured to require review, require a real owner decision.
- Owner dispositions (accept, dismiss, clarify, resolved) are recorded and do not authorise execution.

### 7.8 Owner console

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-UI-01 | One dashboard with Actions and integrated Readiness panel (obligations and evidence). | P0 |
| FR-UI-02 | Pending approvals with exact parameters; approve or reject. | P0 |
| FR-UI-03 | Goal and priority view with versions. | P0 |
| FR-UI-04 | Advisory warning panel: cited goal, budget math, estimate provenance, alternatives, disposition control. | P0 |
| FR-UI-05 | Unified History panel: progress claims and authoritative audit events visually distinct. | P0 |
| FR-UI-07 | Kill switch control and connector status. | P0 |

### 7.9 Integrations (MCP)

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-MCP-01 | Agent-facing Guardian MCP server with per-agent identity exposing only: `get_context`, `propose_action`, `execute_action`, `list_obligations`, `claim_status`, `reserve_budget`, `record_observation`, `get_goals`, `request_review`, `list_findings`, `record_progress`, `recommend_priorities`. | P0 |
| FR-MCP-02 | Email connector MCP server (send, search, read thread) held only by the Guardian, test accounts only. | P0 |
| FR-MCP-03 | Vendor inbox: second team-controlled mailbox with reply helper. | P0 |
| FR-MCP-05 | At least two separate MCP servers appear in architecture and demo. | P0 |

### 7.10 Evaluation

Use the original scenario IDs where applicable, not the entire S1–S32 matrix. Run a focused, prelabelled suite: valid send; stale send from fresh session; unaffected receipt; edited/changed approval; missing dependencies; open or missing mandatory requirements; wrong/current vendor replies; duplicate/unknown result; scope/credentials/allowlist/kill switch; concurrent budget reservation; ₹20,000 shortfall and ₹5,000 positive control; cosmetic drift versus required correction; narrow qualitative policy with missing and sufficient evidence; priority recommendation; stale/invalid/unavailable review; favorable advice cannot bypass a hard denial. Compare reviewer ON vs OFF on identical reasoning fixtures with the same gateway, facts, resource math, trigger inputs and owner UI; OFF suppresses LLM judgment, not hard checks. Record expected/observed outcomes, denominators, failed runs, correctness, latency and model usage; no results until measured. Ordinary-agent and competent-workflow comparisons and wider repetitions are optional research, not release gates.

## 8. User stories

- **Owner:** As the owner, when I change the venue I want only affected work to turn stale, so I do not redo the sponsor receipt.
- **Owner:** As the owner, I want the approval screen to show exact recipients, address and revision, so approval is meaningful.
- **Owner:** As the owner, I want a warning when a ₹20,000 upgrade fits the cap but starves essential catering, with an alternative and the numbers.
- **Owner:** As the owner, I want to dismiss or accept a warning with a reason, so the same warning does not loop.
- **Owner:** As the owner, I want to ask "are we ready?" and get an evidence list, not an assertion.
- **Invitations agent:** As a fresh agent with no history, I want a clear denial reason and next step, so I can recover without looping.
- **Catering agent:** As an agent, I want to reserve budget atomically so I never double-spend with another agent.
- **Any agent:** I need to be told when my scoped view lacks a needed fact, rather than guessing.

---

## 9. Demo scenarios as acceptance tests \[Spec §14\]

**Recovery flow:** normal flow, disruption, the block, recovery, attempted vs confirmed, vendor replies (current and late old-venue), ready.

**Reasoning branch (seeded fixture):** cap ₹100,000; committed or reserved ₹65,000; essential forecast ₹25,000; optional headroom ₹10,000; catering response due in six hours; clock frozen three days before the event.

| Scene | Expected |
| --- | --- |
| R1 Establish goal | Goal version, priority policy, outstanding requirements, resource breakdown |
| R2 ₹20,000 decorations | Hard cap passes; review projects ₹10,000 essential shortfall |
| R3 Explain and offer alternative | Warning card cites goal, math, uncertainty; owner rejects or revises |
| R4 Drift | Three cosmetic revisions while catering deadline nears: warning with evidence |
| R5 Reprioritise | Reconfirm catering and correct venue-dependent invites first |
| R6 Apply the gate | Fresh agent stale send denied even if the review had no concern |
| R7 Verify readiness | Old vendor reply ignored; current matching reply closes obligation |

Include one ordinary valid action that proceeds without warning. If the live reviewer fails, disclose it and show the recorded run.

---

## 10. Non-functional requirements (summary; detail in TRD)

- **Safety:** synthetic data only, test accounts, allowlist and kill switch.
- **Security:** credential brokering, no secrets in prompts or logs, inbound email treated as data.
- **Reliability:** idempotency keys, no blind retry, atomic claims, reconciliation on unknown results.
- **Auditability:** append-only (hash chaining optional) audit log; concise reviewer rationale stored, not hidden chain of thought.
- **Reproducibility:** demo clock, deterministic fixtures, one-command reset.
- **Cost control:** bounded review triggers, deduplication, rate limits and timeouts; overhead measured, not assumed.
- **Usability:** approve/reject within a few clicks; warnings concise and role-redacted.

---

## 11. Claims policy

| We can say | We must not say |
| --- | --- |
| In controlled synthetic scenarios the gate blocked stale actions the baseline allowed. | That this prevents real-world event failures. |
| Confirmation is tracked separately from sending, with real reply matching on team-controlled inboxes. | That vendors actually confirmed anything real. |
| The reviewer identified a documented opportunity cost in a tested case, if observed. | That it always decides optimally or has universal common sense. |
| The design accommodates all twelve CG capabilities. | That all twelve are implemented because they appear in the proposal. |
| Existing tools overlap with parts of this. | That this is a new market or unsolved problem. |
| We did not interview users at scale. | That demand is established. |

---

## 12. Feature status matrix (fill before the final pitch)

| Feature family | Status (implemented / simulated / partial / not built) | Test evidence |
| --- | --- | --- |
| Event coordination (2 independent live LLM roles) | **Partial**: fresh-process Gemini role-agent CLI exists, but live rehearsal and comparable ON/OFF benchmark remain to be run | MCP, HTTP and role-agent unit coverage |
| Shared state and scoped context | **Implemented**: SQLite facts, role-scoped context, estimated payload accounting, SSE refresh, custom HTTP MCP and official-SDK streamable HTTP MCP | Backend state, scope, MCP and HTTP tests |
| Disruption recovery | **Implemented**: selective venue invalidation, stale approvals, and fact-based evidence reopening | 25 Guardian unit/HTTP tests |
| Merged advisory common sense (required scope; CG-09 stretch) | **Partial**: deterministic budget, drift, qualitative-policy, priority findings, stale-on-fact-change and deduped review records; no complete CG-12 model lifecycle | `/api/review`, reviewer dedupe and stale-state tests |
| Execution gateway | **Implemented**: owner approval/revocation, role/type checks, stale facts, expiry, allowlist, kill switch, duplicate and atomic budget claims | Gateway, expiry, revocation and concurrent-claim tests |
| Verification (real inbox or disclosed simulator) | **Partial**: optional SMTP dispatch, IMAP polling, local catcher fallback, and authenticated vendor reply API; sustained real-inbox rehearsal remains | HTTP vendor/evidence tests and connector configuration |
| Monitoring and console | **Implemented**: responsive dashboard, SSE refresh, audit integrity, audit history, readiness, kill switch, reset and API status | TypeScript/Vite build |
| Evaluation | **Partial**: focused backend suite, frontend build, Playwright smoke tests, and deterministic reviewer ON/OFF fixture comparison; no live-model ON/OFF or sustained benchmark | `pnpm test`, `pnpm test:e2e`, `pnpm build` and `pnpm benchmark:review` |

---

## 13. Release phases

| Phase | Content |
|---|---|
| Feasibility | Rules check, independent sessions, stale denial and controlled email readback. |
| Core build | Required scope in §6.1; validate foundations before live reviewer. |
| Final validation | Focused test suite, reviewer-on/off comparison, rehearsal and feature status matrix. |
| Stretch only | Cross-agent conflict first, then optional features listed in §6.2. |

---

## 14. Dependencies, risks and open decisions

**Top risks \[Spec\]:** pitch collapses into "task dependency tracker" (R1); scope creep (R4); wrong or missing dependency edges (R7); OAuth friction (R9); strawman baseline (R19); tiny samples (R20); live demo failure (R23); reviewer hallucination or shadow authorisation (R32, R33); full vision mistaken for implemented MVP (R38).

| Open decision | Options | Owner |
| --- | --- | --- |
| Persona | Small agency, fest committee, other | Team |
| Agent runtime and identity | Which LLM and client; stdio per agent vs HTTP tokens | Agents lead |
| Email path | Real test Gmail with local mail catcher fallback | Integrations lead |
| Console | Minimal web page or terminal approval | Console lead |
| Baseline design | Exact reviewer ON/OFF configuration; external baselines optional | Agents lead |
| Review model | Structured-output model, timeout, scope, human fallback | Agents lead |
| Scripted vs live agents | Which are live; what is disclosed on stage | Team |

**\[Unverified\]:** official rules and rubric (meaningful MCP use, team size, pre-existing code, allowed APIs); the real event window and team size; MCP client support for per-agent identity and elicitation; Gmail OAuth behaviour for test-mode apps.
