# T03 — execution guide (AD0-b)

**How to start a session.** Open a new Claude Code session in this worktree
(`/home/pin/projects/agenfk-wt/t03`), set `/model` Opus 5 and `/effort` xhigh, `/clear`, and say:

> Leia `docs/plans/T03-execution.md` por inteiro e execute a próxima UNIDADE ainda não concluída
> no ledger. Só essa unidade.

Everything the session needs is in this file. It replaces the old single-shot kickoff prompt.

---

## 0. Ledger — the only place that says what is done

Update this table in the LAST commit of every session. It is the handoff.

| Unidade | Escopo | Orçamento | Status | /cost real | Commit |
|---|---|---|---|---|---|
| U1 | CLI namespace collision suite | 60k | TODO | — | — |
| U2 | Migration framework + upgrade fixture | 170k | TODO | — | — |
| U3 | Foundation gate + `project doctor` | 140k | TODO | — | — |
| U4 | Backwards-compatibility suite + close-out | 130k | TODO | — | — |

Ceiling for the whole task: **500k tokens**, set by the owner on 2026-09-08. This overrides the
600k/450k envelope in plan §3; if they disagree, this file wins and the handoff must say so.

**Per-unit stop rule.** If a unit passes its budget by more than 25% (U1 75k, U2 212k, U3 175k,
U4 162k), stop where you are, commit what is green, write what is left in the ledger row, and end
the session. Do not borrow from the next unit's budget. Overrunning is an expected outcome, not a
failure.

---

## 1. Session preamble — do this once, every session

**Confirm the session.** `/status` must show Opus 5 and effort xhigh; stop and report if not.
`pwd` = `/home/pin/projects/agenfk-wt/t03`; `git branch --show-current` =
`feature/7f8f6821-33d4-492d-8574-dd6b83faff98_t03-migrations-foundation-gate`. Report whether
`HERDR_PANE_ID` is set.

**Read, in this order, and nothing else:**
1. `CLAUDE.md` and `AGENTS.md` (repository rules; CLAUDE.md wins on conflict).
2. The unit's own "Read first" list in §3 below.

Read the plan and spec sections named by your unit — not the whole documents. Delegate anything
wider to a subagent. Never read `packages/server/src/server.ts` whole (4,080 lines); grep it.

**Verified starting state** (measured 2026-09-06/08 — confirm cheaply, do not re-derive):
- Worktree branched from main `74196dad`, `npm ci` already done, `.agenfk/project.json` present
  (project `ef5f9e00-b80d-4f9a-9a82-846479156f2d`).
- The branch carries preparation commits only (docs). It is published on the **`fork`** remote.
  `origin` is `cglab-public/agenfk` and returns 403 for this account: **push to `fork`**, and open
  the PR from the fork.
- PRs #1–#4 are merged into main. T01 and T02 are DONE.
- Item `7f8f6821-33d4-492d-8574-dd6b83faff98` is **already IN_PROGRESS** and stays IN_PROGRESS
  until U4. Its parent story `7d83c768` is IN_PROGRESS too, so the gatekeeper is ambiguous:
  **always pass `--item-id`** —
  `agenfk gatekeeper edit --item-id 7f8f6821-33d4-492d-8574-dd6b83faff98`.
- The daemon on port 3000 runs dists hand-patched from main on 2026-09-06, so it HAS the PR #3/#4
  fixes. `agenfk --version` still prints 1.1.16 and the CLI nags about a newer release.
  **DO NOT run `agenfk upgrade`** — the published release lacks these commits and would undo the
  patch. Backup of the old dists: `~/.agenfk-system/.dist-backup-20260906-161729`.
- Last recorded baseline on main: 226 test files, 2,522 passed, 1 skipped. **Measure it yourself**
  on the first unit and record the real numbers; do not trust that line.

**Cost discipline.** `agenfk tokens --item` returns `[]` and always has (the ingestion worker's
call site was deleted in `886d50cb`; `token_events` has never had a row — BUG `71593e56`, open,
belongs to T29). `/cost` is the only measurement. Check it after the reading step and again before
committing, and report both numbers. Delegate wide searches to subagents; use `sed -n`/`grep -n`
instead of `cat`; pipe build and test output through `tail -50`.

**Rules that bind every unit:**
- New server routes live in `packages/server/src/routes/<feature>.ts` as `createXRouter(deps)` with
  dependencies injected — never an import from `../server`, never appended to `server.ts`
  (ADR-0001 D4, which has a compliance grep).
- Never commit to `main`. Never `--force`, never `--no-verify`. Never mask a failing test with a
  threshold, a skip or a loosened assertion.
- Record out-of-scope defects as new AgEnFK items; do not fix them without approval.
- `npm run build` must pass and be reported before you commit.
- A schema change needs owner approval before it lands. Present the plan — table, columns,
  ordering, rollback — and wait.
- `.agenfk/project.json` is required in the worktree and is already there. `agenfk verify`
  REPOINTS `project.projectRoot` to the root it resolves (`server.ts:2955-2985`); it is one mutable
  slot shared by every worktree of this project. Nothing here may rely on its value. Known defect,
  already recorded — do not fix it in T03.

**End of every session:** `npm run build` green, full suite run and counts reported, commit with a
message naming the unit, `git push fork HEAD`, ledger row updated with status and the `/cost`
figure. No PR before U4.

---

## 2. Why this order

U1 reserves the CLI namespaces **before** U3 claims `project doctor` — writing the collision suite
after the command exists would let the suite be written around whatever was built. U2 is
independent of both. U4 asserts that nothing in U1–U3 changed existing API behaviour, so it goes
last.

---

