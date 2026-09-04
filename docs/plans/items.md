# AgEnFK item registry — Autonomous Delivery

Created in **T01 — Bootstrap** on **2026-09-03** against the running AgEnFK server
(port 3001, single state authority — no direct SQLite writes were made).

- **Project** `agenfkplus` — `ef5f9e00-b80d-4f9a-9a82-846479156f2d`
  (`verifyCommand: npm run build && npm test`)
- **Flow** `Default Flow` — `TODO → IN_PROGRESS → REVIEW → TEST → DONE`
  (coding step `IN_PROGRESS`; the final step for `agenfk verify` is `TEST`)
- Tree shape: 1 EPIC → 7 STORY (one per phase) → 33 TASK (one per plan card `Tnn`)

Inspect with:

```bash
agenfk list --project ef5f9e00-b80d-4f9a-9a82-846479156f2d
agenfk get <item-id>
```

## Epic

| Title | Id |
|---|---|
| Autonomous Delivery (master spec v1.0) | `37f84768-01b4-46f1-9c59-7989d643abdd` |

## Stories (one per phase)

| Phase | Title | Id |
|---|---|---|
| A | Phase A — Bootstrap and AD0 | `7d83c768-7717-4f34-8cb8-c5f0a6a6ab64` |
| B | Phase B — Durable Execution foundation (D1–D5) | `8a9fed87-2803-466b-9ea1-aa085ba53d75` |
| C | Phase C — Contract, planning, readiness, scheduler (AD1–AD5) | `20930f08-84b7-411a-9e5f-b1abb90499ce` |
| D | Phase D — Runtime, harness adapters, agent profiles (AD6–AD7) | `0511206b-395e-4a8d-8ea8-f56c74c7f8f0` |
| E | Phase E — Skills governance, verification, integration, release candidate (AD8–AD10) | `5947677c-77f8-41f0-95ed-1e3390ef1871` |
| F | Phase F — FinOps, routing, security hardening (AD11–AD12) | `ce30f713-5229-4f9e-89d6-597bf1f9b3d3` |
| G | Phase G — Corporate Hub fleet scheduling (AD13, post-MVP) | `96f4b46f-e7c8-4a82-859b-a7a2f670b4ac` |

## Tasks

Each task's description carries its Delivery, Model, Effort, Envelope, Gate,
Depends-on and a pointer to `AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md`
§5, card `Tnn`.

