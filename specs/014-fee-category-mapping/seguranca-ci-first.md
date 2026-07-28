# Parecer de segurança — retificação proposta do ADR-0010 Part 3 (CI-first nos dois marketplaces)

**Autor**: `seguranca` · **Data**: 2026-07-24 · **Branch**: `014-fee-category-mapping` · **Tipo**: parecer bloqueante, read-only
**Objeto**: substituir Cloud Run Job + Cloud Scheduler + Cloud NAT + GCP Secret Manager por **GitHub Actions agendado
com self-hosted runner no Brasil**, para Amazon **e** Mercado Livre.
**Escopo**: eixos 1–5 do briefing do dono. Não decide nada (Princípio VIII) — recomenda com confiança declarada.

---

## Veredito em uma linha

**REPROVO a retificação na forma proposta.** A parte "GitHub Actions agendado" é boa e o próprio ADR-0010 já a
abençoa (3C, para chamadas sem geo-gate). A parte **"self-hosted runner"** é que carrega o risco, e num repositório
**PÚBLICO** ela é **impedimento**, não pré-condição de sequenciamento: é execução de código arbitrário de
desconhecidos numa máquina que precisa co-habitar com a credencial OAuth da conta-casa do ML. Tornar o repo privado
**reduz** o risco a "aceitável-com-condições", mas **não** o elimina, e não é o que estava sendo comprado.

E o achado que reenquadra a discussão de custo: **o dinheiro do ADR-0010 Part 3 não está no Secret Manager nem no
Cloud Run Job — está no Cloud NAT.** A retificação ataca os componentes que custam centavos e assume 100% do risco
novo. Ver §5.

---

## 0. Evidência coletada nesta sessão (fatos, não inferência)

| # | Fato | Como foi obtido |
|---|---|---|
| E1 | Repositório **PÚBLICO**, `forks: 0`, dono com `admin: true` | `gh api repos/FreeSoulsDotBat/3dprecify` |
| E2 | Política de aprovação de PR de fork = **`first_time_contributors`** (o default fraco) | `gh api .../actions/permissions/fork-pr-contributor-approval` |
| E3 | `allowed_actions: "all"`, **`sha_pinning_required: false`** | `gh api .../actions/permissions` |
| E4 | `ci.yml` dispara em **`pull_request` sem qualificação** (todo fork PR roda CI), hoje em `ubuntu-latest` | `.github/workflows/ci.yml:6` |
| E5 | 10 actions de terceiros, **todas por ref mutável**; `trufflesecurity/trufflehog@main` é **branch**, não tag | `grep uses:` em `.github/workflows/` |
| E6 | O `permissions:` do `GITHUB_TOKEN` **não tem escopo `secrets`** (lista verificada: actions, artifact-metadata, attestations, checks, code-quality, contents, deployments, discussions, id-token, issues, models, packages, pages, pull-requests, security-events, statuses, vulnerability-alerts) | docs.github.com — workflow-syntax `#permissions` |
| E7 | `PUT /repos/{o}/{r}/actions/secrets/{name}` exige collaborator access; "OAuth tokens and personal access tokens (classic) need the **repo** scope to use this endpoint" | docs.github.com — REST Actions Secrets |
| E8 | GitHub, verbatim: *"We recommend that you only use self-hosted runners with **private** repositories. This is because forks of your public repository can potentially run dangerous code on your self-hosted runner machine by creating a pull request that executes the code in a workflow."* | docs.github.com — self-hosted runners / manage access |
| E9 | GitHub, verbatim: *"Self-hosted runners for GitHub do not have guarantees around running in ephemeral clean virtual machines, and can be **persistently compromised** by untrusted code in a workflow."* | docs.github.com — secure-use / Hardening for self-hosted runners |
| E10 | O repo **já executa OIDC→GCP WIF keyless** (`google-github-actions/auth@v2`) | `.github/workflows/deploy.yml:36-41` |
| E11 | O `gh` CLI está autenticado nesta máquina de desenvolvimento com permissão **admin** sobre o repo | as chamadas `gh api` acima retornaram `permissions.admin: true` sem prompt |

Nota metodológica: tentei enumerar arquivos de credencial no perfil do usuário (`~/.ssh`, gcloud ADC, token do `gh`)
para dimensionar o raio de dano do eixo 3; **a ação foi bloqueada pelo classificador de permissões** e não foi
contornada. Por isso os itens do §3 que dependem disso estão marcados `[INFERIDO]`. E11, porém, é evidência direta e
suficiente: **existe um token GitHub com admin sobre este repositório gravado nesta máquina.**

---

## 1. Eixo 1 — Self-hosted runner + repositório PÚBLICO

### SEC-014-01 · **BLOQUEANTE** · RCE não-autenticado na máquina do runner `[VERIFICADO]`

**Cadeia de ataque concreta, sem nenhum passo exótico:**

1. Qualquer pessoa da internet forka `FreeSoulsDotBat/3dprecify` (público, E1).
2. No fork, edita **o próprio `.github/workflows/ci.yml`** — trocando `runs-on: ubuntu-latest` por
   `runs-on: self-hosted` e acrescentando um `run:` arbitrário — e abre um PR. Isso funciona porque o evento
   **`pull_request`** (E4), diferente de `pull_request_target`, executa os workflows **da versão do head do PR**,
   não da base. O atacante controla o YAML **e** o comando.
3. O primeiro PR dele cai na aprovação manual (E2, `first_time_contributors`). Ele abre então um PR
   **trivialmente legítimo** — corrigir um typo no README —, o dono aprova/mergeia, e a partir daí **ele deixa de
   ser first-time contributor**: todos os PRs seguintes rodam **sem nenhuma aprovação**. A porta é de uso único e
   abre para sempre.
4. O código roda como o usuário do serviço do runner, na máquina do dono, na rede do dono.

Isto é exatamente o cenário que a própria GitHub descreve em E8. Não é risco teórico nem "depende da configuração":
é a recomendação primária e explícita do fornecedor da plataforma, contra a configuração proposta.

