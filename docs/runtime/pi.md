# Pi runtime notes

Captured during **T01 — Bootstrap** on 2026-09-03. Pi is the *secondary harness*
(plan §2.6) and the subject of task **T21 (AD6-c, Pi `HarnessAdapter`)**.

This document is the evidence for **open decision D8** (plan §8): *"Pi provider
configuration for LiteLLM/OpenAI-compatible routes."* The **Confirmed** and
**Still unknown** sections at the bottom state exactly what T01 proved and what it
did not.

## Version and package

| Property | Value |
|---|---|
| Version (`pi --version`) | `0.84.4` |
| Package | `@earendil-works/pi-coding-agent@0.84.4` (npm global) |
| Licence | MIT |
| Install root | `/home/pin/.nvm/versions/node/v22.23.1/lib/node_modules/@earendil-works/pi-coding-agent` |
| Entry point | `dist/bundle/cli.js` |
| Bundled docs | `<install root>/docs/` — `providers.md`, `models.md`, `sessions.md`, `extensions.md`, `settings.md`, `rpc.md`, `json.md`, `security.md`, `llama-cpp.md` |
| Agent home | `~/.pi/agent/` |

## Provider readiness

```
$ pi auth check --provider anthropic
ready

$ pi auth check --provider anthropic --json
{"status":"ready","provider":"anthropic","authType":"oauth"}
```

**Anthropic is ready via OAuth** (a Claude subscription login, not an API key). The
credential lives in `~/.pi/agent/auth.json`; that file is a secret and is never read,
copied, printed or committed by this plan.

Current defaults in `~/.pi/agent/settings.json`:

```json
{ "theme": "dark", "defaultProvider": "openai-codex", "defaultModel": "gpt-5.6-sol" }
```

So the machine-wide default is **not** Anthropic — any Pi execution launched by the
orchestrator must pass `--provider anthropic --model <pattern>` explicitly rather
than relying on the ambient default. Recorded for T21.

Credential resolution order (`docs/providers.md`): CLI `--api-key` → `auth.json`
entry (API key or OAuth token) → environment variable → custom-provider keys in
`models.json`.

## Session flags (D5 / resume-relevant)

| Flag | Meaning |
|---|---|
| `--continue`, `-c` | Continue the previous session in this working directory. |
| `--resume`, `-r` | Interactive picker to select a session to resume. **Interactive — not usable unattended.** |
| `--session <path\|id>` | Use a specific session file or a partial session UUID. |
| `--session-id <id>` | Use an *exact* project session id, **creating it if missing**. This is the flag an orchestrator wants: it is deterministic and idempotent, so the execution id can be minted by AgEnFK before launch. |
| `--fork <path\|id>` | Fork an existing session into a new one. Candidate for checkpoint-branching in D2. |
| `--session-dir <dir>` | Override the session storage/lookup directory — lets an execution keep its transcript inside its own worktree. |
| `--no-session` | Ephemeral, nothing saved. |
| `--name`, `-n <name>` | Session display name. |

Storage: sessions auto-save to `~/.pi/agent/sessions/`, organised by working
directory (this machine currently has one bucket, `--home-pin--`). Each session is a
**JSONL file with a tree structure**. `/session` in interactive mode prints the
current session file, session id, message count, tokens and cost.

