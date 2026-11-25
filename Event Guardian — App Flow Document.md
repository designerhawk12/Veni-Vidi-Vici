# Event Guardian — App Flow Document


> **1 December 2026 delivery scope (PDF review, 25 November):** One reusable Goal Guardian engine, one synthetic TechMeet event, one owner, exactly two independent LLM-driven role agents (Invitations and Catering/Resources), Guardian MCP plus one email connector MCP, and one consolidated owner dashboard. The owner confirms venue facts; transport is not a separate role or required workflow. The minimum reviewer uses one read-only call and shared goal/policy, priority, resource-impact, progress/drift and trigger logic. All external actions use the deterministic gateway; evidence, exact approval, role isolation, deduplication, kill switch and persistent audit remain required. Required evaluation: focused positive/negative controls and reviewer-on/off comparison on identical fixtures. First stretch: grounded cross-agent conflict; optional deeper comparisons, broader qualitative policy, explicit expiry/revocation and hash-chained audit. Excluded for this release: calendar, temporary exceptions/restoration, waivers, incremental context deltas, separate context page, multi-event/production onboarding, exhaustive benchmarks, additional orchestration or custom models. Earlier design catalogue examples and scenario IDs are retained only as background or deferred where explicitly labelled. All implementation claims remain unverified.

**Version:** 0.2 · 1 December scope · **Date:** 25 November 2026 **Source:** *Goal Guardian — Event Coordination, final integrated specification (rev 2, 24 Nov 2026, narrowed by the 25 Nov PDF review)* **Status:** Design proposal. Flows describe intended behaviour, not implemented behaviour.

This document describes how people, agents and services move through Event Guardian: who does what, in which order, what the system shows, and what happens when something fails. Screens are referenced by name and specified in the UI/UX brief. Reason codes and status names match the TRD and Backend Schema.

---

## 1. Actors and surfaces

| Actor | Surface | Can do | Cannot do |
| --- | --- | --- | --- |
| **Owner** | Owner console (web) | Confirm facts, goals, policies; approve exact actions; dispose of warnings; kill switch | Bypass hard invariants with an ordinary approval |
| **Role agent** (invitations, catering/resources) | Guardian MCP server only | Read scoped context, propose actions, execute approved actions, report observations and progress, request review | Approve, confirm goals, alter hard policy, manufacture evidence, reach any connector |
| **Reviewer service** | Internal, read-only | Produce advisory findings | Authorise, execute, change facts or goals |
| **Gateway** | Internal | Allow or deny execution | Treat review output as permission |
| **Vendor (simulated)** | Team-controlled inbox | Reply to messages | n/a (external) |

### 1.1 Screen map (owner console)

One consolidated dashboard with Actions, Decisions (exact approvals and advisory cards), Goals & Facts, Readiness (obligations and evidence), History (separately labelled progress and audit), and Settings in a drawer/header. All are panels, not distinct routes. No waiver or context-viewer page.

## 2. Primary navigation and global behaviour

Open the single dashboard. Header shows workspace, readiness, email connector mode and kill switch. Decision queue combines pending approvals and advisory warnings but maintains independent controls. Server updates refresh affected panels; no standalone feed. Every denial, proposal, approval, review, disposition and execution result is persisted; reported progress is labelled separately from trusted evidence. Use scoped snapshots when agents next request context.

---

## 3. Flow 0 — Setup and feasibility (before the build)

1. Read the official rules and rubric; confirm team size, time window, pre-existing code rules, allowed APIs.
2. Run the feasibility test: two isolated sessions, one venue version change, an old invitation rejected, one harmless real send with readback.
3. Write a one-paragraph go / no-go. If no-go, pivot per the specification (research claim integrity, application assurance, or freelancer exact-version approval).

---

## 4. Flow 1 — Owner onboarding: confirm the plan, goals and requirements

| Step | Actor | Action | System response |
| --- | --- | --- | --- |
| 1 | Owner | Opens **Dashboard / Goals**, reviews seeded objective, hard constraints (cap ₹1,00,000, minimum capacity 120), soft preferences (P1, P2) and priorities (required, important, optional) | Shows version numbers and status `proposed` |
| 2 | Owner | Confirms goal and policy versions | Status `owner_confirmed`; version recorded; earlier versions retained |
| 3 | Owner | Opens **Dashboard / Goals & Facts**, confirms core facts (venue.address v2 (prior v1 seeded), event.start, headcount, budget.cap, guest\_list.version, menu.version) | Facts become current confirmed versions |
| 4 | Owner | Confirms the **event plan** (readiness requirements) | Mandatory obligations created now (venue confirmed, catering confirmation, accurate invitations verified); readiness = not ready |
| 5 | System | Seeds resource ledger and forecasts | Cap, committed, reserved, essential forecast visible on **Dashboard / Goals** |

