# Research — 011-token-optimization (verificação técnica pré-`/speckit-plan`)

**Autor**: devops · **Data**: 2026-07-18 · **Ambiente**: Windows 11 Pro (10.0.26200), PowerShell primário,
Git Bash (POSIX sh) disponível como ferramenta Bash.

**Objetivo**: transformar as incógnitas de mecânica de ferramentas (scope-brief §9.1–§9.3) em fatos verificados,
SEM instalar nada e SEM alterar configuração — a instalação real é tarefa da implementação. Cada achado traz a
evidência (comando + output, ou URL + trecho citado). Itens não confirmáveis sem instalar estão marcados
**A-VERIFICAR-NA-IMPLEMENTAÇÃO**.

> **Nota de versão**: o `README.md` do rtk cita "rtk 0.28.2" (defasado). A release corrente é **v0.43.0**
> (2026-06-28) — verificado via API. Onde README e CHANGELOG divergem, o CHANGELOG (mais novo) prevalece e o
> README é tratado como desatualizado.

---

## rtk (github.com/rtk-ai/rtk)

### Q1 — Hook per-project no Claude Code (vs `rtk init -g`)?

**Finding**: **SIM, suportado nativamente.** `rtk init` **sem** `--global`/`-g` instala o hook **apenas no
projeto** (project-level). `rtk init --global` é o modo global. Este é exatamente o mecanismo project-scoped que
o dono ratificou (Clarifications 2026-07-18).

**Evidence**:
- `docs/guide/getting-started/installation.md` (baixado de `raw.githubusercontent.com/rtk-ai/rtk/master`), seção
  "Project initialization": *"Run once per project to enable the Claude Code hook: `rtk init`"* e, logo abaixo,
  *"For a global install that patches `settings.json` automatically: `rtk init --global`"*.
- `CHANGELOG.md`, bloco `[Unreleased]`: *"Running `rtk init` without `--global` updates the **project-level hook
  only**. Users who skip this step keep the old hook working..."*
- README (tabela "Supported AI Tools"): Claude Code → método **"PreToolUse hook (bash)"**. Os agentes
  explicitamente project-scoped (windsurf/cline/kilocode/antigravity) usam `rtk init` **sem** `-g`, confirmando
  que a ausência de `-g` = escopo projeto.

**Onde escreve**: o `rtk init` (project) grava o hook PreToolUse no `.claude/settings.json` **do projeto** (o
mesmo arquivo que já hospeda o PostToolUse — ver Q5). O CHANGELOG registra "auto-patch settings.json" com
"preserve user content", i.e. faz *merge*, não overwrite.

**Alternatives considered**: hook PreToolUse manual escrito à mão no `.claude/settings.json` chamando
`rtk hook claude` — **não é necessário** porque o init nativo project-level já faz isso; fica como plano B se o
init nativo, no Windows, insistir em modo global/CLAUDE.md (ver Q1-open).

**Open items**:
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO**: confirmar por inspeção pós-`rtk init` (num settings de teste descartável) que
  o alvo é `<projeto>/.claude/settings.json` e que o merge preserva o bloco PostToolUse existente (não sobrescreve
  o arquivo). O CHANGELOG afirma preservação, mas queremos ver o diff real neste repo.

---

### Q2 — Onde vive a config no Windows? Global ou por projeto?

**Finding**: A doc oficial **não lista o caminho Windows** — só Linux (`~/.config/rtk/config.toml`) e macOS
(`~/Library/Application Support/rtk/config.toml`). O rtk é um binário Rust que usa a convenção do crate `dirs`,
então o esperado no Windows é **`%APPDATA%\rtk\config.toml`** (Roaming AppData =
`C:\Users\Jonatan\AppData\Roaming\rtk\config.toml`) — **a confirmar**. A config.toml principal é **global
(per-user)**; o suporte por-projeto é limitado a **`.rtk/filters.toml`** (DSL de filtros), não à seção `[hooks]`.

**Evidence**:
- `docs/guide/getting-started/configuration.md`, tabela "Config file location": só Linux e macOS listados
  (Windows ausente).
- Mesma doc, "Per-project filters": *"Create `.rtk/filters.toml` in your project root to add custom filters or
  override built-ins."* — ou seja, o override por-projeto documentado cobre **filtros**, não `exclude_commands`.