Other flags that matter to the launch contract (§14) and to A0–A4 side-effect policy
(§17): `--print/-p` (non-interactive), `--mode text|json|rpc`, `--thinking
off|minimal|low|medium|high|xhigh|max` (Pi's equivalent of Claude Code effort),
`--no-tools`, `--no-builtin-tools`, `--tools <allowlist>`, `--exclude-tools
<denylist>`, `--approve/-a` and `--no-approve/-na` (trust of project-local files),
`--no-context-files` (disables `AGENTS.md`/`CLAUDE.md` discovery), `--offline`.

`--mode rpc` (documented in `docs/rpc.md`) is the machine-facing transport and is the
first candidate for the T21 adapter rather than parsing terminal text.

## Extensions

| Property | Value |
|---|---|
| User extension directory | `~/.pi/agent/extensions/` |
| Installed today | `agenfk.ts` (14,630 bytes — the AgEnFK Pi extension shipped by this repo as `bin/agenfk-pi-extension.ts`), `herdr-agent-state.ts` (6,602 bytes — installed by `herdr integration install pi` in T01, `HERDR_INTEGRATION_VERSION=8`) |
| Management commands | `pi install <source>`, `pi remove/uninstall <source>`, `pi list`, `pi config`, `pi update [source\|self\|pi]` |
| Ad-hoc loading | `--extension/-e <path>` (repeatable), `--no-extensions/-ne` |
| Docs | `<install root>/docs/extensions.md` (3,020 lines) and `docs/custom-provider.md` |

Extensions can register additional CLI flags, which is how `plan-mode` adds `--plan`.

## Where a LiteLLM / OpenAI-compatible base URL is configured — D8

**Answer: `~/.pi/agent/models.json`.** There is no `--base-url` CLI flag and no
`baseUrl` key in `settings.json`. `models.json` is the single declarative place a
custom or proxied provider is defined, quoting `docs/models.md`:

> Add custom providers and models (Ollama, vLLM, LM Studio, proxies) via
> `~/.pi/agent/models.json`.

Provider-level configuration keys: `baseUrl` (the API endpoint URL), `api` (the wire
protocol), `apiKey`, `headers`, `oauth`, `models`, `modelOverrides`.

Supported `api` values include **`openai-completions`** (OpenAI Chat Completions —
"most compatible", and the one LiteLLM's proxy exposes), `openai-responses`,
`anthropic-messages`, `google-generative-ai`, `azure-openai-responses`.

A LiteLLM proxy is therefore declared as an ordinary custom provider:

```jsonc
// ~/.pi/agent/models.json  — shape taken from docs/models.md
{
  "providers": {
    "litellm": {
      "baseUrl": "http://localhost:4000/v1",
      "api": "openai-completions",
      "models": [ /* … */ ]
    }
  }
}
```

Two further facts from `docs/models.md` that T30 (AD11-b, LiteLLM route correlation)
will need:

- **Built-in providers can be overridden** ("Overriding Built-in Providers"): giving
  `anthropic` a `baseUrl` of `https://my-proxy.example.com/v1` routes the existing
  provider through a proxy without inventing a new provider name. That is the
  cheapest way to put LiteLLM in front of the already-working Anthropic OAuth path —
  **but see the unknown below, because the credential is OAuth, not an API key.**
- **Custom headers** are supported per provider, and `api: "anthropic-messages"`
  accepts a `compat` block for proxies that are not byte-exact.
- `apiKey` is not required for the file to load; models appear but stay unavailable
  in `/model` and `--list-models` until auth is configured.
- Values may be resolved from shell commands at request time, with **no** built-in
  TTL, stale reuse or recovery logic — pi says so explicitly. Any command-sourced
  credential is therefore the orchestrator's problem to cache and rotate.

## Confirmed in T01 (evidence-backed)

1. Pi `0.84.4` is installed and on `PATH`; MIT licensed.
2. `pi auth check --provider anthropic` returns `ready`, `authType: oauth`.
3. The machine default provider/model is `openai-codex` / `gpt-5.6-sol`, **not**
   Anthropic — Pi executions must set `--provider` and `--model` explicitly.
4. Session control flags exist and are as tabulated above; `--session-id` is the
   deterministic, create-if-missing variant suitable for unattended orchestration,
   while `--resume` is an interactive picker and is **not** unattended-safe.
5. Sessions are JSONL trees under `~/.pi/agent/sessions/`, bucketed by working
   directory, and `--session-dir` can relocate them per worktree.
6. Extensions live in `~/.pi/agent/extensions/`; both `agenfk.ts` and the
   Herdr-installed `herdr-agent-state.ts` (v8) are present.
7. An OpenAI-compatible base URL — i.e. LiteLLM — is configured **only** in
   `~/.pi/agent/models.json`, as a provider with `baseUrl` + `api:
   "openai-completions"`; built-in providers can be redirected the same way.

## Still unknown after T01 (D8 remains open)

1. **Not executed end-to-end.** No LiteLLM instance exists on this machine yet (the
   plan defers it to T30), so no `models.json` was written and no request was routed
   through a proxy. Everything in the section above is read from the vendored
   `docs/models.md` and `docs/providers.md` of the installed 0.84.4 package, not
   observed.
2. **OAuth-through-proxy is unproven.** The working Anthropic credential is an OAuth
   token, not an API key. Whether overriding the built-in `anthropic` provider's
   `baseUrl` still forwards that OAuth bearer to a LiteLLM proxy — and whether
   LiteLLM accepts it — is untested. `pi auth print-bearer-token --provider <p>`
   exists and would hand the token to an external client, which is one possible
   bridge, but it means an agent handling a live bearer token: a security decision
   for T31, not a mechanical one.
3. **No `models.json` schema validation was run.** The exact accepted top-level shape
   (`providers` vs. a flat map) was inferred from doc excerpts; T30 must validate it
   against a real file before depending on it.
4. **Cost/usage attribution through a proxy is unverified.** `/session` reports tokens
   and cost for a direct provider; whether those figures survive a LiteLLM hop is the
   crux of T30's route correlation and was not tested here.
5. **`--mode rpc` was not exercised.** It is the likely adapter transport for T21 but
   T01 only read its documentation.

**Recommendation to the owner for D8:** approve the direction — *LiteLLM is wired via
`~/.pi/agent/models.json` as an `openai-completions` provider* — and treat items 1–5
as acceptance criteria for T30, not blockers for T21. T21 can build the Pi
`HarnessAdapter` against the direct `anthropic` provider, which is confirmed ready
today.