**Rule:** a hard limit needs an explicit structured predicate confirmed by the owner before the gateway enforces it. A natural-language soft preference never becomes an enforceable rule on its own.

---

## 5. Flow 2 — Agent action lifecycle (the standard path)

```
Agent                 Guardian MCP / services              Owner (console)
  | get_context()  ------->  scoped snapshot                      |
  | propose_action() ----->  revision n created (deps from template)|
  |                          server builds review snapshot          |
  |                          deterministic signals -> reviewer      |
  |                          validated finding (or UNAVAILABLE)     |
  |                          ---------------------------------->   | sees exact params
  |                                                                 | + advisory finding
  |                          <---------------------------------    | approve / reject
  | execute_action(id, approval) -> gateway checks 0..14            |
  |                          claim persisted -> connector call      |
  | <-------- result or structured denial {code, message, next_step}|
  |                          readback / vendor reply -> evidence    |
```

**Action status path:** Drafted → Approved → Executing → ProviderAccepted → Acknowledged → Confirmed.

**Branches:**

- Owner rejects → action stays Drafted with a rejection reason; the agent revises (new revision).
- A bound fact changes before execution → action and approval go **Stale**; agent revises; owner re-approves.
- Gateway denies → agent reads the reason code and next step (see section 14).
- Provider times out → status **Unknown** → readback → ProviderAccepted or Failed. **No blind retry.**

---

## 6. Flow 3 — Normal flow (demo scene 1)

1. Catering agent calls `reserve_budget` → an exact reservation action passes through the gateway → atomic local reservation recorded.
2. Catering agent proposes `send_catering_update`; owner approves exact parameters; gateway allows; email sent to the vendor inbox with a **correlation token** in the subject.
3. Obligation "vendor confirms venue version" opens in state `pending_verification`.
4. Invitations agent drafts and the owner approves the invitation batch; it is **held** (not yet sent).
5. Sponsor receipt reconciled (unprotected action).

**Board shows:** items with approvals, one pending vendor confirmation, sponsor receipt valid.

---

## 7. Flow 4 — Disruption: the venue changes (demo scenes 2–4)

### 7.1 Owner changes the venue

| Step | Actor | Action | System response |
| --- | --- | --- | --- |
| 1 | Owner | On **Dashboard / Goals & Facts** selects `venue.address`, enters Venue B, confirms | New version v3 `owner_confirmed`; v2 `superseded` |
| 2 | System | Runs invalidation in one transaction | Invitation approval **invalidated**; catering actions **stale**; catering obligations **reopened**; sponsor receipt **unaffected** |
| 3 | System | Marks dependent reviews stale; enqueues review trigger if a decision is pending | Reprioritisation recommendation computed |
| 4 | System | Publishes a change notice; next scoped snapshot is current | Agents see the change on next `get_context` |
| 5 | Console | Updates board live | Stale markers (with reason `venue.address v2->v3`), green unaffected marker on sponsor receipt |

### 7.2 Non-owner proposes a venue change

1. An agent or external source proposes a change. The fact is stored as a **proposal**, not a confirmed version.
2. A review task appears in **Dashboard / Goals & Facts**. Nothing is invalidated and no state changes.
3. Owner accepts (becomes Flow 4.1) or rejects.

### 7.3 The block (fresh agent, no history)

1. A **fresh** invitations agent session starts. It has no chat history.
2. It calls `get_context` and sees the current plan including `venue.address v3`.
3. It (or a stale copy of the old approval) calls `execute_action` on the old-address batch.
4. Gateway denies with `STALE_FACT: venue.address` (or `NO_ACTIVE_APPROVAL`) and the next step: "revise the invitation and request fresh approval".
5. The block is shown on the console and recorded in the audit log. A favourable review would not change this outcome.

### 7.4 Recovery

1. Invitations agent calls `propose_action` with revision 2 (new address).
2. Owner sees exact parameters on **Dashboard / Decisions** and approves revision 2.
3. Agent executes; gateway allows; email sent to the test inbox; **readback** confirms the new address.