| Task | Phase | Delivery | Model / Effort | Env | Gate | Title | Id |
|---|---|---|---|---|---|---|---|
| T01 | A | — | Sonnet 5 / medium | 120k | plan | Bootstrap: fork, dogfooding items, harness installs, hooks | `1b55c410-c21c-4ae0-a3da-887ea17073df` |
| T02 | A | AD0-a | Opus 5 / xhigh | 400k | plan, ADR | Inventory doc, ADR-0001/0002/0003, contradictions log, feature-flag & config skeleton, `/capabilities` | `3d4988dc-f52f-4623-8a55-d27b18de7e47` |
| T03 | A | AD0-b | Opus 5 / xhigh | 600k | plan, schema | Migration framework, foundation-gate service, `agenfk project doctor`, CLI collision tests, backwards-compat suite | `7f8f6821-33d4-492d-8574-dd6b83faff98` |
| T04 | B | DE0 | Fable 5.1 / high | 300k | ADR/spec approval | Author `AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md` (D1–D5 contracts, acceptance suites) | `d5a2c59a-8026-4407-bd7b-97d41d88b36a` |
| T05 | B | D1 | Sonnet 5 / xhigh | 500k | plan, schema | `Execution` entity, repository, API, events, `agenfk execution history` | `39e7484f-d2e5-402f-81c0-ef87b79067ce` |
| T06 | B | D2 | Sonnet 5 / xhigh | 550k | plan, schema | Typed `Checkpoint`, automatic checkpoints at workflow boundaries, `PauseSnapshot` compatibility | `6b9ce7ae-d176-4d24-b7ab-d2f43caa842f` |
| T07 | B | D3+D4 | Fable 5.1 / max | 650k | plan, schema | `Lease` (expiry/heartbeat), `WorktreeBinding`, drift detection without destructive cleanup | `050f4c14-1167-4328-945f-98cf039cfb1a` |
| T08 | B | D5 | Opus 5 / xhigh | 550k | plan | `ResumePacket`, `agenfk execution resume`, `pause-work`/`resume-work` mapped through DE, D1–D5 acceptance suites | `ce407976-3ed4-4645-8e78-ebed0e839c82` |
| T09 | C | AD1-a | Sonnet 5 / high | 500k | plan, schema | Project Contract schema (Zod), tables, source artifact hashing, extraction interface + mocked extractor, idempotent ingest | `282217ec-1b9b-45dc-a872-d67d149f8a9e` |
| T10 | C | AD1-b | Sonnet 5 / high | 450k | plan | `/v1/project-contracts`, `agenfk project ingest` / `contract show`, UI contract read view, events | `50eebe08-bea1-44fa-9e8a-73e9ea2f3220` |
| T11 | C | AD2-a | Opus 5 / xhigh | 550k | plan, schema | Clarification questions, assumptions, contract state machine, immutable versions + diff, `Approval` entity, CLI | `c2a5c854-18b1-4fa5-8529-d12890d2f0c4` |
| T12 | C | AD2-b | Sonnet 5 / high | 450k | plan | UI approval surface, harness-driven extraction/clarification slash commands, `spec-analyst` prompt | `a02db2e0-8e5e-41de-95e0-dc921ad4256d` |
| T13 | C | AD3-a | Opus 5 / xhigh | 600k | plan, schema | Plan entity/versioning, dependency edges, requirement refs, deterministic validator, `plan validate` | `9ca31e88-f8df-4bc6-90f7-2d909d55a14e` |
| T14 | C | AD3-b | Sonnet 5 / xhigh | 550k | plan | Plan proposal service (harness-driven), plan approval, impact/stale markers, UI plan review | `3adf1283-f2ca-4531-9b0b-28d6aca61036` |
| T15 | C | AD4-a | Opus 5 / xhigh | 500k | plan | Readiness engine (12 predicates, reasons, incremental), `/v1/readiness`, `scheduler explain` / `tick --dry-run` | `d50078cb-3547-44ca-9478-b8471c1b70fd` |
| T16 | C | AD4-b | Sonnet 5 / high | 550k | plan | Autonomous Delivery dashboard shell, card orchestration panel, dependency visualization, feature-off tests | `5a43ce23-b145-4110-b2e0-b4505c2aedd8` |
| T17 | C | AD5-a | Sonnet 5 / xhigh | 500k | plan, schema | `OrchestrationRun` entity/state machine, lifecycle API/CLI (`run/status/pause/resume/cancel/doctor`), basic caps | `4c48c4c9-1667-47ca-a0da-30745d553a7d` |
| T18 | C | AD5-b | Fable 5.1 / max | 650k | plan, schema | Scheduler transaction, ordering, WIP/fairness, dispatch outbox, dry-run worker adapter, restart/recovery tests | `0250eec5-f2c9-4c5d-963a-d2cf4af60e0d` |
| T19 | D | AD6-a | Opus 5 / xhigh | 550k | plan, schema | `RuntimeAdapter`/`HarnessAdapter` interfaces, Execution Packet, execution-scoped callback auth, heartbeat states, local-process test runtime | `579b9972-ecbe-488b-999b-cd2979a5400f` |
| T20 | D | AD6-b | Opus 5 / xhigh | 600k | plan | Herdr `RuntimeAdapter` (`packages/runner-herdr`), Claude Code `HarnessAdapter`, first real worker launch in a worktree | `658a0a36-f236-4203-8a5e-122b19bf7ae8` |
| T21 | D | AD6-c | Opus 5 / xhigh | 600k | plan | Pi `HarnessAdapter`, loss detection and recovery paths, portable checkpoint fallback, static Claude→Pi handoff, A0–A2 side-effect enforcement, Codex fixtures | `80c92c98-514e-4cb5-9d36-724d054fa406` |
| T22 | D | AD7 | Sonnet 5 / high | 500k | plan, schema | Agent Profile registry + catalog, capability/side-effect requirements, role-to-flow, separation of duties, profile version in evidence | `c7297741-bc10-4246-a9c2-e56dd0876b44` |
| T23 | E | AD8-a | Opus 5 / xhigh | 550k | plan, schema | Skill package entities, immutable source/hash capture, inspect/admit/quarantine, static checks + golden-eval interfaces | `6be44ee2-961f-4e88-ab4b-db8a0a6c332b` |
| T24 | E | AD8-b | Sonnet 5 / xhigh | 450k | plan | Project skill lock, `verify-lock`, worker skill snapshot, revocation behavior, permission-profile enforcement | `d18f093b-bc91-4c72-97fe-d12d72c08dd2` |
| T25 | E | AD9-a | Opus 5 / xhigh | 600k | plan, schema | Verification Profile/Run entities, layered gates, deterministic runner, affected/full selection, integration with `validate_progress` | `c905bc5a-edb6-4753-af70-411eb6657157` |
| T26 | E | AD9-b | Sonnet 5 / xhigh | 500k | plan | Bounded repair policy, flaky/error/timeout distinction, UI evidence surface, gate adapter interfaces, chaos tests | `db53472e-256e-46c8-8c7d-6ab798580018` |
| T27 | E | AD10-a | Opus 5 / xhigh | 600k | plan, schema | Integration queue/state, isolated integration worktree, dependency-aware order, conflict items, idempotency keys | `1229c68d-eb33-49cf-a51e-8ec1f487e09c` |
| T28 | E | AD10-b | Sonnet 5 / xhigh | 550k | plan, schema | Release Candidate entity, requirement coverage evaluator, release gates on RC tree, artifact slots, acceptance API/CLI/UI | `c0277f06-6e7a-432b-a4c0-37221f719625` |
| T29 | F | AD11-a | Sonnet 5 / xhigh | 500k | plan, schema | Hierarchical budgets, reservations, policy thresholds, cost ledger, `agenfk budget`, token-event attribution | `f27ed628-e4cd-4398-a95f-e54321ea6007` |
| T30 | F | AD11-b | Opus 5 / xhigh | 500k | plan | LiteLLM route correlation, Capability Contract + pre-launch compatibility, fallback/escalation, stagnation detection, unknown-pricing policy | `2bd39f58-4699-4955-8861-f275d113bcf4` |
| T31 | F | AD12-a | Fable 5.1 / max | 550k | plan, schema | Side-effect registry/enforcement, A0–A4 policy engine, approval expiry/revocation, network/filesystem/tool policies, scoped credential hooks | `bc51f50c-3b57-4746-af61-dd985c499aeb` |
| T32 | F | AD12-b | Opus 5 / xhigh | 450k | plan | Adversarial suites (prompt injection, secret redaction, callback replay, path traversal, command injection), security dashboard, incident events | `44f0d137-df15-4c0a-882e-db52270e33f3` |
| T33 | G | AD13-0 | Opus 5 / max | 250k | ADR | Distributed-execution ADR + threat model (documents only; implementation tasks defined after approval) | `8586744b-4434-4d1f-9bb4-495a66dce2d0` |

