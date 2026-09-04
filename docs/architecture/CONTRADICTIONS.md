# Contradictions between the repository and the Autonomous Delivery specification

Recorded under spec §0: *"If the current code contradicts an assumption in this
specification, record the contradiction in an ADR or implementation note and ask for
a decision before changing a public contract."*

**Scope.** C1–C10 are the audit findings of implementation plan §1.3. C11–C13 were
found while executing T01 and are carried over from `docs/plans/handoff-T01.md`.
C14–C19 were found while executing T02.

**Status values.** `resolved` — decided and recorded in an ADR or fixed in this task ·
`deferred` — decided, implementation owned by a later task · `open` — needs an owner
decision before the owning task can proceed.

## Summary

| # | Source | Contradiction | Status | Owner |
|---|---|---|---|---|
| C1 | plan §1.3 | Docs say `better-sqlite3`; code uses `node:sqlite` | resolved | T02 |
| C2 | plan §1.3 | Spec requires transactional migrations; repo has no migration framework | deferred | T03 (ADR-0002) |
| C3 | plan §1.3 | Three pause/resume vocabularies will coexist | deferred | T03, T08 (ADR-0003 D6) |
| C4 | plan §1.3 | Spec suggests new packages; repo convention is a `server.ts` monolith | resolved | T02 (ADR-0001) |
| C5 | plan §1.3 | `autoGitCommit` runs `git add -A` inside the validate handler | deferred | T07, T25 |
| C6 | plan §1.3 | Spec requires a privacy pipeline; hub outbox has no redaction layer | deferred | T05, T32 |
| C7 | plan §1.3 | Spec requires per-execution identity; repo has one shared `verify-token` | deferred | T19 |
| C8 | plan §1.3 | Two commit conventions; `CHANGELOG.md` is stale | resolved | T02 |
| C9 | plan §1.3 | Spec wants design/visual evidence; repo has no browser e2e | deferred | T26 |
| C10 | plan §1.3 | `AGENFK_COMPARISON.md` says AgEnFK "does not address session lifecycle" | deferred | Phase B (ADR-0003) |
| C11 | T01 #1 | Branches cannot be registered on leaf items | decided, deferred | T07 |
| C12 | T01 #2 | No CLI path binds a project to a filesystem directory | deferred | T03 |
| C13 | T01 #3 | `agenfk tokens --item` returns `[]`; plan §3's measurement model depends on it | decided, diagnosis pulled forward | T03 diagnosis, T29 fix |
| C14 | T02 | Card says `GET /capabilities`; spec §23.1 and T03 use `/v1/…`; repo uses bare paths | resolved | T02 (ADR-0001 D6) |
| C15 | T02 | `core` is dependency-free and environment-agnostic; the flag module must read config | resolved | T02 (ADR-0001 D2/D5) |
| C16 | T02 | No `express.Router()`, no error/404 middleware, `app` is a singleton, `getCurrentVersion` unexported | resolved | T02 (ADR-0001 D3/D4) |
| C17 | T02 | Plan §6.1 puts docs in `docs/autonomous-delivery/`; the T02 card says `docs/architecture/` + `docs/adr/` | resolved | T02 |
| C18 | T02 | `packages/cli/src/test/cli.test.ts` is run by nothing | resolved | T02 |
| C19 | T02 | Spec §5 names a companion spec as authoritative that does not exist | deferred | T04 (ADR-0003 D7) |
| C20 | T02 | The 80% coverage gate does not pass at baseline — branches are at 74.63% | decided | TASK `47b3727a` |

---

## Detail

### C1 — Storage engine: `better-sqlite3` vs `node:sqlite`

Three documents state the storage engine is `better-sqlite3`:
`CLAUDE.md:79`, `AGENTS.md:64`, `AFK_ARCHITECTURE.md:12` and `:79`. The code uses
Node's built-in `node:sqlite` `DatabaseSync` (`packages/storage-sqlite/src/index.ts:25`),
which is synchronous, requires Node ≥ 22.5, and has no `transaction()` helper.

