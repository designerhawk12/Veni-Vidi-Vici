# Event Guardian — UI/UX Design Brief


> **1 December 2026 delivery scope (PDF review, 25 November):** One reusable Goal Guardian engine, one synthetic TechMeet event, one owner, exactly two independent LLM-driven role agents (Invitations and Catering/Resources), Guardian MCP plus one email connector MCP, and one consolidated owner dashboard. The owner confirms venue facts; transport is not a separate role or required workflow. The minimum reviewer uses one read-only call and shared goal/policy, priority, resource-impact, progress/drift and trigger logic. All external actions use the deterministic gateway; evidence, exact approval, role isolation, deduplication, kill switch and persistent audit remain required. Required evaluation: focused positive/negative controls and reviewer-on/off comparison on identical fixtures. First stretch: grounded cross-agent conflict; optional deeper comparisons, broader qualitative policy, explicit expiry/revocation and hash-chained audit. Excluded for this release: calendar, temporary exceptions/restoration, waivers, incremental context deltas, separate context page, multi-event/production onboarding, exhaustive benchmarks, additional orchestration or custom models. Earlier design catalogue examples and scenario IDs are retained only as background or deferred where explicitly labelled. All implementation claims remain unverified.

**Version:** 0.2 · 1 December scope · **Date:** 25 November 2026 **Source:** *Goal Guardian — Event Coordination, final integrated specification (rev 2, 24 Nov 2026, narrowed by the 25 Nov PDF review)* and the supplied colour palette "Number 1" (Coolors). **Status:** Design brief for a prototype console. Nothing is designed or built yet. Items tagged **\[Proposal\]** are recommendations added here, not requirements from the specification.

---

## 1. Design context

Event Guardian's only human interface is the **owner console**, a web app used by the event owner to confirm facts and goals, approve exact actions, read advisory warnings, and see whether recorded arrangements are ready. Agents use the MCP server, not a UI. The console is **not an MCP tool** and not a general project-management app.

The console exists to make three moments legible in seconds, even to non-technical judges:

1. **The block:** a stale invitation visibly bounces, with a precise reason.
2. **Attempted vs confirmed:** "sent" is clearly different from "vendor confirmed".
3. **The advisory warning:** a rule-compliant but questionable purchase is questioned, with the maths shown.

**Constraint \[Spec\]:** the minimum console is P0; spend minimal time on polish. Build the minimal console first; polish only after Gate 3 criteria are on track.

---

## 2. Users and key tasks

| User | Context | Top tasks |
| --- | --- | --- |
| **Owner** (primary) | Running a live, changing event; delegating to agents; short on attention | Confirm a venue change; approve exact parameters; read and dispose of a warning; check readiness; hit the kill switch |
| **Judge / observer** (demo) | Sees the console on a projector for 3–4 minutes | Understand what changed, what was blocked, what is confirmed |
| **Developer** (secondary, P1) | Debugging agent behaviour | Read the audit log and role-scope test results |

**Persona is an open decision \[Spec\].** Until chosen, design for a professional organiser who is competent, time-poor and wary of anything that looks like "another approval screen" unless it shows exactly what is being approved.

---

## 3. Design principles

1. **Specifics over buttons.** An approval always shows recipient, address, revision and bound versions. "Approve" without detail defeats the purpose \[Spec D13\].
2. **Status is evidence, not mood.** Every state names its reason (`venue.address v2 → v3`) and, where relevant, its evidence.
3. **Attempted ≠ confirmed**, visually and verbally. Use different labels, icons and weight.
4. **Advice looks like advice.** Warnings are calm and cited; they never look like a hard block. A block is a block; a warning is a question.
5. **Say what is unknown.** `UNAVAILABLE`, unknown estimates and unverified items are shown as such, never filled in.
6. **One glance, then depth.** A scannable board first; evidence and audit one click away.
7. **Never rely on colour alone.** Every status has a label and an icon (essential here because the supplied palette is neutral).
8. **Honest vocabulary.** "Recorded arrangements ready as of revision X", never "event guaranteed".

