# Goal Guardian
### A Goal-Aware Guardrail Layer for AI Agents

**AI agents should not just complete tasks. They should understand whether those tasks actually contribute to what the user wants to achieve.**

Goal Guardian is an independent, goal-aware reasoning and execution guardrail layer designed to work alongside different AI agents. It helps ensure that agents remain aligned with the user's original objectives, priorities, constraints and available resources throughout their execution.

Rather than simply checking whether an action is permitted, Goal Guardian evaluates whether that action is meaningful, necessary and consistent with the user's broader goals.

---

## 1. The Problem

AI agents are becoming increasingly capable of executing complex, multi-step tasks. However, successfully following instructions does not necessarily mean achieving the user's actual objective.

An agent can complete every requested task, follow every instruction and still work against the user's original intention.

Consider a few examples:

**Coding Agents**

A developer asks an AI coding agent to build an application. During development, the agent starts building additional infrastructure, validation systems and internal tools. Each task is completed successfully, but the original application remains unfinished.

**Research Agents**

A user asks an AI agent to identify and evaluate suitable research topics. Instead of progressing towards the evaluation, the agent spends increasing time organizing information and expanding its knowledge base.

**Content Generation Agents**

A user requests a video using a paid generation API. Without an explicitly defined expenditure limit, the agent may continue generating and refining content, consuming resources without questioning whether another generation is worthwhile.

In each situation, the agent may technically follow its instructions while losing sight of the user's actual objective.

### The Gap in Existing Guardrails

Traditional guardrails primarily focus on whether an action is permitted, authorized or compliant with predefined rules.

Goal Guardian addresses an additional question:

**Even if an action is permitted, is it actually worth performing given the user's original objective, priorities and available resources?**

---

## 2. The Proposed Solution

Goal Guardian acts as an independent layer between AI agents and their proposed actions.

It maintains a persistent understanding of the user's:

- Primary objectives and success criteria.
- Priorities and commitments.
- Hard constraints and soft preferences.
- Resource and expenditure limits.
- Progress and outstanding requirements.

It evaluates proposed actions against this context and helps identify decisions that may undermine the user's broader objectives.

### Core Capabilities

| Capability | Description |
|---|---|
| Goal Alignment | Evaluates whether proposed actions contribute to the user's original objectives. |
| Goal Drift Detection | Identifies when an agent's activities gradually move away from the intended goal. |
| Opportunity Cost Analysis | Highlights when an otherwise permissible action competes with more important requirements. |
| Resource Awareness | Identifies unnecessary expenditure of time, API credits and other resources. |
| Priority Management | Helps identify when important objectives are being displaced by lower-priority activities. |
| Diminishing Returns | Recognizes repeated refinement or additional work that may no longer provide meaningful value. |
| Cross-Agent Awareness | Evaluates potential conflicts between actions proposed by different agents. |
| Alternative Recommendations | Suggests more suitable actions while preserving the user's original objectives. |
| Deterministic Execution Controls | Validates permissions, constraints and approvals before protected actions are executed. |

The independent reasoning component provides recommendations and warnings. The user retains control over discretionary decisions, while deterministic execution controls enforce defined rules and permissions.

---

## 3. How Goal Guardian Works

The proposed workflow consists of five main stages.

**1. Goal and Context Establishment**

The user defines their objectives, priorities, constraints, success criteria and available resources.

**2. Agent Activity Monitoring**

Different AI agents submit their proposed actions through a common integration interface.

**3. Independent Goal-Aware Evaluation**

Goal Guardian evaluates proposed actions against the persistent user context, identifying potential goal conflicts, resource wastage and opportunity costs.

**4. Owner Decision and Execution Control**

The user can approve, reject, defer or request clarification. A deterministic execution gateway independently validates permissions, approvals and relevant constraints before allowing protected actions.

**5. Outcome and Evidence Tracking**

Execution results and supporting evidence are recorded to maintain an understanding of progress and outstanding requirements.

---

## 4. General Use Cases

Goal Guardian is designed to support different categories of tool-using AI agents rather than being restricted to a particular application.

### Coding Agents

- Identify unnecessary infrastructure development.
- Detect scope expansion.
- Prioritize unfinished core functionality.
- Highlight repeated work with diminishing returns.

### Research Agents

- Detect when supporting activities displace the original research objective.
- Identify unnecessary data collection and organization.
- Encourage progress towards analysis and evaluation.
- Maintain research objectives across separate sessions.

### Content Generation Agents

- Monitor API expenditure and resource constraints.
- Identify unnecessary generation and refinement cycles.
- Highlight diminishing returns.
- Request approval before consequential expenditure.

### Workflow Automation Agents

- Evaluate whether automated actions remain aligned with user priorities.
- Identify conflicting actions across workflows.
- Detect missing constraints and dependencies.
- Prevent outdated or unauthorized actions through controlled execution.

These are intended application areas. They do not represent currently implemented integrations.

---

## 5. Current Demonstration: Event Guardian

The current frontend prototype demonstrates the Goal Guardian concept through an event-coordination scenario called **Event Guardian**.

The scenario illustrates how independent agents coordinating different event activities can create inconsistencies when important information changes.

### Demonstration Scenario

An event's venue changes from Venue A to Venue B.

Different agents may still hold outdated information and attempt to execute previously prepared actions.

Event Guardian demonstrates how Goal Guardian's proposed controls can handle this situation:

1. Detect the venue change.
2. Identify actions dependent on the outdated venue information.
3. Mark the old invitation as stale and block its execution in the demonstration.
4. Require owner approval for the corrected invitation.
5. Preserve unrelated work, such as a sponsor receipt.
6. Keep catering confirmation pending until current-version evidence is recorded.
7. Display an independent advisory identifying a potential budget conflict.

