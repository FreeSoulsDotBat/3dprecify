# Homologação T016 — E4 (009) PR-A: Histórico + snapshots congelados + fila offline

- **Feature:** 009-e4-history-snapshots-export · PR-A · T016
- **Branch / HEAD:** `develop` @ `b51f9f9` ("feat(009): E4 PR-A — T012/T013 Histórico list + frozen detail, T014/T015 honest teaser")
- **Data:** 2026-07-13
- **Ambiente:** stack real — Postgres compose (`precifica3d_homolog` @ :5433, migração `0003` + trigger de
  imutabilidade vivos), backend uvicorn :8100, Firebase Auth emulator :9099, front `vite preview` :4600
  (build de produção em modo emulador, `dist/` de 11:39 — **posterior** ao último commit, 11:32: build fresco,
  não é o bug do preview velho). Chromium real via `@playwright/test` (`launchPersistentContext`).
- **Método:** cadastro throwaway (seam `window.__e2eAuth`) → grant premium pelo **CLI operador real** →
  jornadas dirigidas em 390px e 1280px, com prova no banco (`psql`) e leitura direta do **IndexedDB**
  (`history:outbox:{uid}`) a cada passo. Contas usadas: `qa-t016-main-…`, `qa-t016-guard-…`, `qa-t016-lapse-…`.

> **Adaptação de ambiente, declarada.** O front de homologação subiu na porta **:4600**, que **não está na
> allowlist de CORS do backend em execução** (só `:5173` / `:4173`). O processo do backend é do owner e não
> podia ser reiniciado; `:4173`/`:5173` estão indisponíveis nesta máquina. Como CORS é uma checagem **do
> navegador** e não toca nenhum contrato de honestidade sob teste, relaxei CORS **apenas no Chromium de
> teste** (`--disable-web-security`). App, backend e banco ficaram **exatamente** como entregues. Nenhum
> resultado abaixo depende dessa flag. → ver Risco R4.

---

## VEREDICTO: **FAIL**

**A jornada central do épico — gravar OFFLINE — não funciona.** Fora dela, quase tudo o que PR-A promete está
correto e, em vários pontos, exemplarmente honesto (a prova das duas prateleiras passa de forma limpa). Mas o
primeiro write offline do produto **não grava nada**, e há um **segundo defeito que destrói silenciosamente um
registro pendente depois de dizer ao vendedor que ele está pendente** — que é a pior classe de mentira possível
neste épico.

Os dois defeitos são **de fluxo/infra do cliente, não dos componentes**: a Sheet, os badges, a lista-união, o
detalhe congelado, o guard de sign-out e os estados `pending`/`blocked` estão **todos corretos** — provei isso
isolando a rede (ver B1, experimento de isolamento). É a mesma distinção que salvou o E3 PR-C: *um componente
correto, alimentado por um fluxo quebrado, ainda mente.*

---

## Os dois bloqueadores

### B1 — BLOQUEADOR · A gravação offline **nunca acontece** (React Query pausa a mutation)

**O que o vendedor vê:** offline, na feira, ele preenche a Sheet e toca em **Salvar no histórico**. Então:
**nada acontece.** Nenhum toast (nem "salvo", nem "pendente", nem erro), a Sheet **fica aberta** com o botão
travado, e o registro **não aparece no Histórico**. Se ele fechar/recarregar o app (ou simplesmente desistir),
**a cotação é perdida para sempre**.

**Causa-raiz.** `apps/web/src/app/providers.tsx:15`:

```ts
export const queryClient = new QueryClient();
```

Sem `defaultOptions`, o `networkMode` do TanStack Query é o padrão **`"online"`**, que **pausa mutations**
enquanto `navigator.onLine === false`. Consequência: **`mutationFn` nunca executa**. Ou seja, a primeira linha
de `useRecordSnapshot` — `enqueueSnapshot(uid, body)`, a durabilidade que ADR-0018 §1 exige — **não roda**.
`mutateAsync()` fica pendente para sempre (`isPending` eterno ⇒ botão travado ⇒ nenhum toast, porque nem o
`try` nem o `catch` da Sheet são alcançados). A mutation pausada vive **só em memória** (não há persister), então
um reload a evapora.