**Tone \[Proposal\]:** precise, calm, command-room. Think a flight-operations board in warm neutrals, not a playful event app.

---

## 4. Colour system

### 4.1 Supplied palette ("Number 1")

| Token | Hex | Character |
| --- | --- | --- |
| `ink` | `#14110F` | Near-black with a warm cast |
| `charcoal` | `#34312D` | Dark warm grey-brown |
| `slate` | `#7E7F83` | Mid cool grey |
| `sand` | `#D9C5B2` | Warm beige |
| `mist` | `#F3F3F4` | Near-white, very slightly cool |

The palette is **entirely neutral** (no red, green or amber). That suits a calm, serious console but creates one real problem: the product's core states (stale, blocked, confirmed, unaffected, warning) are normally colour-coded. See section 4.4.

### 4.2 Role assignment (dark-first theme) \[Proposal\]

A dark-first theme is recommended: it projects well, feels like an operations room, and the palette's darkest values are its strongest.

| Role | Token | Hex | Used for |
| --- | --- | --- | --- |
| App background | `ink` | `#14110F` | Page, nav rail |
| Surface (cards, panels, table rows) | `charcoal` | `#34312D` | Cards, drawers, inputs |
| Primary text | `mist` | `#F3F3F4` | Headings, body, numbers |
| Secondary text, labels, section tags | `sand` | `#D9C5B2` | Metadata, field labels, captions |
| Borders, dividers, disabled, inactive icons | `slate` | `#7E7F83` | Hairlines, placeholders, disabled controls |
| Primary action fill | `sand` | `#D9C5B2` | Approve button (text `ink`), selected nav item |
| Focus ring | `mist` | `#F3F3F4` | 2 px ring with 2 px offset |

**Light theme variant \[Proposal\]:** page `mist`; panels `mist` with a 1 px `sand` border; header and nav `ink` with `mist` text; primary text `ink`; secondary text `charcoal`; primary button `ink` fill with `mist` text; borders `sand`; `slate` only for disabled and decorative use. Ship dark first; light only if time allows.

### 4.3 Contrast of the supplied palette (approximate WCAG 2.x ratios)

Computed by hand from the hex values for this brief; confirm with a contrast checker before sign-off.

| Foreground on background | Ratio (approx.) | Verdict |
| --- | --- | --- |
| `mist` on `ink` | 17 : 1 | Excellent, all text |
| `sand` on `ink` | 11.3 : 1 | Excellent, all text |
| `mist` on `charcoal` | 11.7 : 1 | Excellent, all text |
| `sand` on `charcoal` | 7.7 : 1 | Passes AA and AAA for body text |
| `slate` on `ink` | 4.7 : 1 | Passes AA for normal text, marginal |
| `slate` on `charcoal` | 3.2 : 1 | **Fails** for text; acceptable only for non-text UI at 3 : 1 |
| `ink` on `sand` | 11.3 : 1 | Excellent (button text) |
| `ink` on `mist` | 17 : 1 | Excellent (light theme) |
| `charcoal` on `mist` | 11.7 : 1 | Excellent (light theme) |
| `slate` on `mist` | 3.6 : 1 | Large text and UI only; **not** body text |
| `slate` on `sand` | 2.4 : 1 | Fails; do not use |

**Rules:** never set body or label text in `slate` on `charcoal` or `sand`. Use `slate` for borders, disabled states and placeholder-style hints that duplicate information available elsewhere.

### 4.4 Semantic status colours: a gap in the supplied palette \[Proposal\]

The specification relies on states such as "stale", "unaffected (green)" (demo scene 2) and warnings. The supplied palette has no hues for these, so there are two honest options:

