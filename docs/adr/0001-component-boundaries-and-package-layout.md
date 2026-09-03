# ADR-0001 — Component boundaries and package layout for Autonomous Delivery

- **Status:** Proposed
- **Date:** 2026-09-03
- **Deciders:** repository owner (decision **D2**, plan §8)
- **Delivery:** AD0 — Foundation audit and compatibility contract
- **Task:** T02
- **Spec sections:** §4, §4.1, §23.1, §31

## Context

Spec §31 recommends five new packages (`orchestrator`, `runner-herdr`,
`harness-adapters`, `skill-registry`, `verification`) and mandates a dependency
direction in which `core` imports nothing from server, UI, runtimes or storage
implementations. It also says: *"Final locations MUST follow current repository
conventions discovered in AD0."*

The conventions AD0 actually discovered pull in the opposite direction:

| Repository fact | Evidence |
|---|---|
| `packages/server/src/server.ts` is a 3,928-line module with ~90 routes registered inline | `packages/server/src/server.ts:905`–`:3822` |
| `express.Router()` is used **nowhere** in the repository | `grep -rn "express.Router" packages/` → no matches |
| The Express `app` is a module-level singleton, not a factory | `packages/server/src/server.ts:55-57` |
| There is no global auth, 404 or error middleware; `x-agenfk-internal` is checked inline in 10 handlers | `packages/server/src/server.ts:959, 1030, 2154, 2815, 2824, 2879, 2891, 2901, 2919, 2935` |
| `getCurrentVersion()` is module-private | `packages/server/src/server.ts:3704` |
| `packages/core` has no npm dependencies and imports no Node built-ins | `packages/core/package.json`; `grep -rE "from 'node:" packages/core/src` → no matches |
| `packages/core` has no `exports` map — consumers see only the `src/index.ts` barrel | `packages/core/package.json` (`main`/`types` only) |
| `packages/ui` does **not** depend on `@agenfk/core` | `packages/ui/package.json` |
| Route paths are 85+ bare (`/items`, `/projects`) vs. 2 `/api/*`; `/v1/*` appears only in **outbound** Hub client calls | `packages/server/src/server.ts:684, 758, 1129, 1163` |
| `zod ^3.22.4` is declared only by `packages/server`; installed 3.25.76 exposes the `./v4` subpath | `packages/server/package.json:25`; `node_modules/zod/package.json` exports |

Two further facts constrain the shape of a router module. Because `app` is a
singleton created at module load and `getCurrentVersion()` is unexported, a router
module that reached back into `server.ts` for either would create an import cycle
(`server.ts` → `routes/x.ts` → `server.ts`). And because `core` is dependency-free
*and environment-agnostic*, putting filesystem reads into it to resolve
`~/.agenfk/config.json` would make it Node-only for the first time.

## Decision

