# ADR-0032: Os primitivos do porte — onde cada classe `tf-*` mora, e como o porte não cria uma segunda camada

- **Status**: Proposed (o dono flipa para Accepted no gate da PR-A do 019, como fez com 0025–0031)
- **Date**: 2026-08-26
- **Deciders**: Jonatan (owner, no gate) + arquiteto (019-porte-design)
- **Estende**: ADR-0007 (o DS é `tf-*` cabeado em Radix, não a pele de utilitários do shadcn)
- **Relaciona**: ADR-0031 (composição desktop) · ADR-0012/0015 (o gate é do servidor) ·
  `docs/design/handoff-019/{README.md,tf-components.css}` (autoridade de design, cópia de 2026-08-26)

## Context

O 019 porta o desenho de 157 superfícies. O handoff diz, com todas as letras, que **a maior parte já
existe e está correta**; o delta real são **oito primitivos** que o desenho precisou inventar, **um
token** (`--warning-text`) e **oito adaptações de prancheta** a desfazer.

Um porte de folha de estilo tem um modo de falhar que é silencioso e caro: a folha da prancheta é
**um arquivo só**, e o produto é **um arquivo por primitivo, importado pelo `.tsx` que o usa**
(`shared/ui/alert.tsx:5` → `./alert.css`, e assim para os 18 arquivos de `shared/ui/*.css`). Copiar a
folha inteira criaria uma segunda camada com os mesmos nomes de classe — e o projeto já tem **um caso
medido** dessa divergência acontecendo por conta própria.

**Fatos medidos no repositório (2026-08-26, leitura direta — arquivo:linha junto):**

| fato | onde | consequência |
| --- | --- | --- |
| `.tf-alert--compact` **já existe**, local, com geometria **diferente** da do handoff | `apps/web/src/features/calculator/shopee-warnings.css:5` (`align-items:center`, `padding: var(--space-2) var(--space-3)`) vs. `handoff-019/tf-components.css:740` (`align-items:flex-start`, `padding: var(--space-3)`, `gap: var(--space-2)`) | não é "criar": é **promover e apagar a local**, e a promoção **muda** uma superfície homologada (016/PR-F A5) |
| Os outros 7 primitivos + `--warning-text` **não existem** | grep por `tf-plist\|tf-table\|tf-aviso\|tf-frozen\|tf-segmented--split\|tf-btn--full\|tf-btn--half\|tf-alert__close\|tf-alert__action\|tf-alert--warning\|warning-text` em `apps/web/src` → **0 arquivos** | classificação (c) confirmada para os 7 |
| `tf-badge--success` / `--danger` **já existem** | `apps/web/src/shared/ui/badge.css:23,27` | o handoff os marca "NOVO no lote 18" — **falso no produto**. Terceira correção de escopo da V0, na mesma direção das duas do brief |
| `--tf-warning-deep` **não existe** | `apps/web/src/styles/tokens/colors.css` tem `--tf-amber-deep: #bd6c0e` (:30), `--tf-warning`/`--tf-warning-soft` (:65,:73,:190) e `--warning` (:122) | o brief §2 ("valor = `--tf-warning-deep`, que já existe") nomeia um token inexistente; a folha do handoff usa `--tf-amber-deep`, que é o que existe |
| O grafo de tokens é **congelado por teste** em 87 tokens | `apps/web/src/styles/token-parity.test.ts:17` | `--warning-text` leva a baseline a **88**, e isso é uma mudança **revisada**, não um número que se ajusta |
| O congelamento inerte do produto é `<fieldset disabled>` | `features/catalog/filament-form.tsx:56`, `pages/catalogo/produto-page.tsx:298,366,386` | `tf-frozen` **não** substitui o `fieldset`: ele veste o que o `fieldset` já torna inerte |

Some-se o Princípio VIII: onde uma classe mora, e o que ela promete, é decisão de estrutura de UI —
decidida antes, não inferida na implementação.

## Options considered

### Option A — Uma folha nova `shared/ui/porte-019.css` com os 8 primitivos juntos

- **Pros**: um arquivo, um diff, porte mecânico; o revisor compara com a folha do handoff lado a lado.
- **Cons**: quebra a regra de casa "uma classe, um arquivo, importado pelo `.tsx` dono" — e, pior,
  **reintroduz o caso `tf-alert--compact`**: `tf-alert--*` passaria a ser definido em `alert.css` **e**
  em `porte-019.css`. Uma folha sem componente dono nunca é importada por ninguém (o produto não tem
  `@import` global de `shared/ui`), então ela vira ou código morto ou um import solto em `global.css`,
  fora da disciplina de ADR-0007.