- `exclude_commands` é documentado sob `[hooks]` do `config.toml` **global**.
- Há o comando `rtk config` (mostra a config atual) e `rtk config --create` — a forma canônica de descobrir o
  caminho real no Windows é rodar `rtk config` após instalar.

**Implicação para o requisito `exclude_commands` (graphify/gh/curl)**: como `exclude_commands` mora no
`config.toml` **global (per-user)**, mexer nele afeta *todos* os projetos. Isso parece colidir com a decisão
project-scoped — **mas não colide na prática**: o **hook** só foi instalado neste projeto (Q1), então o
`exclude_commands` global só produz efeito onde o hook dispara = este repo. Ainda assim é uma config global no
disco do usuário. **A-VERIFICAR** se um `config.toml` colocado na raiz do projeto (ou `.rtk/`) é honrado para
`[hooks].exclude_commands`; se não for, documentar no ADR-0022 que o exclude vive na config global e é inócuo
fora deste repo por ausência de hook.

**Open items**:
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO**: caminho exato do `config.toml` no Windows via `rtk config` (esperado
  `%APPDATA%\rtk\config.toml`).
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO**: se `exclude_commands` aceita override por-projeto ou é estritamente global.

---

### Q3 — Caminho do tee no Windows

**Finding**: No Linux o tee grava em `~/.local/share/rtk/tee/` (= `dirs::data_dir()` / `XDG_DATA_HOME`). No
Windows a convenção `dirs` mapeia data_dir para **`%APPDATA%\rtk\tee\`** (Roaming) — **a confirmar**. O ponto
forte: **o caminho é sobrescrevível de forma determinística**, então não dependemos do default:
- env var **`RTK_TEE_DIR`**, ou
- config `[tee] directory = "..."`.

Também relevante para o requisito "failure-preservation": `[tee] mode` aceita `"failures"` (default), `"always"`,
`"never"`; `enabled=true` default; rotação `max_files=20`; só grava outputs ≥ 500 bytes, trunca acima de 1 MB.

**Evidence**:
- `docs/guide/getting-started/configuration.md`, seção "Tee system":
  `[full output: ~/.local/share/rtk/tee/1707753600_cargo_test.log]` e a tabela de settings
  (`tee.enabled`/`tee.mode`/`tee.max_files`, "Min size 500 bytes", "Max file size 1 MB").
- Mesma doc, "Environment variables": `RTK_TEE_DIR` — *"Override the tee directory"*; e comentário no bloco TOML:
  `# directory = "/custom/tee/path"  # optional override`.

**Open items**:
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO**: caminho default real no Windows (rodar um comando que falhe sob rtk e ler o
  path impresso). **Recomendação**: fixar `RTK_TEE_DIR` ou `[tee].directory` explicitamente para um caminho
  conhecido e gitignorado (ex. `<repo>/.rtk-tee/`) — remove a incógnita e torna o "escape hatch" de debugging
  descobrível pelos agentes (FR-004 exige path documentado).

---

### Q4 — Pré-requisito Windows: ripgrep (`rg`) no PATH

**Finding**: **PRESENTE.** `rg` está no PATH desta máquina.

**Evidence** (comando rodado):
```
$ rg --version
ripgrep 14.1.1 (rev f6d0fcd24a)
features:+pcre2 ...
```

**Open items**: nenhum. (Nota: o rtk é um binário Rust autocontido; o `rg` já é pré-requisito do próprio gate/
graph do repo, então mesmo que o rtk não dependa dele diretamente, o ambiente satisfaz o requisito.)

---

### Q5 — Interação com o hook PostToolUse existente (quality-gate.ps1)

**Finding**: **Sem conflito.** Eventos diferentes, matchers diferentes, mesmo arquivo (`.claude/settings.json`),
coexistindo como entradas independentes.

**Evidence** (`.claude/settings.json` local, lido):
- Existente: **`PostToolUse`**, matcher **`Edit|Write`** → `pwsh ... quality-gate.ps1`.
- rtk instala: **`PreToolUse`**, matcher **`Bash`** (README, tabela "Supported AI Tools": Claude Code =
  "PreToolUse hook (bash)"; "Scope note: this only applies to Bash tool calls").