**Prova (trace de IndexedDB + fetch, instrumentado do lado do teste):**

```
>>> OFFLINE
>>> CLICK SUBMIT
   (12 segundos — ZERO IDBGET, ZERO IDBPUT, ZERO FETCH)
>>> RELIGA A REDE
IDBGET  +16.58s key=history:outbox:f6Zr…      ← só agora a mutation "acorda"
IDBPUT  +16.58s key=history:outbox:f6Zr… val=[{"clientSnapshotId":"5434cd98…
```

E o polling do outbox durante o clique offline:

```
t=0.4s … t=4.8s   outbox=[]   sheetOpen=1   submitDisabled=true
```

`outbox=[]` o tempo todo (nada enfileirado) + `submitDisabled=true` para sempre (`isPending`) + **0 unhandled
rejections** + **0 erros de console**. Depois do reload ainda offline: o registro **não existe em lugar nenhum**.

**Experimento de isolamento (o que inocenta o resto do PR-A).** Repeti *exatamente* o mesmo fluxo com o
navegador **online** (`navigator.onLine === true`) e a **API inalcançável** (`route.abort`). Tudo funcionou
**perfeitamente**:

| | offline de verdade | online + API fora |
|---|---|---|
| toast | **nenhum** | ✅ "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão." |
| enfileirou (IndexedDB) | ❌ `[]` | ✅ `["…[pending]"]` |
| aparece na lista com badge | ❌ | ✅ "Pendente neste dispositivo", no lugar cronológico, com os próprios valores |
| sobrevive a reload | ❌ (perdido) | ✅ |
| drena sozinho ao reconectar | — | ✅ (badge some, 1 linha no banco, zero duplicata) |

Ou seja: **outbox, engine de sync, lista-união, badges, banner e toasts estão corretos.** O único defeito é a
mutation ser pausada justamente na condição para a qual ela foi construída.

