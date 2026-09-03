# AgEnFK Autonomous Delivery — Master Specification

**Status:** Implementation proposal  
**Version:** 1.0  
**Date:** 2026-09-02  
**Target repository:** `cglab-public/agenfk`  
**Primary implementation client:** Claude Code  
**MVP objective:** an approved Master Spec produces a tested, auditable release candidate through a durable multi-agent workflow  
**Companion foundation:** `AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md`, deliveries D1–D5

---

## 0. Instructions to the implementing agent

This document is an implementation contract, not a request to implement the entire product in one session.

The implementing agent MUST:

1. Inspect the current repository, its `CLAUDE.md`, `AGENTS.md`, architecture documents, package boundaries, migrations, tests, and active AgEnFK workflow before proposing changes.
2. Treat the current server API as the single authority for AgEnFK state. Never bypass it by writing directly to SQLite.
3. Preserve Standard Mode, Deep Mode, existing custom flows, the Kanban board, GitHub Issues sync, Corporate Hub behavior, and all supported clients.
4. Implement one delivery from Section 26 at a time, on its own item/branch/worktree and preferably its own PR.
5. Stop for approval after planning each delivery unless the user explicitly authorizes autonomous execution of that delivery.
6. Add migrations, API/CLI tests, UI tests, documentation, backwards-compatibility tests, and failure-path tests with every delivery.
7. Prefer extensions of existing abstractions over parallel systems with overlapping state.
8. Never claim completion from an LLM statement. Completion requires deterministic evidence recorded by AgEnFK.
9. Never silently reset, clean, stash, overwrite, rebase, or discard a dirty/divergent working tree.
10. Keep every delivery bounded enough to be completed with materially less than 1 million total model tokens. Split a delivery further if repository inspection shows that it is too large.

The implementing agent MUST NOT:

- rewrite AgEnFK from scratch;
- introduce Jira, Plane, OpenProject, GitHub Issues, or another external board as a required dependency;
- make AgEnFK an LLM gateway, terminal multiplexer, model server, VCS replacement, or raw terminal recorder;
- add LangGraph, CrewAI, AutoGen, Temporal, or another orchestration framework to the MVP without a separate approved ADR;
- create permanently running LLM “employees” when a short-lived role-bound execution is sufficient;
- hard-code roles to providers or models;
- allow an LLM to be the sole authority for scheduling, test success, security approval, budget enforcement, or production mutation;
- dynamically install unreviewed marketplace skills during an active execution.

If the current code contradicts an assumption in this specification, record the contradiction in an ADR or implementation note and ask for a decision before changing a public contract.

---

## 1. Executive summary

AgEnFK already provides the correct control-plane foundation for professional agentic engineering:

- server-owned workflow state;
- Epic, Story, Task, and Bug hierarchy;
- real-time Kanban visibility;
- configurable workflow gates;
- deterministic build/test verification;
- Deep Mode planning and specialist handover;
- mechanical enforcement in Claude Code and Pi;
- multi-project support;
- local SQLite persistence;
- optional GitHub Issues synchronization;
- optional Corporate Hub governance.

Autonomous Delivery extends this foundation from **one agent-supervised engineering item** to **one durably orchestrated software project**.

The target flow is:

```text
Master Spec
  -> structured Project Contract
  -> clarification with the owner
  -> versioned baseline
  -> requirement-to-task dependency graph
  -> owner approval
  -> deterministic scheduling of READY work
  -> isolated agent executions
  -> deterministic review/test/security gates
  -> dependency-aware integration
  -> tested release candidate
```

The product promise is intentionally bounded:

> An approved, sufficiently complete Master Spec can initiate an autonomous pipeline that produces a tested, traceable release candidate without human micromanagement.

The product does not promise that an arbitrary one-line prompt can safely deploy a production system without decisions, credentials, policies, or approval.

---

## 2. Architectural principles

### 2.1 The project owns the plan; the task owns the execution

Models, harnesses, and terminal processes are replaceable compute.

Durable state belongs to AgEnFK:

- project intent;
- requirement baseline;
- task graph;
- decisions;
- approvals;
- execution state;
- checkpoints;
- leases;
- evidence;
- cost and risk state;
- release-candidate state.

### 2.2 Deterministic control, agentic judgment

Use deterministic code for:

- state transitions;
- dependency resolution;
- READY calculation;
- priority ordering;
- leases and concurrency;
- retry limits;
- budget enforcement;
- tool permissions;
- approval requirements;
- test execution and result capture;
- security policy enforcement;
- release readiness.

Use LLM agents for:

- understanding intent;
- asking clarification questions;
- planning and decomposition;
- architecture and design;
- code authoring;
- test authoring;
- review and diagnosis;
- repair proposals;
- risk and cost recommendations;
- documentation and summaries.

An agent may recommend a state change. Only the AgEnFK server may authorize and persist it.

### 2.3 One source of truth

The AgEnFK server and its storage remain authoritative for project and execution state.

The native AgEnFK Kanban is the required board. External boards are optional projections or integrations and MUST NOT be necessary for Autonomous Delivery.

### 2.4 Evidence over assertion

No card, Story, Epic, or project can be completed because an agent says it is complete.

Completion requires machine-verifiable evidence, such as:

- test exit codes;
- build artifacts;
- coverage results;
- screenshots and visual comparisons;
- security scan results;
- CI run identifiers;
- commit and tree hashes;
- requirement traceability;
- approval records.

### 2.5 Safe autonomy

Autonomy is an explicit policy, not a side effect of running an agent. Every mutation is classified and checked against the project's autonomy level.

### 2.6 Portable continuity

An execution must survive:

- model change;
- provider outage or quota exhaustion;
- harness change;
- Herdr restart;
- agent process crash;
- workstation restart;
- context compaction;
- review/test handover;
- rescheduling to another compatible worker.

The Durable Execution companion specification is authoritative for Execution, Checkpoint, Lease, Worktree Binding, and portable resume behavior.

---

## 3. Product modes

Autonomous Delivery MUST be additive.

| Mode | Purpose | Behavior |
|---|---|---|
| Standard | Daily engineering task | One primary agent performs implementation, verification, and closure |
| Deep | Complex feature or architectural change | Supervisor decomposes work and hands off across specialist workflow steps |
| Autonomous Delivery | Project or major initiative from a Master Spec | Durable project contract, dependency graph, scheduler, worker fleet, integration, and release-candidate production |

Existing commands and behaviors for Standard and Deep modes MUST remain compatible.

Autonomous Delivery may reuse Deep Mode flows for individual items, but Deep Mode session orchestration is not the project scheduler.

---

## 4. Component responsibility map

| Component | Owns | Must not own |
|---|---|---|
| AgEnFK | contract, board, DAG, workflow, policies, executions, checkpoints, leases, evidence, approvals, budgets, release readiness | inference transport, terminal emulation, code state |
| Claude Code / Pi / Codex | conversational execution, reasoning, tools, role behavior | durable project authority |
| Herdr | workspaces, tabs, panes, processes, terminal lifecycle, agent process visibility, runtime restoration | project/task success state |
| LiteLLM | model gateway, routes, provider failover, rate limits, model spend telemetry | project scheduling and workflow state |
| Git / worktrees | code state, isolation, commits, diffs, merge ancestry | orchestration policy |
| VS Code | human inspection, debugging, diffs, architecture navigation, manual intervention | orchestration authority |
| CI/CD provider | independent build/test/deploy proof | task planning |
| Optional Corporate Hub | fleet governance, aggregation, distributed policy, organization visibility | raw local session data by default |

### 4.1 Runtime and harness are separate abstractions

Herdr is a `RuntimeAdapter`. Claude Code, Pi, and Codex are `HarnessAdapter`s.