- **Impacto de escalabilidade**: negativo — a nona tela que precisar de um primitivo novo repete a folha.
- **Confiança de que degradaria o DS em um incremento**: 85%.

### Option B — Cada primitivo entra como classe utilitária no Tailwind (`@utility` / `@layer components`)

- **Pros**: zero arquivo novo; o Tailwind v4 já está no build.
- **Cons**: ADR-0007 decidiu explicitamente **contra** a pele de utilitários; os primitivos carregam
  medidas (44px por pseudo-elemento, `line-height` próprio da meia-caixa, o fundo obrigatório do
  congelado) que viram utilitário ilegível; e o token semântico deixa de ser a única fonte da pele.
- **Impacto**: negativo — contradiz uma decisão aceita, sem fato novo que a reabra.
- **Confiança de que é a pior das três**: 90%.

### Option C — Variante em quem já existe; primitivo novo = arquivo novo COM componente dono (ESCOLHIDA)

Cada classe do handoff cai em um de dois baldes: **(1) é um tom/uma largura/uma densidade de um
primitivo que já existe** → entra no `.css` desse primitivo e vira **prop** do `.tsx` dele;
**(2) é um primitivo novo** → nasce `shared/ui/<nome>.tsx` + `shared/ui/<nome>.css`, no molde dos 18
que já existem.

- **Pros**: mantém a regra "uma classe `tf-*`, um arquivo dono"; o import é o do componente, então não
  existe CSS órfão; a promoção da cópia local vira **mover + apagar**, não copiar; ADR-0007 continua
  valendo sem emenda (nenhum utilitário solto entra).
- **Cons**: mais arquivos e mais `.tsx` finos (um `<Frozen>` de dez linhas); um primitivo puramente
  visual ganha um componente que "só" renderiza uma `div` com uma classe.
- **Impacto de escalabilidade**: alto — é o mesmo molde que o DS já usa 18 vezes, e o próximo
  primitivo não tem onde inventar um lugar diferente.
- **Confiança**: 85%.

## Decision

**Option C**, com as sub-regras abaixo — todas normativas.

### 1. O mapa (é ele que dimensiona a PR-A, junto com a V0)

| classe do handoff | classificação V0 | onde mora | superfície TSX |
| --- | --- | --- | --- |
| `tf-alert--compact`, `tf-alert__action`, `tf-alert__close`, `tf-alert--warning` | (b) local / (c) | `shared/ui/alert.css` | `Alert` ganha `compact`, `action`, `onDismiss`, `tone="warning"` |
| `tf-btn--full`, `tf-btn--half` | (c) | `shared/ui/button.css` | `Button` ganha `width?: "full" \| "half"` |
| `tf-segmented--split` | (c) | `shared/ui/segmented.css` | `Segmented` ganha `split?: boolean` |
| `tf-badge--warning` | (c) | `shared/ui/badge.css` | `Badge` ganha o tom `warning` |
| `tf-badge--success`, `tf-badge--danger` | **(a) já existem** | — | guarda anti-regressão, **não** é tarefa |
| `tf-aviso*` | (c) | **novo** `shared/ui/aviso.{tsx,css}` | `Aviso` |
| `tf-plist*` | (c) | **novo** `shared/ui/plist.{tsx,css}` | `PList` |
| `tf-table*` | (c) | **novo** `shared/ui/table.{tsx,css}` | `Table` |
| `tf-frozen` | (c) | **novo** `shared/ui/frozen.{tsx,css}` | `Frozen` (§3) |
| `--warning-text` | (c) | `styles/tokens/colors.css` (dois temas) | — (§4) |
| `tf-phone-scroll`, `tf-price--rola` | **não portar** | — | proibidos por teste (§5) |

`tf-aviso` **não** entra em `alert.css`, e a razão é do próprio handoff: *alerta é o que interrompe;
aviso é o que acompanha*. Fundi-los apagaria a distinção que a US2 existe para criar.

### 2. A promoção do `tf-alert--compact` apaga a local — e é uma mudança visual, não um mover

