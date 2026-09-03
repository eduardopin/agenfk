# Handoff — T01 — Bootstrap: fork, dogfooding items, harness installs, hooks

**Date:** 2026-09-03 · **Delivery:** Bootstrap · **Plan card:** §5/T01
**AgEnFK item:** `1b55c410-c21c-4ae0-a3da-887ea17073df`
**Branch:** `feature/1b55c410-c21c-4ae0-a3da-887ea17073df_t01-bootstrap` (pushed to `fork`)
**Harness:** Claude Code `2.1.259` in Herdr pane `w1:p1`

---

## What shipped

| Deliverable | Where |
|---|---|
| The two contract documents, committed | `AGENFK_AUTONOMOUS_DELIVERY_MASTER_SPEC.md`, `AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md` (commit `98b78ee6`) |
| Project configured | `agenfkplus` `ef5f9e00-b80d-4f9a-9a82-846479156f2d`, `verifyCommand = npm run build && npm test`, description naming this plan |
| Item tree | 1 EPIC → 7 STORY (phases A–G) → 33 TASK (T01–T33) = 41 items, all created through the server |
| Item registry | `docs/plans/items.md` |
| Environment registry | `docs/plans/environment.md` |
| Session notes (Appendix C) | `docs/plans/session-notes.md` |
| Herdr schema snapshot | `docs/runtime/herdr-api-schema.json` — protocol **20**, 91 methods, 26 events, 255,484 bytes |
| Herdr notes | `docs/runtime/herdr.md` |
| Pi notes / D8 evidence | `docs/runtime/pi.md` |
| Kickoff prompt archived | `docs/plans/prompt-T01.md` |
| Herdr integrations | `claude` and `pi`, both `current (v8)` |
| Fork proven writable | branch pushed to `eduardopin/agenfk`; `origin` never touched |

Nothing under `packages/` was modified. Commits: `98b78ee6` (contracts), `64e3bca8` (docs).

## Deviations from the card

1. **Model and effort.** The card mandates **Sonnet 5 / medium**. The session started on
   **Opus 5 (1M) / high**, stopped at step 0, reported the mismatch, and the owner
   explicitly authorised proceeding on Opus 5. Consequence: **T01 is not a valid
   calibration point for the §3.5 cost table** (decision D11) — the first usable data
   points will be T02 and T03.
2. **Task branch created with plain `git`, not `agenfk branch create`.** Forced by
   finding #1 below, not a shortcut.
3. **Decision D5 (dogfooding mode) was already settled before T01 started.** The card
   offers `npm run install:framework` vs. server + CLI only; the framework was already
   installed globally (`1.1.17-beta.5`, enforcement hooks present in
   `~/.claude/settings.json`). T01 did not re-decide it.
4. **The optional courtesy issue to upstream was not opened.** The card marks it
   optional and the ISC licence requires no notice. Left to the owner.
5. **Trust dialog / plugin check.** Plan §2.2 lists accepting the trust dialog as
   pending; it is already accepted — the deterministic check (Appendix D) lists 46
   skills including 19 from the project-scoped plugins. Nothing to do.

## Findings

1. **Task branches cannot be registered on task items.** `agenfk branch create
   <task-id>` → *"Branches are tracked on top-level items only. Item [1b55c410] is a
   child of [7d83c768]."* Consistent with `SDLC.md` §2, incompatible with plan §2.3
   (one branch + worktree per task): the only top-level item is the epic and 33 tasks
   cannot share one `branchName`. **This is a public-contract question and needs an
   owner decision.** Options: (A) allow `branchName` on leaf items; (B) let
   `WorktreeBinding` (D4/T07) own the item↔branch link — recommended, since the master
   spec already points there. Until then task branches are created with `git` and
   recorded in `docs/plans/items.md` plus an item comment. Note the knock-on: the
   gatekeeper's branch auto-checkout does not fire for task items.
2. **No CLI path binds a project to a filesystem directory.** `update-project` accepts
   only `--name`, `--description`, `--verify-command`; `init` and `create-project`
   accept only a name and description; the project JSON returned by the server has no
   `projectRoot` field, though plan §1.1 lists one on the domain type. The binding
   exists solely as the gitignored `/home/pin/projects/agenfk/.agenfk/project.json`,
   which was already present and correct — so nothing was forced. Natural home:
   `agenfk project doctor` (T03).
3. **`agenfk tokens --item 1b55c410-… ` returns `[]`.** `SDLC.md` §0 rule 4 states token
   usage is captured automatically by the server-side ingestion worker; no events were
   attributed to this item during the session. Either ingestion needs a trigger this
   session did not provide, or attribution is not wired for this project. Directly
   relevant to **T29** (token-event attribution) and to the plan's own §3 measurement
   model, which assumes `agenfk tokens list --item <id>` works.