This distinction is mandatory. A runtime knows how to start and observe a process; a harness knows how to prepare, resume, checkpoint, and interpret an agent session.

```ts
interface RuntimeAdapter {
  kind: string;
  health(): Promise<RuntimeHealth>;
  prepareWorkspace(input: RuntimeWorkspaceRequest): Promise<RuntimeWorkspaceRef>;
  startProcess(input: RuntimeProcessRequest): Promise<RuntimeProcessRef>;
  inspectProcess(ref: RuntimeProcessRef): Promise<RuntimeProcessStatus>;
  stopProcess(ref: RuntimeProcessRef, mode: "graceful" | "force"): Promise<void>;
}

interface HarnessAdapter {
  kind: string;
  detect(): Promise<HarnessInstallation | null>;
  capabilities(): Promise<HarnessCapabilities>;
  prepareLaunch(input: HarnessLaunchRequest): Promise<HarnessLaunchPlan>;
  detectSession(input: HarnessSessionDetection): Promise<SessionReference | null>;
  canResume(ref: SessionReference): Promise<boolean>;
  prepareResume(ref: SessionReference, packet: ResumePacket): Promise<HarnessLaunchPlan>;
  requestCheckpoint?(ref: SessionReference): Promise<ArtifactRef | null>;
}
```

The MVP runtime is Herdr. A minimal local-process runtime MAY exist only as a test double or developer fallback.

The first production harness adapters are:

1. Claude Code — official high-capability implementation path and mechanically enforced client.
2. Pi — open, extensible, multi-model execution and LiteLLM/internal-model fallback path.
3. Codex — independent reviewer/fallback adapter after the first two are stable.

Harness preference is project policy, not a global hard-coded truth.

---

## 5. Foundation gate: Durable Execution

Autonomous scheduling MUST NOT launch writable workers until the following D1–D5 capabilities exist and pass their acceptance suites:

1. first-class `Execution` attached to an Item;
2. typed `Checkpoint` with Git, progress, decision, verification, and resume state;
3. automatic checkpoints at resumable workflow boundaries;
4. one active write lease per Item;
5. one writable execution per branch/worktree;
6. worktree drift detection without destructive cleanup;
7. portable resume packet;
8. deterministic execution resume.

Session references are an optional native-resume optimization and do not block the portable path.

Automatic cross-model or cross-harness route selection has an additional gate: a Capability Contract must prove compatibility. Before that gate is available, AgEnFK may use only an explicitly approved static handoff route and must not guess compatibility.

The detailed source of truth is `AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md`.

### 5.1 CLI collision correction

The current AgEnFK CLI already uses:

```bash
agenfk pause <platform>
agenfk resume <platform>
```

These commands manage editor/harness integrations and MUST remain unchanged.

Therefore, Durable Execution and Autonomous Delivery MUST use explicit namespaces:

```bash
agenfk execution resume <item-or-execution>
agenfk project pause <project-or-run>
agenfk project resume <project-or-run>
```

Do not add ambiguous top-level `agenfk resume <item>` or `agenfk pause <project>` aliases.

---

## 6. End-to-end user experience

### 6.1 Ingest

```bash
agenfk project ingest ./MASTER_SPEC.md --project <project>
```

Expected result:

- the source document is hashed and stored as an artifact reference;
- a DRAFT Project Contract is created;
- requirements, outcomes, constraints, non-goals, assumptions, and unknowns are extracted;
- no implementation task is scheduled.

### 6.2 Clarify

```bash
agenfk project clarify <project>
```

The Spec Analyst produces structured questions:

- `BLOCKING`: execution cannot safely begin;
- `IMPORTANT`: owner may answer or explicitly accept an assumption;
- `OPTIONAL`: does not block baseline approval.

Every accepted assumption becomes an explicit contract field. Silence is never interpreted as approval.

### 6.3 Baseline

```bash
agenfk project contract show <project>
agenfk project contract approve <project> --version <version>
```

Approval freezes an immutable contract version with:

- content hash;
- approver;
- timestamp;
- accepted assumptions;
- autonomy policy;
- budget envelope;
- required verification profile.

Changes create a new version. They never mutate an approved baseline in place.

### 6.4 Plan

```bash
agenfk project plan <project> --contract-version <version>
agenfk project plan validate <project>
```

The plan creates or proposes:

- Epics;
- Stories;
- Tasks/Bugs;
- dependency edges;
- requirement references;
- acceptance criteria;
- risk and role recommendations;
- integration boundaries;
- verification requirements.

The plan remains unexecutable until approved.

### 6.5 Approve and run

```bash
agenfk project approve-plan <project> --plan-version <version>
agenfk project run <project> --autonomy A1
```

The scheduler starts only after validating the foundation gate, plan, runtime, worktrees, budget, skills, verification profile, and required approvals.

### 6.6 Observe and intervene

```bash
agenfk project status <project>
agenfk scheduler explain <item>
agenfk execution history <item>
agenfk budget status <project>
agenfk project pause <project>
agenfk project resume <project>
```

### 6.7 Accept

The project transitions to `ACCEPTANCE` only when a release candidate satisfies Section 20. The owner may approve, reject with findings, or request a contract revision.

---

## 7. Project Contract

### 7.1 Purpose

The Project Contract is the structured, versioned interpretation of the Master Spec. It is the authoritative intent consumed by planning and acceptance.

### 7.2 Suggested schema

```yaml
project_contract:
  id: contract_01J...
  project_id: project_...
  version: 3
  state: draft | clarifying | awaiting_approval | approved | superseded | rejected
  source:
    artifact_ref: artifact://...
    sha256: ...
    imported_at: ...
  title: ...
  summary: ...
  outcomes:
    - id: OUT-001
      statement: ...
      success_measure: ...
  users:
    - id: USER-001
      description: ...
  functional_requirements:
    - id: REQ-F-001
      statement: ...
      priority: must | should | could | wont
      acceptance_criteria: [...]
  non_functional_requirements:
    - id: REQ-NFR-001
      category: security | performance | reliability | accessibility | cost | compliance
      statement: ...
      measurable_target: ...
  constraints: [...]
  non_goals: [...]
  assumptions:
    - id: ASM-001
      statement: ...
      status: proposed | owner_accepted | rejected | resolved
  unknowns:
    - id: UNK-001
      question: ...
      severity: blocking | important | optional
      resolution: ...
  architecture_constraints: [...]
  environments: [...]
  data_classification: ...
  verification_profile_id: ...
  autonomy_policy_id: ...
  budget_policy_id: ...
  definition_of_done: [...]
  approval:
    approver_id: ...
    approved_at: ...
    content_sha256: ...
```

### 7.3 Rules

- Structured extraction MUST be validated by JSON Schema or Zod before persistence.
- Unknown fields remain `unknown`; the extracting agent MUST NOT fabricate values.
- Every requirement has a stable ID within the contract lineage.
- An approved contract is immutable.
- A new approved version triggers impact analysis against planned/running/completed work.
- Affected unscheduled tasks become stale until reconciled.
- Running executions continue only when the impact evaluator determines they are unaffected; otherwise they checkpoint and pause.
- Chain-of-thought is not persisted. Store requirements, decisions, assumptions, rationale summaries, and evidence only.

---

## 8. Project lifecycle

```text
DRAFT
  -> CLARIFYING
  -> AWAITING_CONTRACT_APPROVAL
  -> PLANNED
  -> AWAITING_PLAN_APPROVAL
  -> READY
  -> RUNNING
  -> ACCEPTANCE
  -> DELIVERED
```

Exceptional states:

```text
PAUSED | BLOCKED | FAILED | CANCELLED
```

### 8.1 Transition authority