**Resolution.** The documents are wrong, not the code — `node:sqlite` avoids a native
build step. T02 corrects all four statements. ADR-0002 targets `node:sqlite`
explicitly, and its transaction decision (D4/D5) exists *because* of the missing
helper.

### C2 — Transactional migrations required, none exist

Spec §24.1 requires transactional, backwards-compatible migrations. The repository
creates schema with `CREATE TABLE IF NOT EXISTS` on every `init()`
(`packages/storage-sqlite/src/index.ts:62`), has one ad-hoc routine
(`migrateFlowsTable()`, `:231`), no version table, and one hand-written
`BEGIN`/`COMMIT` with no `ROLLBACK` (`:239`, `:244`).

**Resolution.** ADR-0002 specifies the framework; T03 implements it. Schema changes
require the owner's explicit approval (plan §8 D2).

### C3 — Three pause/resume vocabularies

`agenfk pause|resume <platform>` toggles integrations
(`packages/cli/src/index.ts:1276`, `:1310`). `pause-work|resume-work <id>` snapshots an
item (`:1607`, `:1634`). Autonomous Delivery adds `execution` and `project`
namespaces. Spec §5.1 and §28 require the first two to remain unchanged.

**Resolution.** ADR-0003 D6. T03 adds collision tests *before* the new namespaces
exist; T08 maps `pause-work`/`resume-work` onto Durable Execution without renaming
them.

### C4 — New packages vs. the `server.ts` monolith

Spec §31 recommends five new packages; the repository puts ~90 routes inline in a
3,928-line `server.ts`.

**Resolution.** ADR-0001. Both: new packages for orchestration/verification/adapters,
and new server routes as mounted router modules under `packages/server/src/routes/`.
Existing routes are not migrated.

### C5 — `autoGitCommit` races parallel worktrees

Spec §2.4 and §11.6 require completion to come from structured events and evidence.
The server runs `git add -A && git commit` inside the `validate` request handler when
an item reaches DONE. With more than one worktree active, this sweeps unrelated files
into a commit.

**Observed in T01.** It did not fire destructively only because the tree happened to
be clean at the moment of transition — luck, not design.

**Resolution.** Deferred to T07/T25: auto-commit becomes worktree-scoped and
execution-aware, and never runs `git add -A` across an unbound tree.

### C6 — No redaction layer on the Hub outbox

Spec §23.3 and §25.3 require `detect → redact → hash → persist`. `hub_outbox`
(`packages/storage-sqlite/src/index.ts:90`) and the flusher sanitise only remote URLs
and DSNs.

**Resolution.** Deferred to T05 (`RedactedOutboxWriter` becomes the only path into
`hub_outbox` for new event types) and T32 (adversarial tests).

### C7 — One shared verify token vs. per-execution identity

Spec §14 requires per-execution identity for callbacks. The repository has a single
`~/.agenfk/verify-token`, checked inline in 10 handlers
(`packages/server/src/server.ts:959` and nine others).

**Resolution.** Deferred to T19: execution-scoped short-lived tokens are added; the
shared token stays for existing CLI paths.

### C8 — Two commit conventions, and a stale changelog

`CONTRIBUTING.md:40` asks for conventional commits. The server's auto-commit writes
`close(<type>): <title> [<id>]`. `CHANGELOG.md` stops at `1.1.0-beta.2` while
`package.json` is at `1.1.16`.

**Resolution.** T02 documents both commit forms in `CONTRIBUTING.md` and opens an
`[Unreleased]` section in `CHANGELOG.md`. Backfilling the missing releases is **not**
attempted — the history is not reliably reconstructible from commit messages alone,
and inventing it would be worse than the gap.

### C9 — Design/visual evidence with no browser e2e

Spec §13.4 wants design and visual evidence; the repository has no browser e2e (UI
tests are RTL only, `packages/ui/src/test/`, excluded from the root run).

**Resolution.** Deferred to T26: gate adapter interfaces. Playwright is optional, added
only in a project's Verification Profile, never as a core dependency.

### C10 — `AGENFK_COMPARISON.md` denies session lifecycle

The document states AgEnFK "does not address session lifecycle". Phase B makes that
false.