- **Option A (neutral only):** use the supplied palette strictly and encode status with icons, labels, outlines, fills and weight. Works, and is fully palette-pure, but the demo's green "unaffected" moment becomes less vivid.
- **Option B (recommended):** keep the five supplied colours as the whole UI chrome and add **one small, muted status set** used only on small markers (chips, dots, icons, left-edge bars), never for large fills.

| Status | Suggested hue | Hex \[Proposal\] | Always paired with |
| --- | --- | --- | --- |
| Stale / denied / failed | Terracotta | `#E07A5F` | ✕ icon and label "Stale" or "Denied" |
| Advisory warning | Amber | `#E3B23C` | ▲ icon and label "Advice" |
| Verified / confirmed / unaffected | Sage | `#8FB996` | ✓ icon and label "Confirmed" or "Unaffected" |
| Pending / attempted / unknown | `slate` + `sand` outline | `#7E7F83` | ○ icon and label "Pending" or "Provider-accepted" |
| Information / selected | `sand` | `#D9C5B2` | ● icon |

These hexes are **not** part of the supplied palette and have **not** been contrast-tested; verify each reaches at least 4.5 : 1 as text on `ink` and `charcoal`, and 3 : 1 as a non-text marker, and adjust lightness (not hue) if needed. The owner of the palette should approve Option B. In greyscale the status must still be readable from icon and label alone.

---

## 5. Typography \[Proposal\]

| Use | Face | Notes |
| --- | --- | --- |
| Interface text | Inter, with system-sans fallback | The supplied palette image uses a similar geometric sans. |
| IDs, hashes, versions, reason codes, parameters | JetBrains Mono or system monospace | Tabular figures; makes `venue.address v3` and `STALE_FACT` scannable |
| Numbers in budget math | Tabular-numerals feature on the sans | Keeps columns aligned |

Scale (px): 12 (captions), 14 (body, table), 16 (card body), 20 (card title), 28 (screen title), 40 (stage-mode readiness). Minimum 14 px for data, 12 px only for captions. Weights 400, 500, 600 only. Sentence case everywhere.

---

## 6. Layout, spacing and shape

- **Platform:** desktop-first responsive web (primary 1280–1920 px wide, usable on a laptop and a projector); tablet-tolerant; phone not a target for the MVP.
- **Grid:** 12 columns, 24 px gutters; 4 px spacing base (4, 8, 12, 16, 24, 32, 48).
- **Shell:** fixed top bar (workspace, readiness line, connector status, kill switch); left nav rail (icons plus labels); main content; optional right evidence drawer (400 px) that opens without leaving the page.
- **Shape:** large corner radius echoing the palette swatches: 16 px cards and panels, 12 px inputs and buttons, full-pill chips.
- **Elevation:** minimal. Distinguish layers by surface colour (`ink` → `charcoal`), not shadows. Use a 1 px `slate` border where two surfaces meet.
- **Density:** comfortable by default; a compact table mode for the audit log.

---

## 7. Core components

| Component | Anatomy and rules |
| --- | --- |
| **Status chip** | Pill with icon + label + optional reason (`Stale · venue.address v2 → v3`). Labels fixed: Drafted, Approved, Stale, Executing, Provider-accepted, Acknowledged, Confirmed, Unknown, Failed, Unaffected. |
| **Action card** | Title, owner role, status chip, bound facts with versions, revision number, primary action. |
| **Approval card** | Full parameter table (recipient list, address, date, revision), bound fact versions, params hash (mono, truncated, copy), advisory banner if a review exists, buttons **Approve exact revision** and **Reject** with required reason. |
| **Diff view** | Old vs new value side by side for fact changes and revisions; changed words marked with an underline and a "changed" label. |
| **Obligation row** | Description, due time with countdown, required evidence, state (open, pending verification, closed), evidence link. |
| **Evidence list** | Each item: kind (provider ack, readback, vendor reply), source, observed time, versions matched, match result. A non-matching old-venue reply is shown as "Received, did not match current version". |
| **Advisory card** | Amber marker, headline concern, cited goal and policy (with versions), budget math table, uncertainty list, alternatives, disposition control. Visually quieter than a denial. |
| **Budget math table** | Rows: cap, committed or reserved, available, essential forecast, headroom, proposal, projected shortfall. Right-aligned tabular numbers; each row tagged *fact*, *estimate* or *computed*. |
| **Denial banner** | Terracotta marker, reason code (mono), plain-language reason, next permitted step. |
| **Readiness panel** | Large line: "Not ready: 2 open" or "Recorded arrangements ready as of revision 7", plus the checklist with evidence. |
| **Timeline** | Horizontal event rail for progress and revisions with deadline markers and a demo-clock indicator. |
| **Kill switch** | Persistent top-bar control with a confirm dialog and an "engaged" banner. |