| Transition | Authority |
|---|---|
| Contract approval/rejection | Owner or authorized human |
| Plan approval/rejection | Owner or authorized human |
| READY -> RUNNING | Scheduler after policy validation |
| RUNNING -> PAUSED/BLOCKED | Scheduler, policy engine, or human |
| RUNNING -> ACCEPTANCE | Release Readiness evaluator |
| ACCEPTANCE -> DELIVERED | Owner or configured acceptance authority |
| Any -> CANCELLED | Authorized human |

An LLM agent may propose any transition but cannot bypass the authority rules.

---

## 9. Task graph and traceability

### 9.1 Dependency graph

Store typed directed edges:

```yaml
dependency_edge:
  id: dep_...
  project_id: ...
  from_item_id: TASK-102
  to_item_id: TASK-101
  type: blocks | requires | produces_for | validates | integrates_with
  created_by: human | agent | system
  rationale: ...
  contract_version: 3
```

`from_item_id` depends on `to_item_id` for `blocks` and `requires` edges.

### 9.2 Required task metadata

Every executable item MUST have:

- at least one `requirement_ref` or an explicit `infrastructure/support` classification;
- acceptance criteria;
- estimated change surface;
- risk class;
- recommended role profile;
- verification requirements;
- dependency state;
- contract and plan version;
- expected artifact or code outcome.

### 9.3 Plan validation

The validator MUST reject or warn on:

- cycles in blocking dependencies;
- orphan MUST requirements;
- executable tasks with no acceptance criteria;
- tasks with no traceability;
- duplicate tasks with materially overlapping scope;
- tasks estimated to exceed the configured context/work budget;
- multiple tasks intending to own the same migration, API contract, or integration boundary without an explicit coordination item;
- release plan with no integration or acceptance task;
- required security/data work with no assigned gate.

Planning agents may propose the graph. Only deterministic validation makes it schedulable.

---

## 10. Computed readiness

Do not overload or replace customizable workflow columns with a universal `READY` column.

Readiness is a computed orchestration property layered over the existing Item status and active Flow.

```yaml
readiness:
  item_id: TASK-101
  state: ready | not_ready | blocked | stale | completed
  evaluated_at: ...
  reasons:
    - code: DEPENDENCY_OPEN
      detail: TASK-099 is not complete
```

An item is schedulable only when all are true:

1. it is in the executable starting step of its active flow;
2. its plan version is approved and current;
3. all blocking dependencies are satisfied;
4. required inputs/artifacts exist;
5. no active write execution owns it;
6. a worktree can be safely allocated;
7. an eligible role/harness/model route is available;
8. required skills are admitted and locked;
9. budget and retry capacity remain;
10. autonomy policy permits the next side-effect class;
11. no required human approval is pending;
12. the scheduler is below applicable WIP limits.

The CLI and UI MUST explain every failed predicate.

---

## 11. Deterministic scheduler

### 11.1 Scheduler responsibilities

The scheduler:

- evaluates readiness;
- orders candidates;
- reserves capacity and budget;
- creates or resumes an Execution;
- acquires the write lease;
- validates/allocates the worktree;
- chooses an eligible Agent Profile and requested capability route;
- delegates launch to the RuntimeAdapter and HarnessAdapter;
- monitors heartbeat and terminal process state;
- reacts to checkpoints and workflow events;
- applies retry/escalation policy;
- releases capacity and leases;
- never edits code itself.

### 11.2 Candidate ordering

Ordering MUST be reproducible. Recommended priority keys:

1. explicit project priority;
2. critical-path contribution;
3. dependency fan-out unblocked by completion;
4. risk-reduction work before dependent feature work;
5. age;
6. stable Item ID tie-breaker.

An LLM PM agent may propose priority or graph changes. Those changes require validation and, when material, plan approval.

### 11.3 Scheduler transaction

The following must be atomic from the server's perspective:

1. re-evaluate readiness;
2. reserve budget/capacity;
3. create/resume Execution;
4. acquire lease;
5. record dispatch intent in the durable outbox.

Runtime launch occurs after commit. A launch failure creates an auditable event and releases or expires the reservation safely.

### 11.4 WIP and fairness

Support limits at:

- installation;
- project;
- repository;
- role;
- harness/provider route;
- risk class.

Avoid starvation by applying an age component after priority and safety constraints.

### 11.5 Heartbeat and loss detection

Workers report activity through AgEnFK callbacks/hooks. Herdr process state is supporting evidence, not proof of engineering progress.

Possible states:

```text
STARTING | ACTIVE | IDLE | CHECKPOINTING | WAITING_TOOL | LOST | EXITED
```

On `LOST`:

1. wait the configured grace period;
2. inspect Herdr and the harness session reference;
3. request or use the latest checkpoint;
4. classify incomplete side effects;
5. resume if safe and within retry/budget policy;
6. otherwise mark BLOCKED or REQUIRES_HUMAN.

### 11.6 No terminal scraping for completion

Text such as “done”, “tests passed”, or a shell prompt appearing in a pane is never sufficient to complete an Execution.

Completion is accepted only through authenticated structured AgEnFK events plus deterministic evidence.

---

## 12. Orchestration Run

```yaml
orchestration_run:
  id: run_01J...
  project_id: ...
  contract_version: 3
  plan_version: 5
  state: ready | running | paused | blocked | acceptance | completed | failed | cancelled
  autonomy_level: A1
  scheduler_policy_id: ...
  verification_profile_id: ...
  budget_policy_id: ...
  started_at: ...
  ended_at: ...
  active_execution_ids: [...]
  release_candidate_id: ...
  pause_reason: ...
  correlation_id: ...
```

Only one writable Orchestration Run per project/plan version is active by default. Read-only simulation and plan-evaluation runs may coexist.

---

## 13. Agent Profiles

Agents are short-lived executions with role-bound policy. They are not permanent identities that own durable project memory.

### 13.1 Profile schema

```yaml
agent_profile:
  id: software-engineer
  version: 2
  purpose: ...
  supported_item_types: [task, bug, story]
  required_capabilities:
    tool_calling: true
    structured_output: true
    min_context_tokens: 128000
    reasoning_tier: standard
    vision: optional
  preferred_harnesses: [claude-code, pi]
  allowed_side_effects: [READ_ONLY, LOCAL_MUTATION, REPOSITORY_MUTATION]
  forbidden_tools: [...]
  required_skill_refs: [...]
  optional_skill_refs: [...]
  max_attempts: 2
  required_handoffs: [reviewer, tester]
  separation_of_duties: true
```

### 13.2 Initial profile catalog

| Profile | Responsibility |
|---|---|
| `spec-analyst` | Extract contract, identify unknowns, conduct clarification |
| `project-planner` | Decompose approved contract into a traceable DAG |
| `project-manager` | Monitor lifecycle, milestones, risks and blockers; propose validated replanning without directly overriding scheduler policy |
| `architect` | Define boundaries, interfaces, ADRs, migrations, NFR strategy |
| `software-engineer` | Domain, backend, data, and integration implementation |
| `frontend-engineer` | Frontend implementation from approved UX/design contract |
| `product-designer` | User journeys, UX decisions, design tokens, visual acceptance artifacts |
| `reviewer` | Independent requirement, logic, maintainability, and regression review |
| `tester` | Test design, test authoring, failure diagnosis, coverage gaps |
| `security-engineer` | Threat model, AppSec, IaC/cloud and dependency review |
| `platform-delivery` | DevOps and CI/CD for MVP; deployment and operational readiness |
| `integration-release` | Dependency-aware integration, release-candidate assembly and evidence |
| `finops-advisor` | Cost analysis and routing recommendations; no budget bypass authority |
| `documentation` | User, operator, API, architecture, and release documentation |

Not every project uses every profile. The approved plan selects only necessary profiles.

### 13.3 Separation of duties