4. **Herdr gives a real lifecycle signal, not screen scraping.**
   `pane_agent_status_changed` carries `agent_status ∈ {idle, working, blocked, done,
   unknown}` with `pane_id` + `workspace_id`. `pane_agent_detected` carries `released`
   and `final_status` — clean exit vs. loss. `WorktreeInfo` carries `is_prunable`,
   which is precisely the "drift detected, do not clean" signal D4 wants. T20/T21 have
   their fixtures without inventing anything.
5. **A Herdr pane id is workspace-scoped** (`w1:p1`, with a separate `HERDR_TAB_ID`).
   An execution's runtime handle must carry workspace + pane, not the pane alone.
6. **Pi's machine default provider is `openai-codex` / `gpt-5.6-sol`,** not Anthropic.
   Any orchestrated Pi launch must pass `--provider` and `--model` explicitly.
7. **`pi --resume` is an interactive picker** and is not unattended-safe. `--session-id
   <id>` is the deterministic, create-if-missing variant an orchestrator wants — it
   lets AgEnFK mint the session id before launch. Recorded for T21 and for D5.
8. **Version drift in the plan**: Claude Code is `2.1.259`, not `2.1.233` (§2.6); and
   §2.2's "trust dialog still not accepted" is stale. Fix both in T02.
9. **`herdr integration install claude` edits the user-global Claude Code settings.**
   It appended a `SessionStart` hook to `~/.claude/settings.json`, so the hook now runs
   in every project on this machine. Inert outside a Herdr pane and reversible with
   `herdr integration uninstall claude`, but it is a change outside this repository and
   is called out rather than buried.

## Open questions for the owner

