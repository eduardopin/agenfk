# Kickoff prompt — T01 (Bootstrap)

Operator pre-flight, before pasting the block below:

- Open a **new Herdr pane** in the `agenfk` workspace at `/home/pin/projects/agenfk`.
- Start Claude Code there and accept the **trust dialog** (project plugins and hooks are ignored until `hasTrustDialogAccepted` is set for this directory).
- `/model` → **Sonnet 5** · `/effort` → **medium** · `/status` to confirm · `/clear`.
- Paste everything inside the fence.

```text
You are executing task T01 — Bootstrap, of AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md
(repository root), which implements AGENFK_AUTONOMOUS_DELIVERY_MASTER_SPEC.md.

Work on T01 only. Do not start T02. Token envelope: 120k; split trigger 450k (plan §3).
Run this task on Sonnet 5 at effort medium (plan §3.5). Subagents: Haiku 4.5 or Sonnet 5 at low effort.

STEP 0 — confirm the session
Run /status and confirm the model is Sonnet 5 and effort is medium. If not, stop and tell me.
Report whether HERDR_PANE_ID is set in your shell (you should be inside a Herdr pane).

STEP 1 — read, in this order, nothing else
1. CLAUDE.md and AGENTS.md (repository rules; CLAUDE.md wins on conflict).
2. SDLC.md sections 0 to 2 (the enforcement mandate, item hierarchy, branch rules).
3. AGENFK_AUTONOMOUS_DELIVERY_IMPLEMENTATION_PLAN.md sections 1, 2, 3, 3.5, 6, and the T01
   card in section 5, plus Appendix A, B, C, F.
Use a subagent for anything wider. Do not read packages/ source in this task.

STEP 2 — verified starting state (do not redo, only confirm and report deviations)
- Working copy /home/pin/projects/agenfk, branch main, clean except two untracked files:
  the master spec and the implementation plan.
- Remotes: origin = cglab-public/agenfk (upstream, never push), fork = eduardopin/agenfk (push here).
- Herdr 0.8.2 server running, protocol 20, socket ~/.config/herdr/herdr.sock.
- Pi 0.84.4 installed; `pi auth check --provider anthropic` reports ready.
- Codex CLI installed.
- AgEnFK 1.1.17-beta.5 installed; server on port 3001; project `agenfkplus`
  id ef5f9e00-b80d-4f9a-9a82-846479156f2d exists, has no items and no verifyCommand.
- Baseline on this tree: npm run build exits 0; npm test = 219 files, 2368 passed, 1 skipped, ~407s.

STEP 3 — create the item tree, then authorize yourself
The repository forbids editing any file without an active item and a gatekeeper pass, so do this first:
a. `agenfk update-project ef5f9e00-b80d-4f9a-9a82-846479156f2d --verify-command "npm run build && npm test"`
   and give the project a description naming this plan. Check `agenfk init --help` and
   `agenfk create-project --help`; if the CLI can bind the project to /home/pin/projects/agenfk,
   do it; if it cannot, record that as a finding instead of forcing it.
b. Create the EPIC: "Autonomous Delivery (master spec v1.0)".
c. Create one STORY per phase, children of the epic: Phase A AD0, Phase B Durable Execution,
   Phase C AD1-AD5, Phase D AD6-AD7, Phase E AD8-AD10, Phase F AD11-AD12, Phase G AD13.
d. Create one TASK per plan task T01..T33 under its phase story. Each task's title is the card
   title from plan section 4; each description carries: the card's Model, Effort, Envelope, Gate,
   Depends on, and a pointer to the card ("plan section 5, card Tnn"). Script the loop; do not
   hand-type 33 commands.
e. Move the T01 task to the first working step and run
   `agenfk gatekeeper --intent "T01 bootstrap" --item-id <T01-id>`. Only now may you edit files.
f. Record every id in docs/plans/items.md.

STEP 4 — branch
T01 runs in the main clone, not a worktree, because it must commit the two untracked contract
documents. From T02 onward every task uses its own worktree (plan section 2.3).
Create `feature/<T01-item-id>_t01-bootstrap` from main.

STEP 5 — do the work
1. Commit the two contract documents (master spec and implementation plan) to the branch first,
   so every later task and worktree has them.
2. `herdr integration install claude` and `herdr integration install pi`; verify with
   `herdr integration status` (check the exact subcommand with --help). Report what each
   integration changed on disk.
3. `herdr api schema --json > docs/runtime/herdr-api-schema.json` and record the protocol number
   in docs/runtime/herdr.md, together with the socket path, the method namespaces you can see in
   the schema, and the event names relevant to a scheduler (pane/agent status, worktree).
4. docs/runtime/pi.md: Pi version, provider readiness per `pi auth check --provider anthropic`,
   the session flags (--continue, --resume, --session), the extension directory, and where a
   LiteLLM/OpenAI-compatible base URL would be configured. This is the evidence for open
   decision D8 in plan section 8 — state clearly what is confirmed and what is still unknown.
5. docs/plans/environment.md: exact versions of Claude Code, Codex, Herdr, Pi, Node, npm, AgEnFK,
   the AgEnFK server port and DB path, the project id, and the fork/origin remotes.
6. docs/plans/session-notes.md from Appendix C of the plan, filled for this session.
7. Prove the fork is writable: push the branch to `fork`, confirm, and keep it (the PR uses it).
   Never push to origin.

STEP 6 — verify and close
- Run `npm run build && npm test` and paste the summary numbers into the item with `agenfk comment`.
- Walk the item through the flow with `agenfk verify <T01-id> --evidence "..."`, where the evidence
  states what was proven with numbers, not adjectives.
- Open the PR from the fork with `gh pr create --repo eduardopin/agenfk --base main --head <branch>`,
  using the PR body template in Appendix B.

STEP 7 — hand off (mandatory, plan Appendix F)
- Write docs/plans/handoff-T01.md: what shipped, deviations from the card, findings, open questions,
  and your /cost total.
- Then, as the last thing in your final message, print inside one fenced block the complete kickoff
  prompt for T02, built from the T02 card (section 5) and Appendix A, with every placeholder filled:
  task id, title, delivery, envelope, model, effort, spec sections, must-read files, and the T02
  item id you created. Above the fence, state in one line the model and effort I must select before
  pasting it, and name the owner decisions from plan section 8 that block T02 (D2 and D9).
- Stop. Do not begin T02.

CONSTRAINTS (non-negotiable)
- The AgEnFK server is the single state authority; never write to SQLite directly.
- No file is edited without an active item and a gatekeeper pass.
- Never push to origin; never force-push; never reset, clean, stash, or force-checkout a dirty tree.
- No secrets in code, docs, commits, or logs. The verify token and installation id are secrets.
- Do not modify anything under packages/ in this task; T01 touches only docs/, .claude/settings.json
  (local), git remotes, and AgEnFK state.
- Commit messages end with: Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
- PR descriptions end with: 🤖 Generated with [Claude Code](https://claude.com/claude-code)
- Stop and ask if: the working tree is unexpectedly dirty or divergent, a public contract of AgEnFK
  would change, an owner decision from section 8 is needed, or you cross 450k tokens before the
  build and tests are green.
- Report honestly: if a step fails or is skipped, say so with the output. Never claim completion
  from reasoning alone.
```
