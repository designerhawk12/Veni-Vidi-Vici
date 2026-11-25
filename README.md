# Event Guardian

Event Guardian is an event-operations product concept with a public landing page, an interactive frontend prototype, and an initial SQLite-backed Guardian API. The landing page is the default at `/`; the simulated workspace is a separate demo at `/demo`. The API implements persistent versioned facts, selective action invalidation, exact owner approvals, scoped action proposals, an audited execution-claim gate, and an owner kill switch through the TechMeet 2026 scenario.

## Problem

AI-assisted coordination can act on facts that have changed after an action was prepared or approved. It can also report completion after a provider accepts a request without evidence that the intended counterparty confirmed the current arrangement. Event Guardian demonstrates controls that bind approvals and evidence to the relevant action parameters and event-fact version.

## How Event Guardian works

The demo starts after the venue changes from Venue A / V1 to Venue B / V2. Venue-dependent work is invalidated or reopened while the venue-independent sponsor receipt remains valid. A corrected invitation requires a new, parameter-bound owner approval. A guarded send checks that approval and the current facts before recording simulated provider acceptance. Catering remains an open mandatory obligation until evidence matches Venue B / V2, and readiness is derived from the mandatory obligations' accepted evidence.

## Product landing page

The default `/` route introduces Event Guardian, its owner-control and evidence principles, and the interactive demo. Calls to action open `/demo`; they do not imply that the prototype's simulated integrations are production services.

## Demo flow

The `/demo` route is one consolidated owner dashboard, organized into **Goals & Facts**, **Decisions**, **Actions**, **Readiness & Evidence**, and **History** panels. Use the sidebar or scroll through the panels; the sidebar links back to the product landing page, while connector status and the kill switch remain global to the demo.

1. In **Goals & Facts**, inspect the owner-confirmed goal, hard and soft policies, and the Venue A → Venue B fact change (V1 → V2).
2. In **Decisions**, review the corrected invitation and its exact fact-version binding. Approve or reject with a reason; the independent Goal Guardian budget advisory remains non-authorizing.
3. In **Actions**, select **Simulate Stale Action Attempt** to record an outdated invitation attempt and Guardian block. After approval, simulate guarded send from **Decisions**; provider acceptance is recorded as simulated.
4. In **Readiness & Evidence**, simulate the late Venue A reply to see it excluded, then simulate the current Venue B reply. Verify the difference between provider readback, counterparty confirmation, and accepted current-version evidence.
5. In **History**, inspect the local demo timeline. It is not the backend's persistent audit log. **Reset Demo** restores the initial state.

The independent Goal Guardian budget advisory calculates ₹10,000 headroom and a ₹10,000 forecast shortfall for the optional ₹20,000 upgrade. It cannot approve or execute an action.

## Features demonstrated

- TechMeet 2026 dashboard with current facts, dependency impact, and derived metrics
- Stale-action version check with an explicit Guardian rejection reason
- Approval and rejection of the corrected invitation, bound to its exact parameters and V2 facts
- Guarded send simulation with separate provider acceptance and provider readback records
- Current-version evidence matching and rejection of a late Venue A / V1 reply
- Readiness derived from mandatory obligations and their accepted evidence
- Independent TypeScript budget advisory with no approval or execution authority
- Dynamic activity log and full in-memory demo reset

## Tech stack

- React and TypeScript
- Vite
- Tailwind CSS v4
- Lucide React icons
- Local React state with realistic mock data
- Python 3.11+ standard library API and SQLite (WAL mode)

## Prototype boundary

The browser UI is still a frontend prototype: its actions, approvals, provider readbacks, vendor replies and evidence remain simulated in React state and are not yet wired to the API. The backend persists facts, action revisions, approvals, execution claims and audit events, but it does not dispatch actions or provide real email delivery, vendor integration, or AI execution. A successful API claim means only that the deterministic checks passed and the claim was recorded; it does not mean an external action occurred. “Provider Accepted – Simulated” is not a claim that an email was delivered, and simulated vendor evidence is not a guarantee of real event execution.

## Folder structure

src/
  components/
    dashboard/       Reusable event, impact, approval, reviewer and readiness cards
    layout/          Sidebar and top navigation
    shared/          Modal and activity timeline
  data/              Single source of truth for TechMeet mock data
  hooks/             Shared demo state and scenario transitions
  pages/             Landing page and consolidated dashboard panels
  types/             TypeScript domain interfaces
  App.tsx             Page shell and shared navigation
  index.css           Tailwind import and responsive visual system
  main.tsx            Browser entry point