- The authoring execution cannot be the sole final reviewer of its own change.
- High-risk work requires a security profile that did not author the change.
- The final Release Readiness evaluator is deterministic.
- Policy MAY require the reviewer to use a different model family or harness from the author.

### 13.4 Design and frontend quality contract

Projects with a user interface MUST define the expected design artifacts in the approved plan. Depending on the project, they may include:

- user journeys and screen inventory;
- information hierarchy;
- design tokens and component states;
- responsive breakpoints;
- empty, loading, error, permission, and destructive-action states;
- accessibility targets;
- screenshot or design-file references;
- visual-regression baselines;
- browser/device acceptance matrix.

Figma or another design surface may be integrated as an optional tool, but is not an AgEnFK runtime dependency. When used, persist stable file/node/version references rather than relying on screenshots alone.

The Product Designer proposes and validates the UX contract. The Frontend Engineer implements it. Neither role can close user-interface work without the configured visual, responsive, and accessibility evidence.

---

## 14. Worker launch contract

Every worker receives a bounded Execution Packet generated by AgEnFK:

- Item goal and acceptance criteria;
- requirement references;
- current workflow step and exit criteria;
- approved contract and plan version references;
- repository/worktree/branch identity;
- latest portable checkpoint, when resuming;
- relevant decisions and ADRs;
- Agent Profile version;
- exact skill lock snapshot;
- tool and side-effect permissions;
- deterministic verification commands;
- budget/time/retry limits;
- required structured callback protocol;
- correlation identifiers.

Recommended environment variables:

```text
AGENFK_PROJECT_ID
AGENFK_ORCHESTRATION_RUN_ID
AGENFK_ITEM_ID
AGENFK_EXECUTION_ID
AGENFK_ROLE
AGENFK_CONTRACT_VERSION
AGENFK_PLAN_VERSION
AGENFK_WORKTREE
AGENFK_CORRELATION_ID
AGENFK_CALLBACK_URL
AGENFK_EXECUTION_TOKEN
```

`AGENFK_EXECUTION_TOKEN` MUST be short-lived, least-privilege, scoped to one Execution, and never persisted in checkpoints or logs.

The packet is stored as a redacted artifact with a hash. Raw secrets are injected at runtime through approved mechanisms, never embedded in the packet.

---

## 15. Skills Registry and admission control

### 15.1 Principle

Marketplaces are discovery sources, not trust authorities.

Skills are treated like executable software because they may contain instructions, scripts, dependencies, references, and assets that change agent behavior and tool use.

### 15.2 Supported package shape

Support the open Agent Skills directory format centered on `SKILL.md`, while adding AgEnFK registry metadata externally or in a compatible metadata block.

### 15.3 Registry entities

```yaml
skill_package:
  id: react-quality
  version: 1.4.2
  source:
    type: internal | official | community
    repository: ...
    commit: ...
  content_sha256: ...
  publisher: ...
  license: ...
  compatibility: ...
  required_tools: [...]
  network_policy: none | allowlist | unrestricted_forbidden
  filesystem_policy: read_only | project_write | custom
  bundled_scripts: [...]
  status: candidate | trusted | restricted | quarantined | revoked
  evaluations:
    security: ...
    quality: ...
    regression: ...
  admitted_by: ...
  admitted_at: ...
```

### 15.4 Admission pipeline

Before a skill becomes `trusted` or `restricted`:

1. resolve an immutable source commit;
2. calculate content hashes;
3. identify license and publisher;
4. enumerate every bundled file;
5. scan scripts and dependencies;
6. detect unexpected network/filesystem behavior;
7. test prompt-injection and instruction-conflict cases;
8. run role-specific golden evaluations;
9. assign permissions and risk status;
10. record human or policy approval.

Unknown or mutable sources cannot be used by unattended writable executions.

### 15.5 Project skill lock

Approved plans produce a lock snapshot:

```yaml
skill_lock:
  project_id: ...
  contract_version: 3
  plan_version: 5
  entries:
    - skill_id: react-quality
      version: 1.4.2
      content_sha256: ...
      permission_profile: frontend-restricted
```

A running Orchestration Run never receives a new skill version silently. Updating the lock creates a plan revision or explicit administrative change with impact analysis.

### 15.6 Quality ranking

“Best skill” means best performance on AgEnFK's relevant golden tasks under cost, safety, and regression constraints. Marketplace popularity alone is not a quality signal.

---

## 16. Verification system

### 16.1 Verification Profile

```yaml
verification_profile:
  id: node-web-standard
  version: 4
  task_gates:
    - lint_affected
    - typecheck
    - unit_affected
  story_gates:
    - package_build
    - unit_package
    - integration_affected
    - component
  integration_gates:
    - contracts
    - migrations
    - visual_regression
    - critical_e2e
  release_gates:
    - full_build
    - full_test
    - security
    - accessibility
    - performance
    - infra_validation
  commands:
    lint_affected:
      command: ...
      timeout_seconds: 600
      side_effect: READ_ONLY
```

Profiles may be generated from templates and repository inspection, but become authoritative only after validation/approval.

### 16.2 Evidence schema

```yaml
verification_run:
  id: verify_...
  project_id: ...
  item_id: ...
  execution_id: ...
  gate_id: unit_affected
  command: ...
  environment_fingerprint: ...
  commit_sha: ...
  tree_sha: ...
  started_at: ...
  ended_at: ...
  exit_code: 0
  status: passed | failed | error | timeout | skipped
  coverage: ...
  artifact_refs: [...]
  log_sha256: ...
```

### 16.3 Layered execution

Do not run the full release suite after every file edit.

| Boundary | Minimum verification |
|---|---|
| Task | lint/format, typecheck, affected unit tests |
| Story | package build, package tests, component/integration tests |
| Integration | contracts, migrations, visual regression, critical E2E |
| Release candidate | full suite, security, accessibility, performance, infrastructure checks |

### 16.4 Agent versus runner

The Tester agent may design, write, and diagnose tests. The deterministic verification runner executes commands and records authoritative results.

### 16.5 Repair loop

On failure:

1. persist structured evidence;
2. transition the Item according to its Flow, normally back to an implementation/fix step;
3. create a checkpoint;
4. decide whether the author, specialist, stronger route, or human receives the repair;
5. enforce attempt and budget limits;
6. rerun the smallest sufficient failed gate, then all required upstream gates before completion.

No unbounded self-repair loop is permitted.

---

## 17. Security and autonomy

### 17.1 Side-effect classes

```text
READ_ONLY
LOCAL_MUTATION
REPOSITORY_MUTATION
REMOTE_MUTATION
NONPROD_MUTATION
PRODUCTION_MUTATION
```

Every tool and Activity declares a side-effect class. Unknown classification is denied for unattended execution.

### 17.2 Autonomy levels

| Level | Allowed by default |
|---|---|
| A0 | Analyze, clarify, and plan only |
| A1 | A0 plus isolated local/worktree changes and local verification |
| A2 | A1 plus branch push, PR creation, and CI execution |
| A3 | A2 plus approved non-production mutations/deployments |
| A4 | Production mutation only with explicit, time-bounded human approval and scoped credentials |

A4 is not a fully autonomous default. Approval is mandatory unless a future separate governance specification defines a narrower pre-authorized production operation.

### 17.3 Approval object

```yaml
approval:
  id: approval_...
  scope: contract | plan | skill | remote_mutation | nonprod | production | release
  subject_ref: ...
  requested_by: ...
  requested_at: ...
  expires_at: ...
  decision: pending | approved | rejected | expired | revoked
  decided_by: ...
  decided_at: ...
  reason: ...
  constraints: [...]
```

### 17.4 Execution isolation

Writable workers MUST use isolated Git worktrees. Projects SHOULD support devcontainer/container isolation where available.

