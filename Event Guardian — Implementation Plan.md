# Event Guardian — Implementation Plan


> **1 December 2026 delivery scope (PDF review, 25 November):** One reusable Goal Guardian engine, one synthetic TechMeet event, one owner, exactly two independent LLM-driven role agents (Invitations and Catering/Resources), Guardian MCP plus one email connector MCP, and one consolidated owner dashboard. The owner confirms venue facts; transport is not a separate role or required workflow. The minimum reviewer uses one read-only call and shared goal/policy, priority, resource-impact, progress/drift and trigger logic. All external actions use the deterministic gateway; evidence, exact approval, role isolation, deduplication, kill switch and persistent audit remain required. Required evaluation: focused positive/negative controls and reviewer-on/off comparison on identical fixtures. First stretch: grounded cross-agent conflict; optional deeper comparisons, broader qualitative policy, explicit expiry/revocation and hash-chained audit. Excluded for this release: calendar, temporary exceptions/restoration, waivers, incremental context deltas, separate context page, multi-event/production onboarding, exhaustive benchmarks, additional orchestration or custom models. Earlier design catalogue examples and scenario IDs are retained only as background or deferred where explicitly labelled. All implementation claims remain unverified.

**Version:** 0.2 · 1 December scope · **Date:** 25 November 2026 **Source:** *Goal Guardian — Event Coordination, final integrated specification (rev 2, 24 Nov 2026, narrowed by the 25 Nov PDF review)*, sections 15, 16, 17, 18, 21 and 22. **Status:** Planning document. Effort figures, schedule and cut lines are rough planning estimates (they exclude integration debugging, which usually dominates). Nothing has been built or tested.

Tags: **\[Spec\]** from the specification · **\[Judgment\]** added here · **\[Unverified\]** must be confirmed.

---

## 1. Objective and definition of done

**Objective:** deliver a credible thin slice of Event Guardian: an enforcement gateway, verified closure with a real inbox, a minimal live independent reviewer, two genuinely LLM-driven role agents, a minimal owner console, and a focused reviewer-on/off comparison.

**Done means \[Spec §22\]:**

- Stale invitation is denied by state alone, from a fresh history-less agent, while the unrelated sponsor receipt stays valid.
- Corrected revision is exactly approved, sent to the test inbox, and verified by readback.
- "Ready" is refused while obligations are open; only a reply matching token, vendor and current fact versions closes the obligation.
- At least one correct warning on a rule-compliant action (₹20,000 decorations, ₹10,000 shortfall), one justified drift intervention, and the positive controls (₹5,000 purchase; required corrections not flagged).
- Narrow step-free access policy returns ASK on missing evidence; dependency-aware next step and proactive deadline triggers are tested.
- Reviewer ON/OFF comparison recorded with correctness, latency and usage.
- A favourable review cannot bypass a hard denial.
- A recorded clean full run exists, at least five rehearsals are done, and every feature is marked implemented / simulated / partial / not built with test evidence.

**Decision gate \[Spec\]:** a successful recovery demo does not by itself validate the common-sense claim. If conventional tools and a well-configured planning agent perform as well, narrow the claim.

---

## 2. Planning assumptions

| Assumption | Basis |
| --- | --- |
| A single time-boxed build of roughly 24 hours | \[Spec\] \[Unverified\]: confirm the real window and rescale |
| Four people, at most 96 gross person-hours; plan 65–75 focused hours | \[Spec\] \[Unverified\]: confirm team size |
| Synthetic data, test accounts, no real money or people | \[Spec\] |
| SQLite, a small Python API, no GPU, no graph or vector database | \[Spec\], \[Judgment\] on language |
| Official rules and judging rubric not yet read | \[Spec\]: first-hour action |

**My arithmetic on the specification's estimate table \[Judgment\]:** the previous broad estimates are superseded by the narrowed work breakdown; re-estimate after the feasibility gate. No revised effort or completion guarantee is asserted.

---

## 3. Work breakdown

| ID | Required deliverable | Depends on | Acceptance |
|---|---|---|---|
| D0 | Rules and feasibility | — | Two isolated sessions; controlled send/readback; go/no-go |
| D1–D3 | Fixtures/reset, schema, versioned goals/facts | D0 | Repeatable seed; owner-only confirmation |
| D4–D6 | Selective invalidation, exact approval, obligations | D2–D3 | Dependent stale; unaffected valid; missing evidence not ready |
| D7 | Deterministic gateway and atomic execution claim | D4–D6 | Valid send passes; invalid and duplicate sends denied |
| D9a/b/d, D8 | Guardian MCP, one email MCP, controlled inbox/readback and reply helper | D7 | Credential isolation; current matching reply only |
| D10–D11 | Exactly two independent agents, scoped snapshots | D9a | Invitations and Catering/Resources cannot bypass scope |
| D12 | One goal-aware reviewer with validation, resource math, drift, priority, narrow accessibility, triggers and shared alternatives | D2–D6 | Budget/drift/policy positives and negatives; no stale advice |
| D13 | One dashboard, all essential panels | D3–D12 | Decisions distinct from approvals; readiness/evidence and unified history |
| D14–D15 | Focused controls and reviewer ON/OFF | D7–D13 | Prelabelled identical fixtures; measured correctness, latency, usage |
| D19 | Safety | D9b | Allowlist, kill switch, parsing, secrets |
| D16–D18 | Rehearsal, recording, deck and README | All required | Repeatable reset, feature status matrix, clean run |
| D12b | Optional first stretch: one cross-agent conflict | All required | Cited conflict, no scope leakage |