**Por que "primeiro PR precisa de aprovação" não é mitigação:** ela custa um clique do dono, uma vez, e é
irreversível na prática (não existe "desaprovar contribuidor"). Um atacante paciente paga esse preço. O ajuste
correto, se este caminho for adiante, é `approval_policy: all_external_collaborators` — mas isso só move o problema
para fadiga de aprovação: o dono vira o único controle de segurança, revisando YAML linha a linha sob a pressão de
"é só um typo".

### SEC-014-02 · **ALTA** · RCE na máquina do runner **sem nenhum fork PR**, via cadeia de suprimento `[VERIFICADO]`

`allowed_actions: all` + `sha_pinning_required: false` (E3) + 10 actions por ref mutável (E5), das quais
`trufflesecurity/trufflehog@**main**` é uma **branch**. Comprometida a conta de qualquer um desses publishers — ou
apenas movida a tag `v4`/`v5`/`main` —, o código novo executa no próximo run de CI. Em `ubuntu-latest` isso é grave
mas **efêmero e isolado**: a VM morre, não há credencial do dono ali, e o `GITHUB_TOKEN` do PR é read-only. No
runner self-hosted **na máquina do dono**, a mesma cadeia vira **implante persistente numa máquina pessoal**.

Este achado é independente do eixo 1: torna-se o repo privado e ele **continua de pé**. É a razão pela qual
"tornar o repo privado" não é solução completa.

### Resposta direta à pergunta do eixo 1

> *Isto é pré-condição de sequenciamento ou impedimento?*

**Impedimento, na configuração proposta (repo público + máquina pessoal).** Confiança **95%**.
Tornar o repo privado **rebaixa** SEC-014-01 de BLOQUEANTE para MÉDIA (fecha o vetor "qualquer um da internet";
sobra "qualquer colaborador com push" — hoje só o dono) e **não toca** SEC-014-02. Ou seja: privacidade do repo é
**pré-condição necessária e não suficiente**. A condição suficiente é o runner ser **efêmero e descartável**, nunca
a máquina de trabalho do dono (§5, Opção D).

---

## 2. Eixo 2 — Raio de dano: GCP Secret Manager (WIF) × GitHub Secrets

| Dimensão | Secret Manager + WIF (ADR-0010 hoje) | GitHub Secrets (proposto) |
|---|---|---|
| **Credencial longeva em repouso** | **Nenhuma.** WIF/OIDC troca uma asserção de curta duração por um token efêmero. Não existe chave de service account a vazar. | O refresh token do ML **+ um PAT** (SEC-014-03). Duas credenciais longevas onde havia zero. |
| **Quem consegue ler** | Só a identidade WIF do job, com IAM `secretAccessor` naquele único secret. | Qualquer coisa que execute **dentro do contexto do workflow** naquele runner. Fork PR **não** recebe secrets — mas ver SEC-014-04. |
| **Auditoria de leitura** | **Cloud Audit Logs** por acesso: identidade, timestamp, versão. | **Nenhuma.** GitHub não registra leitura de secret por workflow. Um vazamento é indetectável a posteriori. |
| **Versionamento / rollback** | Nativo. Versões anteriores recuperáveis. | **Inexistente.** Secret é write-only e não versionado. |
| **Escopo do dano se comprometido** | O refresh token do ML. Uma conta de marketplace. | O refresh token do ML **e** o PAT — cujo escopo excede em muito o do secret que ele existe para rotacionar. |

### SEC-014-03 · **ALTA** · A rotação exige um PAT — credencial longeva ADICIONAL e de escopo maior `[VERIFICADO]`