A regra do DS é a do **handoff** (12px de padding, gap de 8px, `align-items: flex-start`), porque foi
ela que nasceu da medida do selo. `shopee-warnings.css:5-14` é **apagado na mesma fatia**, e o aviso da
Shopee passa a herdar a regra do DS — o que muda a geometria dele em ~8px de altura. Consequência
declarada: a fatia **re-mede** a seção da Shopee a 360px (a medida do 016/PR-F é a régua) e, se a
seção crescer além do que o 016 mediu, o caminho de volta é promover a geometria **local** e ajustar o
selo — nunca criar um segundo nome para a mesma ideia. Confiança de que a geometria do handoff é a
certa: 75%.

### 3. O contrato do `tf-frozen`: ele veste, nunca inerta

`tf-frozen` é **apresentação**. O que torna o formulário inerte continua sendo o `<fieldset disabled>`
nativo que o produto já usa. Para que "visual congelado sem inércia real" seja **irrepresentável**, o
primitivo entrega os dois juntos:

- `<Frozen>` renderiza um `<fieldset disabled className="tf-frozen">`. Não existe prop para desligar o
  `disabled`; quem quer só o visual não tem como pedir.
- O `background: var(--border-subtle)` nos controles é **parte obrigatória** da regra (o handoff mediu:
  `--bg-muted` sozinho é idêntico ao cartão no tema escuro, e a única pista sobraria na opacidade).
- O esmaecimento é **nos controles**, nunca no contêiner: `opacity` no wrapper arrasta a dica para
  2,58:1 (medida do handoff) e reprova AA — e a dica do consumo médio é justamente a peça que existe
  para ser lida por quem ainda não assinou.
- **Quem precisa continuar clicável fica FORA do `<Frozen>`** — o `<fieldset disabled>` desabilita todo
  controle aninhado, inclusive o que leva à assinatura.
- Aceitação da fatia: contraste **medido** nos dois temas (dica ≥5,67:1, rótulo ≥18,23:1) e um teste
  que prova que o `fieldset` está desabilitado — visual e inércia verificados juntos, nunca só um.

### 4. `--warning-text` entra com um GATE de contraste, não com um valor assumido

O valor proposto pela folha é `--tf-amber-deep` no claro (`#bd6c0e`) e `#ffc070` no escuro. **Calculado
por mim** (fórmula WCAG sobre sRGB, 2026-08-26): `#bd6c0e` dá ≈**3,9:1** sobre branco e ≈**3,5:1** sobre
`--tf-warning-soft` no claro — **abaixo de 4,5:1**, ou seja, reprovaria como texto normal exatamente
como o handoff diz que ciano e laranja reprovam. Não trato isso como fato: **a PR-A MEDE** (a régua da
casa é medir, não estimar) e a decisão fica presa à medida:

- medido ≥4,5:1 nas superfícies onde é **texto** ⇒ entra como está;
- medido <4,5:1 ⇒ o token do tema claro é escurecido até passar, e **isso é decisão do dono** (é cor de
  marca) — nunca "usa assim mesmo porque a folha diz". O ícone isolado pode ficar no tom da folha
  (não-texto responde a 3:1); o **texto** não.

`--warning-text` também **eleva a baseline do `token-parity.test.ts` de 87 para 88** — mudança revisada
no diff, com o tom warning nos dois temas, no mesmo molde dos três `*-text` que já estão lá.

### 5. Duas guardas de folha, ambas provadas por mutação