---

## 8. Screens

### 8.1 One dashboard (P0)

Keep the supplied palette and design tokens. Use a single responsive dashboard rather than ten routes. Panels and drawers are anchored within the dashboard; navigation jumps to sections, not separate pages.

```text
+-------------------------------------------------------------------+
| TechMeet | Not ready: open requirements | Email mode | Kill switch |
+------------------------------+------------------------------------+
| Decisions                    | Readiness                          |
| Exact approval / warning     | Open requirements + evidence       |
| concern, math, uncertainty,  | Pending vs confirmed               |
| alternative, owner response  |                                    |
+------------------------------+------------------------------------+
| Actions: Invitations, Catering/Resources, unaffected receipt      |
+------------------------------+------------------------------------+
| Goals & Facts                | History                            |
| objective, priorities,       | progress claims | audit events     |
| budget, versioned facts      | distinct labels and detail drawer  |
+------------------------------+------------------------------------+
```

**Decisions:** show exact action parameters, bound versions, revision, approve/reject with reason; a warning card includes concern, goal/evidence, math, uncertainty, feasible alternative, next step and accept/dismiss/clarify reason. Advice is not approval; stale advice is visibly outdated.

**Readiness:** computed status and mandatory requirements with evidence links; no waiver controls. A stale vendor reply is shown but cannot close an obligation.

**Actions:** status chips and precise denial codes; unaffected receipt stays valid.

**Goals & Facts:** owner-confirmed objective, tiers, hard and soft policies, resource strip, fact version and proposed changes, impact preview. Include narrow accessibility policy evidence.

**History:** one interface for progress and audit; distinctly label agent-reported observations versus authoritative execution evidence. Filter and inspect via drawer; no dedicated context viewer.

**Settings:** header/drawer with kill switch, connector status, allowlist and demo clock; reset controlled fixtures. Optional expiry/revocation only if tested; hash chain not required. No standalone recommendation page, social features, motivational chat or standalone live feed.

---

## 9. Microcopy and vocabulary

| Context | Copy |
| --- | --- |
| Readiness, not ready | "Not ready: 2 open. Catering confirmation, accurate invitation readback." |
| Readiness, ready | "Recorded arrangements ready as of revision 7." Subline: "This reflects recorded evidence, not a guarantee." |
| After sending | "Provider-accepted. Vendor confirmation pending." |
| Old-venue reply | "Received, did not match the current venue version. Obligation still open." |
| Denial | "Blocked: venue.address changed from v2 to v3 after this was approved. Request revision and fresh approval." |
| Advisory warning | "This fits your ₹1,00,000 cap but may leave ₹10,000 short for essential arrangements. You decide." |
| Unavailable review | "Review unavailable. No recommendation was made. Your decision is required." |
| Estimates | Always labelled "estimate" with source and as-of time; unknowns shown as "Unknown", never a guessed figure. |
| Dismissing advice | "Record why you accept this trade-off" (required field). |
| Agent messages | Shown as claims: "Agent says the event is ready (not verified)". |

Avoid: "AI approved", "safe", "guaranteed", "optimised", "smart". The reviewer is described as "independent review (advice only)".

