# Data model — 018 Abas desktop (Fase 1)

**Resumo em uma linha: nenhuma entidade persistida muda.** Sem migração, sem campo novo, sem mudança
de payload, sem bump de `pricing-core`. O que este incremento cria é **estado de interface**.

Se um dia alguém abrir este arquivo procurando a tabela que o 018 criou: não existe, e isso é o
resultado esperado — um incremento de composição que mexesse no modelo de dados estaria fora do
próprio escopo (FR-004).

---

## 1. Estado de interface (efêmero, por página)

| Estado | Onde vive | Tipo | Regra |
|---|---|---|---|
| `secaoAtiva` (Catálogo) | URL `?tab=` — **inalterado** | `"filaments" \| "printers" \| "products" \| "kits"` | Continua derivado da URL a cada render (013/F-02). Este incremento **não** toca nisso. |
| `itemSelecionado` (Catálogo) | `useState` da página | índice, com clamp | Reinicia ao trocar de seção; cai para índice válido se a lista encolher; some no estado vazio |
| `busca` (Catálogo) | `useState` da página | `string` | Filtra a seção ativa no cliente; não vai para a URL; reinicia ao trocar de seção |
| `registroAberto` (Orçamentos) | `useState` da página | índice, com clamp | Não muda ao carregar mais registros (FR-025) |

**Invariante de seleção**: `itemSelecionado` e `registroAberto` são sempre **derivados contra a lista
atual** no momento do render — nunca lidos como índice cru. É o que faz "o item selecionado foi
excluído" cair num estado válido em vez de numa ficha órfã (Edge Cases da spec).

---

## 2. Preferência persistida (uma, nova)

| Chave | Onde | Valor | Padrão | Escopo |
|---|---|---|---|---|
| `precifica3d-nav-rail` | `localStorage`, via store Zustand com `persist` | `{ "collapsed": boolean }` | `collapsed: false` (expandido) | **aparelho**, nunca conta — não viaja, não sincroniza, não vai para o servidor |

Molde idêntico ao `precifica3d-theme` (`shared/ui/theme-store.ts`): `createJSONStorage(localStorage)`
+ `partialize`. Diferença deliberada: **não** há script de pré-paint em `index.html`. O tema precisa
de um porque pintar a cor errada por um quadro é visível e desagradável; um menu que aparece expandido
por um quadro e recolhe não pinta nada de errado.

**Degradação**: `localStorage` indisponível (modo privado, navegador travado) ⇒ o store cai para o
padrão em memória e o menu abre expandido. Não é erro, não mostra aviso.

---

## 3. O que continua vindo do servidor, sem mudança

Nenhuma destas leituras muda de forma, cache ou momento:

- entitlement (`GET /api/v1/entitlement`) — segue sendo a **única** fonte do plano; a ficha e o teaser
  continuam saindo de estado positivamente conhecido
- identidade (`GET /api/v1/me`), assinatura (espelho do PSP)
- catálogo do vendedor (filamentos, impressoras, produtos, kits) — a busca do Catálogo filtra **a
  lista já em cache**, não pede nada novo
- registros de orçamento (lista paginada por keyset + detalhe congelado)
- catálogo de tarifas (para os preços por canal do kit)

**Consequência para o teste**: como nenhuma leitura muda, os vetores numéricos canônicos continuam
valendo como trava de regressão (SC-007) — se um número mudar, o incremento saiu do escopo.