---

## 8. Flow 5 — Attempted versus confirmed; readiness (scenes 5–7)

| Step | What happens | Result |
| --- | --- | --- |
| 1 | Catering update re-sent for Venue B | Status **ProviderAccepted**; obligation `pending_verification` |
| 2 | An agent calls `claim_status("event is ready")` | **Refused**: two open obligations listed; "provider-accepted, vendor confirmation pending" |
| 3 | Vendor inbox replies with `CONFIRM` and the current token | Verifier matches token, vendor and current venue version → obligation **closed** |
| 4 | A delayed reply referencing the **old** venue arrives | Version mismatch → does **not** close; recorded as evidence of a non-matching reply |
| 5 | A malformed or ambiguous reply arrives | Routed to the owner; never auto-closed |
| 6 | All required obligations closed with current evidence | **Dashboard / Actions** readiness: "recorded arrangements ready as of revision X", with the evidence list |
| 7 | A later fact change voids a confirmation | Readiness returns to not ready; obligation reopens |

Vendor email text is data. Only token and `CONFIRM`/`DECLINE` are extracted; instruction-like text is ignored (scenario S16).

---

## 9. Flow 6 — Advisory review: a rule-compliant but questionable action (reasoning scenes R1–R3)

**Setup:** cap ₹1,00,000; committed or reserved ₹65,000; essential forecast ₹25,000; headroom ₹10,000; catering response due in six hours.

| Step | Actor | Action | System response |
| --- | --- | --- | --- |
| 1 | Catering/Resources agent | Proposes ₹20,000 optional decorations | Revision created |
| 2 | System | Deterministic budget check | Fits the hard cap (₹20,000 ≤ ₹35,000 available) |
| 3 | System | Builds server-side review snapshot; computes signals | Available ₹35,000; headroom ₹10,000; projected shortfall ₹10,000 |
| 4 | Reviewer | Read-only structured review | Verdict `WARN` citing goal `event_success@1`, preference `P1@1`, `budget.cap`, `essential_forecast`; alternatives: defer, or reduce to within headroom |
| 5 | System | Validates every reference and recomputes numbers | Finding stored as `current` advisory review |
| 6 | Owner | Opens **Dashboard / Decisions**; sees cited goal, math, estimate provenance, uncertainty, alternatives | Disposition controls shown |
| 7a | Owner | Rejects the upgrade or chooses a lower amount | Disposition recorded; replacement action needs its own exact approval |
| 7b | Owner | Knowingly accepts the trade-off | Disposition recorded with reason; **exact approval and hard gate are still required** |

**Counter-case:** a ₹5,000 optional purchase with the same state produces **no** shortfall and no unjustified warning.

**If the reviewer is unavailable:** the card shows "Review unavailable" explicitly. For actions configured to require review, the owner must make an actual decision before execution (human-only review). Unaffected actions continue through normal checks.

---

## 10. Flow 7 — Drift detection and reprioritisation (scenes R4–R5)

1. Progress monitor appends events as the invitations agent revises an adequate invitation three times (cosmetic changes) while catering reconfirmation is due in six hours.
2. Threshold trigger creates a review candidate (deduplicated by concern type, revision and versions).
3. Reviewer weighs counter-evidence: Were revisions required corrections (venue, accessibility)? Did the owner request refinement? Was there material improvement?
4. If drift is supported: warning card on **Dashboard / Decisions** referencing the sequence, deadline and pending obligation; recommends reconfirming catering and correcting venue-dependent invitation fields first.
5. Owner accepts, dismisses or asks for clarification. The disposition is persisted so the same warning does not repeat without new evidence.
6. Recommended order is shown (eligible next tasks respecting dependencies); no responsibility is reassigned and no deadline changed without owner authority.

**Counter-case:** three revisions that correct the venue address or fix an accessibility problem are **not** labelled drift.

---

## 11. Flow 8 — Cross-agent conflict (first stretch)

**First stretch only:** Invitations proposes an earlier guest notification while Catering/Resources proposes waiting on an unresolved venue/catering confirmation. The reviewer cites both authorized proposals and relevant goals/dependencies, explains the conflict and suggests a feasible next step. The owner resolves it; no agent receives unauthorized details and the hard gateway remains unchanged. General trade-off analysis is deferred.

---

## 12. Flow 9 — Unknown provider result and reconciliation

