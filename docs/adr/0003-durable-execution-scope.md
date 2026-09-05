# ADR-0003 — Durable Execution scope: AgEnFK owns the execution lifecycle

- **Status:** Proposed
- **Date:** 2026-09-03
- **Deciders:** repository owner
- **Delivery:** AD0 — Foundation audit and compatibility contract
- **Task:** T02 (scope); **implemented in T04–T08**
- **Spec sections:** §2.6, §5, §5.1, §28

## Context

Spec §5 makes Durable Execution a hard gate: autonomous scheduling MUST NOT launch
writable workers until D1–D5 exist and pass their acceptance suites. The audit
found all five missing, with partial analogues already in the codebase:

| Capability | Status | Closest existing analogue |
|---|---|---|
| D1 first-class `Execution` attached to an Item | missing | `AgentRun` (`packages/core/src/types.ts:72-86`) — a transcript record with `status`/`verdict` but no lifecycle, ownership or lease |
| D2 typed `Checkpoint` (git, progress, decision, verification, resume state) | missing | `PauseSnapshot` (`packages/core/src/types.ts:275-287`) — free-text `summary`/`resumeInstructions`, one row per item, consumed on resume |
| D3 one write lease per Item | missing | `activeValidateRunByItem` — an **in-memory** `Map` in `server.ts`, scoped to one endpoint and lost on restart |
| D4 worktree binding + non-destructive drift detection | missing | `branchName?: string` on `BaseItem` (`packages/core/src/types.ts:202`), usable on any item since C11 was resolved; still a name, not a binding to a working directory |
| D5 portable resume packet + `agenfk execution resume` | missing | `resume-work <id>` (`packages/cli/src/index.ts:1634`) — pops the snapshot and restores status |

Spec §5 also names `AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md` as "the detailed
source of truth". **That document does not exist** — not in the repository and not
on this machine (C19, and plan §1.2). Meanwhile
`AGENFK_COMPARISON.md` still states that AgEnFK "does not address session
lifecycle" (C10), which is exactly the scope this ADR changes.

There is also a live naming hazard. Three pause/resume vocabularies will coexist:
`agenfk pause|resume <platform>` (integration toggles,
`packages/cli/src/index.ts:1276`/`:1310`), `pause-work|resume-work <id>` (item
snapshots, `:1607`/`:1634`), and the new `execution`/`project` namespaces. Spec
§5.1 and §28 both require the first two to keep working unchanged.

## Decision

| # | Decision | Rationale |
|---|---|---|
| D1 | AgEnFK **takes ownership of the agent execution lifecycle**. This is a deliberate expansion of the product's scope, superseding the "does not address session lifecycle" statement in `AGENFK_COMPARISON.md`. | Without an owner for lifecycle, scheduling, leases and resume have nowhere to live; spec §4 already assigns "executions, checkpoints, leases" to AgEnFK and forbids them in the harness or runtime. |
| D2 | `AgentRun` and `PauseSnapshot` are **extended, not duplicated**. `Execution` is introduced as the lifecycle owner and `AgentRun` becomes the transcript *of* an execution; `Checkpoint` generalises `PauseSnapshot`, which remains readable and continues to back `pause-work`/`resume-work`. | Spec §0 rule 7: prefer extending existing abstractions over parallel systems with overlapping state. Two competing "what was this agent doing" records would desynchronise. |
| D3 | The write lease (D3) is **persisted**, never an in-memory map, and carries expiry plus heartbeat semantics. | Spec §24.1: "scheduler restart reconstructs state from persisted records; no required in-memory-only queue state." The current `activeValidateRunByItem` loses every lease on restart. |
| D4 | Worktree drift is **detected and reported, never repaired destructively**. No automatic reset, clean, stash, checkout-over, or rebase of a dirty or divergent tree. | Spec §0 rule 9 and the owner's global rules. Herdr's `WorktreeInfo.is_prunable` is a detection signal, not a licence to prune (T01 finding 4). |
| D5 | The **portable** resume packet is the primary path; native harness session references (`--session-id`, `--resume`) are an optimisation that must never be required. | Spec §5: "Session references are an optional native-resume optimization and do not block the portable path." Also T01 finding 7: `pi --resume` is an interactive picker and is not unattended-safe. |
| D6 | New surfaces use the explicit namespaces `agenfk execution …` and `agenfk project …`. `agenfk pause <platform>` and `agenfk resume <platform>` keep their current meaning, and no ambiguous top-level `agenfk resume <item>` or `agenfk pause <project>` alias is ever added. | Spec §5.1 and §28. Collision tests land in T03 before any of these namespaces exist, so the constraint is enforced from the outside in. |
| D7 | `AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md` is **authored in T04** and is authoritative for D1–D5 thereafter. Until it exists, this ADR plus spec §5 are the contract, and no D1–D5 code is written. | The master spec declares a document authoritative that does not exist; writing the entities first would make the companion spec a post-hoc description of whatever got built. |
| D8 | The foundation gate is machine-checkable (`GET /v1/foundation-gate`, T03) and reports each capability as `present | partial | missing` with evidence. A writable autonomous run refuses to start while it fails. | Spec §5 and AD0's acceptance criterion. A gate that only a human can evaluate is not a gate. |

## Alternatives considered

| Option | Why not |
|---|---|
| Introduce `Execution` as a new entity parallel to `AgentRun` | Two overlapping records of the same activity, each with its own status, drifting on every failure path. Explicitly forbidden by spec §0 rule 7. |
| Keep leases in memory and rebuild them on restart from item status | Item status cannot distinguish "an agent holds the write lease" from "an agent crashed holding it". Restart would either strand items or hand two workers the same tree. |
| Let the harness own resume (Claude Code `--resume`, `pi --session-id`) | Spec §4 forbids it — the harness must not own durable project authority — and it does not survive changing harness or machine. T01 finding 7 shows the interactive picker is not automatable anyway. |
| Rename `pause-work`/`resume-work` into the new `execution` namespace | Breaks spec §28's compatibility list and every existing skill and rule bundle that references them. |
| Write D1–D5 now and document the companion spec afterwards | Produces a specification that ratifies whatever was built, which is the opposite of a foundation gate. |

## Consequences

**Positive.** One owner for lifecycle means resume, leases and worktree binding
share a single state model instead of three. The gate is enforceable in code, so
"the foundation is not ready" is a test result rather than a judgement call.

**Negative / accepted cost.** This is a genuine scope expansion for AgEnFK, and it
invalidates a public claim in `AGENFK_COMPARISON.md` that must be corrected. It also
means the product now carries three pause/resume vocabularies, which is a
documentation burden every client rule bundle inherits. T04 must be written before
any Phase B code, which serialises the plan's critical path.

**Follow-up.** T04 authors the companion spec. T05–T08 implement D1–D5. T03 lands the
collision tests (D6) and the gate endpoint (D8) before any of it. `AGENFK_COMPARISON.md`
is corrected when the scope actually ships (Phase B), not in T02 — until then the
statement is true of the released product.

## Compliance

- The gate endpoint reports 0/5 present with evidence today, and a writable run cannot start (T03 test on `assertFoundationGate`).
- `agenfk pause <platform>` / `resume <platform>` behaviour is asserted unchanged, and no top-level `resume <item>` exists (T03 `cli-namespaces.test.ts`).
- No D1–D5 entity is added to `packages/core/src/types.ts` before `AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md` is committed (review question for T04–T08).
- `grep -rn "git reset --hard\|git clean\|git stash\|git checkout -f" packages/` finds nothing outside tests (D4).