Nascem em `apps/web/src/styles/` (ao lado do `token-parity.test.ts`, que é o precedente de "o DS tem
teste próprio"):

1. **Uma classe `tf-*`, um arquivo.** O teste varre todo `*.css` de `apps/web/src`, extrai os seletores
   de classe `tf-*` **definidos** (não os usados) e falha se algum nome aparece como definição em dois
   arquivos. É esse teste que impede o caso `tf-alert--compact` de voltar a existir em dois lugares — e
   é ele que fica **vermelho antes** da promoção e verde depois (não-vacuoso por construção).
2. **Os dois dispositivos de prancheta não entram.** Zero ocorrência de `tf-phone-scroll` e
   `tf-price--rola` em `apps/web/src` **e no bundle** — a segunda metade importa porque a folha do
   handoff é arquivo versionado em `docs/`, e um `cp` distraído é o modo mais provável de eles entrarem.

### 6. As oito adaptações são desfeitas mecanicamente, e as duas que não são adaptação não são tocadas

Desfazer (§3 do handoff): nome do token (`--border` → `--border-default` já é o nome do produto),
`fixed`→`absolute` **volta a `fixed`** no toaster e na TabBar, URL de ícone → o `TF_ICON_BASE` local,
componente React no lugar da classe estática, `text-decoration` (o preflight do Tailwind já faz),
`clamp(…cqw)` → o `12vw` do produto, `flex: 0 0 auto` no `__int` (o produto tem `min-width: 0`; a
troca só entra se o valor extremo for reproduzido **no produto** — a folha mesma chama isso de decisão
de quem porta), e `tf-price--rola` não entra (§5).

**Não reverter**: 015/A6 (tamanho no `__amount`) e 016/T018-A1 (`line-height: 1.2`). São consertos que
a folha copiou de volta; revertê-los reintroduz bug pago. Uma guarda de regressão por cima de cada um
(o teste que já existe para o eixo Y do preço serve para o segundo).

### 7. O anel de foco — RESOLVIDO pelo dono em 2026-08-27: F-2, remover (registro das opções abaixo)

Há uma **contradição entre duas autoridades**, e o Princípio VIII proíbe escolher por conta própria:

- `specs/019-porte-design/spec.md` FR-1903 (autoridade de escopo) pede **anel de foco de 2px** e o anel
  do menu em `--accent`;
- `docs/design/handoff-019/tf-components.css:60-63` (autoridade de design) registra **decisão do dono de
  2026-08-25**: *"nenhum controle mostra indicador de foco"*, com a consequência declarada e aceita de
  que **WCAG 2.4.7 deixa de ser atendido** — e a folha, coerente com isso, zera `:focus-visible` em
  botão, campo, item de menu, aba, interruptor, linha de lista e dispensa.

Opções, sem recomendação de implementação até a palavra do dono:

- **F-1 — o produto NÃO muda** (mantém os anéis de hoje; a folha não é portada nesse ponto). Prós:
  nenhuma regressão de acessibilidade; é a única opção que não exige decidir nada. Contras: a prancheta
  e o produto divergem visualmente onde o dono decidiu. **Confiança de ser o default seguro: 85%.**
- **F-2 — remover os anéis** como a folha declara. Prós: fidelidade total ao desenho e à decisão de
  2026-08-25. Contras: perda de conformidade WCAG 2.4.7 no produto inteiro, incluindo telas fora do
  019; no menu, o item ativo fica indistinguível do focado. **Confiança de que isto vira achado de
  homologação/segurança depois: 70%.**
- **F-3 — 2px como a spec pede, e a decisão da folha vale só para os espécimes da prancheta.**
  Prós: atende FR-1903 e mantém a navegação por teclado. Contras: contraria uma decisão datada do dono
  registrada na folha; precisa que ele confirme qual das duas manda. **Confiança: 60%.**

**Nenhuma das três entra em código antes da resposta.** Até lá, a PR-A porta os primitivos **sem tocar
em `:focus-visible`** (F-1 como estado de repouso, que é ausência de mudança, não escolha).

## Consequences

- **Positivo**: o DS continua com uma classe por arquivo e um dono por classe, com **teste**; a cópia
  local do `tf-alert--compact` morre em vez de virar a segunda definição permanente; `tf-frozen` não
  consegue mentir (visual e inércia vêm no mesmo componente); o token de ATENÇÃO entra com medida, não
  com fé; e os dois dispositivos de prancheta ficam barrados por máquina, não por lembrança.
- **Negativo / aceito**: quatro `.tsx` finos novos; a promoção do `--compact` **muda** uma superfície já
  homologada (016/PR-F A5) e obriga a re-medi-la; a baseline de tokens passa a 88 e todo PR que mexer em
  cor volta a ser um diff revisado (que é o ponto).
- **Risco declarado**: se a medida do §4 reprovar, a PR-A **para** no token e vai ao dono — o tom de
  ATENÇÃO é da US2, e cinco fatias dependem da PR-A. Mitigação: medir o contraste **no primeiro dia** da
  fatia, antes de portar qualquer superfície que use o tom.
- **Follow-ups**: `tf-table` é a peça com que a A11-r (densidade do Catálogo desktop) fecha, na PR-D ou
  na PR-F; a densidade resultante é **contada em itens visíveis sem rolar**, não avaliada por impressão.
