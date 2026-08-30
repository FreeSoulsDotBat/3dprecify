# F08 — Estados, erros e resiliência

## Resumo

**Nenhuma mensagem técnica chega ao vendedor**, e isso é garantido por TIPO, não por disciplina: o
mapa `ErrorCode → frase pt-BR` é um `Record<ApiErrorCode, string>` — um código novo na união gerada
é **erro de compilação** até alguém escrever a frase —, e um teste prova que todo membro resolve para
frase não-vazia. Varri `apps/web/src` por `{err.message}` e `String(error)` em JSX: **zero**. A
`ErrorPage` mostra cópia amigável mais um `correlationId` (identificador de suporte, não *stack*).
Cobertura de estados por tela é densa e o banner de offline é global.
**Um achado Baixo**: seis pré-carregamentos de cache são `void …then()` **sem `.catch`** — uma
rejeição do IndexedDB vira rejeição não tratada. A UI degrada bem (o caminho online assume), mas a
falha é **não observada** — e se ela é reportada ao Sentry depende de um detalhe de configuração que
eu **não** consegui verificar sem inferir.

---

## O que está certo, e por que é estrutural

### O mapeamento de erro (`shared/api/error-messages.ts`)

```ts
const MESSAGE_BY_CODE: Record<ApiErrorCode, string> = { … }
```

O tipo é **exaustivo**. Acrescentar um `ErrorCode` ao enum gerado quebra a compilação aqui até que
uma frase exista. Não é convenção — é o compilador. E um teste de unidade fecha o outro lado
(toda entrada resolve para frase não-vazia em runtime).

Além disso: `honestWriteError` distingue **falha de transporte** (`status === 0` — offline, DNS,
recusa) de **erro codificado do servidor**, e dá frases diferentes. Uma escrita negada por grant
vencido diz "Salvar faz parte do Premium"; uma escrita sem rede diz que precisa de conexão. São
verdades diferentes e o código não as confunde.

### Varreduras de vazamento

| verificação | resultado |
| --- | --- |
| `{err.message}` / `String(error)` renderizado em JSX | **zero** |
| a `ErrorPage` mostra *stack* ou mensagem crua | **não** — cópia de `messages.error` + `correlationId` |
| código de status cru na tela | **não** — o próprio E6 registra a regra ("no status-code jargon ever reaches the seller") e o 409/503 do checkout têm frase específica |

O `correlationId` na tela de erro é a escolha certa: dá ao vendedor algo para citar no suporte sem
lhe mostrar nada que ele não deva ver.

### Cobertura de estados por tela

| tela | carregando | vazio | erro | offline/desatualizado |
| --- | --- | --- | --- | --- |
| `/calcular` | 7 | 2 | 9 | 7 |
| `/catalogo` | 4 | 2 | 4 | 4 |
| `/kits` | 4 | 4 | 4 | 4 |
| `/historico` | 5 | 4 | 5 | **9** |
| `/conta` | 1 | 0 | 3 | 2 |

(contagem de arquivos que tratam cada estado — indicador de cobertura, não prova de correção; a
prova visual é da F11a/F11b.)

`/conta` sem estado "vazio" é **correto**: a conta nunca está vazia — ela sempre tem identidade e
plano. O `/historico` liderar em offline é coerente com ele ser a única superfície com outbox.

Há um `OfflineBanner` global no shell (`app-shell.tsx:54`), então nenhuma tela depende de tratar
"sem rede" sozinha.

---

## Achado

### [F08-001] Seis pré-carregamentos de cache não tratam rejeição

- **Severidade**: **Baixo**
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100% quanto ao código; **incerto** quanto à observabilidade (ver abaixo)
- **Local**:
  - `entities/bom/use-bom.ts:64`
  - `entities/catalog/use-catalog.ts:79`
  - `entities/history/use-history.ts:205` e `:291`
  - `entities/scenario/use-scenarios.ts:78`
  - `entities/user/use-entitlement.ts:53`
- **Origem**: `develop`

Todos têm a forma `void loadCachedX(uid).then((items) => …)` — **sem `.catch`**. Se o `idb-keyval`
rejeitar (quota estourada, store corrompido, navegação privada em alguns navegadores), a rejeição
fica sem tratador.

**O efeito na tela é benigno**: o pré-carregamento é otimização; a consulta online roda de qualquer
jeito e a tela funciona. A degradação é graciosa **por acidente da arquitetura**, não por tratamento.

**O que me incomoda é a invisibilidade.** Se o cache do vendedor está quebrado, ele perde o
pré-preenchimento e o boot offline — e ninguém fica sabendo, porque não há `catch`, não há log e não
há caminho de estado degradado.

**E há uma assimetria**: a mesma família de código faz o certo em outro lugar. O `outbox.ts:121-122`
usa `tabChain.then(run, run)` — dois handlers, rejeição tratada. Quem escreveu o outbox sabia; os
seis pré-carregamentos não herdaram.

**Conserto mínimo (não aplicado — R8)**: um `.catch` que registre e siga (o pré-carregamento pode
falhar; o que não pode é falhar em silêncio). Seis linhas.

---

## Não verificado nesta fase

1. **Se o Sentry captura `unhandledrejection` nesta configuração.** `sentry.ts:31` passa
   `integrations: [breadcrumbsIntegration(...)]`. Na v8+ do SDK um array de `integrations` é
   **mesclado** com os padrões (e o `globalHandlersIntegration`, que captura rejeições não tratadas,
   é padrão) — mas eu **não confirmei** isso na versão instalada, e afirmar sem confirmar é
   exatamente o que a R6 proíbe. **Isto muda a severidade de `[F08-001]`**: se o Sentry captura, a
   falha é observável em produção e o achado é cosmético; se as integrações padrão foram
   substituídas, nenhum erro não tratado do app inteiro é reportado — e aí o achado é bem maior que
   os seis `catch`. → `PENDENCIAS.md` §P-013.
2. **Sessão expirada** — há `TOKEN_EXPIRED` no enum e frase mapeada, e um `sign-out-guard`; não
   construí o caso de um token vencendo no meio de uma sessão longa.
3. **Dado parcial** — a degradação D3/D6 (F07) cobre a parte de catálogo; não varri todas as telas
   procurando renderização de objeto meio-carregado.
4. **A contagem por tela é indicador, não prova.** Um arquivo pode "tratar erro" e tratar mal. A
   verificação real dos estados na tela é da **F11a/F11b**, com imagem.