| # | Question | Blocks |
|---|---|---|
| — | **Item↔branch model** (finding 1): relax the top-level `branchName` constraint, or hand the link to `WorktreeBinding` in D4/T07? | T07; workaround in place until then |
| **D2** | ADR-0001 package layout — new packages per spec §31 vs. folders inside `server` | **T02** |
| **D9** | Zod 3 → 4 (open dependabot PR #159); which API subset new schemas may use | **T02** (decision), T09 (consumption) |
| **D8** | Pi provider configuration for LiteLLM — the route is documented (`~/.pi/agent/models.json`, `baseUrl` + `api: "openai-completions"`), but nothing was proven end-to-end. Recommendation: approve the direction, make the five unknowns in `docs/runtime/pi.md` acceptance criteria for T30, and unblock T21 against the direct `anthropic` provider | T21 (soft), T30 (hard) |
| **D11** | Envelope recalibration — T01 gives no usable data point because it ran on the wrong model tier | after T03 |

## Verification

Gate: the project `verifyCommand`, `npm run build && npm test`.

**Run 2 — clean, authoritative:**

```
npm run build   exit 0
Test Files  219 passed (219)
     Tests  2368 passed | 1 skipped (2369)
  Duration  1086.46s
     EXIT=0
```

Identical counts to the plan §1.4 baseline (219 files, 2,368 passed, 1 skipped).

**Run 1 — failed; recorded rather than suppressed:**

```
Test Files  1 failed | 218 passed (219)
     Tests  1 failed | 2367 passed | 1 skipped (2369)
  Duration  924.37s
     EXIT=1
```

`packages/hub/src/test/admin-installations.test.ts > "rejects non-admin viewer"` —
`beforeEach` hook timed out at **31,813 ms** against the 30,000 ms default, with an
unhandled `database is not open` rejection (`packages/hub/src/db/sqlite.ts:311` ←
`findUserByEmail` `packages/hub/src/auth/password.ts:29` ←
`packages/hub/src/routes/auth.ts:63`) attributed to the preceding test in the same
file.

Not caused by T01, and the evidence for that is threefold:

1. `git diff --stat main...HEAD` = **9 files, 14,426 insertions, all under `docs/`** —
   nothing under `packages/`, `scripts/` or `bin/`.
2. `npx vitest run packages/hub/src/test/admin-installations.test.ts` → **5 passed in
   10.67 s**, deterministically.
3. Run 2, unchanged tree, is green.

Diagnosis: `beforeEach` performs four password-KDF operations (`createPasswordUser`
×2, `loginAs` ×2) with no explicit hook timeout, and `afterEach` calls `await
ctx.db.close()` while a login request can still be in flight. The timeout and the
leaked rejection are almost certainly the same event, surfacing when the box is
loaded — run 1 took 924 s and run 2 took 1,086 s against a 407 s baseline, i.e. this
machine is running the suite 2.3–2.7× slower than when the baseline was taken.

Filed as **BUG `ed5535ae-4bfd-4a78-b083-ae110545b98a`**, not fixed: `packages/hub` is
outside this plan's touch list and T01 is explicitly forbidden from modifying
`packages/`. The bug carries the full diagnosis and a suggested fix direction, with
an explicit warning not to simply raise the global `hookTimeout`, which would hide
the leak.

**Other acceptance evidence:**

| Check | Result |
|---|---|
| `agenfk list --project ef5f9e00-…` | 1 EPIC + 7 STORY + 33 TASK = 41 items |
| `herdr status` | server running, protocol 20, socket `/home/pin/.config/herdr/herdr.sock` |
| `herdr integration status` | `pi: current (v8)`, `claude: current (v8)` |
| `herdr api schema --json` | captured, 255,484 bytes, protocol 20, 91 methods, 26 events |
| `pi --version` | `0.84.4` |
| `pi auth check --provider anthropic --json` | `{"status":"ready","provider":"anthropic","authType":"oauth"}` |
| Plugin check (Appendix D) | 46 skills, 19 from `superpowers:`/`tdd-workflows:`/`database-migrations:` |
| `git push fork` | new branch created on `eduardopin/agenfk`; `origin` never pushed to |

## Token usage

**`/cost` is a user-side slash command and cannot be invoked from inside the session, so
no `/cost` figure is available here.** Two things are reported instead, both labelled
for what they are:

- **`agenfk tokens --item 1b55c410-… ` returns `[]`.** `SDLC.md` §0 rule 4 says token
  usage is captured automatically by the server-side ingestion worker; nothing was
  attributed to this item. This is finding 3 above and it matters beyond T01: plan §3
  builds its whole measurement model on `agenfk tokens list --item <id>` working.
- **Harness context counter:** the session's remaining-token budget moved from
  15,000,000 to ≈14,868,000 over T01 — **≈132k tokens** cumulative (input + cached +
  output across all turns). Treat this as an order-of-magnitude proxy, not a `/cost`
  reading.

Against the card's **120k envelope**, ≈132k is a modest overrun, and the 450k split
trigger was never approached. Two full 15-minute test runs and the flake investigation
account for most of the delta.

Caveat that limits how much this number is worth: the session ran on **Opus 5 / high**
instead of the card's Sonnet 5 / medium, so it is not a valid calibration point for the
§3.5 cost table. **The owner should read D11 as still unanswered after T01.**

## Close-out

| Step (plan Appendix F) | Result |
|---|---|
| 1. Prove the Definition of Done | `npm run build && npm test` → 219 files, 2,368 passed, 1 skipped, exit 0; numbers commented on the item |
| 2. Close the item | `IN_PROGRESS → REVIEW → TEST → DONE`. The final transition ran the project `verifyCommand` server-side (validation run `b7c8acad`) and passed with the same counts |
| 3. Ship the PR | [eduardopin/agenfk#1](https://github.com/eduardopin/agenfk/pull/1), opened from the fork, registered with `agenfk pr-register` (sizing `{task: 1}`, model `claude-opus-5[1m]`, harness `claude-code`) |
| 4. Handoff | this file |
| 5. Registries | `docs/plans/items.md`, `docs/plans/session-notes.md` |
| 6. Next kickoff | T02 prompt emitted at the end of the session |

Note on contradiction **C5**: the server's `autoGitCommit` (`git add -A && git commit`
inside the validate handler on DONE) did not fire destructively here because the tree
was already clean at the moment of the transition. That is luck, not design — with a
dirty tree it would have swept unrelated files into a commit. It is exactly the race
T07/T25 must remove before parallel worktrees exist.

## What T02 must know

- The plan and spec are already committed on this branch; T02 branches from it (or from
  `main` after this PR merges) and will find them.
- **T02's item id is `3d4988dc-f52f-4623-8a55-d27b18de7e47`.** Move it to `IN_PROGRESS`
  and run `agenfk gatekeeper` before the first edit.
- From T02 onward every task runs in its own worktree (plan §2.3):
  `git worktree add ../agenfk-wt/t02 -b feature/3d4988dc-…_t02-ad0-a`. Registering that
  branch in AgEnFK will fail for the same reason as T01 — expected, not a new bug.
- T02 is gated on **ADR approval** as well as plan approval, and on owner decisions
  **D2** and **D9**. Per Appendix F, write the ADRs, stop, and ask before implementing
  what they decide.
- Fix the two stale facts in the plan (findings 8) while editing docs.
- The contradictions list to carry into `docs/architecture/CONTRADICTIONS.md` is plan
  §1.3 (C1–C10) **plus** findings 1, 2 and 3 above.
