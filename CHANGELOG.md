# Changelog

All notable changes to AgEnFK are documented here.

> The entries between `1.1.0-beta.2` and the current package version (1.1.16) were
> never written down. They are **not** reconstructed here: the history is not
> reliably recoverable from commit messages alone, and inventing it would be worse
> than the gap. New work is recorded from `[Unreleased]` onward.

## [Unreleased]

### Added
- **Autonomous Delivery feature flags** (`@agenfk/core`): `autonomousDelivery`,
  `durableExecution` and `localProcessRuntime`, resolved from
  `AGENFK_FEATURE_*` environment variables, then the `features` key of
  `~/.agenfk/config.json`, then a default of **off**. Nothing new runs unless a
  flag is explicitly switched on.
- **`GET /v1/capabilities`** (and the unversioned `/capabilities` alias) reporting
  the server version, the feature flags and a `foundationGate: "unknown"`
  placeholder that T03 replaces with a real Durable Execution evaluation. This is
  the first `express.Router()` module in `packages/server`.
- **`agenfk health`** now reports the Autonomous Delivery flags. A server without
  the endpoint is reported as such and is not counted as a health issue.
- **Architecture records**: `docs/architecture/INVENTORY.md` (the 1.1.16 baseline
  with verified file:line references), `docs/architecture/CONTRADICTIONS.md`
  (C1–C19) and `docs/adr/` with ADR-0001 (component boundaries and package
  layout), ADR-0002 (schema migration framework for `node:sqlite`) and ADR-0003
  (Durable Execution scope).

### Fixed
- Documentation stated that storage used `better-sqlite3`. It has always used
  Node's built-in `node:sqlite`. Corrected in `CLAUDE.md`, `AGENTS.md` and
  `AFK_ARCHITECTURE.md`, which also referred to a nonexistent
  `agentic-framework/` directory and to `db.json` as the server's storage.
- `CONTRIBUTING.md` now documents both commit forms in use: conventional commits
  for humans and agents, and the server's `close(<type>): <title> [<id>]`
  auto-commit.

## [1.1.0-beta.2] — 2026-06-23

### Changed
- **All skill flavors are now CLI-first**: the main `agenfk` skill and every sibling (`agenfk-code/close/test/review/deep/plan/pr/flow/calc-tokens`, plus `SKILL.md` and the per-client flavor files) now instruct the `agenfk` CLI directly instead of MCP-style function calls — each skill is self-contained (agents like Pi load each `~/.agents/skills/<name>/SKILL.md` independently). MCP tool names remain as optional "(MCP: …)" equivalents.
- Read commands in the skills and rule bundles use `--json` for machine-readable output.
- Removed the stale `log_token_usage` tool reference (token usage is ingested server-side).

### Fixed
- `bin/agenfk.js` refuses to run destructively from a source checkout (carried from beta.1; tightened guard).

## [1.1.0-beta.1] — 2026-06-23

### Changed
- **CLI-only by default**: AgEnFK no longer registers the MCP server with any client on install. The `agenfk` CLI is now the primary, fully server-enforced interface for the entire workflow. MCP becomes **opt-in**.
- **Upgrades flip cleanly to CLI-only**: a default (no `--with-mcp`) install/upgrade now *unregisters* any previously-registered agenfk MCP server across clients (claude/codex/gemini/cursor/opencode), so you don't end up in a half-state with stale MCP tools. Pass `--with-mcp` to keep/register it.
- Rule bundles (`CLAUDE.md`, `AGENTS.md`, `agenfk.mdc`, `GEMINI.md`) and `SKILL.md` rewritten to present the CLI as the default path, with a full CLI↔MCP command-mapping table; removed the prior "never use the CLI" guidance.

### Added
- **MCP opt-in flags**: `--with-mcp` registers the MCP server (e.g. `npx agenfk@latest --with-mcp`, `agenfk integration install <platform> --with-mcp`); `--no-mcp` force-disables it. The preference is persisted in `~/.agenfk/config.json` so re-installs honor it.
- **CLI parity commands** closing the former MCP-only gaps: `agenfk pause-work`, `resume-work`, `update-project`, `add-context`, `flow delete`, and `analyze`.
- **`--toon` global flag**: read commands (`list`, `get`, `list-projects`, `flow list`, `flow show`, `tokens`, `pr-register`, `pr-resize`, `update-project`) can emit compact **TOON** (Token-Oriented Object Notation) instead of JSON to reduce output tokens — tabular form for arrays of uniform objects.

### Platforms
- Claude Code: fully supported; gatekeeper + mcp-enforcer PreToolUse hooks still install (the enforcer permits the CLI when MCP is absent).
- Opencode / Gemini CLI / OpenAI Codex CLI / Cursor: CLI-driven workflow via the updated rule bundles; MCP available via `--with-mcp`.

## [0.2.1] — 2026-03-07

### Added
- **Custom Workflow Flows**: Projects can define custom multi-step flows with named steps and exit criteria (replaces fixed TODO → IN_PROGRESS → DONE).
- **Flow Designer**: Visual drag-and-drop flow editor in the Kanban UI.
- **TDD Flow**: Built-in TDD flow template (TODO → CREATE_UNIT_TESTS → IN_PROGRESS → REVIEW → DONE).
- **`get_flow` MCP tool**: Returns the active flow for a project including all steps and exit criteria.
- **`validate_progress` evidence param**: Mandatory `evidence` field logged as a tagged comment for audit trail.
- **Flow publish/install**: Share and install community workflow flows via a public registry repo.
- **Color-coded flow steps**: Steps and Kanban columns render with configurable accent colors.
- **Step colors in FlowStep type**: `color` field added to `FlowStep` in core and UI packages.

### Changed
- `review_changes` and `test_changes` MCP tools are now aliases of `validate_progress` (kept for backward compatibility).
- `validate_progress` on the final step enforces the project's `verifyCommand` automatically.
- Workflow gatekeeper now surfaces current step's exit criteria in the authorization response.

### Platforms
- Claude Code: fully supported via PreToolUse hooks.
- Opencode: fully supported via MCP + skill system.
- Google Gemini CLI: fully supported via MCP + workflow rules.
- OpenAI Codex CLI: fully supported via MCP + `AGENTS.md` rules.
- Cursor: experimental via `.mdc` instructional rules.

## [0.2.0] — 2026-03-01

### Added
- SQLite storage backend (`packages/storage-sqlite`) as an alternative to JSON.
- Telemetry package (`packages/telemetry`) for token usage tracking.
- `agenfk integration list/install/uninstall` commands for per-platform integration management.
- `agenfk health` command for system diagnostics.
- `agenfk upgrade --beta` flag for opting into pre-release versions.
- Parent–child status propagation: parent EPICs and STORYs auto-advance when all children advance.
- Sibling propagation: siblings on the same branch skip redundant build runs.

### Changed
- `agenfk up` now bootstraps services on first run if build artifacts are missing.
- MCP server now runs in stdio mode (`agenfk mcp`), compatible with all MCP clients.

## [0.1.x] — 2026-02-20 to 2026-02-28

Initial development: core monorepo setup, JSON storage, Express REST API, WebSocket real-time updates, React Kanban UI, CLI, MCP integration for Claude Code and Opencode, `validate_progress` workflow gate, auto git-commit on DONE.
