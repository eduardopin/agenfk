# Execution environment — AgEnFK Autonomous Delivery

Recorded in **T01 — Bootstrap** on **2026-09-03**. Every version below was read from
the tool itself in that session, not from a manifest.

Regenerate the version block with the commands in the right-hand column.

## Toolchain

| Component | Version | Read with |
|---|---|---|
| Node.js | `v22.23.1` | `node --version` |
| npm | `10.9.8` | `npm --version` |
| Claude Code | `2.1.259` | `claude --version` |
| Codex CLI | `codex-cli 0.149.1` | `codex --version` |
| Herdr | `0.8.2` (client and server, protocol **20**) | `herdr --version`, `herdr status` |
| Pi | `0.84.4` (`@earendil-works/pi-coding-agent`, MIT) | `pi --version` |
| AgEnFK | `1.1.17-beta.5` | `agenfk --version` |
| GitHub CLI | `2.96.0` | `gh --version` |

> Deviation from plan §2.6, which records Claude Code `2.1.233`. The installed
> version is `2.1.259`. No behavioural difference was observed in T01; noted so the
> plan can be corrected in T02.

Repository package version (root `package.json`): **1.1.16** — the working copy is
one beta line behind the globally installed AgEnFK CLI (`1.1.17-beta.5`). Expected:
the CLI is the *dogfooded control plane*, the repository is the *thing being built*.

## AgEnFK control plane

| Property | Value |
|---|---|
| Server port | **3001** (from `~/.agenfk/server-port`; the server auto-bumps off 3000) |
| Database path | `/home/pin/.agenfk-system/.agenfk/db.sqlite` |
| Storage engine | SQLite via `node:sqlite` `DatabaseSync`, WAL on (contradiction **C1** — the docs still say `better-sqlite3`) |
| Health | `agenfk health` → API server OK, Database OK, Global Skills OK, no duplicate project roots |
| Project name | `agenfkplus` |
| **Project id** | **`ef5f9e00-b80d-4f9a-9a82-846479156f2d`** |
| Project `verifyCommand` | `npm run build && npm test` (set in T01) |
| Active flow | `Default Flow` — `TODO → IN_PROGRESS → REVIEW → TEST → DONE`; coding step `IN_PROGRESS`, final step `TEST` |
| Directory binding | `/home/pin/projects/agenfk/.agenfk/project.json` → `{"projectId":"ef5f9e00-…"}`; `agenfk current-project` resolves it. `.agenfk/` is gitignored |

**Finding (project→directory binding).** Neither `agenfk init` nor `agenfk
create-project` nor `agenfk update-project` exposes a flag to bind a project to a
filesystem path — `update-project` accepts only `--name`, `--description`,
`--verify-command`, and the returned project JSON has no `projectRoot` field even
though plan §1.1 lists one on the domain type. The binding exists solely as the
gitignored `.agenfk/project.json` in the repository root, which was already present
and already correct. Nothing was forced. Recorded for T02/T03 (`agenfk project
doctor` is the natural place to surface this).

## Git remotes

| Remote | URL | Policy |
|---|---|---|
| `origin` | `https://github.com/cglab-public/agenfk.git` | **Upstream. Never pushed to.** |
| `fork` | `https://github.com/eduardopin/agenfk.git` | All branches and PRs go here. |

Working copy: `/home/pin/projects/agenfk`. Upstream licence is **ISC** (CG/lab),
which permits the fork; `LICENSE` and the copyright notice stay untouched.

## Herdr

Server running, protocol 20, socket `/home/pin/.config/herdr/herdr.sock`.
Full notes and the scheduler-relevant method/event inventory:
[`docs/runtime/herdr.md`](../runtime/herdr.md). Machine-readable schema snapshot:
[`docs/runtime/herdr-api-schema.json`](../runtime/herdr-api-schema.json)
(255,484 bytes, 91 methods, 26 events).

### Integrations installed in T01 — exactly what changed on disk

`herdr integration install claude`:

1. **Created** `/home/pin/.claude/hooks/herdr-agent-state.sh` (3,202 bytes, mode
   `0755`). Header declares `HERDR_INTEGRATION_ID=claude`,
   `HERDR_INTEGRATION_VERSION=8`, and *"managed by herdr; reinstalling or updating
   the integration overwrites this file"*. The script exits immediately unless
   `HERDR_ENV=1`, so it is inert outside a Herdr pane.
2. **Modified** `/home/pin/.claude/settings.json` — appended one `SessionStart` hook
   block. This was the *only* change to the file; the pre-existing `PreToolUse`
   (`bash-guard.sh`, `agenfk-gatekeeper`, `agenfk-mcp-enforcer`) and `PostToolUse`
   (`agenfk-pr-hook`) entries were untouched:

   ```json
   "SessionStart": [
     { "matcher": "*",
       "hooks": [ { "type": "command",
                    "command": "bash '/home/pin/.claude/hooks/herdr-agent-state.sh' session",
                    "timeout": 10 } ] }
   ]
   ```

   > This is the **user-global** Claude Code settings file, not the project one — the
   > hook now runs for every project on this machine. Reversible with
   > `herdr integration uninstall claude`. A pre-change copy was kept in the T01
   > session scratchpad.

`herdr integration install pi`:

3. **Created** `/home/pin/.pi/agent/extensions/herdr-agent-state.ts` (6,602 bytes),
   also `HERDR_INTEGRATION_VERSION=8`. It connects to `HERDR_SOCKET_PATH` over
   `node:net` and reports as source `herdr:pi`; it self-disables unless `HERDR_ENV=1`
   **and** both `HERDR_SOCKET_PATH` and `HERDR_PANE_ID` are set. No Pi settings file
   was modified — extensions in that directory are auto-discovered.

Verification: `herdr integration status` → `pi: current (v8)`, `claude: current (v8)`.

Both integrations give Herdr a *semantic* agent lifecycle (`idle | working | blocked
| done | unknown`) rather than screen scraping — the signal plan §2.6 calls the
strongest available fixture source for T20/T21.

## Pi

`0.84.4`, provider `anthropic` **ready** via OAuth. Full notes, session flags,
extension directory and the LiteLLM/OpenAI-compatible base-URL answer (evidence for
open decision **D8**): [`docs/runtime/pi.md`](../runtime/pi.md).

## This session's Herdr pane

| Variable | Value |
|---|---|
| `HERDR_ENV` | `1` |
| `HERDR_WORKSPACE_ID` | `w1` |
| `HERDR_TAB_ID` | `w1:t1` |
| `HERDR_PANE_ID` | `w1:p1` |
| `HERDR_SOCKET_PATH` | `/home/pin/.config/herdr/herdr.sock` |

## Baseline verification on this tree

| Check | Result |
|---|---|
| `npm run build` | exit 0 (all packages) |
| `npm test` | 219 files, 2,368 passed, 1 skipped, ≈407 s (serial: `fileParallelism:false`) |

T01's own re-run of `npm run build && npm test` is recorded in
[`handoff-T01.md`](handoff-T01.md) and as an `agenfk comment` on the T01 item.

## Secrets — never recorded anywhere in this repository

`~/.agenfk/verify-token`, the AgEnFK installation id, `~/.pi/agent/auth.json`, and any
provider bearer token. None of these were read, printed, copied or committed by T01.
