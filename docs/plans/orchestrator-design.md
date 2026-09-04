# Autonomous orchestrator — design carried over from sharkverify

**Status:** deferred to Phase B by owner decision, 2026-09-04. Recorded now so the
design survives and Phase B does not re-derive it.

## Owner decisions (2026-09-04)

| # | Decision | Consequence |
|---|---|---|
| 1 | **Do not build the orchestrator until Phase B (T04–T08) lands.** | Master spec §5's foundation gate stands: no autonomous writable worker starts while Durable Execution D1–D5 is 0/5. T03…T08 continue to run as supervised single sessions, the way T01 and T02 did. |
| 2 | **Target autonomy: auto-merge behind the mutation gate.** | When it is built, a task ends with `gh pr merge --auto --squash`, refused unless the PR body carries the verifier's per-mutation table, with CI still a required server-side check. The two-round fix limit and the escalate-to-owner path stay. |

## What sharkverify actually built

Entry point is bash, the loop is a Claude Code Workflow script, the workers are typed
subagents. Nothing is a daemon.

| File (sharkverify) | Purpose | AgEnFK equivalent owner |
|---|---|---|
| `scripts/orchestrator/sv-orchestrate` | Resolve tasks, run the gate, take a PID lock, launch the wave | T18 scheduler kernel |
| `scripts/orchestrator/preflight.sh` | Deterministic pre-spend gate: clean tree, trunk CI green, open-PR cap, lock free, task schema valid, **measures the test baseline itself** | T17 readiness / T18 |
| `.claude/workflows/sv-wave.js` | readiness → implement → verify → ≤2 fix rounds → SHIP / REJECT / ESCALATE_TO_OWNER; agents return JSON schemas, not prose | T18 + T22 |
| `.claude/agents/sv-{preflight,implementer,verifier,supervisor}.md` | Role definitions; the verifier is a different instance each round | T22 agent profiles |
| `guard-branch.sh` + `.githooks/pre-push` | Mechanical block on orchestrated branches touching infra, migrations, terraform, workflows | T31/T32 autonomy policy |
| `sv-queue` *(uncommitted)* | Kanban front-end: `agenfk list --json`, lowest `[NN]` title prefix, advance via `agenfk verify` | T18 candidate ordering |

## Adaptations this repository needs — these are not a copy

1. **Sequential, not a wave of 4.** Sharkverify caps a wave at 4 parallel tasks. Plan
   §4.9 makes T01→T33 a chain, with only optional parallelism. The orchestrator here
   pulls **one task at a time**; the concurrency cap is 1 until Durable Execution's
   leases (D3) make more than one writable worker safe.
2. **Order comes from the title, and the parser adapts — not the board.** `sv-queue`
   sorts on a `[NN]` title prefix. This board already carries `T01`…`T33` in the titles
   plus `Depends on:` in every description. `sortOrder` is null on all 33 tasks and
   `agenfk update` has no flag to set it, so the parser should read `^T(\d+)` rather
   than 33 items being renamed and every reference in `items.md` invalidated.
3. **The flow keeps `IN_PROGRESS`.** See `flow-agenfk-delivery.md`.
4. **Two hazards must close before an unattended agent runs here** — both found while
   executing T02, neither fixed: BUG `37660bd2` (`findProjectRoot` escapes to `$HOME`
   from a worktree and runs `verifyCommand` and `git add -A` there) and contradiction
   C5 (`autoGitCommit` runs `git add -A` inside the validate handler). With one
   supervised session these are survivable; with an unattended worker they are not.
5. **`bypassPermissions` is how sharkverify runs headless.** That is a defensible trade
   there. It should not be adopted here until 4 is closed.

## What "no human interference" actually means

Sharkverify's own orchestrator is not unsupervised. It escalates to the owner after two
failed fix rounds, and `sv-wave` never opens a PR at all — `sv-queue` adds the
auto-merge. The escalation path is not a gap in the automation; it is the reason the
automation is trustworthy. Decision 2 keeps it.
