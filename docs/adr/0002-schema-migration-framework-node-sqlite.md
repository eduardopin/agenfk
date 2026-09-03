# ADR-0002 — Schema migration framework for `node:sqlite`

- **Status:** Proposed
- **Date:** 2026-09-03
- **Deciders:** repository owner (schema changes require explicit approval — global rules, plan §8)
- **Delivery:** AD0 — Foundation audit and compatibility contract
- **Task:** specified in T02, **implemented in T03**
- **Spec sections:** §24.1, §28

## Context

Spec §24.1 requires that "migrations are transactional and backwards compatible".
The repository has no migration framework at all:

| Repository fact | Evidence |
|---|---|
| Schema is created by `CREATE TABLE IF NOT EXISTS` on every `init()` | `packages/storage-sqlite/src/index.ts:36` → `createTables()` at `:62`; 10 tables at `:64, 68, 79, 86, 90, 99, 121, 126, 139, 156` |
| There is no version table and no way to ask a database what shape it is in | no `schema_version` anywhere in the repository |
| The only migration is one ad-hoc, hand-written routine | `migrateFlowsTable()` at `packages/storage-sqlite/src/index.ts:231`, called from `:171` |
| The only transaction in the package is a hand-written `BEGIN`/`COMMIT` string inside that routine, with no `ROLLBACK` | `packages/storage-sqlite/src/index.ts:239, 244` |
| The engine is `node:sqlite`'s `DatabaseSync`, **not** `better-sqlite3` as three documents claim | `packages/storage-sqlite/src/index.ts:25`; see C1 |

`DatabaseSync` is synchronous and has no `transaction()` helper of the kind
`better-sqlite3` provides, and no savepoint convenience API. Every design choice
below follows from that.

Additive-only matters beyond tidiness: spec §28 requires that existing SQLite data
survives, and the owner's global rules forbid `DROP COLUMN`/`DROP TABLE` without a
documented backup and rollback.

## Decision

| # | Decision | Rationale |
|---|---|---|
| D1 | Add a `schema_version` table holding the applied migration ids and their timestamps. | Makes "what shape is this database in" answerable, which `CREATE TABLE IF NOT EXISTS` never can. |
| D2 | Migrations are an **ordered list of modules**, `{ id, description, up(db) }`, exported from `packages/storage-sqlite/src/migrations/index.ts`. Ids are zero-padded and never reused or reordered. | Ordering is data, not filesystem-scan order, so it is reviewable in a diff. |
| D3 | `runMigrations()` is invoked from `init()` **after** `createTables()`, and applies only ids absent from `schema_version`. | Preserves today's boot path for a fresh database; a new install still gets its schema from `createTables()`. |
| D4 | Each migration runs inside its own transaction via a `withTransaction(fn)` helper on `SQLiteStorageProvider`, implemented as `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`. A failure rolls that migration back and leaves the database at the previous version. | `node:sqlite` gives no transaction helper; without one, a half-applied migration is unrecoverable. `IMMEDIATE` takes the write lock up front rather than failing late. |
| D5 | `withTransaction` guards against nesting: an inner call joins the outer transaction rather than issuing a second `BEGIN`. `node:sqlite` has no savepoint helper, so nesting is rejected, not emulated. | A second `BEGIN` on the same connection is an error; silently swallowing it would turn a rollback into a partial commit. |
| D6 | Migrations are **additive only**: create tables, add nullable columns, create indexes. No `DROP COLUMN`, no `DROP TABLE`, no destructive rewrite, no data loss. A genuinely destructive change requires its own ADR plus a documented backup and rollback. | Spec §28 and the owner's global rules. Also what makes a downgrade survivable: an older binary ignores columns it does not know. |
| D7 | Migration `0001_baseline` records the 1.1.16 schema as already present, so existing installations adopt the framework without re-running anything. | Existing databases must not be rewritten just to gain a version number. |
| D8 | Every migration is proven against a checked-in upgrade fixture (`packages/storage-sqlite/src/test/fixtures/db-1.1.16.sql`) that is opened, upgraded, and re-read for items, flows and snapshots. Each later task's migration also runs against the previous task's fixture. | Turns "backwards compatible" into a test rather than a claim. |
| D9 | Migrations are ordinary code under review: no runtime SQL generation, parameterized statements only, no string interpolation of caller input. | Owner's global security checklist. |

## Alternatives considered

| Option | Why not |
|---|---|
| Keep `CREATE TABLE IF NOT EXISTS` and add ad-hoc routines like `migrateFlowsTable()` | Does not scale past a couple of changes, cannot express ordering, cannot be rolled back, and gives no way to detect a partially-upgraded database. |
| Adopt a migration library (`umzug`, `node-pg-migrate`, Knex) | Adds a dependency and an abstraction layer for ~10 tables and one engine, and none of them target `node:sqlite`'s sync API. The framework here is ~80 lines. |
| Switch to `better-sqlite3` so its `transaction()` helper is available | A dependency swap in a task whose acceptance criterion is "no behaviour change", and `node:sqlite` was a deliberate choice (zero native build). Fix the documents instead — C1. |
| Emulate nested transactions with `SAVEPOINT` | Buys nothing the migration runner needs, and the failure mode of a subtly wrong savepoint implementation is silent data loss. Reject nesting loudly instead. |
| Allow destructive migrations behind a flag | The flag would eventually be set by an autonomous agent. Requiring a fresh ADR keeps a human in that loop. |

## Consequences

**Positive.** Every later delivery can add schema safely. The foundation gate (T03)
and the compatibility suite gain a real version to assert against. Upgrade paths
become testable before release rather than after a user report.

**Negative / accepted cost.** Two code paths now create schema — `createTables()`
for fresh installs and migrations for upgrades — and they can drift. D7's baseline
plus D8's fixture test are the mitigation, but drift remains possible and must be
checked when a table is added. Additive-only means the schema accumulates columns
that a later cleanup ADR will have to address.

**Follow-up.** T03 implements all of this. Every task from T04 onward that adds an
entity adds a migration under this framework and extends the fixture chain.

## Compliance

- `schema_version` exists and `runMigrations()` is idempotent — a second run applies nothing (T03 test).
- A migration that throws leaves `schema_version` unchanged (T03 rollback test).
- `grep -rn "DROP COLUMN\|DROP TABLE" packages/storage-sqlite/src/migrations/` returns nothing (D6).
- The `db-1.1.16.sql` fixture upgrades and re-reads intact on every run (D8).
- A nested `withTransaction` call does not emit a second `BEGIN` (D5 test).
