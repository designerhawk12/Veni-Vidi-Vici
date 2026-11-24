# Event Guardian

Event Guardian is a frontend prototype for an event operations and recovery control center, powered by Goal Guardian. It demonstrates versioned event facts, selective invalidation of stale actions, owner approval, version-aware obligations and evidence, and a read-only budget advisory through the TechMeet 2026 scenario.

## Problem

AI-assisted coordination can act on facts that have changed after an action was prepared or approved. It can also report completion after a provider accepts a request without evidence that the intended counterparty confirmed the current arrangement. Event Guardian demonstrates controls that bind approvals and evidence to the relevant action parameters and event-fact version.

## How Event Guardian works

The demo starts after the venue changes from Venue A / V1 to Venue B / V2. Venue-dependent work is invalidated or reopened while the venue-independent sponsor receipt remains valid. A corrected invitation requires a new, parameter-bound owner approval. A guarded send checks that approval and the current facts before recording simulated provider acceptance. Catering remains an open mandatory obligation until evidence matches Venue B / V2, and readiness is derived from the mandatory obligations' accepted evidence.

## Demo flow

1. On Overview, inspect the Venue A → Venue B / V1 → V2 change. The old invitation is blocked, catering needs reconfirmation, and the sponsor receipt remains valid.
2. Select **Simulate Stale Action Attempt**. The activity log records the agent attempt and the Guardian's version-mismatch rejection; no connector is invoked.
3. Select **Review Action** to inspect the current invitation, then approve or reject it. Approval records the exact proposal parameters and fact version.
4. After approval, select **Simulate Guarded Send**. The app records simulated provider acceptance and readback. Catering confirmation and readiness remain pending.
5. On **Obligations & Evidence**, simulate the late Venue A reply to see it excluded, then simulate the current Venue B reply. The matching record closes catering and changes readiness to **READY – RECORDED ARRANGEMENTS VERIFIED**.
6. Inspect the updated **Actions & Approvals** and **Activity Log** pages. **Reset Demo** restores the initial state and closes open action dialogs.

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

## Prototype boundary

This is a frontend-only hackathon prototype. Every action, agent event, provider readback, vendor reply, approval and evidence record is simulated in browser state. There is no backend, database, authentication, external API, actual email delivery, vendor integration, or real AI execution. “Provider Accepted – Simulated” is not a claim that an email was delivered, and simulated vendor evidence is not a guarantee of real event execution.

## Folder structure

```text
src/
  components/
    dashboard/       Reusable event, impact, approval, reviewer and readiness cards
    layout/          Sidebar and top navigation
    shared/          Modal and activity timeline
  data/              Single source of truth for TechMeet mock data
  hooks/             Shared demo state and scenario transitions
  pages/             Overview, actions, obligations/evidence and activity log
  types/             TypeScript domain interfaces
  App.tsx             Page shell and shared navigation
  index.css           Tailwind import and responsive visual system
  main.tsx            Browser entry point
public/
  shield.svg          Local application icon
  manus-routes.json   Declared website page routes
```

## Installation

Requires Node.js 20+ and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite prints the local development URL. For an optimized build, run:

```bash
pnpm build
pnpm preview
```

All scenario data resets when “Reset Demo” is used or the page is refreshed; no server persistence is configured. The four sidebar pages use local React navigation. `/` is the app entry route; `/manus-routes.json` lists that route.

## Verification

```bash
pnpm build
```

The build runs TypeScript checking and creates `dist/`. There are no configured test or lint scripts. The demo needs no API key, environment variables, or external service. Its mock event, action, approval, evidence, and activity state is centralized in `src/hooks/useDemoScenario.ts` and `src/data/demoData.ts` so a later backend can replace the simulated transitions.

## Implemented frontend and simulated integrations

Implemented in the browser are the dashboard, navigation, approval state, version and parameter guards, obligation and evidence matching, derived readiness, budget calculation, activity timeline, responsive presentation, and reset behavior.

The invitation agent attempt, connector call, provider acceptance, provider readback, vendor replies, and evidence verification are realistic simulations stored in local React state. No real agent, MCP server, email delivery, vendor communication, database, or backend enforcement is implemented.

## Future integration roadmap

The centralized typed scenario state is intended to become an API boundary. A future implementation can replace local transitions with a Python FastAPI service, persist event facts, approvals, obligations, evidence, and audit records in SQLite, and connect a Goal Guardian engine to approved MCP tools. Those integrations must preserve the current separation between action attempts, provider acceptance, counterparty confirmation, and verified current-version evidence.

## Known limits

- One fixed TechMeet 2026 scenario is provided. Event facts and invitation parameters are not editable through the UI; the send guard still checks the approval snapshot and current dependencies.
- Simulated provider acceptance is a transport readback, not proof of recipient delivery. Synthetic vendor confirmation verifies recorded demo evidence, not actual event execution.
- State is in memory only and refreshes back to the initial post-change scenario.