### Budget Opportunity-Cost Example

| Parameter | Amount |
|---|---:|
| Total budget | ₹1,00,000 |
| Committed/reserved | ₹65,000 |
| Essential unreserved forecast | ₹25,000 |
| Available headroom | ₹10,000 |
| Proposed optional upgrade | ₹20,000 |
| Forecast shortfall | ₹10,000 |

Although the proposed upgrade is within the overall budget cap, it creates a forecast shortfall when essential requirements are considered.

Goal Guardian highlights this trade-off and recommends considering a lower-cost alternative.

The reviewer is advisory only. The owner makes the final decision.

---

## 6. Current Implementation

The repository currently contains a frontend-only interactive prototype.

### Implemented Frontend Demonstrations

- Event overview dashboard.
- Venue-change impact visualization.
- Stale invitation detection and blocking simulation.
- Corrected action approval workflow.
- Simulated guarded execution.
- Provider acceptance and readback representation.
- Current-version vendor confirmation simulation.
- Evidence and obligation tracking.
- Dynamic event readiness calculation.
- Independent budget opportunity-cost advisory.
- Activity timeline.
- Demo reset functionality.

### Important Implementation Limitations

The current application is a frontend prototype.

All agent interactions, provider responses, email operations, vendor replies, approvals and evidence records are simulated using frontend state.

The current implementation does not include:

- A functioning backend.
- Persistent database storage.
- Actual AI agent integrations.
- Real MCP communication.
- A live independent LLM reviewer.
- Real email or calendar integrations.
- Actual external action execution.
- Production authentication or authorization.

The event-specific interface is a demonstration of the broader Goal Guardian concept, not the final general-purpose product interface.

---

## 7. Proposed Technical Architecture

The intended architecture separates goal-aware reasoning from deterministic execution enforcement.

| Layer | Proposed Technology | Responsibility |
|---|---|---|
| Frontend | React + TypeScript | User dashboard, goals, agent activity and approvals |
| Backend | Python + FastAPI | Central orchestration and business logic |
| Database | SQLite initially | Persistent goals, constraints, actions, approvals and evidence |
| Agent Integration | Model Context Protocol (MCP) | Standardized communication with supported agents and tools |
| Independent Reviewer | LLM-based reasoning service | Goal alignment, opportunity-cost analysis and recommendations |
| Execution Gateway | Deterministic Python logic | Permission checks, approval validation and execution controls |
| External Connectors | MCP-compatible connectors | Controlled interaction with external tools and services |

### Architectural Principles

- Agents propose actions; they do not control the user's objectives.
- Goal Guardian maintains an authoritative representation of user-defined goals and constraints.
- The independent reviewer is read-only and cannot authorize its own recommendations.
- Deterministic controls enforce hard constraints and approval requirements.
- Protected external actions must pass through the controlled execution gateway.
- Execution attempts and verified outcomes are treated separately.

MCP provides an integration interface. It does not independently provide authorization or guarantee execution safety.

---

## 8. Technology Stack

### Current Frontend Prototype

- React
- TypeScript
- Vite
- pnpm

### Planned Backend and Integration Stack

- Python
- FastAPI
- SQLite
- MCP Python SDK
- LLM API for independent goal-aware review

The backend and MCP integrations are part of the planned development roadmap and are not currently implemented.

---

## 9. Running Locally

### Prerequisites

- Node.js
- pnpm

### Installation

Clone the repository:

```bash
git clone https://github.com/designerhawk12/Veni-Vidi-Vici.git
```

Navigate into the project:

```bash
cd Veni-Vidi-Vici
```

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Start the development server:

```bash
pnpm dev
```

Create a production build:

```bash
pnpm build
```

---

## 10. Future Development Roadmap

The current prototype establishes the frontend and demonstrates the intended workflows. Future development will focus on implementing the actual Goal Guardian architecture.

**Phase 1 – Persistent Goal Context**
- Implement FastAPI backend.
- Introduce SQLite storage.
- Persist user objectives, priorities and constraints.
- Maintain context across independent agent sessions.

**Phase 2 – Agent Integration**
- Implement MCP-based communication.
- Connect supported coding, research and other tool-using agents.
- Establish structured action proposals.
- Introduce agent identity and permission boundaries.

**Phase 3 – Independent Goal-Aware Reviewer**
- Implement structured LLM-based action evaluation.
- Introduce goal alignment and opportunity-cost analysis.
- Detect potential goal drift and diminishing returns.
- Generate evidence-linked recommendations.

**Phase 4 – Deterministic Execution Gateway**
- Implement action validation.
- Introduce exact-parameter approvals.
- Enforce resource limits and authorization.
- Prevent stale or unauthorized protected actions.

**Phase 5 – Evaluation and Expansion**
- Compare normal agent execution against Goal Guardian-assisted execution.
- Evaluate missed warnings and false positives.
- Measure resource consumption, latency and intervention frequency.
- Expand integrations and supported workflows.

---

## 11. Project Vision

AI agents are increasingly capable of performing complex tasks autonomously. However, task completion alone is not a sufficient measure of whether an agent is helping its user.

Goal Guardian aims to introduce an additional layer of awareness and control that preserves the user's original objectives throughout agent execution.

It is not intended to replace existing AI agents. Instead, it is designed to work alongside them, helping ensure that their actions remain meaningful, justified and aligned with what the user actually wants to achieve.

**Because an intelligent assistant should not just know how to complete a task. It should also recognize when to question it.**