| # | Decision | Rationale |
|---|---|---|
| D1 | Adopt spec §31's five new packages: `packages/orchestrator`, `packages/verification`, `packages/skill-registry`, `packages/runner-herdr`, `packages/harness-adapters`. Each is created by the task that first needs it, never speculatively. | Keeps runtime/harness adapters (spec §4.1) swappable and keeps scheduler policy out of the server monolith. |
| D2 | `packages/core` stays **dependency-free and environment-agnostic**: no npm dependencies, no Node built-ins, no I/O. It holds types, pure policy functions, and interfaces only. | Preserves the one package every other package can import without cost, and keeps policy unit-testable without a filesystem. |
| D3 | New server HTTP surface lives in `packages/server/src/routes/<feature>.ts` as `express.Router()` modules mounted from `server.ts`. Existing routes are **not** migrated. | Bounds the blast radius of every later delivery to a new file plus one mount line, without a risky 3,900-line refactor. |
| D4 | Each router module exports a **factory** — `createXRouter(deps)` — receiving its dependencies (version getter, config loader, storage, clock) as arguments. It must not import `server.ts`. | Removes the import cycle structurally rather than by convention, and makes each router unit-testable without booting the server. |
| D5 | I/O for configuration and the environment lives on the server side of the boundary. Pure resolvers live in `core` and take already-read values as input. | Direct consequence of D2; keeps precedence rules table-testable. |
| D6 | New Autonomous Delivery REST resources use the versioned prefix `/v1/<resource>` (spec §23.1). Existing bare paths are untouched. `GET /capabilities` is kept as an unversioned alias of `/v1/capabilities` because the T02 card names it. | Gives the ~15 resources of spec §23.1 one consistent prefix, without a breaking rename of the ~85 existing routes. |
| D7 | UI features for Autonomous Delivery live under `packages/ui/src/autonomous/`. | Keeps the new surface separable and keeps `packages/ui` free of `@agenfk/core`, which it does not depend on today. |
| D8 | Agent Profiles and Verification Profiles are **data** (`profiles/*.yaml`), never packages or compiled subsystems. | Spec §31 explicitly forbids a package per profile; profiles must be editable without a release. |
| D9 | New Zod schemas import from the **`zod/v4`** subpath. Existing `zod` root imports (`packages/server/src/index.ts:11`, 11 schemas) are left alone. Dependabot PR #159 (3.25.76 → 4.4.3) may be merged or deferred independently. | Resolves owner decision **D9**: the installed 3.25.76 already ships `zod/v4`, so new code is written once against the API it will keep, and the version bump becomes a no-op for new code instead of a flag day. |
| D10 | Dependency direction is enforced as: `core ← orchestrator ← server`, `core ← adapters ← server`, `core ← storage`. `core` never imports server, UI, Herdr, harness CLIs, or a storage implementation. | Spec §31; also what makes D2 checkable rather than aspirational. |

## Alternatives considered

| Option | Why not |
|---|---|
| Folders inside `packages/server/src/` instead of new packages | Lets scheduler/verification policy reach server internals, and makes the runtime/harness split of spec §4.1 unenforceable — an adapter could import Express. |
| Migrate the existing ~90 routes into routers as part of AD0 | A 3,900-line refactor with no behavioural test coverage of its own; it would consume the entire T02 envelope and put every later delivery behind it. Rejected as out of scope, not as wrong. |
| Router modules importing `app`/`getCurrentVersion` from `server.ts` directly | Import cycle. Works by luck under CommonJS hoisting today; breaks unpredictably once a router is imported before `server.ts` finishes evaluating. |
| Let `core` read `~/.agenfk/config.json` with `node:fs` | Makes `core` Node-only for the first time and couples pure policy to a file layout, for no gain — the caller already knows how to read its own config. |
| Put new routes on bare paths to match the repo majority | Leaves spec §23.1's ~15 versioned resources permanently inconsistent, and T03's `/v1/foundation-gate` already assumes the prefix. |
| Adopt Zod 4 now by merging #159 | A major bump touching 11 existing schemas, inside a task whose acceptance criterion is "no behaviour change". `zod/v4` gets the same forward-compatibility with zero risk to existing code. |

## Consequences

**Positive.** Every later delivery adds a file and a mount line instead of editing a
3,900-line module, so two deliveries rarely conflict in the same region. Router
factories are testable without `initStorage()`. `core` stays importable from any
environment, which keeps the door open for a browser-side policy check later.

**Negative / accepted cost.** The repository now has two route conventions — inline
bare-path routes and mounted `/v1` router modules — and two Zod import styles.
Both are transitional and both are documented here and in
[`../architecture/CONTRADICTIONS.md`](../architecture/CONTRADICTIONS.md) (C14, C16).
Anyone reading `server.ts` alone no longer sees the full route table.

**Follow-up.** T03 adds `packages/server/src/routes/foundation-gate.ts` as the second
router module and is the first consumer of D4's factory shape. T09 is the first
consumer of D9 (`zod/v4`). T20/T21 create `packages/runner-herdr` and
`packages/harness-adapters` under D1.

## Compliance

- `grep -rn "from '\.\./server'" packages/server/src/routes/` must return nothing (D4).
- `grep -rnE "from ['\"]node:|require\(['\"](fs|path|os)" packages/core/src/` must return nothing (D2/D5).
- `packages/core/package.json` `dependencies` must stay absent (D2).
- Every new router module has a unit test that constructs it with stub dependencies and no server boot (D4).
- New route paths in `packages/server/src/routes/` start with `/v1/` (D6); the single documented exception is the `/capabilities` alias.