Security policy must support:

- filesystem scope;
- network egress allowlists;
- tool allow/deny lists;
- scoped and short-lived credentials;
- secret redaction;
- non-production defaults;
- branch protection awareness;
- production confirmation;
- dependency and skill supply-chain checks.

### 17.5 Untrusted inputs

Treat Master Specs, cards, comments, issue imports, web content, documentation, tool output, and skill resources as potentially hostile input.

Instructions found in project content never override system policy, approved contract, Agent Profile, tool permissions, or autonomy level.

---

## 18. FinOps and model routing

### 18.1 Enforcement versus advice

FinOps enforcement is deterministic. The `finops-advisor` agent explains and recommends but cannot bypass a cap.

### 18.2 Budget hierarchy

Support budgets for:

- project;
- Orchestration Run;
- Epic/Story/Task;
- Execution attempt;
- role;
- model route;
- wall time;
- token count;
- optional currency cost.

### 18.3 Budget policy

```yaml
budget_policy:
  id: budget_...
  project_max_usd: 500
  run_max_usd: 250
  reserve_percent:
    review: 15
    testing: 15
    repair: 10
  item_defaults:
    task_max_usd: 10
    max_attempts: 2
    max_wall_minutes: 90
  on_threshold:
    75_percent: warn
    90_percent: restrict_to_approved_routes
    100_percent: pause
```

### 18.4 Routing contract

AgEnFK declares required capabilities and a preferred route. LiteLLM performs provider/model routing and failover. AgEnFK records the outcome and validates that the selected route remains compatible.

Unknown model capabilities or unknown pricing degrade to `REQUIRES_HUMAN` or a configured conservative ceiling. They are never fabricated.

### 18.5 Retry and escalation

Suggested default:

1. first eligible attempt on the selected route;
2. one evidence-informed repair attempt if policy permits;
3. escalate to a stronger compatible route or independent specialist;
4. after the configured limit, mark `BLOCKED` or `REQUIRES_HUMAN`.

### 18.6 Stagnation detection

Pause or escalate when successive checkpoints show no material progress, for example:

- no relevant diff;
- same verification failure with no new diagnosis;
- repeated tool errors;
- repeated plan restatement;
- budget consumption without acceptance-criteria progress.

---

## 19. Integration and merge queue

Completing individual cards is insufficient. Autonomous Delivery requires project-level integration.

### 19.1 Integration responsibilities

The Integration/Release profile and deterministic merge service:

- verify dependency order;
- inspect branch/worktree fingerprints;
- confirm required reviews and evidence;
- update branches safely through explicit Git operations;
- detect conflicts;
- create an isolated integration worktree/branch;
- run integration gates;
- preserve contributor commits and traceability;
- create/update PRs;
- never push directly to protected `main` by default.

### 19.2 Conflict handling

Automatic conflict resolution is allowed only within a configured risk threshold and must be followed by all affected verification gates. Otherwise create a dedicated integration-conflict item.

Never silently choose one agent's version over another.

### 19.3 Idempotency

Use idempotency keys for:

- branch creation;
- PR creation/update;
- CI triggers;
- release-candidate creation;
- artifact upload;
- non-production deployments.

A resumed execution checks external state before repeating a remote operation.

---

## 20. Release Candidate

### 20.1 Definition

A release candidate is an auditable project artifact, not merely a Git branch.

```yaml
release_candidate:
  id: rc_...
  project_id: ...
  orchestration_run_id: ...
  contract_version: 3
  plan_version: 5
  source:
    repository: ...
    branch: ...
    commit_sha: ...
    tree_sha: ...
  build_artifacts: [...]
  verification_summary: ...
  requirement_coverage: ...
  security_summary: ...
  known_issues: [...]
  cost_summary: ...
  release_notes_ref: ...
  deployment_manifest_ref: ...
  rollback_plan_ref: ...
  state: assembling | failed | ready | accepted | rejected
```

### 20.2 Readiness criteria

An RC is `ready` only when:

- all MUST requirements map to completed evidence or an explicitly approved exception;
- all required Items are complete under their active Flows;
- all release gates pass against the exact RC commit/tree;
- no unresolved critical/high security finding exists unless explicitly excepted by authorized policy;
- migrations and rollback/forward-fix strategy are documented;
- required operational documentation exists;
- known issues are listed;
- cost summary is complete;
- build/deployment artifacts are addressable and hashed;
- the source tree is reproducible enough for the project's policy;
- acceptance approval is requested.

Production deployment is outside the MVP completion definition.

---

## 21. Board and UI requirements

The current Kanban remains the visual foundation.

### 21.1 Project-level surface

Add an Autonomous Delivery view with:

- contract and plan versions;
- lifecycle state;
- autonomy level;
- budget consumed/reserved/remaining;
- READY/blocked/running/completed counts;
- dependency graph summary;
- active agents and worktrees;
- pending approvals;
- release-candidate status;
- pause/resume controls;
- recent incidents and recovery events.

### 21.2 Card-level orchestration panel

Display:

- computed readiness and reasons;
- requirement references;
- dependencies/dependents;
- assigned Agent Profile;
- active Execution and attempt;
- harness/model route;
- Herdr runtime reference without exposing sensitive raw paths centrally;
- worktree/branch;
- lease status;
- last checkpoint;
- latest verification evidence;
- cost and limits;
- blockers;
- PR/CI links;
- execution history.

### 21.3 Explainability

Every disabled action or non-ready item must expose a deterministic reason. Avoid generic “agent unavailable” or “cannot proceed” messages.

### 21.4 UI authority

The UI is a client. Server APIs and domain policy remain authoritative.

---

## 22. CLI surface

Proposed commands:

```bash
# Contract and planning
agenfk project ingest <master-spec> [--project <id>]
agenfk project clarify <project>
agenfk project contract show <project> [--version <n>]
agenfk project contract diff <project> <v1> <v2>
agenfk project contract approve <project> --version <n>
agenfk project plan <project> --contract-version <n>
agenfk project plan validate <project>
agenfk project approve-plan <project> --plan-version <n>

# Orchestration lifecycle
agenfk project run <project> [--autonomy A0|A1|A2|A3|A4]
agenfk project status <project>
agenfk project pause <project-or-run> [--reason <text>]
agenfk project resume <project-or-run>
agenfk project cancel <project-or-run>
agenfk project doctor <project>

# Scheduler and execution
agenfk scheduler status [--project <id>]
agenfk scheduler explain <item>
agenfk scheduler tick [--dry-run]
agenfk execution resume <item-or-execution>
agenfk execution history <item-or-execution>

# Agents, runtime, and skills
agenfk agent profile list
agenfk agent profile show <profile>
agenfk runtime status
agenfk skills registry list
agenfk skills inspect <skill>
agenfk skills admit <skill> --version <version>
agenfk skills quarantine <skill>
agenfk skills lock <project>
agenfk skills verify-lock <project>

# Verification, budget, and release
agenfk verification profile show <project>
agenfk verification run <item> --gate <gate>
agenfk verification evidence <item>
agenfk budget status <project>
agenfk budget set <project> ...
agenfk release candidate create <project>
agenfk release candidate status <project>
```

CLI commands call server APIs. They do not write storage directly.

MCP tools may mirror safe API operations, but CLI remains canonical and equivalent.

---

## 23. API and event model

### 23.1 API groups

Suggested versioned REST resources:

```text
/v1/project-contracts
/v1/project-plans
/v1/dependencies
/v1/orchestration-runs
/v1/readiness
/v1/scheduler
/v1/agent-profiles
/v1/runtime-workers
/v1/skill-packages
/v1/skill-locks
/v1/verification-profiles
/v1/verification-runs
/v1/budgets
/v1/approvals
/v1/release-candidates
```

