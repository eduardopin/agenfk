# Handoff — T02 — AD0-a: inventory, ADRs, contradictions log, feature-flag and config skeleton

**Date:** 2026-09-03 · **Delivery:** AD0-a · **Plan card:** §5/T02
**AgEnFK item:** `3d4988dc-f52f-4623-8a55-d27b18de7e47`
**Branch:** `feature/3d4988dc-f52f-4623-8a55-d27b18de7e47_t02-ad0-a`
**Worktree:** `../agenfk-wt/t02` (the first task in this plan to use one)
**Harness:** Claude Code `2.1.259`, Opus 5 (1M) at effort `xhigh` — as the card specifies

---

## What shipped

| Deliverable | Where |
|---|---|
| Architecture inventory | `docs/architecture/INVENTORY.md` — 320 lines, under the card's 400-line split cap |
| Contradictions log | `docs/architecture/CONTRADICTIONS.md` — C1–C19 |
| ADR template | `docs/adr/0000-template.md` |
| ADR-0001 component boundaries and package layout | `docs/adr/0001-…` — owner decisions **D2** and **D9** |
| ADR-0002 migration framework for `node:sqlite` | `docs/adr/0002-…` — specified here, implemented in T03 |
| ADR-0003 Durable Execution scope | `docs/adr/0003-…` |
| Feature flags (pure resolver) | `packages/core/src/features.ts` + one barrel line in `packages/core/src/index.ts` |
| `GET /v1/capabilities` (+ `/capabilities` alias) | `packages/server/src/routes/capabilities.ts` — the **first router module** in the package |
| Router mount | `packages/server/src/server.ts` — 10 lines: one import, one `app.use` |
| Flag reporting in `agenfk health` | `packages/cli/src/index.ts` |
| Tests | `packages/core/src/test/features.test.ts`, `packages/server/src/test/capabilities.test.ts`, `packages/cli/src/test/health-capabilities.test.ts` |
| Documentation corrections | `CLAUDE.md`, `AGENTS.md`, `AFK_ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md` |
| Plan stale-fact fixes (T01 finding 8) | `AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md` |

**No schema change. No new dependency. No orchestration behaviour.** All three flags
default to `false`, so a default installation behaves exactly as 1.1.16 did.

## Owner decisions taken this session

| # | Question | Decision |
|---|---|---|
| — | T02's base branch, since PR #1 was still open and `fork/main` had no spec or plan | **Merge PR #1 first.** Done — `fork/main` is now `8d67c6de`; the T02 worktree was rebased onto it. This put T01 finding 8 back in scope for this PR |
| **D2** | ADR-0001 package layout | Approved as prescribed: spec §31's new packages, `core` stays dependency-free, new routes as mounted router modules |
| **D9** | Zod API surface for new schemas | New schemas import **`zod/v4`**, already shipped by the installed 3.25.76. Existing `zod` root imports untouched; dependabot #159 becomes a no-op for new code |
| — | `/capabilities` vs `/v1/…` | `/v1/capabilities` canonical, `/capabilities` kept as the alias the card names. One handler serves both |
| — | ADR approval gate | ADRs approved by the owner before any code was written |

## Deviations from the card

1. **The feature-flag module is split in two.** The card puts config and env reading in
   `packages/core/src/features.ts`. `packages/core` has no npm dependencies *and* no Node
   built-ins, and `packages/ui` does not depend on it, so it is environment-agnostic today;
   adding `node:fs` would have made it Node-only for the first time. The resolver in `core`
   is pure and takes already-read values; the file read lives in the server. Behaviour is
   exactly what the card specifies. Recorded as C15 and decided in ADR-0001 D2/D5.
2. **The route is versioned.** `/v1/capabilities` is canonical rather than the card's bare
   `/capabilities`, which is kept as an alias. C14, ADR-0001 D6, owner-approved.
3. **The CLI test is a new file, not an addition to `cli.test.ts`.** That file is excluded
   from the root Vitest run and `packages/cli` has no `test` script, so nothing executes it
   (C18). Re-enabling it repository-wide is somebody else's deliberate decision and was not
   reversed here; it was run manually as evidence instead.
4. **`c4m` was not run interactively.** The card lists it as a resource for the container
   diagram. It is a dialogue-driven skill and this was an autonomous run, so the Mermaid
   `C4Container` diagram in the inventory was authored directly, following the same model.
5. **`CHANGELOG.md` was not backfilled.** The gap between `1.1.0-beta.2` and `1.1.16` is
   recorded as a gap rather than reconstructed from commit messages. Stated in the file itself.