### 3.1 Team responsibilities (planning assumption)
Core: D1–D7; Integrations: D8, D9, D19; Agents/review/evaluation: D10–D12, D14–D15; Console/demo: D13, D16–D18. Pair on gateway/evidence and agree contracts early. Four team members and a 24-hour sprint are historical planning assumptions, not confirmed availability; rescale to actual time before 1 December.

---

## 4. Timeline and decision gates \[Spec §16\]

| Hours | Focus | Exit check |
| --- | --- | --- |
| 0–1 | D0: read rules and rubric, feasibility test, go / no-go | **Gate 0** |
| 1–4 | D1, D2, D3; goals and progress fixtures; agree API and review contracts | Contract frozen |
| 4–9 | D4, D5, D6, D7 plus D9a | **Gate 1** |
| 9–14 | Integrations D8, D9b, D9d; in parallel Agents lead builds D12 on local fixtures | **Gate 2** |
| 14–18 | D10, D13, D12 integration, required scoped snapshots (D11) | End-to-end run; required live review cases exercised |
| 18–21 | Minimum D14/D15 comparison and reasoning controls; **code freeze near hour 20** | **Gate 3** |
| 21–23 | D16 rehearsals, recording, D17 deck | Five rehearsals |
| 23–24 | Buffer only. No new features | Submit |

| Gate | Question | If no |
| --- | --- | --- |
| **0 (hour 1)** | Did the feasibility test pass; are the rules compatible? | Pivot: research claim integrity, application assurance, or freelancer exact-version approval |
| **1 (hour \~9)** | Is a stale send blocked end to end locally, with the sponsor receipt unaffected? | Cut optional D12b; fix the gate before proceeding; disclose any required item not completed |
| **2 (hour \~14)** | Does real readback with vendor-reply matching work? | Switch to the local mail catcher, disclose it, continue |
| **3 (hour \~20)** | Are gateway and evidence path reliable, is independent review demonstrated, is minimum evaluation under way? | Stop feature work; report missing or failed features; claim no full coverage |

If the reviewer cannot be demonstrated, present a narrower recovery prototype rather than claiming the full Guardian.

---

## 5. Phase plans

### Phase 0 — Feasibility and rules (hour 0–1)

1. Read the official rules and rubric. Note meaningful-MCP-use criteria, team size, pre-existing-code rules and allowed APIs.
2. Confirm the real time window and rescale this plan.
3. Assign roles and agree the API contract outline.
4. Create test accounts (agent mailbox, vendor mailbox) and verify send and read.
5. Run the feasibility test: two isolated sessions, one venue version change, an old invitation rejected, one harmless real send with readback.
6. Run one separate read-only model review on the budget fixture plus a valid positive control; verify references and arithmetic.
7. Write the go / no-go paragraph. Freeze the minimum common-sense cases and the fallback if the model is unavailable.
8. Set up the repo, `.env.example`, `.gitignore` for secrets, and the shared runbook. Schedule code freeze and rehearsal slots now.
9. Arrange 3–5 short conversations with real organisers (one question: "Tell me about the last time a late change broke something you had already sent").

### Phase 1 — Foundations and contracts (hour 1–4)

| Person | Tasks |
| --- | --- |
| Core | Schema and migrations (Backend Schema doc); fact versioning; persistent append-only audit log |
| Integrations | Mail accounts, local mail catcher fallback, connector skeleton |
| Agents and eval | Goal and priority fixture; progress and forecast fixtures; draft review prompt and JSON schema; choose agent runtime and identity transport |
| Console and demo | Wireframes from the UI/UX brief; fixture reset script (D1); README skeleton |

**Contract freeze at hour 4 \[Judgment\]:** DB schema; Guardian MCP tool signatures; console REST endpoints; review JSON contract; reason-code list; fixture IDs. Changes after this need a three-person agreement.

### Phase 2 — Core enforcement (hour 4–9)