- Eventos ortogonais (Pre vs Post) e matchers disjuntos (`Bash` vs `Edit|Write`) → não disputam a mesma tool
  call. Confirmado que hoje **não há** nenhum bloco `PreToolUse`/`rtk`/`graphify` no settings
  (`grep` retornou "none found"), então o init do rtk adiciona um bloco novo, não colide.

**Nuance a vigiar**: se algum dia `graphify claude install` for rodado, ele **também** escreve um hook
`PreToolUse` (lembrete graphify). Dois hooks `PreToolUse`+`Bash` coexistem como *array* no Claude Code, mas a
ordem importa (rtk reescreve o comando; graphify injeta lembrete). Hoje graphify está instalado só via seção no
CLAUDE.md (sem hook PreToolUse), então não há sobreposição. **Fora de escopo** de 011, mas registrado.

**Open items**:
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO**: após `rtk init`, reler `.claude/settings.json` e confirmar que o bloco
  PostToolUse (quality-gate) permaneceu byte-idêntico.

---

### Q6 — Instalação do binário no Windows + colisão de nome

**Finding**: Método recomendado no Windows = **binário pré-compilado** `rtk-x86_64-pc-windows-msvc.zip` (extrair
`rtk.exe` para um dir no PATH). `cargo install` é alternativa **mas exige URL git explícita** por causa da
colisão de nome no crates.io.

**Evidence**:
- Release **v0.43.0** (verificado via API) contém o asset **`rtk-x86_64-pc-windows-msvc.zip`**.
- `installation.md`: *"Windows users: Extract the zip and place `rtk.exe` in a directory on your PATH... do not
  double-click the `.exe`"*.
- **Colisão de nome** (`installation.md` + README linha 100): *"Two unrelated projects share the name `rtk`:
  Rust Token Killer (`rtk-ai/rtk`) — this project; Rust Type Kit (`reachingforthejack/rtk`) — a different tool."*
  `cargo install rtk` pode instalar o errado. Forma segura:
  `cargo install --git https://github.com/rtk-ai/rtk rtk`. Teste de sanidade: `rtk gain` deve mostrar stats (se
  falhar, é o pacote errado).

**Recomendação de método**: baixar o zip da release v0.43.0 e colocar `rtk.exe` em um dir do PATH (ex.
`C:\Users\Jonatan\.local\bin`) — evita toolchain Rust e a colisão do crates.io. Verificar com `rtk --version`
(esperar `rtk 0.43.0`) e `rtk gain`.

**Open items**:
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO — RISCO WINDOWS (o maior desta rodada)**: o modo **hook auto-rewrite** no
  Windows *nativo*. O README (defasado, v0.28.2) diz: *"On native Windows (cmd.exe / PowerShell), RTK falls back
  to CLAUDE.md injection mode — commands are not rewritten automatically"* (o `rtk-rewrite.sh` exige shell Unix).
  **Porém** o CHANGELOG (v0.43.0) mostra trabalho posterior de hook nativo Windows:
  - *"hooks: windows use 'rtk hook claude' no fallback"* (2 commits),
  - *"hooks: add regression test for windows native"*,
  - *"init-uninstall: uninstall removes --claude-md artifacts on Windows"*.

  Ou seja, na v0.43.0 o hook Windows delega para **`rtk hook claude`** (comando nativo, sem depender do `.sh`).
  **Além disso**, a ferramenta Bash do Claude Code **neste ambiente roda Git Bash (POSIX sh)** — então o
  `rtk-rewrite.sh` *poderia* rodar mesmo em "Windows". Qual dos dois caminhos o `rtk init` escolhe (delegador
  nativo vs `.sh` via Git Bash vs fallback CLAUDE.md) **precisa ser observado empiricamente** na implementação,
  porque é a diferença entre US2 filtrar de verdade (redução tokens/chamada) ou virar só injeção de instruções
  (sem filtragem automática). É o item de maior risco do épico e justifica o slice de homologação próprio da US2
  (raw-vs-filtered, FR-006).

---

## graphify

### Q7 — `graphify hook install`: o que escreve exatamente