**Resolution.** ADR-0003 records the scope change. The document is corrected when the
capability actually ships (Phase B) — until then the statement is true of the released
product, and correcting it early would be the inaccuracy.

### C11 — Branches cannot be registered on leaf items

`agenfk branch create <task-id>` fails with *"Branches are tracked on top-level items
only."* The only top-level item in this plan is the epic, and 33 tasks cannot share one
`branchName`. This is consistent with `SDLC.md` §2 and incompatible with plan §2.3
(one branch and worktree per task). Knock-on: the gatekeeper's branch auto-checkout
does not fire for task items.

**Workaround in force.** Task branches are created with plain `git` and recorded in
`docs/plans/items.md` plus an item comment. T01 and T02 both did this.

**Decided 2026-09-03 (owner): (B) — `WorktreeBinding` (D4/T07) owns the item↔branch
link.** `branchName` is not relaxed to leaf items, so no public contract changes now and
T07 does not inherit two overlapping representations. The binding entity has to map an
item to a branch *and* a working directory anyway, which is strictly more than
`branchName` can express. Accepted cost: until T07 lands, task branches are created with
plain `git`, recorded in `docs/plans/items.md`, and the gatekeeper's branch auto-checkout
does not fire for task items.

### C12 — No CLI path binds a project to a directory

`update-project` accepts only `--name`, `--description`, `--verify-command`; `init` and
`create-project` accept a name and description. `Project.projectRoot` exists on the type
(`packages/core/src/types.ts:176`) but the server's project JSON does not expose it. The
binding lives only in the gitignored `.agenfk/project.json`.

**Resolution.** Deferred to T03: `agenfk project doctor` is the natural home.

### C13 — Token attribution returns nothing

`agenfk tokens --item <id>` returned `[]` for the whole of T01, though `SDLC.md` §0
rule 4 states token usage is captured automatically by the server-side ingestion
worker. Plan §3's entire measurement model — and decision D11's recalibration —
assume `agenfk tokens list --item <id>` works.

**Decided 2026-09-03 (owner): diagnose before T03 starts.** A bounded investigation
into why the ingestion worker attributes no events to this project — it may be a small
wiring gap rather than missing functionality. The reason for pulling it forward is D11:
the envelope recalibration wants T02's and T03's real numbers, and T03 is the last point
at which T03's own data can still be captured. If the diagnosis shows the fix is large it
stays in T29, and plan §3 is amended to say plainly that its figures are harness-counter
proxies rather than measurements. Until then, every token figure in this plan is a proxy.

### C14 — `/capabilities` vs. `/v1/…` vs. the repository's bare paths

The T02 card specifies `GET /capabilities`. Spec §23.1 lists ~15 resources under
`/v1/…`, and the T03 card specifies `GET /v1/foundation-gate`. The repository itself
registers 85+ bare paths and only two under `/api/…`; `/v1/` appears only in *outbound*
Hub client calls (`packages/server/src/server.ts:684`, `:758`, `:1129`, `:1163`).

**Resolution.** ADR-0001 D6: `/v1/capabilities` is canonical, `/capabilities` is kept as
an alias so the card's acceptance criterion is met literally. One handler serves both.

### C15 — A dependency-free `core` that must read configuration

The T02 card says the feature flags are "read from `~/.agenfk/config.json` … and env"
and places them in `packages/core/src/features.ts`. But `packages/core` has no npm
dependencies and imports no Node built-ins, and `packages/ui` does not depend on it —
`core` is environment-agnostic today. Adding `node:fs` would make it Node-only for the
first time.

**Resolution.** ADR-0001 D2/D5: `core` holds a pure resolver that takes already-read
values; the server performs the file read. Behaviour matches the card; the I/O sits on
the other side of the boundary.

### C16 — The router-module convention has no precedent in the codebase

`express.Router()` is used nowhere. The Express `app` is a module-level singleton
(`packages/server/src/server.ts:55-57`), there is no global auth, 404 or error
middleware, and `getCurrentVersion()` is module-private (`:3704`). A router module that
imported `server.ts` for the version would create an import cycle.