Reuse existing Item, Execution, Comment/Event, Flow, and evidence APIs where possible.

### 23.2 Event envelope

```yaml
event:
  id: evt_...
  type: scheduler.item_dispatched
  occurred_at: ...
  project_id: ...
  orchestration_run_id: ...
  item_id: ...
  execution_id: ...
  correlation_id: ...
  actor: system | human | agent
  actor_id: ...
  payload: ...
  schema_version: 1
```

### 23.3 Minimum events

```text
contract.imported
contract.question_created
contract.approved
contract.superseded
plan.created
plan.validation_failed
plan.approved
readiness.changed
scheduler.item_reserved
scheduler.item_dispatched
scheduler.dispatch_failed
runtime.process_started
runtime.process_lost
execution.checkpointed
execution.resumed
execution.escalated
verification.started
verification.completed
approval.requested
approval.decided
budget.threshold_reached
skill.locked
skill.revoked
integration.started
integration.failed
release_candidate.ready
project.paused
project.resumed
project.delivered
```

Events sync to the UI through existing real-time mechanisms and to Corporate Hub only through the redacted durable outbox policy.

---

## 24. Storage, concurrency, and scale

### 24.1 Local MVP

The local single-installation MVP continues to use SQLite/WAL through `storage-sqlite`.

Requirements:

- server is the only state writer;
- migrations are transactional and backwards compatible;
- scheduler reservation uses database transactions;
- leases have expiry and heartbeat semantics;
- durable outbox prevents lost dispatch/sync events;
- scheduler restart reconstructs state from persisted records;
- no required in-memory-only queue state.

### 24.2 Distributed future

Multi-machine scheduling through Corporate Hub is post-MVP.

Before distributed writable scheduling, introduce an approved architecture for:

- PostgreSQL or equivalent shared transactional store;
- distributed leases/fencing tokens;
- authenticated workers;
- queue fairness;
- tenant isolation;
- secret boundaries;
- network partitions;
- idempotent dispatch;
- HA and disaster recovery.

Temporal may be evaluated later as a durable workflow backend, but is not an MVP dependency and must not duplicate AgEnFK's domain authority.

---

## 25. Observability, audit, and privacy

### 25.1 Correlation

Propagate stable identifiers across:

```text
Project Contract
Plan
Item
Orchestration Run
Execution
Checkpoint
Herdr workspace/pane
Harness session
LiteLLM request metadata
Git branch/commit/PR
CI run
Release Candidate
```

### 25.2 Metrics

At minimum:

- spec-to-approved-contract time;
- contract questions by severity;
- plan validation failure rate;
- READY queue depth;
- lead/cycle time by Item type and role;
- agent attempts per completed Item;
- repair-loop rate;
- interrupted executions resumed without restatement;
- worktree/lease conflicts prevented;
- verification pass/fail and flaky-test rate;
- cost per completed requirement;
- budget variance;
- capability/fallback events;
- human interventions by reason;
- RC first-pass acceptance rate.

### 25.3 Privacy

Persist through:

```text
detect -> redact -> hash/reference -> persist
```

Do not centrally sync by default:

- raw terminal history;
- secrets;
- `.env` content;
- authorization headers;
- private keys;
- raw production data;
- sensitive full prompts;
- raw local session paths;
- unrestricted diffs.

Store operational summaries, decisions, evidence references, hashes, states, metrics, and redacted artifacts.

---

## 26. Delivery roadmap

Each delivery below is independently mergeable and must leave the product usable. If a delivery becomes too large after repository inspection, split it without mixing future-delivery behavior into the first part.

### AD0 — Foundation audit and compatibility contract

**Depends on:** none.  
**Purpose:** establish the exact current baseline and prevent duplicate Durable Execution work.

Deliver:

- repository architecture/current-schema inventory;
- automated capability checks for Durable Execution D1–D5;
- CLI collision tests preserving `agenfk resume <platform>`;
- feature flag/config skeleton for Autonomous Delivery;
- ADR confirming component boundaries and package layout;
- backwards-compatibility test suite for Standard/Deep modes.

Acceptance:

- audit reports each foundation capability as present, partial, or missing;
- no writable Autonomous Run can start while the foundation gate fails;
- existing tests and install/upgrade paths pass;
- no new orchestration behavior runs by default.

### AD1 — Project Contract and Master Spec ingestion

**Depends on:** AD0.  
**Standalone value:** a Master Spec becomes structured, versioned project intent without launching work.

Deliver:

- Project Contract schema/repository/migration;
- Master Spec artifact hashing;
- structured extraction service interface;
- JSON Schema/Zod validation;
- requirement IDs, assumptions, unknowns, non-goals, NFRs;
- CLI/API/UI read surface;
- mocked extractor for deterministic tests.

Acceptance:

- import is idempotent by source hash unless `--new-version` is explicit;
- malformed extraction is rejected;
- `unknown` remains unknown;
- no task is scheduled;
- contract round-trip and migration tests pass.

### AD2 — Clarification, baseline versioning, and approvals

**Depends on:** AD1.  
**Standalone value:** owner and agent can turn an ambiguous spec into an immutable approved contract.

Deliver:

- structured clarification questions;
- blocking/important/optional categories;
- assumption acceptance/rejection;
- immutable contract versions and diff;
- approval records;
- contract state machine;
- UI approval surface.

Acceptance:

- blocking unknowns prevent approval;
- owner may explicitly accept important assumptions;
- approved contract cannot be mutated;
- revisions show deterministic diff and retain lineage;
- approval identity/time/hash are auditable.

### AD3 — Traceable project planning and dependency graph

**Depends on:** AD2.  
**Standalone value:** an approved contract produces a reviewable, validated Epic/Story/Task DAG.

Deliver:

- plan entity/versioning;
- dependency edges;
- requirement references on Items;
- plan proposal service and deterministic validator;
- orphan/cycle/oversized-task checks;
- plan approval;
- impact markers for stale plans after contract revision.

Acceptance:

- every MUST requirement is mapped or explicitly excepted;
- cycles prevent approval;
- plan changes after approval require a new version;
- no plan Item enters execution before approval;
- existing Item hierarchy remains compatible.

### AD4 — Readiness engine and Kanban orchestration overlays

**Depends on:** AD3 and Durable Execution foundation.  
**Standalone value:** users can see exactly what is READY or blocked and why, without launching agents.

Deliver:

- computed readiness engine;
- readiness explanations;
- project-level Autonomous Delivery dashboard shell;
- card orchestration panel;
- dependency visualization appropriate to the current UI;
- WebSocket updates;
- scheduler dry-run/explain CLI.

Acceptance:

- readiness is deterministic for identical state;
- custom Flow columns are not replaced;
- every not-ready item has at least one actionable reason;
- no external board is required;
- current Kanban behavior remains intact when the feature is disabled.

### AD5 — Scheduler kernel and dry-run orchestration

**Depends on:** AD4.  
**Standalone value:** AgEnFK can deterministically reserve and simulate project work without starting a harness.

Deliver:

- Orchestration Run entity/state machine;
- scheduler transaction, ordering, WIP, reservations;
- durable dispatch outbox;
- basic budget/attempt/time caps required before launch;
- pause/resume/cancel/status/doctor;
- dry-run worker adapter;
- restart/recovery tests.

Acceptance:

- concurrent scheduler ticks cannot reserve the same Item twice;
- ordering is reproducible;
- process restart loses no reserved work;
- pause prevents new dispatch but preserves resumability;
- budget exhaustion pauses rather than loops;
- dry-run produces a complete dispatch plan and audit timeline.

### AD6 — Herdr runtime and harness adapters

**Depends on:** AD5.  
**Standalone value:** one READY item can be executed in an isolated Herdr-managed worker and resumed safely.