1. Gateway persists the execution claim, then calls the connector; the call times out.
2. Status **Unknown**; a readback job searches the mailbox by correlation token.
3. Found → **ProviderAccepted**; not found after the retry budget → **Failed** and the claim and approval are reconciled; the owner is notified.
4. **No automatic resend.** A new send requires a new idempotency key and fresh gateway pass.

---

## 13. Flow 10 — Narrow qualitative policy (required)

**Excluded:** no temporary exceptions, restoration workflows or waiver path. A missing or outdated requirement remains open.

**Required qualitative policy flow:** Owner confirms a step-free access preference. The reviewer checks supplied venue evidence. If evidence is absent, return `ASK` with the missing fact and suggested next step; with sufficient matching evidence, do not invent a concern. Display the finding in Decisions. Owner clarifies and records reason; any protected action still needs exact approval and hard checks.

---

## 14. Denial reasons and the agent recovery path

Every denial returns a machine-readable code plus the next permitted step so agents recover instead of looping.

| Code | Meaning | Next permitted step |
| --- | --- | --- |
| `KILL_SWITCH_ON` | Dispatch disabled | Wait for owner |
| `SCOPE` | Agent outside workspace scope | Stop; ask owner |
| `TYPE_NOT_ALLOWED` | Action type not on the role's allowlist | Propose an allowed type or ask owner |
| `NO_ACTIVE_APPROVAL` | No active approval | Request owner approval for the exact revision |
| `APPROVAL_MISMATCH` | Approval is for a different action or revision | Use the correct approval or request a new one |
| `APPROVAL_EXPIRED` | Approval expired or revoked | Request fresh approval |
| `DEPENDENCIES_MISSING` | Critical dependency undeclared or incomplete | Owner acknowledgement or template fix |
| `OWNER_REVIEW_REQUIRED` | Review configured but no owner decision | Owner decision required |
| `PARAMS_CHANGED` | Parameters differ from approved hash | Re-propose and re-approve |
| `STALE_FACT` | A bound fact has a newer confirmed version (names the fact) | Revise against the new version; request fresh approval |
| `HARD_POLICY_VIOLATION` | Confirmed hard predicate not satisfied | Adjust action; owner may revise the policy through the console |
| `BUDGET_CAP_EXCEEDED` / `BUDGET_CONFLICT` | Over cap, or concurrent reservation won | Reduce amount or retry after ledger update |
| `OPEN_OBLIGATION` | Blocking obligation open | Close the obligation with evidence |
| `DUPLICATE` | Idempotency key already used | Do not resend; check status |
| `RECIPIENT_NOT_ALLOWLISTED` | Address not on test-domain allowlist | Correct recipients |

---

## 15. Failure and edge paths

| Situation | Behaviour |
| --- | --- |
| Reviewer timeout or malformed output | Mark review **unavailable** (logged distinctly); never show a fabricated verdict; human-only review where required |
| Goal or forecast changes while a review runs | Result stored as **stale**; not shown as current; re-review if still useful |
| Same warning trigger repeats unchanged | Deduplicated; no alert loop |
| Owner revises priority policy | New policy respected; earlier relevant reviews stale; approvals and actions reassessed |
| Required obligation never created or required action unknown | Readiness false; missing requirement exposed |
| Agent asks for another role's data (e.g. sponsor financials) | Not in scope; no data returned |
| Agent attempts self-approval | Rejected |
| Email connector fails | Switch to the local mail catcher and disclose it |
| Console down | Show audit log and the recording |
| Kill switch engaged | Future dispatch disabled; in-flight operations cannot be recalled |
| Manual action outside the controlled path | Not detected; disclosed limit; reconcile where observable |

---

## 16. Demo run order (3–4 minute live slot)

| Segment | Flow | Time |
| --- | --- | --- |
| Goal and questionable decision | Flow 1 then Flow 6 (R1–R3) | 30–60 s |
| Drift and reprioritise | Flow 7 (R4–R5) | about 30 s |
| The block and recovery | Flow 4.3–4.4 (R6) | about 60 s |
| Attempted vs confirmed and readiness | Flow 5 (R7) | about 45 s |
| Measured results and limitations | Evaluation slide | 15–30 s |

Include one valid ordinary action that proceeds without a warning. Retain the longer scripted sequence as a recorded fallback. If an LLM or reviewer misbehaves live, re-run once, then show the recording and say why; display "unavailable" rather than a fabricated verdict.