O ML **rotaciona o refresh token no uso** (o próprio ADR-0010 Part 3 registra: *"the job persists the rotated refresh
token back to Secret Manager each cycle"*). No modelo GitHub Secrets, gravar o token rotacionado de volta exige
`PUT /repos/{o}/{r}/actions/secrets/{name}`, e:

- O `permissions:` do `GITHUB_TOKEN` **não possui escopo `secrets`** — E6, lista completa verificada. **O
  `GITHUB_TOKEN` não pode escrever um Actions secret, em nenhuma configuração.**
- O endpoint exige collaborator access; PAT clássico precisa do escopo **`repo`** (E7).

Consequência inevitável: para rotacionar, é preciso guardar **um PAT dentro de um GitHub Secret**. E o raio de dano
desse PAT é **maior** que o do segredo que ele protege:

- **PAT clássico com `repo`**: leitura e escrita em **todos os repositórios** da conta `FreeSoulsDotBat`, incluindo
  push para `develop` deste repo → o que dispara CI → e, pelo caminho de deploy, alcança a infraestrutura.
- **PAT fine-grained** restrito a este repo com `Secrets: write`: **muito melhor**, e é o mínimo aceitável se este
  caminho for adiante — mas continua (a) longevo, (b) sem MFA no uso, (c) com expiração que, ao vencer, quebra a
  rotação silenciosamente, e (d) armazenado no mesmo cofre que ele tem permissão de reescrever (auto-referência:
  quem rouba o PAT reescreve qualquer secret do repo, inclusive `WIF_PROVIDER`, `FIREBASE_SERVICE_ACCOUNT` e os
  segredos de pagamento do E6/ADR-0023).

**Veredito do eixo 2:** a migração **inverte** a postura. Sai-se de *zero credencial longeva* — o ganho central do
WIF, e a razão de ele existir no ADR-0004/0005 — para *duas*, sendo uma de escopo superior ao ativo protegido.
Regressão mensurável, não empate. Confiança **90%**.

### SEC-014-04 · **MÉDIA-ALTA** · Fork PR não recebe secrets, mas **espera** por eles `[INFERIDO ~85%]`

É correto e deve ser dito na absolvição: workflows disparados por `pull_request` **de fork não recebem secrets**, e
o `GITHUB_TOKEN` deles é read-only. A retificação não expõe o token do ML diretamente a um PR hostil.

O problema é **co-residência temporal**. O run agendado mensal (`on: schedule`, que executa a partir da branch
default — propriedade boa: um fork PR não altera o que o job agendado faz) **injeta o refresh token do ML e o PAT no
ambiente do mesmo runner**. Um implante deixado por um fork PR três semanas antes (SEC-014-01) dorme e colhe:
`Runner.Worker` é um processo local, o ambiente do job é legível por qualquer processo do mesmo usuário, e o
mascaramento de segredo do GitHub protege **o log**, não a memória.

**Cenário concreto:** dia 3, o fork PR planta uma tarefa agendada que dumpa o ambiente de `Runner.Worker`. Dia 1 do
mês seguinte o job de ingestão roda; o atacante fica com o refresh token do ML **e** com o PAT. Com o PAT ele comita
valores de comissão adulterados no `catalog.json` — e o gate humano do PR não vê nada, porque com o mesmo PAT ele
pode empurrar direto para `develop`. Não há alerta: não existe log de leitura de secret no GitHub.

### SEC-014-05 · **MÉDIA** · A rotação no GitHub Secrets é uma armadilha de **disponibilidade** `[INFERIDO ~80%]`

Secret não versionado + write-only + rotação-no-uso = uma falha parcial de escrita, um PAT expirado no momento
errado, ou uma gravação corrompida **perdem o único refresh token válido de forma irreversível**. O ML já invalidou
o anterior no momento do uso; o novo não foi persistido; **não há versão anterior para restaurar**, porque o GitHub
não versiona secrets nem permite lê-los. Recuperação = refazer manualmente o fluxo OAuth authorization-code na
conta-casa. No Secret Manager o mesmo incidente é um `gcloud secrets versions access` de uma versão anterior.

Achado **específico da retificação**: não existe no desenho atual. Não é hipotético — rotação-no-uso é exatamente o
padrão em que "gravar o novo segredo" é um passo crítico e não-idempotente.

---

## 3. Eixo 3 — Superfície do runner self-hosted em si

### SEC-014-06 · **ALTA** · Persistência entre jobs e contaminação de workspace `[VERIFICADO — E9]`

GitHub, verbatim: *"do not have guarantees around running in ephemeral clean virtual machines, and can be
**persistently compromised** by untrusted code in a workflow"* (E9). Concretamente, no modo padrão (não-efêmero):

- O diretório `_work/` **não é limpo** entre jobs. Um PR hostil envenena `node_modules/`, o store do pnpm, o venv do
  `uv` ou `.git/hooks/` — e o run agendado seguinte, que **tem** o segredo, executa o payload.
- O repo roda `pnpm install --frozen-lockfile` (pnpm 11). O lockfile é imutável no PR, mas o **store/cache do pnpm no
  disco do runner não é** — é território do atacante.
- O arquivo `.credentials` do runner guarda a credencial OAuth de registro do próprio runner: roubá-la permite
  **buscar jobs** como se fosse o runner.
- A doc da GitHub manda perguntar explicitamente (E9): *"what sensitive information resides on the machine? For
  example, private SSH keys, API access tokens"* e *"does the machine have network access to sensitive services?"*.

### SEC-014-07 · **BLOQUEANTE se a máquina for a pessoal do dono** · Raio de dano fora do repositório `[INFERIDO ~85%]`

Não consegui enumerar o perfil do usuário (o classificador bloqueou, e não contornei). Mas **E11 é evidência direta**:
o `gh` CLI está autenticado nesta máquina com `admin: true` sobre o repositório. Um job comprometido rodando como o
usuário do dono lê esse token do disco e obtém **administração do repositório** — o que inclui reescrever todos os
secrets, desabilitar branch protection, e mergear o próprio PR envenenado. **O gate humano do §4 morre aqui.**

Somam-se a isso, com alta plausibilidade nesta máquina de desenvolvimento (`[INFERIDO ~85%]`, não verificado): chave
SSH do git (o remote é `git@github.com:` → push em qualquer branch), ADC do `gcloud`, credenciais do Firebase, os
segredos do E6/Mercado Pago (ADR-0023), perfis de navegador, e **acesso irrestrito à LAN doméstica** (roteador, NAS,
qualquer serviço sem autenticação na rede local). Nada disso está no modelo de ameaça de "reusar um processo
existente para economizar".

**Uma máquina que guarda a credencial de admin do repositório e a chave de assinatura do trabalho do dono não pode
ser, ao mesmo tempo, o alvo de execução de código de terceiros.** Vale para repo público **e** privado; privado
apenas troca "terceiros anônimos" por "cadeia de suprimento de actions e dependências" (SEC-014-02).

---

## 4. Eixo 4 — O que NÃO muda: absolvições (com uma ressalva que importa)

Absolver com evidência vale tanto quanto achar buraco.

### ABS-1 · Gate humano por PR — **preservado arquiteturalmente, MAS condicionado à integridade do runner** `[VERIFICADO com ressalva]`

Abrir um PR pelo GitHub Actions precisa de `contents: write` + `pull-requests: write` no `GITHUB_TOKEN` — escopos que
existem (E6) e são limitados a este repositório. `on: schedule` executa o workflow **da branch default**, então um PR
de fork não consegue alterar o que o job agendado faz. A política Q-A do ADR-0010 ("abre PR, nunca auto-merge") é
implementável **igualmente bem** nos dois runtimes. **Absolvido no desenho.**

**A ressalva, substantiva:** o gate humano é um controle de **integridade de conteúdo** e pressupõe que quem produz o
diff e quem publica são processos íntegros. Sob SEC-014-04/07 o atacante controla o diff **e** tem caminho de push
direto — o gate vira teatro. Ou seja: *o gate por PR sobrevive à retificação, mas deixa de ser suficiente*, porque no
desenho atual ele se apoiava numa base de execução isolada (Cloud Run Job) que a retificação remove. **Não conte o
gate humano como mitigação dos achados acima; ele é downstream deles.**

### ABS-2 · Fail-safe (falha ⇒ nenhum PR) — **preservado** `[VERIFICADO]`

É propriedade do **código do job** (`try/except` → não abre PR → alerta), não do runtime. O SC-806 do brief
(*"an empty or drastically-shrunk parse is treated as a failure, not as a fee change"*) é asserção de código e migra
intacta. **Absolvido, sem ressalva de desenho** — com duas notas: (a) num runner comprometido nenhuma asserção de
código significa nada; (b) em GitHub Actions **um job agendado que nunca roda não gera alerta nenhum**, então é
preciso um sinal de liveness explícito. Isto é exatamente o argumento do Q7=(a) do brief — o PR mensal de
`lastReviewed` é o batimento cardíaco. Sem ele, fail-safe silencioso vira falha silenciosa.

### ABS-3 · "O token nunca é exposto ao cliente" — **preservado, integralmente** `[VERIFICADO]`

O cliente não participa desta cadeia em nenhum dos dois desenhos. `GET /api/v1/fee-catalog` é público, não
autenticado, e serve o artefato commitado (ADR-0010 R3/R6=a); o token do ML só existe no runtime de ingestão. Além
disso o secret-scan da CI (gitleaks + trufflehog, `ci.yml:128`) guarda contra o token vazar para o repositório —
guarda **ainda mais crítica** com o repo público. **Absolvido.**

### ABS-4 · Bônus — a Amazon em GitHub Actions **não é** a retificação, e é boa `[VERIFICADO]`

O ADR-0010 Part 3 já diz, na rejeição da opção 3C: *"a scheduled workflow remains fine for non-API curation chores
that make no geo-gated call"*. A Amazon é exatamente isso: página pública, sem OAuth, sem conta-casa, **sem nenhum
segredo**, sem exigência de egress BR (pendente da verificação de ~65% no §9.1 do brief). Rodá-la num runner
**hospedado pela GitHub** é custo zero real, risco marginal zero, e **não precisa de ADR novo — já está aprovado**.
É o Q6=(a) do brief. **Se o dono quer "custo zero e reuso de processo existente", metade do objetivo já está
autorizada, hoje, sem nenhum risco novo.**

---

## 5. Eixo 5 — Alternativas, com o preço dito

Ordenadas por relação segurança/custo. Estimativas de preço marcadas — **verificar na calculadora GCP no plan round**.

### O reenquadramento de custo que muda a conversa `[INFERIDO ~70%, verificar]`

Decomposição mensal estimada do ADR-0010 Part 3 como está:

| Componente | Custo/mês estimado | A retificação elimina? |
|---|---|---|
| **Cloud NAT** (gateway ~US$0,044/h + processamento) | **~US$32** | sim |
| **IP externo estático reservado** | ~US$3,50 | sim |
| Cloud Scheduler (3 jobs/mês são gratuitos) | ~US$0 | sim, sem ganho |
| Cloud Run Job (12 execuções x ~5 min, dentro do free tier) | ~US$0 | sim, sem ganho |
| **Secret Manager** (US$0,06/versão/mês + US$0,03/10k acessos) | **~US$0,07** | sim — e é o único item cuja remoção **compra risco** |

**~97% do custo é Cloud NAT + IP estático.** A retificação, do jeito proposto, remove ~US$0,07/mês de Secret Manager
e assume em troca SEC-014-01 até 07. **Esse é o preço explícito, e ele é ruim.** O alvo certo do corte de custo é o
NAT — e o NAT é necessário **só para o ML**.

### Opção A — **Split assimétrico** (recomendada): Amazon 100% no Actions hospedado; ML mínimo no GCP

- Amazon: workflow agendado em `ubuntu-latest`. **Zero segredo, zero infra, zero egress BR, custo zero.** Já
  autorizado pelo ADR-0010 (ABS-4); não precisa de emenda.
- ML: mantém Secret Manager (WIF, sem credencial longeva) — os ~US$0,07/mês que ninguém deveria querer economizar.
- **Segurança preservada integralmente.** É literalmente o Q6=(a) do brief §10 (~80% de recomendação do
  product-owner). **Confiança 88%.**

### Opção B — **Medir se o Cloud Run Job em `southamerica-east1` já passa o geo-gate SEM VPC/NAT** (maior alavanca)

O ADR-0010 escolheu NAT para obter um **IP estático** BR. Mas o geo-gate do ML, como o próprio ADR o descreve, é **por
país do IP**, não por allowlist. Se o egress default do Cloud Run em São Paulo já geolocaliza como BR, **o NAT inteiro
é desnecessário** e o custo do caminho ML cai para ~US$0,10/mês — **a motivação da retificação evapora sem abrir mão
de nada.**

- Confiança de que passa: **~50%** (genuinamente incerto — faixas de IP do Google às vezes geolocalizam fora do país
  da região). **Não decidir com base nisso; medir.**
- Custo de medir: uma tarde, **depois** que a conta-casa do ML existir (Q3 = SIM, decidido em 2026-07-24).
- **Melhor relação custo/risco de todas as opções. Deve ser item explícito do plan round.**

### Opção C — GitHub Actions hospedado + **OIDC/WIF -> Secret Manager**

O repo **já faz isso** (E10, `deploy.yml`). Elimina Cloud Run Job e Scheduler, mantém zero credencial longeva e
**resolve SEC-014-03 e SEC-014-05 de uma vez** (a rotação grava uma nova *versão* no Secret Manager via WIF; sem PAT,
com auditoria e rollback). Custo ~US$0,07/mês.
**Limitação honesta: não resolve egress BR.** Serve para a Amazon, ou para o ML **se** B der positivo.
**Confiança 85%** de que é a forma correta de fazer "CI-first" sem regressão de postura.

### Opção D — Runner self-hosted **efêmero/JIT em VM descartável no BR** (se o dono insistir no self-hosted)

VM `e2-micro` em `southamerica-east1` (~US$7 a 8/mês `[INFERIDO ~65%]` — note: **mais barato que o Cloud NAT**),
runner registrado em modo efêmero/JIT, destruída após cada job. Neutraliza SEC-014-06 (sem persistência) e
SEC-014-07 (não é a máquina do dono). **Condições não-negociáveis, todas juntas:**

1. **Repositório PRIVADO antes** de o runner existir (fecha SEC-014-01);
2. VM **descartável e recriada por execução** — a doc da GitHub avisa (E9) que reusar hardware para hospedar runners
   JIT pode expor informação do ambiente;
3. VM em **projeto GCP isolado**: sem ADC do dono, sem chave SSH do dono, sem rota para a LAN doméstica;
4. o segredo **continua no Secret Manager via WIF** — nunca em GitHub Secrets (senão SEC-014-03/05 voltam);
5. `sha_pinning_required: true` e actions fixadas por SHA (fecha SEC-014-02).

**Preço honesto:** ~US$7 a 8/mês **mais** a operação de manter a automação de ciclo de vida do runner. Se você já tem
uma VM BR, rodar o script direto nela (cron) é mais simples que orquestrar via Actions — o que sugere que, chegando
até aqui, o Cloud Run Job do ADR-0010 já era a resposta certa. **Confiança 70%** de que D é aceitável; **90%** de que
dá mais trabalho que A+B.

### Opção E — **REPROVADA sem alternativa**: self-hosted na máquina pessoal do dono, com ou sem repo privado

Confiança **95%**. Nenhum ganho de custo justifica SEC-014-07.

---

## 6. Achados independentes desta decisão (corrigir de qualquer forma)

| ID | Sev. | Achado | Remediação mínima |
|---|---|---|---|
| SEC-014-02 | ALTA `[VERIFICADO]` | `trufflesecurity/trufflehog@main` — action de terceiro por **branch mutável**; mais 9 por tag mutável; `sha_pinning_required: false` | Fixar `trufflehog` por SHA imediatamente; depois as demais; ligar `sha_pinning_required: true` |
| SEC-014-08 | MÉDIA `[VERIFICADO]` | `allowed_actions: "all"` num repositório público | Restringir a `selected` com a allowlist explícita já em uso |
| SEC-014-09 | BAIXA `[VERIFICADO]` | Sem `.github/dependabot.yml` — nenhuma atualização automatizada de dependência/action | Adicionar os ecossistemas `github-actions` + `npm`/`pip` |
| SEC-014-10 | MÉDIA `[INFERIDO ~80%]` | `approval_policy: first_time_contributors` (E2) — um PR trivial aprovado libera o contribuidor **para sempre** | Enquanto o repo for público: `all_external_collaborators`. **Obrigatório** se qualquer runner self-hosted existir |

---

## 7. O que o dono precisa decidir (Princípio VIII — opções, não decisão)

1. **Visibilidade do repositório.** Tornar privado **antes** de qualquer runner self-hosted é pré-condição
   inegociável. Independente disso, é a decisão de maior alavancagem disponível hoje, e já era intenção declarada.
2. **Onde roda a Amazon.** Recomendo GitHub Actions hospedado — já autorizado pelo ADR-0010, custo zero, sem segredo.
   **Não requer emenda ao ADR.** (Confiança 88%.)
3. **Onde roda o ML.** Recomendo: (i) **medir** a Opção B assim que a conta-casa existir; (ii) se passar, Cloud Run
   Job sem NAT (~US$0,10/mês) ou Opção C; (iii) se não passar, escolher entre pagar o NAT (~US$35/mês) ou a Opção D
   com as 5 condições. (Confiança 80%.)
4. **Onde vive o segredo do ML.** Recomendo **Secret Manager em qualquer cenário** — custa ~US$0,07/mês e é o único
   componente cuja remoção compra risco (SEC-014-03/04/05). Migrar para GitHub Secrets exige aceitar formalmente: um
   PAT longevo de escopo superior, zero auditoria de leitura, e a perda irreversível do token numa falha de rotação.
   (Confiança 90%.)
5. **Se ainda assim quiser GitHub Secrets**, isso precisa de um **ADR de exceção** com as três aceitações acima
   escritas e, no mínimo: PAT fine-grained restrito a este repo com `Secrets: write` **apenas**, lembrete de
   expiração em calendário, e um runbook de re-autorização OAuth para o cenário SEC-014-05.

---

## Conclusão

A retificação mistura uma boa ideia (Amazon em CI agendada — já aprovada, custo zero) com duas regressões de postura
(runner self-hosted; segredo saindo do Secret Manager). **Bloqueio a segunda metade; endosso a primeira.** O custo
que motivou a proposta está no **Cloud NAT**, não nos componentes que a proposta remove — e há um caminho, mensurável
em uma tarde (Opção B), capaz de entregar quase todo o "custo zero" pretendido **sem tocar em nada da segurança**.

**Não fabrico nem um buraco nem um atestado de saúde**: o gate humano por PR, o fail-safe e o "token nunca chega ao
cliente" **estão preservados** na proposta, e digo isso com evidência — mas o gate humano deixa de ser *suficiente*,
porque ele se apoiava num isolamento de execução que a retificação remove.

**Recomendação: A + B, com C como contingência. Confiança 85%.**

---

## 8. Reconciliação com a "Amendment 2026-07-24" do arquiteto (lida DEPOIS de redigir §1–7)

Ao fechar o parecer descobri que `docs/adr/0010-…md` já carrega, na árvore de trabalho (não commitada), a
**Amendment 2026-07-24 — Part 3 ingestion runtime**, escrita pelo arquiteto, que roteia explicitamente **QA2
(custódia), QA3 (repo público) e QA4 (de quem é a máquina)** para `seguranca`. Registro a leitura tardia por
honestidade de processo — e ela **muda o enquadramento do meu veredito para melhor**, porque a emenda **não escolhe
self-hosted incondicionalmente**.

### 8.1 Correção do meu próprio enquadramento (duas)

**Correção 1 — o self-hosted é condicional, não escolhido.** A emenda escolhe **3D (runner hospedado pela GitHub)**
para Amazon (88%) e para ML **somente se G1 passar**; **3E (self-hosted BR)** entra **apenas se G1 falhar**. Portanto
**SEC-014-01 e SEC-014-07 não bloqueiam a emenda inteira — bloqueiam exclusivamente o ramo 3E.** Meu veredito
permanece idêntico em conteúdo e fica mais estreito em alcance. Isso importa operacionalmente: **rodar G1 antes de
discutir runner elimina a chance de o bloqueio sequer ser necessário.**

**Correção 2 — subestimei o deferimento de provisionamento.** Minhas Opções A/B/C do §5 pressupõem GCP disponível. A
decisão permanente de **2026-07-09 (provisionamento + primeiro deploy DEFERIDOS até v1 = E1–E6)** significa que
3A/3F **não podem executar** sem reverter uma decisão separada do dono. Isso **não muda** minha leitura de risco (a
postura de credencial do Secret Manager continua estritamente superior), mas **muda o custo real** da minha
recomendação: ela não é "de graça", ela cobra uma reversão parcial de decisão. Devo dizer isso, e digo.

**Sub-pergunta que o dono precisa responder e que eu não posso responder por ele:** habilitar **apenas Secret Manager
+ WIF pool** num projeto GCP (sem Cloud Run, sem Scheduler, sem VPC, sem NAT — ~US$0,07/mês) conta como
"provisionamento" sob o deferimento de 2026-07-09? A pegada é ~5% da do 3F. **Não presumo a resposta** (Princípio
VIII); registro que a resposta decide o QA2.

### 8.2 Convergência independente — G1 é a mesma alavanca que eu identifiquei

Cheguei sozinho, pela via do custo (§5, Opção B), à mesma conclusão que o arquiteto alcançou pela via da evidência
(§A1.3): **o geo-gate do ML nunca foi medido**, e o único 403 observado foi `PolicyAgent` numa chamada **anônima** —
o que prova apenas que o caminho não-autenticado está morto. O desenho de **duas pontas** do G1 (mesmo token, mesmo
minuto, braço de controle a partir de egress BR) é **melhor que o meu** e o endosso sem ressalva: sem o braço de
controle, um 403 não prova nada. **Endosso G1 como pré-condição de qualquer decisão sobre runner. Confiança 90%.**

**Acréscimo meu — G1b (se G1 falhar, não pule para uma máquina).** G1 falhando prova que **egress não-BR** é
bloqueado. **Não prova** que o egress default do Cloud Run em `southamerica-east1` **sem VPC/NAT** falha — que é o
meu §5 Opção B. Testar isso custa uma execução e pode eliminar tanto o Cloud NAT (~US$32/mês) quanto o runner
self-hosted. **Sequência correta: G2 → G1 → (se falhar) G1b → só então QA4.**

**Acréscimo meu — G3, a medição que o ADR-0010 exige desde 2026-07-06 e nunca foi feita: o ML realmente rotaciona o
refresh token, e o token antigo permanece válido?** Esta medição **decide o QA2 sozinha** (§8.3). É barata, é
pré-requisito escrito, e ambos — arquiteto (§A5) e eu (SEC-014-03/05) — construímos raciocínio em cima de uma
suposição não verificada. **Não decida a custódia antes do G3.**

### 8.3 Resposta ao **QA2 — custódia do refresh token do ML**

Ordenada, e **condicionada ao G3**:

- **(c) GitHub Secrets SEM write-back — RECOMENDADA *se* G3 mostrar que o token antigo sobrevive ao uso.**
  Neste mundo **SEC-014-03 e SEC-014-05 evaporam por completo**: sem write-back não há PAT, não há segunda
  credencial longeva, não há perda irreversível. Sobra um refresh token longevo num Actions secret — criptografado em
  repouso, mascarado em log, **não entregue a PR de fork** — que é postura **normal e defensável** para um job
  hospedado e efêmero. **Confiança 85% de que é aceitável, condicionada ao G3.**
- **(c') Variante manual, se o ML rotacionar mas com validade longa.** Sem write-back; o job **alerta** quando a
  autenticação falha, e o dono atualiza o secret à mão e re-dispara por `workflow_dispatch`. Custa toil humano
  (provavelmente 1 a 2 toques por ano), custa **zero** credencial nova, e o fail-safe já garante que a falha é
  travamento silencioso, nunca corrupção. **Confiança 75%.** Exige runbook.
- **(b) Secret Manager via OIDC→WIF — a postura tecnicamente superior**, e a que eu escolheria sem a restrição de
  provisionamento: zero credencial longeva, versionamento (rollback do SEC-014-05), auditoria de leitura. Custo
  ~US$0,07/mês **mais** a resposta à sub-pergunta do §8.1. **Confiança 90% na postura; a viabilidade é decisão do
  dono, não minha.**
- **(a) GitHub Secrets + PAT/App para write-back — DESACONSELHADA.** É SEC-014-03 na íntegra: segunda credencial
  longeva, de escopo superior ao ativo protegido, guardada no mesmo cofre que ela pode reescrever, sem auditoria de
  leitura e sem rollback. Se for escolhida mesmo assim, o mínimo é **GitHub App** (token de instalação de vida curta)
  em vez de PAT, ou PAT fine-grained com `Secrets: write` **apenas** neste repo, lembrete de expiração em calendário
  e runbook de re-autorização OAuth. **Confiança 88% de que existe opção melhor.**

**Ordem recomendada de decisão: G3 → se o token antigo sobrevive, (c). Senão (b), se o dono liberar o Secret Manager
mínimo; senão (c'); (a) só como último recurso, com ADR de exceção.**

### 8.4 Resposta ao **QA3 — implementar a metade ML antes de o repo ficar privado?**

Recomendo **(c)**, não (a) — e isto **libera trabalho** em vez de travá-lo. Confiança **85%**.

| Peça | Repo público hoje | Justificativa |
|---|---|---|
| Amazon (3D hospedado, **sem segredo**) | **LIBERADO, sem ressalva** | nenhum segredo, runner efêmero da GitHub, PR de fork não alcança nada. Comece por aqui. |
| ML em **3D hospedado** + custódia (b)/(c)/(c') | **LIBERADO** | o perigo documentado pela GitHub (E8) é específico de **self-hosted**. Runner hospedado é efêmero e descartado; PR de fork **não recebe secrets**. Absolvido. |
| ML em **3D hospedado** + custódia **(a), com PAT** | **NÃO liberado enquanto público** | o PAT amplia o raio para toda a conta, e o repo público maximiza a superfície de PR hostil |
| ML em **3E self-hosted** | **BLOQUEADO** — repo privado é pré-condição, e não é suficiente (SEC-014-02) | E8/E9 verbatim |

### 8.5 Resposta ao **QA4 — de quem é a máquina, se G1 falhar**

- **(b) a workstation do dono: REPROVADO.** SEC-014-07 + E11 (há um token GitHub com **admin** sobre este repo
  gravado nesta máquina). Confiança **95%**. Não é negociável por economia.
- **(a) VPS BR pequeno: aceitável somente com as 5 condições da Opção D (§5)** — repo privado, runner **efêmero/JIT**
  com host recriado por execução, projeto/rede isolados, segredo **fora** do disco do runner, actions fixadas por SHA.
- **(c) revisitar 3F: só depois do G1b.** Se o egress default do Cloud Run em São Paulo já for BR, não há máquina
  **nem** NAT a pagar.
- **Antes de qualquer uma das três: rode o G1b.** É a única que pode custar zero sem comprar risco nenhum.

### 8.6 Achado novo, extraído da §A6.5 da emenda

**SEC-014-11 · MÉDIA · O PR do artefato de dinheiro chega SEM CI — o gate humano lê um diff que nenhuma máquina
validou** `[VERIFICADO — doc GitHub citada na emenda: eventos disparados pelo GITHUB_TOKEN não criam novo workflow
run]`. O artefato é `backend/app/data/catalog.json`, ou seja **percentuais de comissão que entram no cálculo de preço
do vendedor**. Sem CI no PR não rodam: o truth-gate zod, o guard F3/SC-802 de banda, nem a paridade seed↔artefato.

**Concordo com a remediação (i)+(iii) do arquiteto, com uma correção de peso: (iii) NÃO é opcional.** A validação (i)
roda **dentro do mesmo job** que produziu o diff — compartilha o mesmo limite de confiança, e um job comprometido
valida o próprio veneno. O `workflow_dispatch` manual da CI sobre o branch do PR (iii) roda num runner hospedado
**limpo**, contra a árvore do PR: é a única verificação **independente** da cadeia. **(i) é conveniência; (iii) é o
controle.** Ambos, e (iii) como item obrigatório do checklist do PR mensal. **Confiança 85%.**

### 8.7 Veredito reconciliado

Retifico o alcance, não o conteúdo:

- **Emenda CI-first como um todo: NÃO bloqueada.** A metade Amazon (3D) é boa, já estava autorizada pelo ADR-0010, e
  deve começar agora. Confiança 88%.
- **ML em 3D hospedado: NÃO bloqueado**, condicionado a G1 passar e à custódia sair de QA2 (c)/(c')/(b).
  Confiança 85%.
- **ML em 3E self-hosted: BLOQUEADO** — repo público é impedimento; repo privado é pré-condição necessária e **não**
  suficiente; a workstation do dono é reprovada em qualquer visibilidade. Confiança 95%.
- **QA2(a) — GitHub Secrets + PAT: desaconselhado**, e exige ADR de exceção se escolhido. Confiança 88%.
- **Nenhum desses caminhos deveria ser decidido antes de G2, G1, G1b e G3.** Três dos quatro custam uma execução de
  CI; o quarto (G3) é uma verificação que o ADR-0010 exige **por escrito** desde 2026-07-06.
- **Independentemente de tudo acima**, os achados SEC-014-02 (`trufflehog@main` por branch mutável), SEC-014-08
  (`allowed_actions: all`), SEC-014-10 (`first_time_contributors`) e SEC-014-11 (PR sem CI) devem ser corrigidos —
  eles não dependem de nenhuma destas decisões.

---

# ADENDO — Parecer decisório T004/D3 (2026-07-28, pós-gates)

**VEREDITO: LIBERA COM CONDIÇÕES — confiança 88%.**

Os 12% restantes: o alcance real de escrita do token ML é indemonstrável sem uma chamada de escrita (proibida,
§ameaça), e o classificador do FR-020a comitará dinheiro num `develop` que **hoje não tem proteção nenhuma**
(medido 2026-07-28: `branches/develop/protection` → 404; `rulesets` → `[]`; ambos reconfirmados pelo main-loop).

## As 8 condições (verificáveis; **nenhuma depende da visibilidade do repositório**)

1. **O job que carrega o segredo instala ZERO dependências** — só `checkout` + `setup-node` + `node <arquivo>.mjs`
   com built-ins, a forma que o G1 já provou viável. Nada de `pnpm install` no job com segredo; Playwright/Amazon
   ficam em **job separado, sem segredo**.
2. **Todas as actions de `fee-refresh.yml` pinadas por SHA de 40 caracteres** + `sha_pinning_required: true` no
   repositório (hoje `false`). Fecha `trufflehog@main` e as outras 9 referências mutáveis de uma vez.
3. **Segredo num GitHub Environment** (`ml-ingest`) com *deployment branch rule* restrita ao branch default; o job
   declara `environment: ml-ingest`. Hoje há **0 environments**.
4. **`::add-mask::` no token rotacionado antes de qualquer log**; proibido logar corpo de resposta de
   `/oauth/token`; sem `set -x`; sem upload de artefato com resposta bruta. **Achado desta revisão**: logs de repo
   público são mundialmente legíveis e **o token NOVO devolvido pela rotação não é mascarado** — só a string
   cadastrada como secret é. Um `console.log(body)` publica um refresh token válido para sempre.
5. **O segredo nunca em workflow disparado por `pull_request`, `pull_request_target` NEM `workflow_run`** —
   completa a condição do `arquiteto`: `workflow_run` roda do branch default **com** segredos e é acionável
   indiretamente por PR de fork.
6. **Separação de privilégio em dois jobs**: coleta (tem o segredo, `permissions: contents: read`) → artefato →
   publicação (`contents: write` + `pull-requests: write`, **sem** o segredo).
7. **T069b deixa de ser bloqueada por T004 e vira pré-condição de T060/T063** — as correções de segurança estavam
   bloqueadas pelo próprio parecer que as exige (dependência circular). Inclui §A6.5(iii) com dono nomeado.
8. **Runbook de revogação testado uma vez e cronometrado** (≤15 min), **2FA** na conta da casa, e **rotação manual
   anual** em calendário — sem write-back, o mesmo segredo é replayed 12×/ano.

## O que do parecer original CAIU (por medição, não por opinião)

| achado | estado |
|---|---|
| SEC-014-01 (RCE via fork PR em self-hosted) | **caiu inteira** — G1 extinguiu o self-hosted |
| SEC-014-07 (raio de dano na máquina do dono) | **caiu** — QA4 extinta |
| SEC-014-03 (PAT longevo para write-back) | **caiu** — G3 dispensa write-back |
| SEC-014-05 (perda irreversível na rotação) | **caiu quase toda** — sobra o TTL desconhecido do token antigo |
| SEC-014-04 (co-residência temporal) | **caiu** — dependia de runner persistente |
| §5 opções A/B/C + Cloud NAT + "A+B" | **caíram por irrelevância** — sem geo-gate não há NAT a discutir |
| QA2(b) Secret Manager via WIF | **recomendação retirada** — tecnicamente superior, mas cobra reverter o deferimento de provisionamento por um ativo de dano médio-baixo. **(c) passa a ser a escolha certa** |
| §8.4/QA3 "esperar o repo ficar privado" | **caiu** — nenhuma das 8 condições depende de visibilidade |

**Sobrevive e foi re-medido**: `allowed_actions: all`, `sha_pinning_required: false`,
`approval_policy: first_time_contributors`, `trufflehog@main`, SEC-014-11 (PR do artefato de dinheiro sem CI).
**Absolvição medida**: `default_workflow_permissions: read` + `can_approve_pull_request_reviews: false`.

## Modelo de ameaça — o reenquadramento que importa

Vetor **morto**: fork PR não recebe segredo e o runner é efêmero. Vetor **vivo**: mantenedor de action ou
dependência comprometido — tag mutável ou `postinstall` dentro do job com o segredo exfiltra no mesmo run, e
mascaramento protege o log, não a rede. Vetor **barato e esquecido**: leitor dos logs públicos.

**Pior dano real: não é dinheiro.** É perda de controle da conta da casa e da app OAuth
(`urn:global:admin:oauth:/read-write` alcança a própria app), anúncios ou mensagens fraudulentas sob identidade
ligada ao documento do dono, e PII da conta. **A ausência de vendas derruba o dano de Alto para Médio-baixo, não a
zero** — o ativo é a identidade e a app, não o saldo.

**Sobre os escopos `write`/`admin` que a tela do ML não deixa remover** *(inferência ~65%)*: escopo no token não é
autorização efetiva — o próprio G1 mediu 403 em toda a família `/sites/*` com permissões mínimas. Mas `/users/me`
devolveu 200 no mesmo teste, provando que **alguns endpoints escapam do PolicyAgent**. Trate como potencialmente
efetivos em endpoints legados e **NÃO teste escrita** — uma chamada de escrita bem-sucedida é dano auto-infligido.
Mitigação compensatória: conta sem meio de pagamento, sem saldo, sem anúncios.

**E o reenquadramento central**: quem exfiltra o token já tem execução de código num job com `contents: write` no
branch default — e nesse mundo **envenena o `catalog.json`, o percentual que entra no preço do vendedor, sem
precisar do token ML**. **O ativo mais valioso deste job é a permissão de escrita no repositório, não o segredo.**
Por isso as condições 1, 2 e 6 valem mais do que qualquer coisa feita ao segredo em si.

## Custódia (c) — CONFIRMADA, 90%

G3 removeu a única objeção estrutural. Duas honestidades: G3 mediu que o antigo sobrevive **uma** rotação, num
ponto no tempo — não mediu TTL nem número de rotações; e sem write-back o mesmo segredo é replayed indefinidamente.
Se falhar, o desfecho é **parada silenciosa + selo de obsolescência**, nunca corrupção do artefato.

## `ML_ACCESS_TOKEN` — nada a apagar

Medido 2026-07-28: `actions/secrets` → `total_count: 0`; environments, dependabot e codespaces também 0.
Residual: apagar `g1-probe-ml.yml` e `g2-probe-amazon.yml` junto com a fatia (o §A13 já os declara descartáveis, e
o g1 ainda referencia o nome do segredo).

## Se o repositório virar privado

**Nenhuma condição é adicionada nem removida.** Muda o entorno: a condição 4 perde urgência, some o auto-disable de
60 dias por inatividade, minutos passam a consumir cota (~0,25%), e o vetor fork-PR morre de vez. **A visibilidade
não é dependência desta ratificação** — inversão explícita do que este mesmo documento recomendava em QA3.

## ACHADO NOVO — decisão do dono (Princípio VIII, não decidido aqui)

O FR-020a manda o job **comitar direto em `develop`** quando o diff é só `lastReviewed`. **`develop` não tem
proteção nem ruleset** (medido). Então o portão que protege dinheiro é **exclusivamente o classificador dentro do
job** — nenhum controle de plataforma o respalda. Opções: (i) ruleset em `develop` exigindo PR — mata o commit
direto do FR-020a; (ii) manter o commit direto e compensar com CODEOWNERS + condição 6; (iii) commit direto só num
branch dedicado que abre PR sempre.