Deliver:

- RuntimeAdapter interface;
- Herdr RuntimeAdapter;
- HarnessAdapter interface;
- Claude Code adapter;
- Pi adapter;
- execution-scoped callback authentication;
- worker launch packet;
- heartbeat/loss detection;
- native session reference when available;
- portable checkpoint fallback;
- minimum A0/A1/A2 side-effect enforcement for worker tools, with unknown side effects denied;
- A3/A4 disabled until AD12;
- Codex adapter interface fixtures, with full adapter optional in this delivery.

Acceptance:

- scheduler launches one worker in the correct worktree;
- process lifecycle is visible without terminal text determining completion;
- callback from wrong/expired Execution token is rejected;
- Herdr restart and deleted harness session both exercise documented recovery paths;
- Claude Code quota/session failure produces a valid checkpoint and handoff-ready Pi launch plan; execution is automatic only for a statically approved compatible route until AD11 capability routing exists;
- A1 workers cannot perform remote mutations, and A3/A4 cannot be selected;
- no dirty/divergent worktree is reset automatically.

### AD7 — Agent Profiles and role-bound execution

**Depends on:** AD6.  
**Standalone value:** scheduler dispatches bounded specialist roles rather than generic agents.

Deliver:

- Agent Profile schema/registry;
- initial profile catalog;
- capability and side-effect requirements;
- role-to-flow integration;
- separation-of-duties rules;
- model/harness independence;
- profile version captured in checkpoints/evidence.

Acceptance:

- unsupported role/capability combinations are not dispatched;
- author cannot be sole required reviewer;
- profile update does not mutate active Execution behavior;
- project uses only roles required by its approved plan.

### AD8 — Governed Skills Registry and project lock

**Depends on:** AD7.  
**Standalone value:** approved agents use pinned, auditable skills; marketplace content cannot silently enter executions.

Deliver:

- skill catalog/admission entities;
- immutable source/hash capture;
- inspection and admission CLI/API;
- trusted/restricted/quarantined/revoked states;
- project skill lock;
- worker skill snapshot;
- static security checks and golden-evaluation interfaces;
- revocation behavior.

Acceptance:

- mutable/unreviewed skill cannot run in unattended write mode;
- lock verification detects drift;
- active run retains its pinned snapshot unless policy revokes it;
- revoked dangerous skill pauses affected undispatched work and flags active work;
- skill scripts cannot exceed their permission profile.

### AD9 — Deterministic verification and bounded repair loops

**Depends on:** AD7; integrates with AD8.  
**Standalone value:** completed items carry independent, reproducible evidence and failures re-enter a bounded repair loop.

Deliver:

- Verification Profile/Run entities;
- layered gates;
- deterministic command runner with timeout and artifact capture;
- affected/full gate selection;
- repair policy;
- flaky/error/timeout distinction;
- UI evidence surface;
- security/accessibility/visual gate adapter interfaces.

Acceptance:

- LLM statements cannot mark a gate passed;
- evidence binds to exact commit/tree/environment;
- failed gates route back according to Flow and policy;
- attempts are bounded;
- release gates rerun against the integrated RC tree;
- relevant failure chaos tests pass.

### AD10 — Integration queue and release-candidate assembly

**Depends on:** AD9.  
**Standalone value:** multiple completed cards become one tested, traceable release candidate.

Deliver:

- integration queue/state;
- isolated integration worktree/branch;
- dependency-aware integration order;
- conflict item generation;
- idempotent PR/CI operations;
- Release Candidate entity;
- requirement coverage evaluator;
- release notes, deployment-manifest, rollback-plan artifact slots;
- acceptance UI.

Acceptance:

- individually passing branches cannot produce a ready RC until integrated gates pass;
- conflict never silently discards a side;
- repeated orchestration does not duplicate PRs/CI/RCs;
- RC binds all evidence to one exact commit/tree;
- owner can accept or reject with structured findings.

**MVP cut line:** AD0–AD10 delivers Master Spec -> approved contract -> approved plan -> autonomous work -> tested release candidate.

### AD11 — FinOps, capability routing, and stagnation control

**Depends on:** AD6 and AD9.  
**Standalone value:** autonomous runs enforce cost/time/model policies and explain spend.

Deliver:

- full hierarchical budgets and reservations;
- LiteLLM/model route correlation;
- Capability Contract integration;
- fallback/escalation rules;
- cost ledger/dashboard;
- stagnation detection;
- review/test/repair reserves;
- unknown-pricing policy.

Acceptance:

- hard cap cannot be exceeded by scheduler dispatch;
- every recorded model cost is attributable to an Execution/Item when provider metadata exists;
- incompatible fallback is caught before launch;
- context-only mismatch requests compaction;
- stagnating work pauses/escalates instead of consuming an unbounded budget.

### AD12 — Security hardening and A3/A4 autonomy enforcement

**Depends on:** AD8–AD11.  
**Standalone value:** explicit autonomy levels and side-effect policy safely govern remote/nonprod/production operations.

Deliver:

- side-effect registry/enforcement;
- A0–A4 policy engine;
- approval expiry/revocation;
- network/filesystem/tool policies;
- prompt-injection test suite;
- secret-redaction adversarial tests;
- scoped credential hooks;
- security dashboard and incident events.

Acceptance:

- unknown side effect is denied unattended;
- A1 cannot push or call remote mutation tools;
- A2 cannot deploy;
- A3 cannot mutate production;
- A4 production operation requires valid scoped approval;
- hostile card/spec/skill content cannot override policy in test fixtures.

**Production-ready v1 cut line:** AD0–AD12.

### AD13 — Corporate Hub fleet scheduling and distributed execution

**Depends on:** proven AD0–AD12 usage and separate ADR.  
**Standalone value:** organization-level scheduling across installations/workers.

Not part of MVP. Requires shared-store, fencing, tenancy, HA, worker identity, and network-partition design. Temporal or another durable runtime may be evaluated here, not assumed.

Deliver:

- approved distributed-execution ADR and threat model;
- shared transactional persistence and migration path;
- worker registration, identity, health, and capability inventory;
- distributed scheduler with fencing tokens and idempotent dispatch;
- tenant/org isolation;
- network-partition and worker-reconciliation behavior;
- Hub fleet UI and operational runbooks;
- local-only compatibility mode.

Acceptance:

- two scheduler instances cannot grant valid ownership of the same writable Item;
- a stale worker is fenced before its work is reassigned;
- duplicate dispatch and callbacks are idempotent;
- organization data cannot cross tenant boundaries;
- network-partition recovery does not silently accept divergent code state;
- existing local installations continue to operate without the distributed service.

---

## 27. Cross-cutting test strategy

### Unit

- contract validation and version immutability;
- requirement and dependency rules;
- DAG cycle detection;
- readiness predicates/explanations;
- scheduler ordering/reservation;
- WIP/fairness;
- budget reservation and threshold behavior;
- capability compatibility;
- Agent Profile permissions;
- skill lock verification;
- approval expiry;
- side-effect policy;
- RC readiness evaluator.

### Integration

- Master Spec -> Contract -> questions -> approval;
- Contract -> plan -> Items/dependencies -> approval;
- READY item -> reservation -> Execution/lease/worktree -> Herdr dispatch;
- Claude Code checkpoint -> Pi portable resume;
- worker callback authentication;
- verification failure -> repair -> re-verification;
- two independent worktrees -> integration -> RC;
- contract revision -> impact/stale task behavior;
- skill revocation during a run;
- budget exhaustion during retry;
- GitHub/Hub compatibility where affected.

### Chaos/failure

