# Kickoff prompt — T03 (AD0-b: migration framework, foundation gate, `project doctor`, compat suites)

Operator pre-flight, before pasting the block below:

- Open a **new Herdr pane** in the `agenfk` workspace, `cd /home/pin/projects/agenfk-wt/t03`
  (the task's worktree — **not** the main clone).
- Start Claude Code there and accept the **trust dialog** if prompted.
- `/model` → **Opus 5** · `/effort` → **xhigh** · `/status` to confirm · `/clear`.
- Paste everything inside the fence.

```text
You are executing task T03 — AD0-b, of AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md
(repository root), which implements AGENFK_AUTONOMOUS_DELIVERY_MASTER_SPEC.md.

Work on T03 only. Do not start T04. Token envelope: 600k; split trigger 450k (plan §3).
Run this task on Opus 5 at effort xhigh (plan §3.5). Subagents: Sonnet 5 for review and
exploration; Haiku 4.5 only for mechanical greps.

STEP 0 — confirm the session
Run /status and confirm the model is Opus 5 and effort is xhigh. If not, stop and tell me.
Confirm `pwd` is /home/pin/projects/agenfk-wt/t03 and `git branch --show-current` is
feature/7f8f6821-33d4-492d-8574-dd6b83faff98_t03-migrations-foundation-gate.
Report whether HERDR_PANE_ID is set in your shell.

STEP 1 — read, in this order, nothing else
1. CLAUDE.md and AGENTS.md (repository rules; CLAUDE.md wins on conflict).
2. AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md — §1.1, §1.2, §1.3 (C1-C5), §3, and the
   **T03 card in §5** (line 411). Master spec §5, §5.1, §24.1, §26 AD0, §27, §28, §32.
3. docs/adr/0001-component-boundaries-and-package-layout.md (D4: router modules) and
   **docs/adr/0002-schema-migration-framework-node-sqlite.md — this is the binding contract
   for everything you build in this task**.
4. docs/plans/handoff-T02.md, section "What T03 must know".
5. packages/storage-sqlite/src/index.ts (763 lines — read it whole; it is the thing you change).
6. packages/server/src/routes/capabilities.ts (the router-module shape you must copy).
Use a subagent for anything wider. Do not read packages/server/src/server.ts whole (4,080 lines);
grep it.

STEP 2 — verified starting state (measured 2026-09-06; confirm, do not redo)
- Worktree /home/pin/projects/agenfk-wt/t03, fast-forwarded to main 74196dad, tree clean,
  `npm ci` already done, `.agenfk/project.json` present (project ef5f9e00-b80d-4f9a-9a82-846479156f2d).
- PRs #1-#4 are merged into main. T01 and T02 are DONE.
- The AgEnFK item for this task is 7f8f6821-33d4-492d-8574-dd6b83faff98 and is **already
  IN_PROGRESS**. Its parent story 7d83c768 is also IN_PROGRESS, so the gatekeeper is ambiguous:
  **always pass --item-id**, e.g.
  `agenfk gatekeeper edit --item-id 7f8f6821-33d4-492d-8574-dd6b83faff98`.
- The running daemon (port 3000, DB ~/.agenfk-system/.agenfk/db.sqlite) was patched on
  2026-09-06 by copying main's built dist over ~/.agenfk-system/packages/{core,storage-sqlite,
  telemetry,cli,server}/dist and restarting. It therefore HAS the PR #3/#4 fixes
  (project-root boundary, working gatekeeper branch check, auto-commit opt-in and off by default).
  Old dists are backed up at ~/.agenfk-system/.dist-backup-20260906-161729.
  **`agenfk --version` still prints 1.1.16 and the CLI nags that 1.1.17 is available.
  DO NOT run `agenfk upgrade`** — the published 1.1.17 release does not contain these commits
  and would silently undo the patch.
- Last recorded baseline on main: 226 test files, 2,522 passed, 1 skipped. The flow requires you
  to MEASURE it yourself on this branch point and report the actual numbers. Do not trust that line.

STEP 3 — the work (T03 card §5, "In scope")
a. Migration framework in packages/storage-sqlite/src/migrations/: `schema_version` table;
   `migrations/index.ts` as an ordered list of `{ id, description, up(db) }`; `runMigrations()`
   called from `init()` after `createTables()`; migration `0001_baseline` recording the 1.1.16
   schema; a `withTransaction(fn)` helper on SQLiteStorageProvider using **BEGIN IMMEDIATE** /
   COMMIT / ROLLBACK. A failed migration must leave the DB at the previous version.
   ADR-0002 fixes the two decisions most likely to be got wrong: BEGIN IMMEDIATE rather than a
   bare BEGIN, and **rejecting** nested transactions rather than emulating them with savepoints
   (node:sqlite has no savepoint helper).
b. Upgrade fixture packages/storage-sqlite/src/test/fixtures/db-1.1.16.sql (schema + sample rows)
   and a test that opens it, upgrades it, and re-reads items/flows/snapshots intact.
c. Foundation gate: packages/core/src/foundation-gate.ts (pure evaluator over CapabilityReport[]),
   packages/server/src/routes/foundation-gate.ts (GET /v1/foundation-gate → D1-D5 as
   present | partial | missing, each with an evidence string), and `assertFoundationGate()` for
   T17. CLI `agenfk project doctor [--project <id>]` prints the gate section.
   Replace `foundationGate: 'unknown'` in routes/capabilities.ts; bump CAPABILITIES_SCHEMA_VERSION
   only if the payload shape changes in a way a client would notice.
   `allFeaturesDisabled()` (packages/core/src/features.ts:117) is exported and unused in
   production code — it is meant for `assertFoundationGate()`. Use it or delete it.
d. CLI collision tests, packages/cli/src/test/cli-namespaces.test.ts. Current registrations,
   verified at this branch point: `pause <platform>` :1276, `resume <platform>` :1310,
   `pause-work <id>` :1637, `resume-work <id>` :1664, `skills` :2758. Assert their semantics are
   unchanged, that the namespaces `execution`, `project`, `scheduler`, `agent`, `runtime`,
   `verification`, `budget`, `release`, `skills registry` are reserved and do not collide with
   `skills install/uninstall/status`, and that no top-level `resume <item>` exists.
   Write this suite BEFORE anything claims those namespaces.
e. Backwards-compatibility suite packages/server/src/test/compat/: Standard and Deep mode API
   paths (create / move / gatekeeper / validate / pause-work / resume-work / flows / projects),
   run twice — feature flags off and on — asserting identical responses; the installer
   JSON→SQLite migration test still green; an MCP tool-list snapshot.

Out of scope: any D1-D5 entity (Execution, Checkpoint, Lease, WorktreeBinding, ResumePacket).

Acceptance (AD0): the gate endpoint reports 0/5 present with evidence; a writable run cannot
start (unit test on `assertFoundationGate`); the upgrade fixture passes; the collision and compat
suites pass; storage coverage stays ≥ 80%.

STEP 4 — rules that bind you
- New server routes go in packages/server/src/routes/<feature>.ts as `createXRouter(deps)` with
  dependencies injected — never an import from ../server, never appended to server.ts (ADR-0001 D4,
  which has a compliance grep).
- Never commit to main. Never --force, never --no-verify. Never mask a failing test with a
  threshold, a skip or a loosened assertion.
- Record out-of-scope defects you find as new AgEnFK items; do not fix them without approval.
- `npm run build` must pass and be reported.
- The flow's IN_PROGRESS exit criteria still instructs you to create .agenfk/project.json because
  "findProjectRoot walks up to $HOME (BUG 37660bd2)". That text is **stale** — PR #3 fixed it, and
  the file is present here anyway. Do not act on it; note it in the handoff as flow text to update.
- A schema change needs owner approval before it lands (T03 gate: "plan, schema change approval").
  Present the migration plan — table, columns, ordering, rollback — and wait.

STEP 5 — measurement and the split rule
`agenfk tokens --item` returns [] and always has: the token-ingestion worker's call site was
deleted in commit 886d50cb and token_events has never had a row (BUG 71593e56, open, belongs to
T29). So measure this task with **/cost at the end of the session** and record the number in
docs/plans/handoff-T03.md. If you pass 450k before the compat suite is green, stop and split:
ship the migration framework + foundation gate as T03 and the compat suite as a new item T03-b.

STEP 6 — close-out
Flow agenfk-delivery: TODO → IN_PROGRESS → REVIEW → TEST → MUTATE → DONE. MUTATE is the final
step, so `agenfk verify` there runs the project's verifyCommand with no command argument.
Advance with `agenfk verify 7f8f6821 --evidence "<what you did>"` at each step, and read the
step's exit criteria with the gatekeeper before trying to satisfy it. REVIEW requires an
INDEPENDENT reviewer — spawn a read-only reviewer subagent, or say plainly that you could not
and ask for a review in a fresh session. Never claim a review you did not have.
Then: update CHANGELOG.md, write docs/plans/handoff-T03.md (what T04 must know), append to
docs/plans/session-notes.md, and open the PR from the fork with `gh` — body listing spec sections
implemented, migrations added, tests added, compatibility risks, contradictions found, token usage.
```