**Finding**: `graphify hook install` instala hooks git **`post-commit` e `post-checkout`** (todos os platforms) —
**NÃO** `post-merge`. Subcomandos: `hook install` / `hook uninstall` / `hook status`. Também há um `merge-driver`
que o help descreve como "set up via hook install" (union-merge de `graph.json`).

**Evidence** (comandos rodados — versão local **graphify 0.9.12**):
```
$ graphify --help
  ...
  hook install            install post-commit/post-checkout git hooks (all platforms)
  hook uninstall          remove git hooks
  hook status             check if git hooks are installed
  ...
  merge-driver <base> <current> <other>  git merge driver: union-merge two graph.json files
                                         (set up via hook install)
```
(Nota: `graphify hook --help` sozinho não imprime detalhe — só `graphify --help` lista os subcomandos.)

**Merge-driver é irrelevante aqui**: o CLAUDE.md declara `graphify-out/` **gitignored** — não há `graph.json`
versionado para union-merge, então essa parte do `hook install` é inócua neste repo. O que importa é o
**post-commit** (refresh do grafo no commit).

**Mudança de comportamento a registrar (US3/ADR-0014)**: hoje o refresh dispara em **`post-merge`** (só em
merges para `develop`). O `graphify hook install` moveria para **`post-commit`** (todo commit, qualquer branch)
**+ `post-checkout`** (toda troca de branch). É mais frequente e adiciona ~20s por commit/checkout. Isso *fecha*
o gap de freshness que a US3 mira (o post-merge best-effort é pulado em ff-pull), mas troca "raro e às vezes
pulado" por "sempre, a cada commit". Tradeoff a decidir no plan.

**Open items**: nenhum bloqueante — `hook install` **não foi rodado** (conforme instrução). Comportamento exato
do script gerado (conteúdo do `.git/hooks/post-commit`) só é inspecionável após instalar → **A-VERIFICAR** o
conteúdo e a latência real do post-commit num teste descartável.

---

### Q8 — CONFLITO CRÍTICO: graphify hook git nativo vs lefthook

**Finding**: **Coexistem hoje, com segurança empiricamente comprovada** — mas há um risco residual. O lefthook
gerencia **`pre-commit`, `pre-push`, `post-merge`** (tipos definidos no `lefthook.yml`) e escreve arquivos
`.git/hooks/*` **nativos** (não usa `core.hooksPath`). O graphify escreveria `post-commit` + `post-checkout` —
**tipos diferentes, slots hoje vazios**. O `lefthook install` **não é destrutivo** com hooks de tipos que ele não
gerencia.

**Evidence**:
- `git config core.hooksPath` → **exit 1 (não definido)**: lefthook usa o `.git/hooks` default, escreve arquivos
  nativos.
- `.git/hooks/` (listado): existem `post-merge`, `pre-commit`, `pre-push`, `prepare-commit-msg` (não-samples).
  **`post-commit` e `post-checkout` NÃO existem** (`test -f` → NO para ambos) → slots livres para o graphify.
- **Prova empírica de que o lefthook não apaga hooks fora do config**: `.git/hooks/prepare-commit-msg` **é
  gerado pelo lefthook** (contém `call_lefthook run "prepare-commit-msg"`) **mas NÃO está no `lefthook.yml`
  atual** (que só tem pre-commit/pre-push/post-merge). Ele é um stub órfão que **sobreviveu a múltiplos
  `pnpm install`** — ou seja, `lefthook install` deixa hooks fora do seu config intactos. Logo, um `post-commit`
  do graphify **não seria apagado** pelo `lefthook install` que roda no `prepare` (`package.json` →
  `"prepare": "lefthook install"`, confirmado).
- `.gitattributes` atual **não** define merge-driver graphify; `git config --get-regexp '^merge\.'` → **none**.

**Portanto**: `graphify hook install` **sobrevive ao `pnpm install`** hoje, porque lefthook não gerencia
`post-commit`/`post-checkout` e é não-destrutivo.

**RISCO RESIDUAL**: se algum dia o `lefthook.yml` passar a declarar `post-commit` (ou `post-checkout`), o próximo
`lefthook install` **sobrescreveria** o hook do graphify com um stub `call_lefthook`, silenciosamente. Além
disso, com dois gerenciadores de hook (lefthook + graphify), o hook do graphify fica **invisível** no
`lefthook.yml` — um novo dev que só lê o `lefthook.yml` não sabe que ele existe.