- **Core:** typed action templates and `apply_fact_change` (D4); canonical hashing and approval binding (D5); obligation ledger and `can_claim_ready` (D6); gateway with check order, atomic claim, idempotency and reason codes (D7). Write the negative-control tests **before** the gateway code.
- **Integrations:** Guardian MCP server (D9a) calling the gateway; per-agent identity.
- **Agents and eval:** reviewer service skeleton with deterministic resource math and schema validation, run on local fixtures.
- **Console:** status board skeleton against the REST API.
- **Gate 1 check:** stale send blocked end to end locally; sponsor receipt unaffected.

### Phase 3 — Integrations and evidence (hour 9–14)

- **Integrations:** real email send and readback (D8, D9b), vendor inbox and reply helper (D9d), correlation tokens, strict reply parser, allowlist and kill switch (D19).
- **Core:** hardening of concurrency (per-workspace serialisation, persisted claims, unknown-result reconciliation).
- **Agents and eval:** reviewer live call with timeouts, dedupe, stale marking and the “unavailable” path.
- **Gate 2 check:** real readback and vendor-reply matching; else switch to the mail catcher and disclose.

### Phase 4 — Agents, console and review integration (hour 14–18)

- Launch exactly two genuinely LLM-driven role agents as **fresh processes**, restricted tool lists, own identities; verify empty history at start (risk R15).
- Console: approvals with exact parameters, goals, advisory panel, seeded timeline, readiness, kill switch.
- Integrate review into `propose_action`; show warnings with cited goals, math and alternatives; record owner dispositions.
- Basic role-scoped snapshots; no incremental deltas.
- Run the full end-to-end flow once, live, including one live review.

### Phase 5 — Evaluation and freeze (hour 18–21)

- Build reviewer ON/OFF toggle; optional external baselines only after required comparison.
- Run the focused mandatory controls in §8, including the narrow policy and freshness tests; repeat identical fixtures as time permits.
- Record exact denominators, failures and tokens including reviewer and retrieval calls.
- **Code freeze about hour 20.** Only bug fixes for demo blockers after that.
- **Gate 3 check.**

### Phase 6 — Rehearsal and submission (hour 21–24)

- At least five full rehearsals; record a clean full run; screenshot set.
- Deck, one-pager and architecture diagram; limitations slide.
- README test: someone outside the team starts the system in under 10 minutes.
- Hour 23–24 is buffer only.

---

## 6. Reviewer build order \[Judgment\]

One service, one output schema, built in this order so a working slice exists early:

1. Authorised snapshot builder and deterministic resource math (CG-04 signals).
2. Structured review call, schema and reference validation, `UNAVAILABLE` path (CG-01).
3. Goal and priority lookup and alignment finding (CG-02, CG-05 basic).
4. Warning card with alternative (CG-08 basic) and owner dispositions.
5. Progress journal, threshold trigger and drift finding with counter-evidence (CG-03, CG-10 via fixture, CG-12).
6. Reprioritisation after disruption (CG-11 basic) and semantic policy check (CG-07 basic).
7. Narrow trade-off case is already merged into budget impact (P0). First stretch: cross-agent conflict (CG-09); broader coverage optional.

Do **not** build twelve services. The prompt contract: judge only against supplied owner-confirmed goals; separate hard facts from estimates; cite only supplied references; flag insufficient evidence; never authorise or execute.

---

## 7. Test and quality plan

| Layer | Plan |
| --- | --- |
| Unit | Canonical hashing with shuffled inputs; version comparison on integers; resource math (₹20,000 → ₹10,000 shortfall; ₹5,000 → ₹0); readiness logic |
| Property | Invalidation both directions; approval never reusable across revisions |
| Integration | Gateway with the local mail catcher; unknown-result path; concurrent budget reservations (one denied) |
| Scenario | Focused scenario suite; no exhaustive matrix |
| Reviewer | Prelabelled fixtures written **before** runs; positive controls; reference-validation failure injects; timeout and malformed-output cases |
| Security | Before every run, audit the agent tool lists (no direct email tools); search for side channels; instruction-like vendor text is treated as data (S16) |
| Smoke | One scripted pass through the demo, run before each rehearsal |

**Controls to pass \[Spec §14.2\]:** ordinary valid send succeeds; unaffected action continues; deliberate owner revision handled and re-approved; stale approval blocked; new agent without history blocked by state; missing evidence keeps obligation open; conflicting budget requests deny one; unknown provider result produces `unknown` with no duplicate; undeclared critical dependency fails closed; approval reused with different params denied `PARAMS_CHANGED`.

---

## 8. Evaluation execution plan \[Spec §17\]