6. **`AGENFK_COMPARISON.md` was not corrected** even though ADR-0003 makes its
   "does not address session lifecycle" claim obsolete. It is still true of the *released*
   product; it gets corrected when Phase B ships. C10.

## Findings

1. **A worktree needs its own `npm ci`.** `git worktree add` gives a clean checkout with no
   `node_modules`, so the first command in a new task worktree must be `npm ci` (~2 minutes
   here). Plan §2.3 does not mention it. Every task from here on pays this cost; worth
   adding to the kickoff template (Appendix A).
2. **`os.homedir()` cannot be spied in this test setup.** `vi.spyOn(os, 'homedir')` fails
   with *"Cannot redefine property"*. Any code path whose failure mode depends on
   `os.homedir()` throwing must take an injectable resolver to be testable —
   `readFeatureConfig(homedir?, resolveHomedir = os.homedir)` is the shape used here.
   Relevant to T03's `project doctor`, which will resolve paths the same way.
3. **A default parameter is outside its own function's `try`.** The first version of
   `readFeatureConfig` was `(homedir = os.homedir())`, which would have let an OS-level
   failure escape as a 500 from an endpoint whose contract is that it never fails. Found by
   the independent reviewer, not by the tests. The rule for the rest of this plan: resolve
   ambient state *inside* the guard, never as a default argument.
4. **`scripts/enforce-coverage.ts` is not wired into anything.** No npm script references it
   and CI runs `npm ci → build → test`. Its per-file check would also fail on any modified
   file outside the coverage `include` set (`packages/cli`, for one), reporting *"No coverage
   data found"* as a failure. The real gate is `vitest.config.ts`. `AFK_ARCHITECTURE.md`
   presents the script as canonical, which overstates it.
5. **The repository root accumulates test artefacts.** ~40 `*-test-db.sqlite-wal/-shm` files
   from suite runs. They are gitignored (`*.sqlite*`) so they cannot be committed by
   accident, but they are never cleaned up. Cosmetic, recorded so nobody rediscovers it.

## Open questions for the owner

| # | Question | Blocks |
|---|---|---|
| **C11** | Item↔branch model: relax the top-level `branchName` constraint, or hand the link to `WorktreeBinding` in D4/T07? Carried unresolved from T01 | T07 |
| **C13** | `agenfk tokens --item` still returns `[]`. Plan §3's measurement model and D11's recalibration both assume it works | T29, and every token figure in this plan |
| **D11** | Envelope recalibration. T02 is the first task that ran on the model and effort its card specifies, so it is the first valid data point | after T03 |

## Verification

<!-- VERIFICATION -->

## Token usage

The `/cost` slash command cannot be invoked from inside a session, so no `/cost` figure is
available. The harness context counter is reported instead, labelled for what it is: an
order-of-magnitude proxy, not a measurement. See C13 — `agenfk tokens --item` returns
nothing, so the plan's intended instrument is still unavailable.

**Against the card's 400k envelope the 450k split trigger was never approached.**

Unlike T01, this session ran on the model and effort the card specifies (Opus 5, `xhigh`),
so it **is** a valid calibration point for the §3.5 cost table.

## Close-out

<!-- CLOSEOUT -->

## What T03 must know

- **T03's gate endpoint is the second router module.** Copy the factory shape from
  `packages/server/src/routes/capabilities.ts`: `createXRouter(deps)`, dependencies
  injected, never an import from `../server`. ADR-0001 D4 and its compliance grep.
- **`foundationGate: "unknown"` in the capabilities payload is T03's to replace.** Bump
  `CAPABILITIES_SCHEMA_VERSION` if the payload shape changes in a way a client would notice.
- **`allFeaturesDisabled()` is exported from `@agenfk/core` and currently unused by
  production code.** It is the callable form of AD0's "no new orchestration behaviour runs
  by default" and is intended for `assertFoundationGate()`. If T03 does not use it, delete it.
- **ADR-0002 is the contract for the migration framework**, including the two decisions most
  likely to be got wrong: `BEGIN IMMEDIATE` rather than a bare `BEGIN`, and *rejecting*
  nested transactions rather than emulating them with savepoints.
- **The CLI namespace collision suite must be written before anything claims those
  namespaces.** `pause <platform>` and `resume <platform>` are at
  `packages/cli/src/index.ts:1276` and `:1310`; `pause-work`/`resume-work` at `:1607`/`:1634`.
- **Run `npm ci` in the new worktree first** (finding 1).
- The inventory's file:line references were correct at commit `2b3761b6`. `server.ts` is now
  10 lines longer, so any reference beyond `:927` has shifted by 10.