**Alternatives considered (≥3, Principle VIII — decisão é do plan/dono, não infiro)**:

- **Opção A — `graphify hook install` (post-commit/post-checkout nativos).** *Prós*: é o mecanismo upstream que o
  dono ratificou; fecha o gap de freshness de forma determinística; sobrevive ao `pnpm install` hoje (comprovado).
  *Contras*: segundo gerenciador de hooks; invisível no `lefthook.yml`; clobber silencioso se `lefthook.yml`
  ganhar `post-commit`; refresh a **cada** commit/checkout (~20s). *Escalabilidade*: boa enquanto ninguém tocar
  post-commit no lefthook. *Confiança*: **80%** de que sobrevive ao ciclo atual; **60%** de que sobrevive a
  evoluções futuras do lefthook.yml sem uma salvaguarda documentada.

- **Opção B — registrar o refresh DENTRO do `lefthook.yml`** (um bloco `post-commit:` chamando
  `graphify update .`, ou reaproveitando/adaptando `scripts/graph-refresh.sh`). *Prós*: **gerenciador único**
  (lefthook), fonte única de verdade, visível em um lugar, sobrevive ao `pnpm install` por construção
  (regenerado do `lefthook.yml`), imune ao clobber. *Contras*: não usa o `hook install` upstream que o dono
  citou (exigiria emenda da decisão via Clarification datada); post-commit em todo commit tem o mesmo custo de
  ~20s; não instala o merge-driver (irrelevante aqui, graph.json é gitignored). *Escalabilidade*: melhor — um só
  ponto de manutenção. *Confiança*: **95%** de sobrevivência ao `pnpm install`.

- **Opção C — híbrido: `graphify hook install` como primário + guarda no `lefthook.yml`.** Rodar o
  `hook install` (honra a decisão ratificada) E adicionar uma nota/CI-check garantindo que `lefthook.yml` nunca
  declare `post-commit`/`post-checkout` (documentado no ADR-0022 como invariante). *Prós*: honra a decisão do
  dono e neutraliza o risco residual. *Contras*: mais peças; a invariante depende de disciplina/CI.
  *Confiança*: **85%**.

**Open items**:
- **A-VERIFICAR-NA-IMPLEMENTAÇÃO**: rodar `graphify hook install` num clone/teste descartável e depois
  `pnpm install`, confirmando que o `.git/hooks/post-commit` do graphify permanece intacto após o
  `lefthook install`.

---

### Q9 — Estado atual dos hooks git

**Finding** (tudo verificado):
- `git config core.hooksPath` → **não definido** (exit 1). Lefthook opera no `.git/hooks` default.
- `.git/hooks/` não-samples: **`post-merge`, `pre-commit`, `pre-push`, `prepare-commit-msg`** — todos
  `call_lefthook` (lefthook-gerados). `prepare-commit-msg` é **órfão** (não está no `lefthook.yml`).
- **`post-commit` e `post-checkout` ausentes** (slots livres p/ graphify).
- `post-merge` atual = stub lefthook que chama `call_lefthook run "post-merge"`, que por sua vez executa
  `lefthook.yml → post-merge → graph-refresh: sh scripts/graph-refresh.sh` (o mecanismo best-effort descrito no
  CLAUDE.md; ADR-0014).
- `lefthook.yml` gerencia: `pre-commit` (prettier+eslint staged), `pre-push` (`pnpm gate:all` +
  `check-migrations.sh`), `post-merge` (`graph-refresh.sh`).
- `package.json` → `"prepare": "lefthook install"` → **o `lefthook install` roda a cada `pnpm install`**.

**Evidence**: comandos e trechos citados em Q7/Q8 acima (mesma rodada).

---

## Recomendações para o plan

Estas são recomendações técnicas do devops; as escolhas de standard são do dono/arquiteto via ADR-0022
(Principle VIII). Onde há decisão, apresento a opção recomendada + confiança.