Use the original scenario IDs where applicable, not the entire S1–S32 matrix. Run a focused, prelabelled suite: valid send; stale send from fresh session; unaffected receipt; edited/changed approval; missing dependencies; open or missing mandatory requirements; wrong/current vendor replies; duplicate/unknown result; scope/credentials/allowlist/kill switch; concurrent budget reservation; ₹20,000 shortfall and ₹5,000 positive control; cosmetic drift versus required correction; narrow qualitative policy with missing and sufficient evidence; priority recommendation; stale/invalid/unavailable review; favorable advice cannot bypass a hard denial. Compare reviewer ON vs OFF on identical reasoning fixtures with the same gateway, facts, resource math, trigger inputs and owner UI; OFF suppresses LLM judgment, not hard checks. Record expected/observed outcomes, denominators, failed runs, correctness, latency and model usage; no results until measured. Ordinary-agent and competent-workflow comparisons and wider repetitions are optional research, not release gates.

---

## 9. Demo and pitch preparation

- **Live slot (3–4 min):** R1–R3 (30–60 s), R4–R5 (about 30 s), R6 (about 60 s), R7 (about 45 s), measured results and limitations (15–30 s). Keep the longer script as the recorded fallback.
- Show one valid ordinary action that proceeds with no warning; do not show only failures.
- **Honesty rules:** disclose which agents are scripted; both are genuinely LLM-driven; if the live reviewer fails, show "unavailable" and the recording, never a fabricated verdict.
- **Failure playbook:** real email fails, use the mail catcher and say so; LLM misbehaves, re-run once then show the recording; console down, show audit log and recording; network down, play the full recording; the block does not trigger, stop and show the recorded run without improvising; unmeasured question, say "we did not measure that".
- **Deck:** problem story, execution and reasoning failure modes, demo, architecture, evaluation, honest limitations, what is next. Never pitch it as a generic firewall or "33 ideas".

---

## 10. Cut list and priority order

Never cut the PDF-required foundations, all minimum merged reviewer behaviors, two independent agents, one email connector, consolidated dashboard, safety, reset, focused tests and reviewer-on/off comparison. First stretch only after all required tests pass: cross-agent conflict; then optional explicit approval expiry/revocation, hash chaining, broader policy and comparisons. Excluded features are not contingency backlog for 1 December.

---

## 11. Risk checkpoints

| Risk | Early warning | Planned response |
| --- | --- | --- |
| R4 scope creep | New "quick" features after hour 9 | Freeze scope at D0; stretch only if Gate 3 is on track |
| R6 gate bypass | An agent config lists direct email tools | Review tool lists before every run |
| R7 wrong dependency edges | Sponsor receipt flagged stale, or old invitation passes | Tests in both directions; fail closed |
| R9 OAuth friction | Still on OAuth screens after hour 10 | Local mail catcher |
| R15 non-isolated sessions | A "fresh" agent already knows the venue change | Fresh process, verify empty history |
| R23 live demo failure | First full run after hour 20 | Recording; one-command reset; integrate by hour 14 |
| R28 late integration | Roles still testing in isolation at hour 15 | Contract freeze hour 4; daily integration checks |
| R30 fatigue | Bugs introduced after freeze | Hard freeze near hour 20; buffer hour |
| R32–R33 reviewer hallucination / shadow authority | Unsupported numeric claim or ID; verdict bypasses approval | Reference validation, recomputed math, read-only reviewer, unchanged gate |
| R38 vision mistaken for MVP | Pitch says all twelve capabilities work | Feature-status matrix with test evidence |

---

## 12. Release checklist

**Safety:** test accounts only; allowlist enforced in the connector; kill switch tested; no secrets in git, prompts, logs or recordings.

**Functionality:** all P0 controls pass; live budget, drift, narrow policy and priority reviewer cases; hard denial unaffected by a favourable review.

**Honesty:** feature-status matrix filled (implemented / simulated / partial / not built, with evidence); failed runs and integrations disclosed; scripted vs live agents disclosed; mail path (real inbox or mail catcher) disclosed.

**Delivery:** README works from a clean machine in under 10 minutes; reset under 60 seconds; recording and screenshots stored offline; deck and one-pager final; code freeze respected.

---

## 13. If more time is available \[Judgment\]

Use spare time first for a single grounded cross-agent conflict using the same two roles; then broaden qualitative policy and resource comparisons, add explicit expiry/revocation or hash chaining, repeat focused evaluation, and improve reliability. Do not add excluded event-management breadth before 1 December.

---

## 14. Open items to confirm

| Item | Owner |
| --- | --- |
| Real time window, team size, official rules and rubric | Team |
| Persona for the pitch | Team |
| Agent runtime and per-agent identity mechanism (stdio per agent vs HTTP tokens) | Agents lead |
| Email path (Gmail test accounts with mail-catcher fallback) | Integrations lead |
| Console: minimal web page or terminal approval for the first run | Console lead |
| Baseline design written down | Agents lead |
| Review model, timeout, scope and human-review fallback | Agents lead |
| Scripted vs live agents and stage disclosure | Team |
| Whether the Option B status colours in the UI brief are acceptable | Console lead and palette owner |
