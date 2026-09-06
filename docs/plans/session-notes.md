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
- **Gate de verificação passou**: `npm run build && npm test` → 219 arquivos, 2.368
  testes passando, 1 skipped, `EXIT=0` (1.086s). Uma execução anterior da mesma árvore
  falhou em `packages/hub/src/test/admin-installations.test.ts` (hook `beforeEach`
  estourou 30s em 31.813ms); o arquivo passa isolado (5/5, 10,67s) e T01 não altera
  código-fonte. Registrado como BUG `ed5535ae-4bfd-4a78-b083-ae110545b98a`, não
  corrigido (`packages/hub` está fora do escopo de T01).
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

- **BUG `ed5535ae-4bfd-4a78-b083-ae110545b98a`** — flake em
  `packages/hub/src/test/admin-installations.test.ts`. `beforeEach` faz quatro
  operações de KDF de senha sem timeout explícito e `afterEach` fecha o banco com
  requisição ainda em voo (`database is not open`). Aparece sob carga: esta máquina
  roda a suíte 2,3–2,7× mais devagar que a linha de base de 407s do plano. Não elevar
  o `hookTimeout` global — isso esconde o vazamento.

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

---

# Session Notes — 2026-09-04 — Preparação do terreno + BUG `37660bd2` / BUG `2df0f02f`

Sessão de preparação, não uma task do plano. Rodou em Claude Opus 5 (1M).

## Concluído