## Branch registry

Plan §2.3 wants one branch (and, from T02, one worktree) per task, named
`feature/<task-item-id>_t<nn>-<slug>`.

| Task | Branch | Registered in AgEnFK |
|---|---|---|
| T01 | `feature/1b55c410-c21c-4ae0-a3da-887ea17073df_t01-bootstrap` | no — see finding below |
| T02 | `feature/3d4988dc-f52f-4623-8a55-d27b18de7e47_t02-ad0-a` (worktree `../agenfk-wt/t02`) | no — same reason |
| BUG `37660bd2` + BUG `2df0f02f` | `fix/37660bd2-a249-4e0e-977c-ace47df65fc3_project-root-boundary` (worktree `../agenfk-wt/hazards`) | no — same reason |

**Finding — task branches cannot be registered on task items.** `agenfk branch create
<task-id>` fails with *"Branches are tracked on top-level items only. Item
[1b55c410] is a child of [7d83c768]."* This matches `SDLC.md` §2 ("Branches are only
tracked on top-level items (no `parentId`); child tasks inherit the parent's
branch"), but it is incompatible with this plan's one-branch-per-task convention: the
only top-level item here is the epic, and 33 tasks cannot share one `branchName`.

Consequences and options, for T02 (ADR) and T07 (`WorktreeBinding`, D4):

