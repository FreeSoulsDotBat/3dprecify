# F09 — Build e prontidão de deploy

## Resumo

A esteira de deploy é `workflow_dispatch` com **guarda de habilitação por ambiente**
(`vars.DEPLOY_ENABLED != "true"` ⇒ sai 1) e autentica por **WIF sem chave** — as duas escolhas
certas. Bundle do cliente em **902 KB** num chunk único; a vulnerabilidade moderada que a auditoria
de dependências aponta (`protobufjs`, via `firebase`) **não chega ao vendedor** — medi: zero
`protobuf` e zero `grpc` no bundle servido.
**Um achado ALTO, e ele já era conhecido**: **0 de 33** usos de ação nos 5 workflows estão fixados
por SHA — incluindo `trufflesecurity/trufflehog@main`, um terceiro por **branch mutável**. Isto está
registrado como `SEC-014-02`, severidade ALTA, marcado `[VERIFICADO]`, com a remediação escrita
*"fixar `trufflehog` por SHA **imediatamente**"* — e **não foi feito**. O agravante que o parecer não
cobria: o workflow de **deploy**, que carrega credencial WIF de produção, está entre os não fixados.

---

## O que está certo

| verificação | resultado |
| --- | --- |
| gatilho do deploy | `workflow_dispatch` apenas — **não** dispara sozinho |
| guarda de ambiente | `vars.DEPLOY_ENABLED != "true"` ⇒ `exit 1` (`deploy.yml:29-34`) |
| autenticação GCP | **WIF sem chave** (`id-token: write` + `workload_identity_provider`) — nenhum JSON de service account no repositório |
| `.env` versionado | **nenhum** (só `.env.example`, com valores `demo-*` e aviso escrito) |
| vulnerabilidade em produção | 1 moderada (`protobufjs` ← `firebase`) — **não alcança o cliente** |
| paridade de gate | `pnpm gate:all` é o **mesmo literal** em `lefthook.yml:20` e `ci.yml:32` (verificado na F02) |

### O bundle

| | |
| --- | --- |
| total de `dist/` | **1,3 MB** |
| maior chunk JS | **902 KB** (`index-*.js`), chunk único |
| `firestore` no bundle | 2 ocorrências — **resíduo de string** |
| `protobuf` / `grpc` | **0 / 0** |

O app importa **só o Auth** do Firebase, e o *tree-shaking* removeu o Firestore de fato. Por isso a
vulnerabilidade do `protobufjs` fica confinada à árvore de dependências e **não é servida**.

**Não há `manualChunks` nem ajuste de `chunkSizeWarningLimit`** em `vite.config.ts` — o build emite o
aviso de "chunks maiores que 500 kB" a cada execução (visto nos logs de e2e desta sessão). Não é
defeito; é um aviso conhecido e não tratado. Otimização de bundle é da **F13**.

---

## Achado

### [F09-001] Nenhuma ação de CI está fixada por SHA — e a remediação "imediata" nunca foi aplicada

- **Severidade**: **Alto**
- **Bloqueia provisionamento**: **SIM, na minha leitura** — este é literalmente o workflow que roda
  quando você provisiona.
- **Certeza**: 100% (contagem medida; o registro anterior é citável)
- **Local**: `.github/workflows/{ci,deploy,g1-probe-ml,g2-probe-amazon,auto-pr}.yml`
- **Origem**: `develop`

**Medido agora:**

```
0 de 33 usos de `uses:` estão fixados por SHA de 40 caracteres
```

| ação | ref | onde |
| --- | --- | --- |
| `trufflesecurity/trufflehog` | **`@main`** — branch mutável | `ci.yml:141` |
| `google-github-actions/auth` | `@v2` | `deploy.yml` |
| `google-github-actions/setup-gcloud` | `@v2` | `deploy.yml` |
| `FirebaseExtended/action-hosting-deploy` | `@v0` | `deploy.yml` |
| `gitleaks/gitleaks-action` | `@v2` | `ci.yml` |
| `actions/checkout` ×11, `setup-node` ×7, `pnpm/action-setup` ×5, `setup-uv` ×4, `setup-java` ×1 | tags | todos |

**Isto não é achado novo — é achado NÃO REMEDIADO.** `specs/014-fee-category-mapping/seguranca-ci-first.md:315`:

> `SEC-014-02` | **ALTA** `[VERIFICADO]` | `trufflesecurity/trufflehog@main` — action de terceiro por
> **branch mutável**; mais 9 por tag mutável; `sha_pinning_required: false` |
> **Fixar `trufflehog` por SHA imediatamente**; depois as demais; ligar `sha_pinning_required: true`

O parecer é de um agente de segurança, a severidade é ALTA, o achado está marcado **VERIFICADO**, e a
ação diz **imediatamente**. Nada foi feito.

**O agravante que o parecer não cobria.** Ele foi escrito olhando a ingestão de tarifas
(`fee-refresh.yml`, que nem existe ainda). O alvo de maior valor é outro: **`deploy.yml`**. Ele roda
com `id-token: write` e acesso a `secrets.WIF_PROVIDER` / `secrets.WIF_SERVICE_ACCOUNT` — ou seja,
com direito de publicar em produção no GCP e no Firebase Hosting.

Uma tag é um **ponteiro mutável**. Quem controla o repositório da ação (ou quem o comprometa) pode
repontar `@v2` para código arbitrário, que passa a rodar **dentro do seu job de deploy, com as suas
credenciais de produção**. É a forma canônica de ataque de cadeia de suprimentos em CI, e a defesa
canônica é fixar por SHA — que é imutável.

**Por que eu o marco como bloqueante de provisionamento**, e é a única vez nesta auditoria que faço
isso por convicção e não por medição: hoje o `deploy.yml` **não roda** (a guarda `DEPLOY_ENABLED`
está desligada e o provisionamento está adiado), então a exposição atual é baixa. **Provisionar é
exatamente o ato de ligar essa guarda.** O momento de fixar é antes, não depois — e o custo é uma
tarde de `gh api` resolvendo SHAs.

**Conserto (não aplicado — R8)**: substituir cada `@tag` pelo SHA de 40 caracteres do commit
correspondente, começando pelo `trufflehog@main`, e ligar `sha_pinning_required: true` na
configuração do repositório. → spec na F15.

---

## Não verificado nesta fase

1. **`docs/environments.md` contra a realidade do GCP.** O documento existe e descreve os ambientes,
   mas **nada foi provisionado** — não há projeto GCP, não há Cloud Run, não há WIF configurado. A
   conferência "o documento bate com o que existe" é impossível enquanto nada existir, e vira parte
   do próprio provisionamento.
2. **O `firebase.json` / regras de Hosting** — não abri. Cabe no provisionamento.
3. **Vulnerabilidades de dependências de DEV** — rodei `pnpm audit --prod`. A árvore de
   desenvolvimento (vitest, playwright, eslint) não foi auditada; ela não é servida, mas roda no CI
   com acesso ao repositório — o que se cruza com `[F09-001]`. → `PENDENCIAS.md` §P-014.
4. **Tamanho de bundle como problema de desempenho** — 902 KB num chunk é grande para 3G, mas medir
   impacto (tempo até interativo) é da **F13**.