public/
  shield.svg          Local application icon
  manus-routes.json   Declared website page routes


## Installation

Requires Node.js 20+ and pnpm 11.

pnpm install --frozen-lockfile
pnpm dev


Vite prints the local development URL. For an optimized build, run:

pnpm build
python3 -m unittest backend.test_guardian
pnpm preview


The browser demo state resets when “Reset Demo” is used or the page is refreshed. The sidebar jumps between sections of one consolidated dashboard; the API state persists separately in SQLite. `/` is the public landing page, `/demo` is the interactive prototype, and `/manus-routes.json` lists both routes.

The console follows the dark-first neutral palette and evidence-led status vocabulary in the UI/UX brief. Status always includes an icon and label, budget advice is visually distinct from hard denials, approval rejection requires a reason, and the top-bar kill switch is confirmed before changing simulated dispatch state.

## Guardian API foundation

The backend uses only Python's standard library. Run its unit tests and start the API from the repository root:

```sh
python3 -m unittest backend.test_guardian

export OWNER_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export INVITATIONS_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export CATERING_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python3 -m backend.api serve
```

The API listens on `http://127.0.0.1:8000` by default. Configure `DB_PATH`, `HOST`, or `PORT` to override the defaults. The initial SQLite database is created at `backend/data/guardian.sqlite3`; stop the API before running `python3 -m backend.api reset` to recreate that seeded database. Do not expose this prototype API to an untrusted network: bearer tokens are local development credentials and the server is intended for loopback use.

All API routes require a bearer token. The owner token can read `GET /api/state` and `GET /api/audit?since=0`, confirm an existing fact with `POST /api/facts/{fact_id}` (`{"value": ...}`), approve an exact action revision with `POST /api/actions/{id}/approve` (`{"revision": 1}`), and control `POST /api/killswitch` (`{"enabled": true}`). Agent tokens can propose with `POST /api/actions` (`{"type": "send_invitation_batch", "params": {"recipients": ["guest@example.test"]}}`), revise through `POST /api/actions/{id}/revisions`, and request a guarded claim with `POST /api/actions/{id}/claim` (`{"revision": 1}`). Only `example.test` and `vendor.test` recipients are allowlisted in the fixture.

The claim endpoint persists authorization before any future connector call. It does not invoke a connector, and claims are single-use; a duplicate is denied and must be reconciled rather than retried.

## Verification

pnpm build


The build runs TypeScript checking and creates dist/. There are no configured frontend test or lint scripts. The browser demo needs no API key or external service. Its mock event, action, approval, evidence, and activity state is centralized in src/hooks/useDemoScenario.ts and src/data/demoData.ts. The API's core tests cover canonical parameter hashing, owner-only approvals/fact changes, selective invalidation, role restrictions, allowlisting, kill-switch behavior and duplicate claims.

## Implemented frontend and simulated integrations

Implemented in the browser are the dashboard, navigation, approval state, version and parameter guards, obligation and evidence matching, derived readiness, budget calculation, activity timeline, responsive presentation, and reset behavior.

The invitation agent attempt, connector call, provider acceptance, provider readback, vendor replies, and evidence verification shown by the browser are simulations stored in local React state. The API has backend enforcement for fact/action version checks and approval-bound execution claims, but it is not yet connected to the UI and does not call an email connector. No real agent, MCP server, email delivery, vendor communication, or AI execution is implemented.

## Future integration roadmap

The initial SQLite-backed API is the first step toward replacing local transitions. Next, wire the console to the API, then add mandatory obligations/evidence, connector integration, and scoped agent context. Preserve the separation between action attempts, provider acceptance, counterparty confirmation, and verified current-version evidence.

## Known limits

- One fixed TechMeet 2026 scenario is provided. Event facts and invitation parameters are not editable through the UI; the send guard still checks the approval snapshot and current dependencies.
- Simulated provider acceptance is a transport readback, not proof of recipient delivery. Synthetic vendor confirmation verifies recorded demo evidence, not actual event execution.
- Browser scenario state is in memory only and refreshes to the initial post-change scenario; API data persists in SQLite until reset.
- The API does not yet implement obligations/readiness, vendor reply verification, agent context, model review, or actual connector dispatch.
