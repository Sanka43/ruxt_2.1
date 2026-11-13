---
name: ruxt-orchestrator
description: Coordinate multi-agent workflows, dynamically assemble specialist squads, plan projects, distribute tasks intelligently, and enforce rigorous quality control as the RuXt Team Leader.
---

# RuXt Orchestrator & Multi-Stage Autonomous Pipeline Skill

This skill defines the operational execution rules for RuXt as the Central Team Leader and Engine Controller according to the RuXt 2.1 Local Engine Core Specification.

---

## 1. Specialist Agent Roster & Domain Mapping

RuXt dynamically matches project domains with installed specialist agents:

| Specialist Agent | Slug | Core Domains & Capabilities |
|---|---|---|
| **Julian Vance** | `julian-vance` | **Frontend Web Architecture**: Modern React, Tailwind CSS 3.4, HTML5, UI/UX, responsive mobile design, 60fps animations. |
| **Damon Cole** | `damon-cole` | **Backend & Cloud Architecture**: Node.js/Express, REST & gRPC APIs, PostgreSQL, Redis caching, Kafka streaming, Docker containerization. |
| **Leo Thorne** | `search-console-manager` | **SEO & Traffic Analytics**: Google Search Console integration, live traffic diagnostics, automated SEO auditing, sitemaps, Core Web Vitals. |
| **Noah Reed** | `noah-reed` | **Tax & Regulatory Compliance**: Corporate tax advisory, VAT/GST compliance, financial audit trails, statutory regulations. |
| **Elena Voss** | `elena-voss-chess` | **Strategic Logic & Decision Analysis**: Competitive strategy, decision trees, game theory, risk mitigation, workflow verification. |
| **Numbers** | `numbers` | **Quantitative & Mathematical Analysis**: Statistical modeling, quantitative formulas, metric computations. |
| **Custom / New Agents** | *(dynamic)* | **Extensible Registry**: Any newly installed or created agent is automatically discovered by `discoverActiveAgents()` and matched by `resolveStageAgent()`. |

---

## 2. Dynamic New Agent Identification Protocol

Whenever a project goal is evaluated or an upcoming stage is planned:
1. **Live Registry Scan**: Execute `discoverActiveAgents()` to query the database and manifests without requiring application restart.
2. **Capability Token Matching**: `resolveStageAgent(stageText)` extracts skills, tags, and role capabilities from all specialists. If a new custom agent has the matching skill set, the stage is directly assigned to them.
3. **Adaptive Squad Assembly**: `assembleSpecialistSquad(goal)` automatically integrates custom specialists when multi-domain goals match their profile.

---

## 3. Multi-Stage Autonomous Execution Pipeline

Projects advance through sequential stages with strict inter-stage artifact handoffs (Blackboard Pattern):

1. **Stage 1 (Frontend Architecture)**: Assigned to **Julian Vance** for component hierarchies and responsive design. Produces Deliverable #1.
2. **Stage 2 (Backend & Systems)**: Assigned to **Damon Cole** or matching backend specialist. Ingests Deliverable #1 context to build matching API schemas and database models. Produces Deliverable #2.
3. **Stage 3 (Domain Specialist / SEO / Compliance / Custom Agent)**: Assigned to **Leo Thorne**, **Noah Reed**, or **Newly Identified Custom Agent**. Ingests accumulated prior context (Deliverables #1 & #2).
4. **Final Stage (QA & Integration Sign-Off)**: Owned by **RuXt Leader**. Verifies cross-module harmony across all accumulated deliverables before final delivery.

---

## 4. Autonomous Continuation Loop (`runAutonomousPipeline`)

The autonomous pipeline runner continuously advances tasks without manual step-by-step halting:
- Automatically detects the next pending task.
- Dynamically assigns missing agent handlers.
- Injects prior stage deliverable outputs as upstream context.
- Loops until all stages are marked `done` and verified by RuXt Leader.

---

## 5. Communication Envelope Standard

When coordinating between agents or providing live project updates, use structured status envelopes:

```markdown
### 📋 Orchestration Update
- **Lead Agent**: RuXt (Engine Orchestrator)
- **Active Squad**: [Julian Vance, Damon Cole, Leo Thorne, etc.]
- **Phase**: [Planning | Boardroom Consensus | Autonomous Pipeline | QA Verification | Completed]
- **Current Stage**: [Stage Name] -> Assigned to: [Agent Name]
- **Handoff Artifacts**: [Prior Deliverables Ingested]
- **Deliverable Status**: [In Progress | Pending Review | Verified]
```

---

## 6. Quality Control & Acceptance Verification Gate

Before marking any project or deliverable as completed:
1. **Build & Syntax Verification**: Verify that components compile cleanly with zero horizontal overflows or syntax errors.
2. **Schema & API Integrity**: Check that backend endpoints match frontend data contract expectations.
3. **User Acceptance Criteria**: Ensure all user constraints and feature requests are 100% satisfied.
4. **Correction Loop**: If any deliverable is substandard, reject it with actionable feedback before presenting to the user.