**Ironia registrada (vale para o ADR):** ADR-0018 **rejeitou explicitamente a Opção B** ("TanStack Query
persisted paused mutations"). A implementação acabou herdando **exatamente esse comportamento** pelo
`networkMode` padrão — **sem** a persistência que ao menos faria a mutation pausada sobreviver a um restart.
O pior dos dois mundos, por omissão de uma linha.

**Correção mínima proposta (não apliquei):** `networkMode: "always"` na mutation de gravação (e na de drain) —
a durabilidade é o **outbox**, não a rede; a rede é apenas o dreno.

```ts
// entities/history/use-history.ts — useRecordSnapshot (e useSyncOutbox)
return useMutation<RecordOutcome, Error, SnapshotIn>({
  networkMode: "always",   // o outbox É a durabilidade; a mutation PRECISA rodar offline
  mutationFn: async (body) => { … },
```

(ou `defaultOptions: { mutations: { networkMode: "always" } }` no `QueryClient` — mas prefiro o alvo estreito,
para não mudar o comportamento de writes online-only do E2/E3, que legitimamente dependem da rede.)

**Evidência:** `19-OFFLINE-sem-toast-sheet-travada-390.png` · `20/21-OFFLINE-registro-AUSENTE-da-lista-*.png` ·
`22-OFFLINE-reload-registro-PERDIDO-390.png` · `23-OFFLINE-repro-outbox-vazio-390.png` — e, no contraste,
`25→30` (o mesmo fluxo funcionando quando `navigator.onLine` é true).

---

### B2 — BLOQUEADOR · Race de *lost update* no `drainOutbox` **destrói** um registro pendente (pendente falso)

**Este é o defeito mais grave dos dois em natureza**, ainda que menos frequente: o app diz
**"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."** — e o registro **já foi destruído**
naquele instante. Não está no servidor, não está no aparelho. É um **pendente falso**: um recibo de uma coisa
que não existe.

**Causa-raiz.** `apps/web/src/entities/history/outbox.ts` → `drainOutbox()` faz um **read-modify-write sem
lock**:

```ts
const entries = await listOutbox(uid);      // (1) LÊ a fila
const remaining: OutboxEntry[] = [];
for (const entry of entries) {
  try { await deps.post(entry.body); }      // (2) await de REDE — janela longa
  catch { … remaining.push({…}); }
}
await writeOutbox(uid, remaining);          // (3) SOBRESCREVE com o que leu em (1)
```

Qualquer registro **enfileirado durante (2)** não está em `remaining` — e o write de (3) **o apaga**. O
`UNIQUE (owner_uid, client_snapshot_id)` do banco **não protege contra isso**: ele impede **duplicatas**, mas
não impede um registro que **nunca chega a ser POSTado**. ADR-0018 §6 previa `navigator.locks` para
single-flight — **grep confirma que não foi implementado em lugar nenhum** (`navigator.locks` não existe no
código). A justificativa do ADR ("correctness does not depend on the lock — the DB unique key does") **só vale
para duplicatas**; tem um buraco para *lost update* da fila local.

**Repro determinístico** (`act4f`): A pendente → um drain lê `[A]` e seu POST é **segurado 8s** → durante esses
8s, gravo **B** (cujo POST é recusado, então B fica `pending` na fila) → o drain lento conclui, A sobe (2xx) e
ele escreve `remaining = []`, calculado da leitura **obsoleta** → **B é apagado**.

```
FASE 3 — grava B DURANTE o drain de A
  toast de B pendente? true                    ← o app AFIRMA "pendente neste dispositivo"
  outbox depois: []                            ← …e B já não existe

DB:  RACE-A ✓   RACE-B ✗   (a execução gravou os dois; só A chegou)
     race_a=2  race_b=1   (2 execuções × A; apenas 1 × B)
```

Também ocorreu **espontaneamente**, sem eu forçar nada: no trace de B1, ao religar a rede, o registro "TRACE"
foi enfileirado (`IDBPUT val=[{…}]`) e imediatamente sobrescrito por `IDBPUT val=[]` **sem nenhum POST** — e
não existe no banco.

**Alcance em produção (não é teórico):** a janela é o tempo de um POST em voo. Ela abre exatamente quando (a) a
conexão volta e o `OutboxSyncer` dispara o drain no evento `online` — que é **precisamente** o momento em que o
vendedor da feira volta a ter sinal e pode estar gravando; (b) no boot do app; (c) com **duas abas**. Corrigir
B1 (`networkMode: "always"`) **aumenta** a exposição a B2, porque passa a existir tráfego de gravação offline
concorrendo com os drains.

**Correção mínima proposta:** o single-flight de ADR-0018 §6 (`navigator.locks.request("history-outbox:"+uid, …)`
envolvendo **enqueue e drain**), ou tornar o write-back do drain um **read-modify-write re-lido** (reler a fila
e remover só as chaves efetivamente aceitas, em vez de sobrescrever com um retrato velho). A segunda opção é a
mais barata e já elimina o *lost update*.

**Evidência:** `31-race-registro-perdido-390.png` + queries do banco acima.

---

## O contrato de honestidade — ponto a ponto

| # | Contrato | Resultado | Observado |
|---|---|---|---|
| 1 | Teaser honesto (deslogado + free): sem preço, sem data, sem CTA de compra, **sem entrada de exemplo** | ✅ | `/historico` é público, **sem bounce**. "O histórico faz parte do Premium…". `R$` = 0, datas = 0, **0 cards** (`a[href*="/historico/"]` = 0). Deslogado ganha **[Entrar]**; logado-free **não** ganha. |
| 2 | **Q15** — "Salvar no histórico" **NÃO EXISTE** sem Premium ativo | ✅ | Botão **ausente** (count = 0) deslogado, logado-free **e lapsed**. Não é disabled, não é gatilho de teaser. Calculadora free intocada (SC-109). |
| 3 | Sheet de gravação | ✅ | Intro honesto; **Rótulo (opcional)**; **Validade da proposta**; base **Varejo pré-selecionado** + Atacado, **com os dois totais** (R$ 42,98 / R$ 37,25); **"Cotado em 13/07/2026" ANTES de gravar**. |
| 4 | Toast "Registro salvo no histórico." **só em 2xx real** | ✅ | Aparece online; **nunca** apareceu em nenhum caminho pendente/blocked/offline. |
| 5 | Gravação online (peça única) no banco | ✅ | `label`, `headline_total=42.98`, `headline_basis=PRECO_VAREJO`, `kind=SINGLE`, `model_version=3.1.0`, `quote_validity_days=15`, `device_utc_offset_minutes=-180`. |
| 6 | Kit gravável, payload **itemiza** as peças | ✅ | Card "Kit · 2 peças"; payload com `lines[]` (input + totals por linha); detalhe "PEÇAS DO KIT". |
| 7 | Offline: botão primário **não muda de rótulo** | ✅ | "Salvar no histórico" em ambos (botão e submit). |
| 8 | Offline: toast **"Pendente neste dispositivo…"**, tom info, nunca "salvo"/"falhou" | ❌ **B1** | **Nenhum toast.** A Sheet trava. (Quando a mutation *roda* — API fora, navegador online — o toast é exatamente o certo. ✅) |
| 9 | Registro pendente **aparece na lista**, no lugar cronológico, **com os próprios valores** | ❌ **B1** / ✅ fora dele | Offline real: **não aparece** (silent drop). Com a mutation rodando: aparece com badge "Pendente neste dispositivo", data, "Valor cotado", base. |
| 10 | Banner de fila: offline **sem** "Sincronizar agora" | ✅ | Offline: "Sem conexão. {n} registro(s) pendente(s)…", **0 botões**. Online: banner + **[Sincronizar agora]**. |
| 11 | Reconectar ⇒ **drena sozinho**; **uma linha só** (idempotência) | ✅ | `OutboxSyncer` drena no evento `online` sem clique. Banco: **0 duplicatas** (`GROUP BY client_snapshot_id HAVING COUNT(*)>1` ⇒ 0 linhas), inclusive após reload-enquanto-pendente. |
| 12 | Fila **sobrevive ao restart** do app | ✅ (quando enfileirada) | Reload com pendente: continua lá, ainda `pending`. ❌ no caso B1 (nunca foi enfileirada). |
| 13 | Detalhe congelado | ✅ | Data **+ hora** ("às 11:50"), "Valor cotado" + base rotulada, "Validade da proposta: 15 dias", "Valores congelados em …", **detalhamento gravado**, **ficha técnica** (fórmula **3.1.0** + explicador das duas prateleiras + **nota do relógio do aparelho**). **0 inputs** na tela. Nunca a palavra "Preço". |
| 14 | **Duas prateleiras**: snapshot **IDÊNTICO** após deletar o produto de origem | ✅ **(prova limpa)** | `innerText` do detalhe **byte a byte idêntico** antes/depois do delete. Nome capturado **"Vaso G" continua aparecendo**. **Zero** legenda, **zero** aviso, **zero** badge, **zero** "(avulsa)". |
| 15 | **F1 guard**: "removido/excluído/deletado/desatualizado" em **nenhuma** superfície de snapshot | ✅ | `/removid\|excluíd\|deletad\|desatualizad/i` no `innerText`: **0 ocorrências** em lista, detalhe, pendente, blocked e lapsed. |
| 16 | Contraste E3: o **kit salvo** DEVE degradar | ✅ | Lado a lado, o kit reabre com **"(avulsa)"** + a legenda calma "…mantidos e continuam editáveis." — o inverso exato do snapshot. |
| 17 | Sign-out guard nos **DOIS** pontos de saída | ✅ | Diálogo bloqueante na **barra do topo** *e* na **/conta**. |
| 18 | Guard: conta certa, [Sincronizar agora] desabilitado offline **com motivo**, [Sair e descartar] → **2º confirm**, [Voltar] inócuo | ✅ | "2 REGISTRO(S) AINDA NÃO FORAM SINCRONIZADOS"; offline o botão fica **disabled** + "Precisa de conexão para enviar."; 2º confirm "DESCARTAR 2 REGISTRO(S) E SAIR?"; **Voltar** não desloga e **não apaga** (outbox intacto nas duas etapas). |
| 19 | Descartar só apaga após o 2º confirm; purga a fila | ✅ | Após confirmar: outbox = `[]`, uid do Firebase = `null` (deslogado), **0 linhas** no banco com esses rótulos. Fila vazia ⇒ **sem diálogo** (sign-out de 1 clique preservado). |
| 20 | `blocked` (403 no sync): **retido, visível, calmo** | ✅ | Badge **"Envio pausado · precisa de Premium"** (tom info, nunca danger), banner "1 registro(s) não foram enviados: o Premium não está ativo.", entrada **retida** no outbox (`[blocked]`), **nunca** persistida no servidor. Nenhuma ocorrência de "falhou"/"bloqueado"/"expirou"/"suspenso". |
| 21 | Lapse: Histórico **continua legível**, nada é apagado | ✅ | Banner calmo "Premium pausado — seus registros continuam aqui e podem ser abertos…". Registros legíveis, detalhe abre. **Não** vira teaser. Botão de gravar some. |

---

## Achados

| # | Sev | Achado |
|---|-----|--------|
| **B1** | **BLOQUEADOR** | Gravação offline nunca executa: `networkMode` padrão (`"online"`) pausa a mutation ⇒ nada enfileirado, nenhum toast, Sheet travada, cotação **perdida** se o app reiniciar. `app/providers.tsx:15`. |
| **B2** | **BLOQUEADOR** | *Lost update* no `drainOutbox` (`entities/history/outbox.ts`, read-modify-write sem lock) **apaga** um registro enfileirado durante um POST em voo — **depois** de o app afirmar "Pendente neste dispositivo". ADR-0018 §6 (`navigator.locks`) não foi implementado. |
| **N1** | Nit | Falha de leitura do servidor **estando online** exibe o banner **"Modo leitura offline"** (`historico-page.tsx`, `history.stale`). ux §2.4 pede, nesse caso, a faixa `Alert tone="danger"` + **[Tentar novamente]** — o banner offline atribui a causa errada (diz "sem conexão" para quem está conectado). Baixo impacto, mas é uma imprecisão honesta. |
| **N2** | Nit | Detalhe mostra **"Mão de obra R$ 0,00"**. **Não é zero fabricado**: o payload contém de fato `"labor": "0.00"` (o `pricing-core` sempre emite a chave) e a calculadora ao vivo renderiza a mesma linha — o snapshot é cópia fiel da tela. FR-507 está **estruturalmente correto** (`rows.filter(!!value)` descarta chaves ausentes; **não há** `?? 0`). Só ruído visual. |
| **N3** | Nit | Linhas ad-hoc de kit aparecem como **"Cálculo avulso"** no detalhe (o payload tem `name: null` — o vendedor nunca as nomeou), enquanto o composer as mostrava como "Peça 1/Peça 2". Nada é inventado, mas perde-se o rótulo que estava na tela. |
| **N4** | Info / escopo | Snapshots nascidos na **calculadora** congelam sempre `provenance: null` (`pages/calcular/calcular-page.tsx:260` — `freezePriceResult(input, result, null)`), mesmo quando a calculadora foi **pré-preenchida por um produto do catálogo** (E2 SC-305). Logo, "Registro criado a partir de: {nome}" **nunca** aparece nesses registros. Snapshots de **kit** capturam sim (provado: "Vaso G" sobreviveu ao delete). **T018/T019 (US3 — a superfície de origem) são PR-B e estão `[ ]`**, então isso *parece* escopo diferido — mas vale a confirmação do owner, porque D3/ux §3.2 dizem que o nome capturado "sempre aparece". |

---

## Riscos

- **R1 — B2 fica pior depois de corrigir B1.** Ao habilitar `networkMode: "always"`, passa a haver gravação
  concorrente com os drains exatamente no instante da reconexão. **Corrigir B1 sem corrigir B2 troca um bug
  visível (nada acontece) por um bug invisível (o registro some depois de dizer "pendente").** Os dois devem
  entrar juntos.
- **R2 — Duas abas.** Sem `navigator.locks`, duas abas do mesmo vendedor fazem read-modify-write concorrente na
  mesma chave de IndexedDB. Não testei este cenário; pelo código, é o mesmo *lost update* de B2, com janela maior.
- **R3 — Os testes verdes não pegam nenhum dos dois.** Ambos vivem na costura React Query ↔ IndexedDB ↔ rede.
  Um teste de unidade do `outbox` (que chama `drainOutbox` direto) e um teste de componente da Sheet (com o
  QueryClient de teste, normalmente com `retry:false` e sem simular `navigator.onLine=false`) passam com folga.
  Sugestão para T017: um e2e que faça `context.setOffline(true)` **de verdade** e afirme
  (a) o toast pendente, (b) a linha na lista, (c) **uma** linha no banco após reconectar.
- **R4 — CORS do ambiente.** O backend em execução não aceita a origem `:4600` do front de homologação. Não é
  defeito de PR-A (é config de ambiente; `docs/environments.md` cuida das origens reais), mas **o próximo
  homologador vai bater na mesma parede** — vale subir o backend com `P3D_CORS_ORIGINS` incluindo a porta do
  preview, ou fixar o preview numa porta já permitida.

---

## Screenshots (`specs/009-e4-history-snapshots-export/evidence/`)

**Teaser + Q15 (✅):** `01/02` teaser deslogado (390/1280) · `03` calc deslogado sem botão · `04` calc free sem
botão · `05` teaser free.
**Gravação online (✅):** `06` botão após grant · `07/08` Sheet (base, totais, data) · `09` toast "Registro
salvo" · `10/11` lista sincronizada · `12/13` detalhe congelado · `14–17` kit.
**B1 — offline quebrado (❌):** `18` Sheet offline (rótulo do botão intacto) · `19` **sem toast, Sheet travada** ·
`20/21` **registro AUSENTE da lista** · `22` **reload: registro PERDIDO** · `23` repro com outbox vazio.
**O que *deveria* acontecer (✅ com a mutation rodando):** `25` toast pendente · `26/27` badge "Pendente neste
dispositivo" na lista · `28` detalhe pendente · `29` fila sobrevive ao reload · `30` drenou sozinha.
**B2 — race (❌):** `31` registro perdido.
**Duas prateleiras (✅):** `32` kit com linha do produto · `33` snapshot ANTES do delete · `34` produto deletado ·
`35/36` snapshot DEPOIS (idêntico) · `37` kit degradado "(avulsa)" — o contraste.
**Sign-out guard (✅):** `38` diálogo (topo) · `38b` offline com [Sincronizar agora] desabilitado + motivo ·
`39` mesmo diálogo pela /conta · `40` 2º confirm · `41` após descartar e sair.
**Lapse (✅):** `42` histórico legível + banner calmo · `43` detalhe abre · `44` calculadora sem botão.
**Blocked 403 (✅):** `45/46` badge "Envio pausado · precisa de Premium".

---

## Recomendação

**Não mergear PR-A como está.** Duas correções pequenas e bem localizadas destravam tudo — e o resto do PR-A
está sólido o bastante para que valha a pena corrigir em vez de replanejar:

1. `networkMode: "always"` na mutation de gravação (e no drain) — **B1**.
2. Eliminar o *lost update* do `drainOutbox` (re-ler a fila no write-back, ou o `navigator.locks` de
   ADR-0018 §6) — **B2**.

Depois, **re-homologar exatamente a jornada 6→7** (gravar offline → reconectar → drenar → uma linha só no banco),
que é a única que hoje não passa. Todo o resto — teaser, Q15, Sheet, detalhe congelado, duas prateleiras, guard
de sign-out, blocked, lapse, idempotência — já está homologado e não precisa ser re-testado.

---
---

# Re-verificação (correções B1/B2) — 2026-07-13

> O relatório acima fica **intacto**: o FAIL é evidência, não vergonha. Esta seção é uma verificação
> **focada** nos dois bloqueadores + o nit do banner. O que já passou não foi re-testado.

- **Ambiente reconstruído:** front :4600 com **build novo** (`dist/` 12:27, posterior às fontes corrigidas, 12:25) ·
  backend :8100 **reiniciado com CORS liberando `http://127.0.0.1:4600`** (verificado por preflight real:
  `access-control-allow-origin: http://127.0.0.1:4600`) · Postgres `precifica3d_homolog` · Auth emulator :9099.
- **O workaround `--disable-web-security` foi REMOVIDO.** Chromium roda com CORS normal, e **não houve nenhum
  erro de CORS no console**. Este resultado é o CORS real. → **Risco R4 do relatório original: RESOLVIDO.**
- **IndexedDB zerado** (perfil novo) + conta throwaway nova (`qa-t016-fix-…`, uid `rvdL4oQ7…`) + grant pelo CLI real.
- 390px **e** 1280px em todas as telas.

## VEREDICTO DA RE-VERIFICAÇÃO: **PASS-WITH-NITS**

**Os dois bloqueadores estão corrigidos e verificados na jornada real.** Gravar offline funciona de ponta a
ponta, a fila é durável, drena sozinha, e **nada se perde** na corrida que antes destruía um registro. Os nits
remanescentes são cosméticos/escopo e nenhum deles mente para o vendedor.

### B1 — gravar OFFLINE de verdade (`context.setOffline(true)`) · ✅ **CORRIGIDO**

| Contrato | Resultado |
|---|---|
| `navigator.onLine === false` (offline **real**, não só API fora) | ✅ confirmado |
| Botão existe e **não muda de rótulo** ("Salvar no histórico", botão e submit) | ✅ |
| Toast **"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."** (tom info) | ✅ |
| Nunca "salvo" / "guardado" | ✅ (0 ocorrências) |
| Nunca "falhou" / "não foi possível" | ✅ (0 ocorrências) |
| Sheet **fecha** (a gravação de fato aconteceu) | ✅ |
| **IndexedDB tem o body COMPLETO** | ✅ `{id, state:"pending", label, total:"42.98", basis:"PRECO_VAREJO", kind:"SINGLE", deviceQuotedAt, payload:[schemaVersion, kind, modelVersion, inputs, breakdown, totals, channels, provenance]}` |
| Aparece na lista com badge **"Pendente neste dispositivo"** e **os próprios valores** | ✅ "Feira offline A · Cotado em 13/07/2026 · Peça única · Valor cotado R$ 42,98 · preço de varejo" |
| Banner de fila **offline sem** [Sincronizar agora] | ✅ "Sem conexão. 1 registro(s) pendente(s)…" · **0 botões** |
| Detalhe do pendente abre **offline**, com badge | ✅ |
| **Sobrevive a reload offline** | ✅ fila intacta (`["Feira offline A[pending]"]`) |
| F1 guard | ✅ 0 ocorrências |

**Reconexão (`setOffline(false)`)** → drena **sozinho** (sem clique): badge some, banner some, fila = `[]`.
**Banco: UMA linha só**, com o `client_snapshot_id` **exatamente igual** ao cunhado offline no IDB
(`61b2964b-fa0c-4114-9a16-ab9f88b3801a`).

**Ciclo duro** (gravar offline → **reload** → reconectar): fila sobrevive ao reload (`["Ciclo duro B[pending]"]`),
drena após reconectar, **1 linha** no banco (`5a0a245d-…`). **Zero duplicatas.**

*Evidência:* `fix-01`…`fix-09`.

### B2 — a corrida (o "pendente falso") · ✅ **CORRIGIDO**

Repro **idêntico** ao que provou o bug: drain de A com **POST segurado 8s** e gravação de B **durante** o voo.

```
FASE 3 (B gravado com o POST de A em voo)
  toast de B pendente? true
  fila: [RACE-A fix(pending), RACE-B fix(pending)]

FASE 4 — o drain de A conclui (o instante que ANTES apagava B)
  fila DEPOIS: [RACE-B fix(pending)]      ← ANTES era []  ⇒  B era destruído
```

O drain removeu **apenas** a entrada que ele de fato resolveu (A, 2xx) e **preservou B**, que fora enfileirada
depois da sua leitura. Liberado o servidor, ambas drenam.

**Conservação (o teste do pendente falso):** IDs cunhados pelo app = `{1bc8670a (A), 1ec72b80 (B)}`;
fila final = `[]`; banco = `{1bc8670a, 1ec72b80}`. **fila ∪ banco ⊇ todos os gravados. Nada sumiu.**

**Variante "rajada"** (2 cotações offline + a 3ª gravada **em cima do drain** do evento `online`): os 3 IDs
(`240c9294`, `74c8af6e`, `801b2dc7`) estão **todos** no banco, fila final `[]`.

**Idempotência global da run:** `SELECT COUNT(*), COUNT(DISTINCT client_snapshot_id) FROM snapshots`
⇒ **17 / 17**. Zero duplicatas em toda a re-verificação.

*Evidência:* `fix-10`, `fix-11`, `fix-12`.

### Nit do banner · ✅ **CORRIGIDO**

| Situação | Esperado | Resultado |
|---|---|---|
| **Offline** | "Modo leitura offline" (calmo), linhas visíveis | ✅ banner calmo, **sem** tira de erro, linhas renderizando |
| **Online + leitura falhando** | tira `danger` + **[Tentar novamente]**, linhas visíveis | ✅ "Não foi possível carregar seu histórico." + **[Tentar novamente]**; **7 cards ainda visíveis** (nenhum muro de erro sobre dado que o vendedor já tem); "Modo leitura offline" **corretamente ausente** |

*Evidência:* `fix-13`/`fix-14` (offline) · `fix-15`/`fix-16` (erro online).

## Achados remanescentes (nenhum bloqueia)

| # | Sev | Achado |
|---|-----|--------|
| **N5** | Nit (novo, **pré-existente**, fora do E4) | **Offline, o logo da top-bar quebra** (aparece o `alt` "Precifica3D" e o ícone de imagem quebrada). Causa: `apps/web/vite.config.ts` → `includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"]` **não inclui** `brand/logo/*.svg`, e `logo.tsx:28` serve `/brand/logo/${file}` — grep no `dist/sw.js` confirma **nenhuma entrada `brand/logo`** no precache. Não é regressão das correções (o SW/logo não foi tocado), mas aparece **justamente na jornada offline que o E4 existe para servir**. Correção mínima: acrescentar `"brand/logo/*.svg"` a `includeAssets`. |
| **N2** | Nit | "Mão de obra R$ 0,00" no detalhe — **não é zero fabricado** (o payload contém `"labor":"0.00"`; a calculadora ao vivo mostra a mesma linha). Mantido do relatório original. |
| **N3** | Nit | Linhas ad-hoc de kit como "Cálculo avulso" (payload tem `name: null`). Mantido. |
| **N4** | Info / escopo | Snapshots da calculadora congelam `provenance: null` mesmo com pré-preenchimento do catálogo (T018/T019 são **PR-B**). Mantido — vale confirmação do owner. |

**Riscos R1/R2/R3/R4 do relatório original:** R1 (B2 piorar com B1) e R2 (duas abas) **fechados** — o
`withOutboxLock` com `navigator.locks` cobre inter-abas e a seção crítica não contém rede. R3 (testes verdes não
pegavam) **endereçado** pelos testes de regressão dos dois bloqueadores. R4 (CORS) **resolvido** no ambiente.

## Recomendação

**Liberado para merge.** Os dois bloqueadores foram corrigidos na causa-raiz certa (device-first write +
single-flight sob lock, sem rede na seção crítica) e a jornada que define o épico — *o vendedor na feira, sem
sinal, gravando uma cotação que sobrevive ao aparelho reiniciar e chega íntegra à conta quando o sinal volta* —
**funciona de ponta a ponta, sem duplicar e sem perder nada**. O único item que eu levaria junto é o **N5**
(uma linha no `vite.config.ts`), porque um logo quebrado é a primeira coisa que o vendedor vê exatamente na tela
offline que o épico acabou de conquistar.