- Today the branch is created with plain `git checkout -b` and recorded here plus as
  an `agenfk comment` on the task item. The gatekeeper's branch auto-checkout does
  not apply to task items.
- Option A: relax the top-level constraint so leaf items may carry a `branchName`.
- Option B: let `WorktreeBinding` (D4) own the branch↔item link and leave
  `branchName` alone — this is the direction the master spec already points in, and
  is the recommended one.

Either way it is a **public behaviour change to AgEnFK** and needs an owner decision;
it is recorded here rather than worked around silently.

## Defects found while executing the plan

Filed under the same project but outside the T01–T33 chain (SDLC "Fix-Must-Be-Bug"
rule: a defect is a BUG, never a TASK).

| Type | Title | Id | Found in |
|---|---|---|---|
| BUG | Flaky: hub `admin-installations` `beforeEach` times out at 30s under load; `database is not open` leaks from `afterEach` | `ed5535ae-4bfd-4a78-b083-ae110545b98a` | T01 baseline verification |
| BUG | `findProjectRoot` escapes to `$HOME` when verify runs from a git worktree, running `verifyCommand` and `git add -A` outside the repo | `37660bd2-a249-4e0e-977c-ace47df65fc3` | T02 (first task to use a worktree) |
| BUG | `autoGitCommit` runs `git add -A` inside the validate handler, sweeping unrelated files into a commit (C5) | `2df0f02f-7533-4733-b935-3a73f749fa22` | T02 / contradiction C5 |
| TASK | Raise branch coverage to the 80% gate (currently 79.x%) | `47b3727a-451e-4774-bd9b-7e87f4e9a88c` | T02 coverage measurement |

`packages/hub` is outside this plan's touch list and T01 may not modify `packages/`, so
the defect is filed, not fixed. See `handoff-T01.md` for the full diagnosis.

The two worktree hazards — `37660bd2` and `2df0f02f` — were **fixed ahead of T03** rather
than deferred, on the owner's decision of 2026-09-04. They are the reason an unattended
worker could not run here: one sends `verifyCommand` and `git add -A` to the user's home
directory, the other stages the whole tree from inside the validate handler. `ed5535ae`
(`packages/hub`) remains filed and unfixed — it is outside this plan's touch list.

## Status log

| Date | Task | Event |
|---|---|---|
| 2026-09-03 | T01 | created, moved to `IN_PROGRESS`, gatekeeper `AUTHORIZED (CODING)` |
| 2026-09-03 | T02–T33 | created in `TODO` |
| 2026-09-03 | BUG `ed5535ae` | filed (hub test flake found during T01 verification) |
| 2026-09-03 | T01 | `IN_PROGRESS → REVIEW → TEST → DONE`; server-side validation run `b7c8acad` re-ran `npm run build && npm test` and passed (219 files, 2,368 passed, 1 skipped) |
| 2026-09-03 | T01 | PR [eduardopin/agenfk#1](https://github.com/eduardopin/agenfk/pull/1) opened from the fork and registered (`agenfk pr-register`, sizing `{task: 1}`) |
| 2026-09-03 | T02 | `IN_PROGRESS → … → DONE` in worktree `../agenfk-wt/t02`; ADRs 0001–0003 approved by the owner before any code was written |
| 2026-09-03 | BUG `37660bd2`, TASK `47b3727a` | filed during T02 |
| 2026-09-04 | BUG `2df0f02f` | filed — contradiction C5 given its own item so the hazard is tracked on the board, not only in the contradictions log |
| 2026-09-04 | — | Owner decision: the orchestrator stays deferred to Phase B (`docs/plans/orchestrator-design.md`); T03–T08 continue as supervised single sessions |
| 2026-09-04 | T02 | PR [eduardopin/agenfk#2](https://github.com/eduardopin/agenfk/pull/2) opened, registered and squash-merged; `main` is now `3cc00bf3` |
| 2026-09-04 | BUG `37660bd2` + BUG `2df0f02f` | Owner decision: fix both **before** T03, as the first unit of work. Branch `fix/37660bd2-…_project-root-boundary` |