- kill harness mid-edit;
- stop/restart Herdr;
- stop/restart AgEnFK server;
- corrupt/delete session reference;
- expire lease;
- switch branch externally;
- modify worktree after checkpoint;
- duplicate scheduler tick;
- duplicate callback/outbox delivery;
- provider 429/outage/quota exhaustion;
- incompatible fallback model;
- CI timeout;
- flaky test;
- remote mutation returns ambiguous result;
- skill source disappears;
- contract changes while workers are active.

### Security

- prompt injection in Master Spec, card, comment, web result, tool output, and skill reference;
- credential leakage through logs/checkpoints/artifacts;
- callback token replay;
- path traversal in worktree/artifact paths;
- command injection in Verification Profile;
- unauthorized side-effect escalation;
- malicious skill script;
- SSRF/egress policy violations;
- cross-project and cross-organization data isolation.

---

## 28. Backwards compatibility

The implementation MUST preserve:

- existing SQLite data and migrations;
- Standard and Deep mode behavior;
- existing Flow configuration and transitions;
- `pause-work` / `resume-work` behavior mapped through Durable Execution;
- `agenfk pause <platform>` and `agenfk resume <platform>`;
- CLI-only default and optional MCP equivalence;
- current supported client integrations;
- current Kanban and multi-project behavior;
- GitHub Issues synchronization;
- Corporate Hub outbox and governance contracts;
- feature-off behavior equivalent to the pre-Autonomous version.

New database entities are additive. Existing Items do not require a Project Contract unless they participate in Autonomous Delivery.

---

## 29. Non-functional requirements

### Reliability

- no acknowledged state transition is lost after server restart;
- duplicate events are idempotent;
- leases use fencing/expiry appropriate to local architecture;
- a runtime outage does not corrupt project state;
- resume never silently discards code.

### Performance

- readiness evaluation should support incremental recomputation for affected Items;
- the Kanban must not require loading raw execution artifacts;
- scheduler tick duration and queue depth are observable;
- large plans are paginated in API/UI.

### Security

- least privilege and deny-by-default for unknown mutations;
- secrets excluded from persisted summaries;
- remote UI access requires authentication;
- artifacts have retention and redaction classes.

### Maintainability

- domain policies live in testable core/orchestrator services, not UI or prompts;
- adapters implement stable interfaces;
- agent prompts/profiles/skills are versioned;
- storage implementations do not leak into domain logic;
- all public event payloads are schema-versioned.

### Accessibility and UX

- orchestration status and approvals are keyboard accessible;
- state is not represented by color alone;
- failure/readiness explanations use specific corrective language;
- destructive approvals clearly name scope and expiry.

---

## 30. Success metrics

### North-star metric

> Percentage of approved Master Specs that produce a release candidate satisfying all configured gates without the owner having to restate project context or manually coordinate individual tasks.

### Supporting metrics

- percentage of interrupted executions resumed without manual reconstruction;
- median owner interventions per release candidate;
- requirement traceability coverage;
- first-pass plan approval and RC acceptance rates;
- escaped regression rate in acceptance;
- duplicate/concurrent write conflicts prevented;
- scheduler idle time while READY work exists;
- repair attempts per completed Item;
- cost per accepted requirement;
- cost and time variance from policy;
- skill evaluation regression rate;
- security-policy denials and true-positive rate;
- mean time to resume after process/provider failure.

---

## 31. Recommended package boundaries

Final locations MUST follow current repository conventions discovered in AD0. Suggested direction:

```text
packages/core
  domain types, policies, schemas, interfaces

packages/orchestrator
  readiness, scheduler, planning validation, run lifecycle, release readiness

packages/runner-herdr
  Herdr RuntimeAdapter

packages/harness-adapters
  Claude Code, Pi, later Codex adapters

packages/skill-registry
  catalog, admission, locks, evaluations

packages/verification
  profiles, deterministic runner, evidence adapters

packages/server
  REST/WebSocket composition, callbacks, authentication, scheduler service

packages/storage-sqlite
  migrations and repositories

packages/cli
  canonical command surface

packages/ui
  Autonomous Delivery and card orchestration surfaces
```

Avoid a package per Agent Profile. Profiles are data/policy, not compiled subsystems.

Dependency direction:

```text
core <- orchestrator <- server
core <- adapters <- server
core <- storage implementation
server composes concrete implementations
```

`core` MUST NOT import server, UI, Herdr, harness CLIs, or SQLite implementations.

---

## 32. Definition of Done for every delivery

A delivery is complete only when:

- scope and non-scope match its section;
- migrations upgrade a realistic prior database;
- rollback/recovery behavior is documented where applicable;
- public types and API schemas are versioned;
- CLI and API behavior are equivalent;
- unit, integration, and relevant failure tests pass;
- affected UI has automated tests and manual/visual evidence where appropriate;
- security/privacy review is complete;
- backwards-compatibility suite passes;
- documentation and changelog are updated;
- no TODO silently defers an acceptance criterion;
- the AgEnFK item contains evidence and a final summary;
- the PR is small enough to review professionally.

---

## 33. Initial Claude Code kickoff prompt

Use this prompt with the repository and this specification available:

```text
You are implementing AgEnFK Autonomous Delivery from
AGENFK_AUTONOMOUS_DELIVERY_MASTER_SPEC.md.

Start with AD0 only. Do not implement later deliveries.

1. Read CLAUDE.md, AGENTS.md, README.md, AFK_ARCHITECTURE.md, SDLC.md,
   package manifests, migrations, current tests, and the companion
   AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md.
2. Inspect the repository and map current capabilities to the AD0 acceptance
   criteria and Durable Execution D1-D5 foundation gate.
3. Create/use the correct AgEnFK Epic/Story/Task according to existing rules.
4. Produce a concrete implementation plan listing files, migrations, tests,
   compatibility risks, and any contradiction between the current repository
   and the master spec.
5. Pause for my approval before editing code.

Non-negotiable constraints:
- AgEnFK server remains the single state authority.
- Native AgEnFK Kanban is the required board.
- Preserve Standard Mode, Deep Mode, custom flows, integrations, GitHub sync,
  Corporate Hub, and existing CLI behavior.
- Preserve `agenfk resume <platform>`; execution/project resume use explicit
  namespaces.
- No Jira/Plane dependency, no orchestration framework dependency, no direct
  SQLite writes, and no destructive Git cleanup.
- One delivery per branch/worktree/PR with deterministic evidence.
```

After AD0 merges, use the same structure for AD1, replacing “AD0 only” with the next approved delivery.

---

## 34. References

- AgEnFK repository: https://github.com/cglab-public/agenfk
- AgEnFK architecture: https://github.com/cglab-public/agenfk/blob/main/AFK_ARCHITECTURE.md
- Herdr agent automation: https://herdr.dev/docs/agent-automation/
- Herdr integrations: https://herdr.dev/docs/integrations/
- Pi extensions: https://pi.dev/docs/latest/extensions
- Pi SDK: https://pi.dev/docs/latest/sdk
- LiteLLM: https://docs.litellm.ai/
- Agent Skills specification: https://agentskills.io/specification
- Git worktree: https://git-scm.com/docs/git-worktree
- Temporal Durable AI, future evaluation only: https://docs.temporal.io/ai

---

## 35. Final architectural decision

AgEnFK Autonomous Delivery is approved as an additive project-orchestration layer built on Durable Execution.

The canonical architecture is:

```text
Master Spec
  -> AgEnFK Project Contract and native board
  -> deterministic scheduler
  -> Durable Execution, leases, checkpoints, worktrees
  -> Herdr runtime
  -> Claude Code / Pi / Codex harness adapters
  -> LiteLLM/model routes where applicable
  -> deterministic verification and security gates
  -> integration queue
  -> tested release candidate
```

This preserves the central rule:

> Agents perform engineering work. AgEnFK owns the engineering state, policy, evidence, and authority to proceed.
