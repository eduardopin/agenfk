# Session Notes — 2026-09-03 — T01

## Concluído

- **Projeto AgEnFK configurado**: `agenfkplus`
  (`ef5f9e00-b80d-4f9a-9a82-846479156f2d`) recebeu `verifyCommand`
  `npm run build && npm test` e uma descrição que aponta para o plano.
- **Árvore de itens criada** via servidor (única autoridade de estado, nenhuma
  escrita direta em SQLite): 1 EPIC → 7 STORY (fases A–G) → 33 TASK (T01–T33). Cada
  task carrega Delivery, Model, Effort, Envelope, Gate, Depends-on e ponteiro para o
  card. Ids em [`items.md`](items.md).
- **T01 autorizado**: item movido para `IN_PROGRESS`, `agenfk gatekeeper` retornou
  `AUTHORIZED (CODING)`. Nenhum arquivo foi editado antes disso.
- **Branch** `feature/1b55c410-c21c-4ae0-a3da-887ea17073df_t01-bootstrap` criado a
  partir de `main` (git puro — ver Riscos).
- **Documentos de contrato commitados** (`98b78ee6`): master spec + plano de
  implementação, para que todo worktree posterior já os tenha.
- **Integrações Herdr instaladas**: `claude` e `pi`, ambas `current (v8)`. O que
  mudou em disco está registrado em [`environment.md`](environment.md).
- **Snapshot da API do Herdr**: `docs/runtime/herdr-api-schema.json` (protocolo 20,
  91 métodos, 26 eventos) + notas em `docs/runtime/herdr.md`, incluindo o enum
  `AgentStatus` (`idle | working | blocked | done | unknown`) e o `WorktreeInfo` com
  `is_prunable` — matéria-prima de T20/T21 e da detecção de drift (D4).
- **Pi documentado** em `docs/runtime/pi.md`: 0.84.4, provider `anthropic` `ready`
  via OAuth, flags de sessão, diretório de extensões, e a resposta de D8 (LiteLLM
  entra por `~/.pi/agent/models.json` com `baseUrl` + `api: "openai-completions"`).
- **Registros**: `environment.md`, `items.md`, este arquivo, e `handoff-T01.md`.
- **Fork provado gravável**: branch empurrado para `fork` (`eduardopin/agenfk`).
  `origin` (upstream `cglab-public/agenfk`) não foi tocado.
- **Plugins de escopo de projeto carregam**: verificação determinística (Appendix D)
  listou 46 skills, 19 delas de `superpowers:` / `tdd-workflows:` /
  `database-migrations:`.

## Decisões Tomadas

- **Modelo/effort desta sessão**: executada em **Opus 5 (1M) / high** e não em
  Sonnet 5 / medium como manda o card. A sessão parou no STEP 0, reportou a
  divergência, e o owner autorizou explicitamente prosseguir em Opus 5. Registrado
  como desvio no handoff; recalibra D11.
- **Binding projeto↔diretório**: mantido como está (`.agenfk/project.json`, já
  presente e correto). O CLI não expõe flag para isso; nada foi forçado — virou
  finding para T02/T03.
- **Branch da task**: criado com `git` puro, já que `agenfk branch create` recusa
  itens filhos. Não foi contornado por baixo dos panos: virou finding com duas
  opções de resolução (ver Dívida Técnica).
- **D8 (Pi + LiteLLM)**: não bloqueia T21. A rota está documentada e o provider
  `anthropic` direto está pronto; a prova end-to-end vira critério de aceite de T30.

## Próximos Passos

1. **T02 — AD0-a** (`3d4988dc-f52f-4623-8a55-d27b18de7e47`), Opus 5 / xhigh,
   envelope 400k, em worktree próprio (a partir de T02 todo task usa worktree).
2. Antes de T02, o owner precisa responder **D2** (layout de pacotes do ADR-0001) e
   **D9** (Zod 3 → 4, PR dependabot #159).
3. T02 deve corrigir no plano: Claude Code é `2.1.259`, não `2.1.233`.

## Riscos Ativos

- **`~/.claude/settings.json` é global.** A integração do Herdr adicionou um hook
  `SessionStart` que agora roda em *todos* os projetos desta máquina. É inerte fora
  de um pane Herdr (`HERDR_ENV=1`) e reversível com
  `herdr integration uninstall claude`, mas é uma mudança fora do repositório.
- **Divergência de versão AgEnFK**: CLI global `1.1.17-beta.5` contra repositório
  `1.1.16`. Esperado (dogfooding), mas T03 mexe em storage — conferir que a fixture
  de upgrade cobre a versão que o CLI global usa.
- **Sessão em Opus 5 em vez de Sonnet 5** invalida T01 como ponto de calibração de
  custo para a tabela de §3.5.

## Dívida Técnica Registrada

- **Branch por task não é registrável no AgEnFK.** `SDLC.md` §2 restringe
  `branchName` a itens de topo; o plano §2.3 quer um branch por task. Opção A:
  permitir `branchName` em folhas. Opção B (recomendada): `WorktreeBinding` (D4/T07)
  passa a ser o dono do vínculo item↔branch. É mudança de contrato público — precisa
  de decisão do owner. Detalhado em [`items.md`](items.md).
- **Projeto não tem `projectRoot` exposto no CLI.** `update-project` só aceita
  `--name`, `--description`, `--verify-command`; o vínculo com o diretório vive só em
  `.agenfk/project.json` (gitignored). Candidato natural a `agenfk project doctor`
  (T03).
- **Plano desatualizado em dois pontos**: versão do Claude Code (§2.6) e a afirmação
  de que o diálogo de trust ainda não fora aceito (§2.2) — os plugins de projeto
  carregam, logo já está aceito.