---

## 10. Accessibility

- Target **WCAG 2.2 AA**.
- Full keyboard operation; logical tab order; visible 2 px `mist` focus ring with offset on every interactive element.
- Status never by colour alone: every chip has icon plus text.
- Respect `prefers-reduced-motion`; the stale animation reduces to an instant state change plus an announcement.
- Live regions (`aria-live="polite"`) announce stale markers, new warnings and readiness changes; denials use `assertive` only when the owner just took the action.
- Tables use proper headers; the budget math table is readable by screen readers row by row.
- Hit targets at least 44 px for approve, reject, kill switch.
- Minimum text 14 px for data; verify all proposed status hues for contrast (section 4.4).

---

## 11. Motion \[Proposal\]

Motion is functional and short (150–250 ms, ease-out).

- **Stale event:** affected chips slide 4 px and settle with the terracotta marker; the unaffected chip does a brief steady sage pulse once. This is the visible "bounce" moment for judges. No looping animation.
- **Denial:** the denial banner expands in place.
- **Readiness change:** the number cross-fades; no confetti.
- Reduced-motion mode removes all movement.

---

## 12. States, errors and edge cases

| State | Treatment |
| --- | --- |
| Loading | Skeleton rows in `charcoal` |
| Empty | One sentence on what appears here and what the next step is |
| Connector failure | Top-bar chip "Email: mail catcher (disclosed)" or "Email down" |
| Kill switch engaged | Persistent banner; protected actions disabled with explanation |
| Reviewer unavailable | Card says so explicitly; human-only decision required where configured |
| Stale review | Greyed card with "Out of date" |
| SSE disconnect | Banner "Live updates paused" with retry; data shown with last-updated time |
| Concurrent change at approval | Terracotta card, approval blocked, next step shown |

---

## 13. Demo mode (projector and stage) \[Proposal\]

- **Stage mode toggle:** raises base type size by about 25 per cent, hides secondary columns, enlarges the readiness line to 40 px.
- Keep the dashboard in dark theme; the strongest contrast is `mist`/`sand` on `ink`.
- Reserve a fixed area for the key evidence of each moment: the denial banner, the "Provider-accepted / vendor pending" chip pair, and the budget math table.
- Never show tokens, keys or credentials on screen; hide them in recordings.
- Provide a seeded reset button for rehearsal (one-command reset in the backend).

---

## 14. Design tokens and handoff

```css
:root {
  --ink: #14110F;
  --charcoal: #34312D;
  --slate: #7E7F83;
  --sand: #D9C5B2;
  --mist: #F3F3F4;

  --bg: var(--ink);
  --surface: var(--charcoal);
  --text: var(--mist);
  --text-muted: var(--sand);
  --border: var(--slate);
  --accent: var(--sand);
  --on-accent: var(--ink);
  --focus: var(--mist);

  /* Proposed status hues (not in the supplied palette; verify contrast) */
  --status-stale: #E07A5F;
  --status-advice: #E3B23C;
  --status-ok: #8FB996;

  --radius-card: 16px;
  --radius-control: 12px;
  --space: 4px;
}
```

Deliverables: design tokens (above), component library sheet (section 7), one high-fidelity dashboard with all essential panels (Actions, Decisions, Goals & Facts, Readiness and History), a clickable prototype of the stale-block moment, and an accessibility checklist.

---

## 15. Open design questions

1. Does the palette owner approve the **Option B status hues**, or must the console stay strictly neutral (Option A)?
2. Is a light theme required, or is dark-only acceptable for the hackathon?
3. Which persona is chosen? It affects tone and density.
4. Will the demo run on a projector, a recorded screen, or both? Stage mode depends on it.
5. Is a terminal approval (instead of a web console) acceptable for the first run, as the specification allows?
6. Are brand name, logo or wordmark needed beyond "Event Guardian"? None were supplied.