1. **rtk per-project (US2)** — usar **`rtk init` SEM `--global`** para instalar o hook PreToolUse só neste repo
   (grava em `<repo>/.claude/settings.json`, merge preservando o PostToolUse existente). Binário via
   **zip pré-compilado v0.43.0** (`rtk-x86_64-pc-windows-msvc.zip`) em dir do PATH — não `cargo install rtk`
   (colisão "Rust Type Kit"; se usar cargo, `--git https://github.com/rtk-ai/rtk`). `exclude_commands`
   (graphify/gh/curl) na seção `[hooks]` do config global — inócuo fora deste repo porque o hook só existe aqui;
   `tee.mode="failures"` + fixar `RTK_TEE_DIR`/`[tee].directory` para um caminho gitignorado conhecido (FR-004).
   Confiança de que o per-project funciona: **90%**. **Risco aberto que domina o slice**: se o hook auto-rewrite
   *não* ativar no Windows nativo (fallback CLAUDE.md), a filtragem automática não acontece — o plan deve incluir
   uma verificação empírica raw-vs-filtered (FR-006) como primeiro passo executável da US2, e o fallback
   `rtk hook claude`/Git Bash como contingência a testar.

2. **graphify refresh que sobrevive ao `pnpm install` (US3)** — recomendo a **Opção B (registrar o refresh no
   `lefthook.yml`)** como a mais robusta (gerenciador único, imune a clobber, visível), **OU** a **Opção A
   (`graphify hook install`)** — que o dono ratificou — **acompanhada da guarda da Opção C** (invariante
   documentada no ADR-0022: `lefthook.yml` nunca declara `post-commit`/`post-checkout`). Empiricamente, a Opção A
   sobrevive ao ciclo atual (lefthook é não-destrutivo — comprovado pelo `prepare-commit-msg` órfão), mas a
   Opção B remove o risco residual por construção. Como a US3 cita `hook install` explicitamente, se o plan ficar
   com A, registrar a escolha + a guarda como decisão datada. **Sub-decisão a resolver no plan**: post-commit
   (todo commit, ~20s) vs manter a granularidade post-merge — é uma mudança de comportamento, não só de
   mecanismo.

3. **Config exata proposta (a ratificar no ADR-0022)** —
   - rtk `config.toml` (global, `%APPDATA%\rtk\config.toml` *a confirmar via `rtk config`*):
     `[hooks] exclude_commands = ["graphify", "^gh", "^curl"]` · `[tee] enabled=true, mode="failures"` +
     `directory` fixado.
   - `.claude/settings.json` (projeto): bloco `PreToolUse`/`Bash` do rtk **somado** ao `PostToolUse`/`Edit|Write`
     existente (sem tocá-lo).
   - ADR-0014 emendado nomeando o novo mecanismo de refresh (post-commit graphify **ou** lefthook post-commit),
     com o procedimento manual/AI (`pnpm graph:update`) mantido como fallback documentado.

### Riscos novos descobertos (não estavam explícitos no brief)

- **R1 (alto) — hook auto-rewrite no Windows nativo pode não filtrar.** README (v0.28.2) diz fallback
  CLAUDE.md-injection no Windows; CHANGELOG (v0.43.0) mostra hook nativo via `rtk hook claude`. Divergência não
  resolvível sem instalar. Se cair no fallback, US2 entrega instrução, não filtragem → a economia tokens/chamada
  não se materializa automaticamente. **Deve ser o primeiro item verificado da US2.**
- **R2 (médio) — `exclude_commands` é global, não per-projeto.** A decisão project-scoped é honrada de fato
  (hook só existe aqui), mas a config de exclusão mora no disco per-user; documentar isso para não parecer
  violação da decisão (edge case já previsto no spec, mas a mecânica confirma que é config global).
- **R3 (médio) — clobber silencioso do hook graphify** se o `lefthook.yml` um dia ganhar
  `post-commit`/`post-checkout` (Opção A). Mitigado pela Opção B ou pela guarda da Opção C.
- **R4 (baixo) — mudança de cadência do refresh do grafo**: post-merge (raro) → post-commit (todo commit, ~20s).
  Fecha o gap de freshness da US3, mas adiciona latência recorrente ao commit; decidir conscientemente no plan.
- **R5 (baixo) — `prepare-commit-msg` órfão** no `.git/hooks` (lefthook-gerado, fora do `lefthook.yml`). Não é
  de 011, mas é ruído no diretório de hooks; oportunidade de limpeza (`lefthook install --force` ou remoção
  manual) fora do escopo.