## 3. The units

### U1 — CLI namespace collision suite · 60k

**Read first:** the T03 card in `AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md` §5 (line 411);
master spec §27. `packages/cli/src/index.ts` — only the registration sites, via grep.

**Build:** `packages/cli/src/test/cli-namespaces.test.ts`. Current registrations, verified at this
branch point: `pause <platform>` :1276, `resume <platform>` :1310, `pause-work <id>` :1637,
`resume-work <id>` :1664, `skills` :2758.

Assert: those five keep their current semantics; the namespaces `execution`, `project`,
`scheduler`, `agent`, `runtime`, `verification`, `budget`, `release`, `skills registry` are
reserved and collide with nothing; `skills install/uninstall/status` stay distinct from a future
`skills registry`; **no top-level `resume <item>` exists**.

**Done when:** the suite is green, `npm run build` passes, and the suite fails if you locally add a
colliding command (prove it once, then revert the probe).

**Not in this unit:** any production CLI change. This unit adds tests only.

---

### U2 — Migration framework + upgrade fixture · 170k

**Read first:** `docs/adr/0002-schema-migration-framework-node-sqlite.md` — **the binding contract
for this unit**; master spec §5, §5.1; `packages/storage-sqlite/src/index.ts` (763 lines — read it
whole, it is the thing you change).

**Build, in `packages/storage-sqlite/src/`:**
- `migrations/index.ts` — an ordered list of `{ id, description, up(db) }`.
- a `schema_version` table, and `runMigrations()` called from `init()` **after** `createTables()`.
- migration `0001_baseline`, recording the 1.1.16 schema.
- `withTransaction(fn)` on `SQLiteStorageProvider` using **BEGIN IMMEDIATE** / COMMIT / ROLLBACK.
- a failed migration must leave the DB at the previous version — test it.
- fixture `src/test/fixtures/db-1.1.16.sql` (schema + sample rows) and a test that opens it,
  upgrades it, and re-reads items, flows and snapshots intact.

ADR-0002 fixes the two decisions most likely to be got wrong: **BEGIN IMMEDIATE**, not a bare
BEGIN; and **reject** nested transactions rather than emulate them with savepoints — `node:sqlite`
has no savepoint helper.

**Gate:** this unit changes the schema. Present the migration plan and wait for owner approval
before landing it.

**Done when:** the fixture upgrades and reads back intact; a deliberately failing migration rolls
back to the previous version; `storage-sqlite` coverage stays ≥ 80%; build green.

---

### U3 — Foundation gate + `project doctor` · 140k

**Read first:** master spec §26 (AD0), §24.1; `docs/adr/0001-component-boundaries-and-package-layout.md`
(D4, router modules); `packages/server/src/routes/capabilities.ts` — the router-module shape you
must copy; `packages/core/src/features.ts` around line 117.

**Build:**
- `packages/core/src/foundation-gate.ts` — a pure evaluator over `CapabilityReport[]`.
- `packages/server/src/routes/foundation-gate.ts` — `GET /v1/foundation-gate`, returning D1–D5 as
  `present | partial | missing`, each with an evidence string.
- `assertFoundationGate()` (consumed by T17): a writable run must not be able to start while the
  gate is unmet. Unit-test that.
- CLI `agenfk project doctor [--project <id>]` printing the gate section. The namespace was
  reserved in U1 — keep that suite green.
- Replace `foundationGate: 'unknown'` in `routes/capabilities.ts`. Bump
  `CAPABILITIES_SCHEMA_VERSION` only if the payload shape changes in a way a client would notice.
- `allFeaturesDisabled()` (`packages/core/src/features.ts:117`) is exported and unused in
  production; it is meant for `assertFoundationGate()`. Use it or delete it — say which and why.

**Done when:** the endpoint reports **0/5 present**, each with evidence; `assertFoundationGate()`
blocks a writable run in a unit test; build green.

**Out of scope for the whole task:** any D1–D5 entity itself (Execution, Checkpoint, Lease,
WorktreeBinding, ResumePacket). This unit reports on their absence; it does not build them.

---

### U4 — Backwards-compatibility suite + close-out · 130k

**Read first:** master spec §28, §32; `packages/server/src/test/` for the existing harness shape.

**Build `packages/server/src/test/compat/`:** Standard and Deep mode API paths — create, move,
gatekeeper, validate, pause-work, resume-work, flows, projects — run **twice**, feature flags off
and on, asserting identical responses. Keep the installer JSON→SQLite migration test green. Add an
MCP tool-list snapshot.

**Acceptance for T03 as a whole**, verify all of it here: gate endpoint 0/5 present with evidence;
a writable run cannot start; the upgrade fixture passes; the collision and compat suites pass;
storage coverage ≥ 80%.

**Close-out.** Flow `agenfk-delivery`: TODO → IN_PROGRESS → REVIEW → TEST → MUTATE → DONE. MUTATE
is the final step, so `agenfk verify` there runs the project's `verifyCommand` with no command
argument. Advance with `agenfk verify 7f8f6821 --evidence "<what you did>"` at each step, and read
the step's exit criteria with the gatekeeper before trying to satisfy it. REVIEW requires an
**independent** reviewer — spawn a read-only reviewer subagent, or say plainly that you could not
and ask for a review in a fresh session. Never claim a review you did not have.

Then: update `CHANGELOG.md`; write `docs/plans/handoff-T03.md` (what T04 must know); append to
`docs/plans/session-notes.md`; open the PR **from the fork** with `gh`, the body listing spec
sections implemented, migrations added, tests added, compatibility risks, contradictions found, and
the total `/cost` against the 500k ceiling.