- **T02 entregue de fato.** A branch estava com 7 commits e sem PR. PR
  [eduardopin/agenfk#2](https://github.com/eduardopin/agenfk/pull/2) aberto, registrado
  (`agenfk pr-register`, sizing `{task: 1}`) e squash-merged. `main` local avançou de
  `2b3761b6` para `3cc00bf3` por fast-forward de `fork/main`.
- **BUG `2df0f02f-7533-4733-b935-3a73f749fa22`** criado para a contradição C5, que até
  aqui só existia no log de contradições e não no board.
- **Os dois hazards de worktree fechados**, na branch
  `fix/37660bd2-a249-4e0e-977c-ace47df65fc3_project-root-boundary`
  (worktree `../agenfk-wt/hazards`):
  - `packages/server/src/project-root.ts` — resolução limitada ao repositório do
    chamador. Um marcador `.agenfk` só vale em ou abaixo do toplevel do git, e
    `os.homedir()` nunca vale. Sem marcador mas dentro de um repositório, o toplevel é
    a resposta — numa worktree, a raiz da worktree.
  - As duas cópias divergentes da busca (`server.ts` e `index.ts`, o entry point MCP)
    viraram uma só. `index.ts` passa `AGENFK_PROJECT_ROOT` / `AGENFK_DB_PATH` como
    opções. Deixá-lo de fora teria fechado o bug pela metade: tinha o mesmo escape.
  - O repoint de `project.projectRoot` deixou de ser silencioso — log no servidor e
    comentário no item. Repontar em silêncio era parte do defeito, não um detalhe.
  - `autoGitCommit` virou opt-in (`project.autoGitCommit`, ausente = desligado) e
    recusa qualquer raiz que não seja o toplevel de um repositório ou worktree, o
    diretório home incluído. Toda recusa é logada com o motivo.

## Decisões Tomadas

| # | Decisão | Consequência |
|---|---|---|
| 1 | Manter o orquestrador adiado para a Fase B | T03–T08 seguem como sessões supervisionadas, conforme `orchestrator-design.md` |
| 2 | Fechar os dois hazards **antes** do T03 | Viraram a primeira unidade de trabalho, com item próprio no board cada um |
| 3 | `findProjectRoot` cai no toplevel do git e loga o repoint | Alternativa recusada: erro explícito, que quebraria toda worktree até alguém criar `.agenfk/project.json` à mão — exatamente o workaround que se queria eliminar |
| 4 | `autoGitCommit` passa a ser opt-in, **default desligado** | Mudança funcional visível para todos os usuários do AgEnFK. Registrada no CHANGELOG como BREAKING (behaviour) |

## Revisão independente

A exit criteria do passo REVIEW exige revisor independente. Dois rodaram sobre o diff, cada um
verificando achados por execução contra fixtures git montadas para o caso, não por inferência.
13 achados: 10 aceitos e corrigidos em `043f6f28`, 3 recusados com motivo no corpo do commit.

Ambos chegaram ao mesmo blocker, que **esta branch criou** e não herdou:

1. **A resposta de DONE afirmava `"The server has auto-committed the changes"` incondicionalmente.**
   Com o default invertido isso virou mentira para todo projeto: um agente daria `git push` numa
   branch com o trabalho ainda unstaged e reportaria o item entregue. A mensagem agora deriva do
   resultado real e nomeia o motivo da recusa.
2. **O guard de `$HOME` comparava caminhos não resolvidos.** `projectRoot` chega realpath'd,
   `os.homedir()` não; com o home alcançado por symlink (`/home` → `/var/home`, bind mount, home
   cifrado) as strings diferem, o guard passa — e um home dotfiles é um toplevel git de verdade,
   então o guard seguinte passa também. `git add -A` no `$HOME`, através do guard escrito para
   impedi-lo.

Os demais: `$HOME` ainda retornado pelo ramo `git-toplevel`; submódulo resolvendo para o submódulo
(regressão para checkout comum, não só worktree); uma **terceira** cópia da busca em `packages/cli`
que a minha própria mensagem de commit dizia não existir; falhas de `git` indistinguíveis de "não é
repositório"; a rota nova mascarando toda falha de storage como 404 no **desligador** de uma feature
destrutiva; o comentário de repoint derrubando o request inteiro de validate; e o terceiro parâmetro
opcional, que permitiria desligar o auto-commit em silêncio ao reverter um call site.

Erro meu no caminho, pego pela suíte e não por mim: o `execSync` que adicionei no CLI poluía
`ui-open.test.ts`, que conta invocações de shell. Trocado por `execFileSync` — a forma correta de
qualquer modo.

## Próximos Passos

1. Worktree `../agenfk-wt/t03` + `npm ci`, branch
   `feature/7f8f6821-33d4-492d-8574-dd6b83faff98_t03-…`.
2. T03 conforme o card §5/T03, com `handoff-T02.md` §"What T03 must know" como entrada.
3. **Instalar esta versão** (`npm run install:framework`) antes do T03 se quiser que a worktree
   dispense o `.agenfk/project.json` à mão — o daemon em execução ainda é o anterior ao fix, e
   demonstrou isso ao vivo ao fechar estes dois itens, imprimindo "The server has auto-committed
   the changes" quando nada foi comitado.

## Riscos Ativos

- **O daemon em execução ainda roda a versão instalada globalmente**, não esta branch.
  Enquanto o fix não for instalado, fechar um item a partir de uma worktree continua
  sujeito ao comportamento antigo. Manter a árvore limpa na transição para DONE.
- **C11 e C13 seguem sem resposta do owner** — vínculo item↔branch e
  `agenfk tokens --item` retornando `[]`. O segundo derruba todo o modelo de medição
  do plano §3.

## Dívida Técnica Registrada

- **Opt-in não retroage.** Projetos que hoje dependem do auto-commit param de comitar
  até rodarem `agenfk update-project <id> --auto-git-commit true`. É o preço da
  decisão 4 e está no CHANGELOG, mas nada avisa o usuário na primeira transição para
  DONE depois do upgrade.
- **As guardas limitam *onde* o auto-commit acontece, não *o que* ele estagia.** Com
  o opt-in ligado, `git add -A` continua varrendo a árvore inteira na raiz do projeto.
  O auto-commit com escopo de worktree e ciente da execução continua sendo T07/T25.

---

# Session Notes — 2026-09-06 — Abertura do T03 (preparação, sem implementação)

## Concluído

- **Worktree `../agenfk-wt/t03` levada de `3cc00bf3` para `main` `74196dad`** por fast-forward.
  Estava dois commits atrás e portanto sem os fixes dos PRs #3 e #4 — os mesmos fixes que o
  card do T03 pressupõe.

- **Daemon atualizado por troca cirúrgica dos `dist`, não por `npm run install:framework`.**
  Rodar o instalador a partir do clone teria consequências que a decisão original não previa:
  `rootDir` é o próprio diretório de onde se roda, então o framework home viraria
  `/home/pin/projects/agenfk` — o CLI (`~/.local/bin/agenfk`) seria repontado para o checkout
  git, o daemon passaria a executar o `dist` de qualquer branch que estivesse na árvore, e com
  o `rulesScope: "project"` já gravado no config o bundle de regras sobrescreveria `AGENTS.md`,
  `.claude/CLAUDE.md` e `.cursor/rules/` **dentro do repositório**, sujando a `main`.
  O que de fato diferia entre o instalado e a `main` era só o código compilado:

  | | `~/.agenfk-system` (1.1.16) | repo `main` |
  |---|---|---|
  | versão declarada | 1.1.16 | 1.1.16 (os fixes são commits não liberados) |
  | dependências (root + 5 pacotes) | idênticas | idênticas |
  | `bin/` (hooks PreToolUse) | byte-idêntico | byte-idêntico |
  | `packages/*/dist` | anterior aos PRs #3/#4 | com os fixes |

  Então: `npm run build`, backup dos `dist` antigos em
  `~/.agenfk-system/.dist-backup-20260906-161729`, cópia dos cinco `dist`
  (`core`, `storage-sqlite`, `telemetry`, `cli`, `server`) e `agenfk restart --quiet`.
  `dbPath` preservado (`~/.agenfk-system/.agenfk/db.sqlite`), 47 itens intactos, board no ar.

- **Item T03 (`7f8f6821`) movido para IN_PROGRESS** e gatekeeper confirmado autorizando
  a partir da worktree.

- **`docs/plans/prompt-T03.md` escrito** — o prompt de kickoff que a memória do projeto dizia
  existir mas que nunca chegou ao disco.

## Decisões Tomadas

| # | Decisão | Consequência |
|---|---|---|
| 1 | Aplicar os fixes por troca de `dist` em vez de reinstalar | Mesmo efeito no comportamento do daemon, sem repontar CLI nem sobrescrever arquivos versionados. Reversível pelo backup |
| 2 | Preparar o T03 aqui e executá-lo em sessão nova | Cumpre o passo 0 do card (Opus 5 / xhigh / `/clear`) e deixa o envelope de 600k começar do zero |
| 3 | Medir o envelope por `/cost` no fim da sessão | `agenfk tokens --item` retorna `[]` e sempre retornou (BUG `71593e56`). Número por sessão, não por item |

## Riscos Ativos

- **`agenfk upgrade` desfaz o patch.** O CLI anuncia que 1.1.17 está disponível; a release
  publicada não contém os commits dos PRs #3/#4. Rodar o upgrade substitui o `dist` remendado
  pelo publicado e traz de volta os três defeitos. Vale até a próxima release da fork.

- **`agenfk --version` continua dizendo 1.1.16** — a versão declarada não distingue o daemon
  remendado do original. A única evidência da troca é este registro e o diretório de backup.

- **O texto do passo IN_PROGRESS do flow `agenfk-delivery` está desatualizado**: ainda manda
  criar `.agenfk/project.json` na worktree porque "`findProjectRoot` sobe até `$HOME`
  (BUG `37660bd2`)". O PR #3 fechou isso. O flow vive no servidor, não no repositório, então
  corrigi-lo é mudança de estado do board — fica para o owner decidir junto com o T03.

- **O gatekeeper é ambíguo neste projeto**: a story `7d83c768` (Phase A) está IN_PROGRESS junto
  com o T03, então toda chamada precisa de `--item-id`.

## Observado, não corrigido

- Matei o PID 81132 achando que era o daemon da API; era um servidor MCP stdio
  (`packages/server/dist/index.js`) de outra sessão cliente, no ar havia 1d9h. O daemon da API
  é `server.js`. Sem dano: o cliente respawna o MCP na próxima conexão. Fica registrado porque
  a distinção `index.js` (MCP stdio) vs `server.js` (API) não está em nenhum documento e é fácil
  de errar de novo.
