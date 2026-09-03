# Herdr runtime notes

Captured during **T01 — Bootstrap** on 2026-09-03. This file is the human-readable
companion to the machine-readable snapshot `docs/runtime/herdr-api-schema.json`,
which T20 (`packages/runner-herdr`) uses as a contract-test fixture.

Regenerate the snapshot with:

```bash
herdr api schema --json > docs/runtime/herdr-api-schema.json
```

## Version and transport

| Property | Value |
|---|---|
| Client version | `0.8.2` (stable channel) |
| Server version | `0.8.2`, status `running` |
| **Protocol** | **20** (client and server agree; `compatible: yes`) |
| Schema envelope version | `schema_version: 1`, title `Herdr API` |
| Socket path | `/home/pin/.config/herdr/herdr.sock` (Unix domain socket; on Windows the same value is used as a named pipe `\\.\pipe\<path>`) |
| Snapshot size | 255,484 bytes, 91 methods, 26 event types |
| Licence | Apache-2.0 |

Environment variables Herdr exports into a pane — these are how a process knows it
is running under Herdr and which pane it occupies. Confirmed in this session:

| Variable | Value in this pane |
|---|---|
| `HERDR_ENV` | `1` (integrations no-op unless this is `1`) |
| `HERDR_SOCKET_PATH` | `/home/pin/.config/herdr/herdr.sock` |
| `HERDR_PANE_ID` | `w1:p1` |
| `HERDR_TAB_ID` | `w1:t1` |
| `HERDR_WORKSPACE_ID` | `w1` |
| `HERDR_BIN_PATH` | `/home/pin/.local/bin/herdr` |

The `<workspace>:<pane>` id shape matters for AD6: a Herdr pane id is scoped to a
workspace, so an execution's runtime handle must carry both, not the pane id alone.

## Method namespaces (91 methods)

| Namespace | Count | Methods |
|---|---|---|
| `agent` | 12 | `explain`, `focus`, `get`, `list`, `prompt`, `read`, `rename`, `send_keys`, `start`, `view.clear`, `view.set`, `wait` |
| `client` | 2 | `window_title.clear`, `window_title.set` |
| `events` | 2 | `subscribe`, `wait` |
| `integration` | 2 | `install`, `uninstall` |
| `layout` | 3 | `apply`, `export`, `set_split_ratio` |
| `notification` | 1 | `show` |
| `pane` | 30 | incl. `split`, `close`, `get`, `list`, `read`, `send_input`, `send_text`, `send_keys`, `wait_for_output`, `process_info`, `report_agent`, `report_agent_session`, `report_metadata`, `release_agent`, `clear_agent_authority` |
| `plugin` | 11 | `action.invoke`, `action.list`, `enable`, `disable`, `link`, `unlink`, `list`, `log.list`, `pane.open`, `pane.close`, `pane.focus` |
| `popup` | 1 | `close` |
| `server` | 5 | `agent_manifests`, `live_handoff`, `reload_agent_manifests`, `reload_config`, `stop` |
| `session` | 1 | `snapshot` |
| `tab` | 7 | `create`, `close`, `focus`, `get`, `list`, `move`, `rename` |
| `workspace` | 9 | `create`, `close`, `focus`, `get`, `list`, `move`, `move_block`, `rename`, `report_metadata` |
| `worktree` | 4 | `create`, `list`, `open`, `remove` |
| `ping` | 1 | `ping` |

### Methods a scheduler (AD5/AD6) actually needs

- **Launch**: `pane.split` / `tab.create` / `workspace.create` to obtain a pane, then
  `agent.start` (or `pane.send_text`) to run the harness in it.
- **Address**: `pane.get`, `pane.list`, `agent.get`, `agent.list` to resolve a runtime
  handle back to a live pane, and `pane.process_info` to confirm what is running.
- **Observe**: `agent.wait` / `pane.wait_for_output` for blocking waits;
  `events.subscribe` for the push path.
- **Identity for resume**: `pane.report_agent`, `pane.report_agent_session`,
  `pane.report_metadata` — this is what the `claude` and `pi` integrations call, and
  it is what makes a pane's agent session recoverable (D5 `SessionReference`).
- **Release**: `pane.release_agent`, `pane.clear_agent_authority`, `pane.close`.
- **Worktrees**: `worktree.create`, `worktree.list`, `worktree.open`, `worktree.remove`
  — relevant to D4 `WorktreeBinding`. Per plan §2.6 these are *observed, not adopted*
  until T07 decides who owns worktree creation.

## Event types (26)

`layout_updated`, `pane_agent_detected`, **`pane_agent_status_changed`**, `pane_closed`,
`pane_created`, `pane_exited`, `pane_focused`, `pane_moved`, `pane_output_changed`,
`pane_updated`, `tab_closed`, `tab_created`, `tab_focused`, `tab_moved`, `tab_renamed`,
`workspace_closed`, `workspace_created`, `workspace_focused`, `workspace_metadata_updated`,
`workspace_moved`, `workspace_renamed`, `workspace_reordered`, `workspace_updated`,
**`worktree_created`**, `worktree_opened`, `worktree_removed`.

The `subscription_event` schema declares no `type` constants of its own — subscription
delivery reuses the `event` union.

### Events relevant to a scheduler

| Event | Payload (required fields in bold) | Why the scheduler cares |
|---|---|---|
| `pane_agent_status_changed` | **`type`**, **`pane_id`**, **`workspace_id`**, **`agent_status`**, `agent`, `display_agent`, `title`, `state_labels` | The semantic lifecycle signal. `agent_status` is the enum `idle \| working \| blocked \| done \| unknown` — a real state machine, not screen scraping. This is the heartbeat source for AD6 and the "worker is blocked" trigger for AD5. |
| `pane_agent_detected` | **`type`**, **`pane_id`**, **`workspace_id`**, `agent`, `final_status`, `released` | Attach/detach of an agent to a pane. `released: true` plus a `final_status` is the clean-exit path; its absence after `pane_exited` is loss (D5 recovery). |
| `pane_exited` / `pane_closed` | pane identity | Worker died or its pane went away — the loss-detection path in T21. |
| `pane_created` / `pane_updated` | pane identity | Confirms a launch actually produced a pane. |
| `worktree_created` / `worktree_opened` / `worktree_removed` | **`workspace`** (`WorkspaceInfo`), **`worktree`** (`WorktreeInfo`) | Feeds D4 drift detection. `WorktreeInfo` = **`path`**, **`is_bare`**, **`is_detached`**, **`is_prunable`**, **`is_linked_worktree`**, **`label`**, plus `branch` and `open_workspace_id`. `is_prunable` is exactly the "drift detected" signal the spec wants surfaced without destructive cleanup. |
| `workspace_metadata_updated` | workspace identity + metadata | Pairs with `workspace.report_metadata`; a candidate carrier for the AgEnFK execution id on a workspace. |

`AgentStatus` (`#/schemas/event/$defs/AgentStatus`) — the full enum:

```
idle | working | blocked | done | unknown
```

## Integrations installed in T01

`herdr integration install claude` and `herdr integration install pi` were run.
See `docs/plans/environment.md` for exactly what each wrote to disk.
Both report `current (v8)` in `herdr integration status`.
