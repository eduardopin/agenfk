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
- **`agenfk update-project --auto-git-commit <true|false>`** and the internal-token
  route `PUT /projects/:id/auto-git-commit`, the only ways to switch auto-commit on.
  Like `verifyCommand`, it is privileged: it decides whether the server runs `git`
  in a working tree, so it is not settable through the open `PUT /projects/:id`.
  `agenfk health` also names the projects that have it on, and where they would
  commit.
- **Architecture records**: `docs/architecture/INVENTORY.md` (the 1.1.16 baseline
  with verified file:line references), `docs/architecture/CONTRADICTIONS.md`
  (C1–C19) and `docs/adr/` with ADR-0001 (component boundaries and package
  layout), ADR-0002 (schema migration framework for `node:sqlite`) and ADR-0003
  (Durable Execution scope).

### Changed
- **BREAKING (behaviour): auto-commit on DONE is now opt-in.** When an item reached
  DONE the server ran `git add -A && git commit` at the project root — the entire
  working tree, not the files belonging to the item. It is now **off unless the
  project opts in**. Existing projects keep behaving as before only after running:

  ```
  agenfk update-project <project-id> --auto-git-commit true
  ```

  The default was flipped rather than merely guarded because the command stages
  everything in the tree, and with per-task git worktrees — which the workflow now
  expects — that sweeps unrelated work into a commit. Contradiction C5.

  **Opting in is only safe with one active worktree per project.** The guards bound
  *where* the commit happens, not *what* it stages: the project root is whatever the
  last validated item resolved, so closing an item that never sent a `cwd` can commit
  in another task's worktree. Worktree-scoped, execution-aware auto-commit is T07/T25.
- **The DONE response no longer claims the server committed when it did not.** It
  previously said "The server has auto-committed the changes" on every DONE
  transition; with auto-commit off by default that was false for every project, and
  an agent following it would push a branch whose work was still unstaged. The
  message now reports what actually happened, and names the reason when the commit
  was skipped.
- **`findProjectRoot` no longer resolves a submodule to the submodule.** The
  repository boundary added below stops at the caller's git toplevel, which for a
  submodule or a vendored clone is the inner repository rather than the project that
  carries the `.agenfk` marker. Submodules now climb to the outermost superproject,
  so the marker above is found as before. An **unrelated** nested clone keeps its own
  boundary and no longer inherits a marker from the directory it sits in — a
  deliberate behaviour change for that case.

### Fixed
- Documentation stated that storage used `better-sqlite3`. It has always used
  Node's built-in `node:sqlite`. Corrected in `CLAUDE.md`, `AGENTS.md` and
  `AFK_ARCHITECTURE.md`, which also referred to a nonexistent
  `agentic-framework/` directory and to `db.json` as the server's storage.
- `CONTRIBUTING.md` now documents both commit forms in use: conventional commits
  for humans and agents, and the server's `close(<type>): <title> [<id>]`
  auto-commit.
- **`findProjectRoot` escaped to the user's home directory from a git worktree.**
  The walk looked for any `.agenfk` ancestor with no repository boundary; a worktree
  has none of its own, so the search climbed until it found the framework's own
  `~/.agenfk` and returned `$HOME`. The server persisted that as
  `project.projectRoot` and ran the project's `verifyCommand` there — and, before
  the change above, `git add -A && git commit` as well. A `.agenfk` marker now
  counts only at or below the caller's git toplevel, `os.homedir()` never counts,
  and a worktree resolves to its own root. The two divergent copies of the walk in
  `packages/server` — `server.ts` and the MCP entry point `index.ts` — are now one
  module, `packages/server/src/project-root.ts`. The CLI's third copy,
  `findProjectJsonPath`, had the same defect against `.agenfk/project.json` and now
  carries the same two rules; it stays duplicated because neither package the CLI
  depends on may hold a resolver that needs `fs` and `child_process`.
- **The home directory is refused on every path, not just the marker walk.** Where
  `$HOME` is itself a git repository — a dotfiles repo, the exact setup this bug
  endangers — the repository-boundary branch used to return it. And
  `autoGitCommit`'s home guard compared unresolved paths, so a home reached through
  a symlink (`/home` → `/var/home`, a bind mount, an encrypted home) slipped past it
  and committed the whole home directory.
- **`git` failures are no longer indistinguishable from "not a repository".** `git`
  missing from the daemon's PATH, dubious ownership, or a wedged mount silently
  removed the repository boundary for every resolution; they are now logged, carried
  into the refusal message, and the git call has a timeout so a stale network mount
  cannot wedge the daemon.
- **A change of `project.projectRoot` is no longer silent**: the server logs the
  repoint with the directory it resolved from, and records it as an item comment.
- **`autoGitCommit` refuses to run outside a repository root**, the home directory
  included, and every refusal is logged with its reason.

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