**Resolution.** ADR-0001 D3/D4: router modules are **factories** taking injected
dependencies and must never import `server.ts`. Enforced by a grep in the ADR's
compliance section.

### C17 — Two documented homes for Autonomous Delivery documentation

Plan §6.1 requires "docs under `docs/autonomous-delivery/` updated"; the T02 card
requires `docs/architecture/INVENTORY.md`, `docs/architecture/CONTRADICTIONS.md` and
`docs/adr/`.

**Resolution.** The card wins for these three artefacts, because architecture records
and ADRs are repository-wide concerns rather than feature documentation.
`docs/autonomous-delivery/` remains the home for feature-level documentation from AD1
onward. No file is written twice.

### C18 — The CLI test named by the card would never run

`packages/cli/src/test/cli.test.ts` is excluded from the root Vitest run
(`vitest.config.ts` `exclude`), and `packages/cli/package.json` has no `test` script —
so nothing executes it. The T02 card requires a "CLI `health` output test".

**Resolution.** The new test is a separate file that the root run includes. The
pre-existing `cli.test.ts` is left untouched and is still run manually as part of T02's
evidence. Re-enabling it repository-wide is out of T02's scope and is not silently
adopted.

### C19 — The companion spec is authoritative and absent

Spec §5 states: *"The detailed source of truth is
`AGENFK_DURABLE_EXECUTION_MASTER_SPEC_2.md`."* That file exists neither in the
repository nor on the build machine (plan §1.2).

**Resolution.** ADR-0003 D7: T04 authors it before any D1–D5 code is written, so the
companion spec is a contract rather than a post-hoc description of whatever was built.

### C20 — The coverage gate does not pass at baseline

Plan §1.4 records the coverage gate as "enforced by `vitest.config.ts`; every task must
keep it", and plan §6.1 makes "coverage gate ≥ 80% … intact" a Definition-of-Done item for
every task. Running it shows the gate has never passed:

```
Statements   : 83.89% ( 4924/5869 )
Branches     : 74.63% ( 3196/4282 )   <-- below the 80% threshold
Functions    : 86.23% (  714/828  )
Lines        : 86.84% ( 4337/4994 )
ERROR: Coverage for branches (74.63%) does not meet global threshold (80%)
```

`vitest.config.ts` sets all four thresholds to 80, so `npm run test:coverage` exits
non-zero on an unmodified checkout. This is **pre-existing debt, not a regression**: T02's
own files are at 100% statements, branches and functions
(`packages/core/src/features.ts`, `packages/server/src/routes/capabilities.ts`), and 200
new lines cannot move a 4,282-branch denominator by 5.4 points.

Closing the gap means covering roughly 230 more branches across `core`,
`storage-sqlite`, `server` and `hub`. It is not work any single task in this plan can
absorb, and CI does not run coverage — `ci.yml` runs `npm ci → build → test`, so nothing
enforces it today.

**Decided 2026-09-04: (a) treat 74.63% as a floor, and fund the gap as its own item —
TASK `47b3727a`.**

Option (c), lowering the branch threshold in `vitest.config.ts` to the current figure, was
explicitly rejected. It is the tidiest-looking fix and the least safe one: it converts real
debt into an invisible standard, and it is the exact move the delivery flow's own exit
criteria forbid — *"never mask a failing test with a threshold, a skip, or a loosened
assertion."* A gate that is green because the bar was moved to meet the code is not a gate.
It is also outside T02's touch list, so it would have required a plan amendment regardless.

Consequences for every task until `47b3727a` lands:

- Report **per-file** coverage for the code the task adds, held to ≥ 80%. This is the
  number plan §6.1 actually cares about ("new code ≥ 80%").
- Report the global figure as **unchanged**, never as green, and never lower it.
- `npm run test:coverage` continues to exit non-zero on an unmodified checkout. That is
  the honest state of the repository, and it is now visible on the board rather than
  buried in a DoD checkbox nobody could satisfy.

Note that CI does not run coverage today (`ci.yml` is `npm ci → build → test`), so nothing
enforces the gate either way. Wiring coverage into CI belongs with `47b3727a`, not before
it — doing it first would turn every merge red.
