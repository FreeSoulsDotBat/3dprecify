# Research & decisões — 019 O porte do design (Fase 0)

Este arquivo é a **autoridade técnica** do incremento (o plano aponta para cá; **não existe**
`arquitetura-019.md` — o 018 provou que o research basta, Princípio VI).

Tudo aqui foi decidido **antes** da implementação (Princípio VIII). O que sustenta as decisões são
**fatos lidos no código em 2026-08-26**, não suposições — onde há medida, ela vem com arquivo:linha.
Onde uma autoridade contradiz outra, ou onde uma resposta do dono deixou um buraco, **eu paro e
apresento opções** em vez de escolher (§F e §D-3).

**ADRs desta rodada** — os quatro cobrem as decisões estruturais; o dono flipa cada um no gate da fatia
que o executa (precedente 0025–0031):

| ADR | cobre | flip no gate da |
| --- | --- | --- |
| **ADR-0032** (Proposed) | §A — os 8 primitivos, o token de ATENÇÃO, as guardas de folha | PR-A |
| **ADR-0031 §Emenda 2026-08-26** (Proposed) | §B — a quinta aba (Simulações desktop) | PR-F |
| **ADR-0033** (Proposed) | §C — observação de preço, fixação, unicidade de nome (+ o texto da Clarification para a 007) | PR-D |
| **ADR-0034** (Proposed) | §D — `computeQuote`, o congelamento do orçamento enviado | PR-E |

**Correções de escopo que a leitura devolveu** (todas na direção de *menos* trabalho do que o handoff
sugere — a terceira confirma a Ressalva 3 do PO):

1. `tf-alert--compact` já existe local, com geometria **diferente** (`features/calculator/shopee-warnings.css:5`).
2. `tf-badge--success` / `--danger` **já existem** (`shared/ui/badge.css:23,27`) — o handoff os marca
   "NOVO no lote 18"; no produto, não são.
3. `--tf-warning-deep`, citado pelo brief §2 como "que já existe", **não existe**: o que existe é
   `--tf-amber-deep` (`styles/tokens/colors.css:30`), que é o que a folha do handoff de fato usa.
4. Escritas de catálogo são **online-only, sem outbox** (`entities/catalog/use-catalog.ts:42,176`) — o
   cenário "dois aparelhos criam Gancho offline" da Q5 **não é alcançável hoje** (§C-3).
5. `quote_validity_days` **já existe** em `snapshots` (`models/__init__.py:652`) — "Válido até" não
   precisa de coluna (§D).

---

## A — Os primitivos moram no primitivo que já existe, ou nascem com componente dono

**Decisão** (ADR-0032): duas regras e nenhuma terceira. **Tom, largura ou densidade de algo que já
existe** → entra no `.css` daquele primitivo e vira **prop** do `.tsx` dele (`Alert` ganha `compact`,
`action`, `onDismiss`, `tone="warning"`; `Button` ganha `width`; `Segmented` ganha `split`; `Badge`
ganha `warning`). **Primitivo novo** → `shared/ui/<nome>.tsx` + `shared/ui/<nome>.css`, no molde dos 18
que já existem: `Aviso`, `PList`, `Table`, `Frozen`.

**Por que não uma folha `porte-019.css` com tudo**: no produto, cada `.css` é importado pelo `.tsx` que
o usa (`shared/ui/alert.tsx:5` → `./alert.css`); não há import global de `shared/ui`. Uma folha sem
componente dono ou é código morto, ou vira um import solto em `global.css` — e, pior, faria
`tf-alert--*` existir em dois arquivos, que é exatamente o defeito que já aconteceu sozinho uma vez.

**Por que não utilitário do Tailwind**: ADR-0007 decidiu contra a pele de utilitários; nada mudou.

**As duas guardas** (em `apps/web/src/styles/`, ao lado do `token-parity.test.ts`):
1. **uma classe `tf-*`, um arquivo** — varre todo `*.css` de `apps/web/src`, extrai definições, falha em
   nome duplicado. Fica **vermelho antes** da promoção do `--compact` e verde depois;
2. **`tf-phone-scroll` e `tf-price--rola` = zero ocorrências**, no código **e no bundle** (a folha do
   handoff é arquivo versionado em `docs/` — um `cp` distraído é o caminho mais provável de eles
   entrarem).

**O contrato do `tf-frozen`** (o ponto que a pergunta do plano levanta): ele **veste**, não inerta. Quem
inerta continua sendo o `<fieldset disabled>` nativo que o produto já usa (`filament-form.tsx:56`,
`produto-page.tsx:298,366,386`). Para que "congelado por fora, vivo por dentro" seja irrepresentável,
`<Frozen>` **é** um `<fieldset disabled className="tf-frozen">`, sem prop para desligar o `disabled`. O
`background` faz parte obrigatória da regra, o esmaecimento é nos CONTROLES (o wrapper com `opacity`
derruba a dica para 2,58:1), e **quem precisa continuar clicável fica fora do `<Frozen>`** — um
`fieldset` desabilitado desabilita tudo que estiver dentro, inclusive o caminho da assinatura.

**O que muda de verdade e o plano precisa orçar**: promover `tf-alert--compact` **apaga** a cópia local
e **muda a geometria** do aviso da Shopee em ~8px (a local usa `align-items:center` + padding 8/12; a do
handoff, `flex-start` + 12 e gap 8). A fatia **re-mede** a seção a 360px contra a medida do 016/PR-F.
Confiança de que a geometria do handoff é a certa: **75%**; caminho de volta declarado no ADR.

**O token `--warning-text` entra com gate de medida, não com valor assumido.** Calculei (WCAG sobre
sRGB): `#bd6c0e` ≈ **3,9:1** sobre branco e ≈ **3,5:1** sobre `--tf-warning-soft` no claro — **abaixo de
4,5:1**. Não trato como fato: a PR-A **mede**; passando, entra como está; reprovando, o tom claro é
escurecido e **isso é decisão do dono** (é cor de marca). O ícone isolado pode ficar no tom da folha
(não-texto responde a 3:1); o **texto** não. E a baseline do `token-parity.test.ts` vai de **87 para 88**
como mudança revisada (`:17`).

**Proíbe**: classe `tf-*` definida em dois arquivos · CSS sem componente dono · utilitário solto ·
`tf-phone-scroll`/`tf-price--rola` · reverter 015/A6 e 016/T018-A1 · esmaecimento por `opacity` no
contêiner · `tf-frozen` sem inércia real.

---

## B — Simulações é a quinta aba, e entra por EMENDA datada no ADR-0031

**Decisão**: emenda datada no ADR-0031 (§Emenda 2026-08-26), **não** ADR novo.

**Por quê**: o próprio ADR-0031 previu o caso no follow-up — *"se um dia uma quinta tela quiser um
limiar diferente…"*. Simulações **não quer**: mesmo limiar (1280px), mesmo hook (`useIsWide`), mesma
propriedade estrutural (`false` sem `matchMedia` ⇒ o ramo mobile é o mesmo código e a suíte existente
continua exercitando-o), mesma regra de seleção (estado do componente, nunca a URL). Um ADR novo
repetiria a decisão inteira sem decidir nada, e criaria **duas fontes para um limiar só** — que é o que
a Option B do 0031 rejeitou. **Confiança: 90%** (a alternativa "ADR próprio" fica em 70% de divergir em
dois incrementos, a mesma estimativa da Option B).

**Consequência de projeto**: a lista de simulações que hoje mora numa gaveta
(`features/scenarios/scenarios-list-sheet.tsx`) **muda de hospedeiro, não de identidade** — o mesmo
componente montado na composição larga, nunca uma segunda cópia (a regra §E do research do 018).

**Proíbe**: segundo `matchMedia`, limiar diferente, seleção na URL, qualquer toque no ramo mobile — e
inferir a composição: o layout ≥1280px é o da prancheta 20g, transcrito por fatia.

---

## C — O Catálogo ganha dado novo sem virar fonte de preço

**Decisão** (ADR-0033), governada por uma frase que substitui a leitura ingênua do invariante do E2:

> O app **nunca exibe um preço que ele mesmo calculou no passado**. Exibe **o cálculo de hoje** ou **o
> número que o vendedor declarou**.

### C-1 — Observação de preço: tabela própria, **uma linha por (conta, item)**

Rejeitadas: **colunas em `products`** (põe dinheiro na linha do produto, a um `SELECT` de virar "o
preço" — 65% de uso indevido em dois incrementos) e **append-only** (≈73 mil linhas/conta/ano das quais
só a última é lida; um append-only existe quando as linhas antigas são **prova**, e uma observação não
prova nada). Escolhida: `price_observations`, `UNIQUE (owner_uid, subject_kind, subject_id)`,
`subject_id` **sem FK** (precedente ADR-0019 §5 / ADR-0021 N2), migração **0008** aditiva. **Confiança:
80%.**

**Quem escreve é o CLIENTE** — é o único que sabe calcular (ADR-0008: o backend nunca recomputa). O
servidor valida e guarda; não deriva, não compara, não conta. A contagem "3 preços mudaram" é derivada
no cliente comparando o recomputado de hoje com a observação lida.

**Quando escreve**: ao abrir a lista, **depois** do recompute bem-sucedido, em lote (`PUT`), idempotente
por item. **A assimetria é o desenho**: escrita falha ⇒ a marca não avança ⇒ o vendedor vê o mesmo aviso
de novo (repete uma verdade). Escrever **antes** de exibir esconderia uma mudança real — proibido.

**Superfície separada do produto**: `GET`/`PUT /api/v1/price-observations`. `ProductOut` continua sem
campo de dinheiro, e isso segue verificável no contrato congelado pelo drift-guard.

**Efeito colateral aceito e visível**: recarregar a página "consome" a visita — o aviso da visita
anterior some. É o significado literal de *"desde a sua última visita"*; registro porque parecerá
defeito para quem não souber.

### C-2 — Fixar preço: coluna nullable em `products`, com nome que denuncia o uso indevido

`seller_fixed_price` (`MONEY_SETTLED NULL`, com o `CHECK` `NULL OR (>=0 AND <> 'NaN')`) +
`seller_fixed_at`. `NULL` = acompanhando o custo. **Confiança: 80%** (alternativas: tabela paralela 45%,
JSONB 20%).

**A regra que a leitura ingênua erraria**: o preço fixado **não entra em composição**. `computeBom`
compõe kit a partir de **entradas**, e o construtor da PR-E vende **direto** (Q6: marketplace fora) — o
número fixado é o preço do **anúncio**, que embute comissão. Usá-lo como unitário de venda direta
cobraria do cliente uma comissão que não existe naquela venda: um número plausível e errado.
**Confiança de que a leitura ingênua produziria esse erro: 80%.** Fixar é do Catálogo; kit, orçamento e
cenário seguem o motor.

### C-3 — Unicidade de nome: `name_norm` + índice único **parcial**, e uma regra só no servidor

`name_norm` TEXT NOT NULL em `filaments`/`printers`/`products`/`boms` + `UNIQUE (owner_uid, name_norm)
WHERE deleted_at IS NULL`. "Por tipo" cai de graça (são tabelas diferentes). Normalização: `NFD` →
remover `Mn` → minúsculas (`lower()`/`toLowerCase()` — **não** `casefold()`, que diverge em `ß`) →
`trim` → colapsar espaços. **Vetor de casos compartilhado** exercitado nos dois lados; o servidor é a
autoridade. **Confiança: 80%** (extensão `unaccent` rejeitada: não é IMMUTABLE, não entra em índice sem
wrapper, e vira dependência de provisionamento por uma regra de texto).

**Um comportamento no servidor** (conflito ⇒ renomeia com sufixo, em silêncio — decisão do dono) e a
**recusa no formulário, no cliente, antes de enviar**. Online o vendedor quase nunca alcança o servidor
(o formulário barrou); a corrida real entre dois aparelhos resolve sozinha, sem descartar nada (R6).

**O que a Q5 NÃO autoriza — e é o ponto que mais economiza a PR-D**: criar fila offline para o catálogo.
Medido: não existe. O "caminho offline do conflito" da FR-1915 se exercita como **corrida de
concorrência no servidor**, não como teste de outbox. **Confiança do fato medido: 90%.**

### C-4 — A Clarification datada da 007

O texto está escrito, pronto para colar, em **ADR-0033 §Decision 5**. O `plan` aplica; este research e o
ADR **não** editam a 007.

**Proíbe**: backend recomputando preço · valor guardado alimentando o número GRANDE · `ProductOut` com
dinheiro derivado de cálculo · fila offline de catálogo · descartar escrita do usuário num conflito ·
preço fixado participando de kit/orçamento/cenário.

---

## D — A regra do construtor mora no motor; o congelamento é o do E4

**Decisão** (ADR-0034): função **nova** `computeQuote` no `pricing-core`, sobre `computeBom`; e o
orçamento enviado vira um `snapshot` com `kind='QUOTE'` e `headline_basis='PRECO_ORCAMENTO'`.

**Fato que encurta a fatia**: `computeBom` **já** faz N linhas × quantidade com a regra de dinheiro da
ADR-0008 e já devolve `custoTotal` (o piso) e `precoVarejo` (a base). O que falta é o desconto —
e só ele.

**Por que função nova e não estender `computeBom`**: estender põe um parâmetro de **orçamento** numa
função de **kit**, e um opcional em rota quente é como alguém aplica desconto num kit sem querer. Por
que não compor na tela: a FR-1916 proíbe soma paralela, e dois lugares arredondando dinheiro divergem
num centavo que ninguém vê (**70%** de que aconteceria). **Confiança na escolhida: 85%.**

**Versão: 4.1.0 → 4.2.0 (MINOR)** — nenhuma computação existente muda; o pacote ganha capacidade
(precedente 016/PR-F). A prova exigida antes do bump valer é a varredura de igualdade 4.1.0↔4.2.0 sobre
`computeCalculator`/`computeBom` (a lição do 014/C: versão bumpada sem diferença medida, ou implementação
reescrita sem bump, são o mesmo tipo de mentira).

**Piso**: `belowCost = netTotal < costFloor`, **estritamente** — empate não é "abaixo". **Q10
confirmada: avisa, não bloqueia** (90%) — orçamento abaixo do custo é decisão legítima do vendedor.
**Q7 confirmada: "Válido até" é texto no documento** (85%), usando o `quote_validity_days` que já
existe; vencer de verdade exigiria autoridade de relógio (e `device_quoted_at` é, por decisão do E4, um
carimbo do aparelho que o servidor não verifica) e superfície de notificação — dois produtos novos por
uma linha impressa. **Q8 confirmada: congela + PDF**, sem link nem e-mail (zero superfície nova).

**A armadilha de banco que a migração TEM que resolver junto** (achado desta análise): o `CHECK`
`headline_matches_totals` escolhe a chave do total por `CASE` sobre `headline_basis`
(`models/__init__.py:618-626`). Um valor de enum novo cai no `ELSE` implícito, o `CASE` devolve **NULL**
e **um `CHECK` que avalia NULL PASSA** no PostgreSQL — ou seja, adicionar o enum sem estender o `CASE`
**desliga em silêncio** a amarração entre o total do cartão e o total do documento. O `CASE` é estendido
na mesma migração, e um teste insere um orçamento com total divergente **esperando a recusa**. O espelho
na aplicação (`_BASIS_TOTAL_KEY`, `api/history.py:71-74`, um dict cuja chave faltante é `KeyError` ⇒ 500
que o outbox re-tenta para sempre) ganha guarda estrutural: o conjunto do `Literal` **é igual** ao
conjunto das chaves do dict.

### D-3 — RESOLVIDO pelo dono (2026-08-27): a US18 sai do construtor (Q9-2')

A US18 quer *"10 un. sai mais barato que 9"* derivado das **faixas progressivas do marketplace** (Q9,
default) — mas a **Q6, decidida, tira o marketplace do construtor**. Sem faixa e sem troca de markup por
quantidade, o total é **monotônico por construção**, e o aviso **nunca dispara**. Três opções, nenhuma
implementada antes da resposta: **Q9-1** o construtor escolhe varejo/atacado (o aviso passa a ser real;
inventa decisão de produto — 55%) · **Q9-2** a US18 migra para as telas onde a faixa existe, virando a
superfície visível da propriedade já provada (70%) · **Q9-3** a US18 fica como propriedade testada sem
superfície (60%). **Decisão do dono (2026-08-27): retirar a US18 do construtor** — "não aplicável à venda direta"; a propriedade band-dominance segue provada no motor para o preço de anúncio (marketplace), sem superfície nova nesta fatia (variante da Q9-2 sem migrar a superfície). FR-1918 marcada RETIRADA no spec. US16/US17 seguem intactas.

**Proíbe**: aritmética de dinheiro na tela · desconto por item ou duas vezes · comissão de marketplace
no construtor · segundo mecanismo de congelamento · gravar o total descontado em `totals.precoVarejo`
(faria o documento imutável afirmar que o **motor** calculou aquele número) · total líquido negativo.

---

## E — Premium sem parede: a barreira de escrita é estrutural, e o servidor não é tocado

**Fato medido que resolve a maior parte da US8 de graça**: o servidor **já** deriva do LEDGER uma união
de três estados — `none | active | lapsed` (`backend/app/entitlement/__init__.py:31,55-81`) — e as duas
portas já são diferentes: `require_catalog_read` aceita `lapsed` e **recusa** `none` (:105-113);
`require_entitlement` (escrita) exige `active` (:92-100). Ou seja, **"nunca teve" × "teve e venceu" já é
estrutural do lado do servidor**, e a distinção que a US8 pede é a leitura desse campo — não uma
heurística de tela e **não** um gate novo. **Diff em `app/entitlement/` = vazio** (SC-1903/SC-709) é
consequência do desenho, não disciplina.

**Decisão E-1 — onde mora a união no cliente**: uma função **pura** `premiumGate(entitlement, session)`
→ união discriminada, em **`shared/billing/`**, ao lado do `PremiumTeaser` que já vive lá
(`shared/billing/premium-teaser.tsx`). Rejeitado `entities/user/` (é onde o **dado** mora, e está certo
que fique lá — mas `shared` não pode importar `entities`, e o vazio didático + o formulário inerte são
peças de `shared/ui`/`shared/billing` consumidas por quatro páginas). Rejeitado `features/<cada uma>`
(FSD-Lite proíbe feature→feature; quatro cópias divergiriam). A função recebe uma **forma estrutural**
(`{status}`), como o `plan-view.ts` do E6 faz com `EntitlementLike` — assim ela não importa nada e todo
mundo pode importá-la. **Confiança: 75%.**

Estados (nomes finais no plano; a copy é transcrita da prancheta, nunca escrita aqui): `active` ·
`lapsed-com-itens` · `free-nunca-teve` · `unknown` (sem resposta do servidor — nunca "presume grátis"
nem "presume premium", o precedente `PlanState` do E6).

**Decisão E-2 — a barreira de escrita é a AUSÊNCIA do handler, não um `disabled`**: no estado grátis o
formulário é montado **sem** `onSubmit` de rede. Não existe "existe mas está desabilitado": a função que
enfileira/envia **não é passada**. Somado ao `<Frozen>` (§A), que é um `<fieldset disabled>` real, o
botão nasce desabilitado **e** não há caminho de código para uma escrita. **Um teste prova por ausência**
(o mock de rede recebe **zero** chamadas), no molde do SC-709: suíte verde prova que nada quebrou;
ausência prova que nada aconteceu.

**Decisão E-3 — nada entra no outbox, e isso é fácil porque o outbox não é do catálogo**: o outbox
(ADR-0018) é **exclusivo do Histórico**, e escritas de catálogo são online-only (medido). A AC "0 itens
na fila" se prova diretamente; e a fatia **não pode** criar fila nova (a PR-D reforça: observação de
preço é online-only, §C-1).

**Decisão E-4 — a parede que sai é a de `catalogo-page.tsx:106-110`** (`if (signedOut || status ===
"none") → <PremiumTeaser>`), e o vazio didático ocupa **também** o ramo `ENTITLEMENT_REQUIRED` do painel
(`catalog-panel.tsx:228-231`): para quem nunca teve, a lista **é** um 403, então é ali que o vazio nasce
— não numa lista vazia que nunca chega. Invariante do 016/US1 mantido: **um teaser, nunca dois**.

**E-5 — RESOLVIDO pelo dono (2026-08-27): o deslogado vê o MESMO caminho sem parede, com "Assinar Premium" visível; no clique é promptado a criar conta/entrar (intenção preservada via o `redirect` que o `TeaserUpgrade` já usa — `/sign-in?redirect=/conta?assinar=1`) e segue ao checkout. A tela/prompt de entrada-com-intenção NÃO está prototipada → prompt gerado para o Claude Design (`docs/design/prompts/019-lote32h-deslogado.md`). Registro histórico das opções:** O lote 32 desenha o visitante **grátis**;
`signedOut` é outro caso (não há conta, não há ledger, e "Assinar Premium" precisa de conta). Opções:
**(a)** deslogado continua vendo a superfície de entrada de hoje e o lote 32 vale só para o logado sem
premium — é a única que não inventa copy nem fluxo (**80%**); **(b)** deslogado vê o mesmo vazio + o
formulário inerte, com a ação primária levando ao login — mais demonstrativo, mas exige copy que a
prancheta não tem; **(c)** deslogado vê o formulário inerte sem nenhuma ação — rejeitada (beco sem
saída). Recomendo **(a)** até o dono dizer o contrário; nenhuma frase nova é escrita por agente.

**Proíbe**: qualquer diff em `app/entitlement/` · heurística de tela para distinguir nunca-teve de
venceu · handler de escrita montado no estado grátis · escrita do grátis na fila · dois teasers na
mesma tela · exibir item que o servidor não devolveria.

---

## F — RESOLVIDO pelo dono (2026-08-27): o anel de foco SAI (F-2)

`spec.md` FR-1903 pede **anel de 2px** e o anel do menu em `--accent`.
`docs/design/handoff-019/tf-components.css:60-63` registra **decisão do dono de 2026-08-25**: *"nenhum
controle mostra indicador de foco"*, com a consequência declarada e aceita de que **WCAG 2.4.7 deixa de
ser atendido** — e a folha zera `:focus-visible` em botão, campo, menu, aba, interruptor, linha e
dispensa, coerentemente.

**Decisão do dono (2026-08-27, via AskUserQuestion, reafirmando a de 25/08): F-2 — remover.** Nenhum controle mostra indicador de foco; campos mantêm só a borda de acento. Consequência aceita e registrada no spec §Clarifications como exceção explícita ao WCAG 2.4.7. A guarda geométrica de foco do 018 vira guarda do INVERSO (zero anel em :focus-visible), provada por mutação. Registro histórico das opções (ADR-0032 §7): **F-1** o produto não muda (default de repouso, é
ausência de mudança — 85%) · **F-2** remover os anéis como a folha declara (70% de virar achado de
homologação/segurança depois) · **F-3** 2px como a spec pede, e a decisão da folha vale só para as
pranchetas (60%). ~~Até a resposta, a PR-A porta os primitivos sem tocar em `:focus-visible`.~~ **Resolvido: a PR-A zera `:focus-visible` conforme a folha (linhas 191, 252, 353-355, 603-604, 714, 757, 779 do tf-components.css).**

---

## G — A dispensa do selo é uma CHAVE DE CONTEÚDO, então "até a fonte mudar" não precisa de invalidação

**Decisão**: a dispensa guarda a **identidade da fonte**, não um booleano. A chave é
`(marketplace, source, effectiveDate)` — os campos que o produto já carrega em
`feeSource`/`fixedFeeSource` (`features/calculator/calculator-model.ts:95,189`). Quando a citação ou a
data mudam, a chave é **outra**, e uma chave que não está no conjunto de dispensadas simplesmente não
está dispensada: o selo **reaparece sozinho**, sem código de expiração, sem comparação de datas, sem job.
**Confiança: 85%.**

**Onde**: `localStorage` (persiste entre sessões — D3), device-scoped, **sem uid**: o conteúdo é
identificador de fonte pública (marketplace, URL, data), não dado da conta — então não há o que vazar
entre contas e a purga de sign-out não se aplica. Lista **limitada** (as N mais recentes) para não
crescer sem fim. Molde do `theme-store`/`precifica3d-nav-rail` (ADR-0031).

**Proíbe**: guardar "dispensado: true" sem a fonte · esconder número ou mudar cálculo ao dispensar.

---

## H — "Entendi" da plausibilidade vive na SESSÃO, em memória, chaveado por campo+valor

**Decisão**: um store leve em `features/calculator` (módulo/Zustand, **em memória**), chave
`${campo}:${valorNormalizado}`. Sobrevive à navegação entre abas dentro do app (o que "pela sessão"
significa para quem usa) e morre ao recarregar. Dispensado `850 g`, o aviso **volta** em `2.400 g`,
porque a chave é outra — a mesma ideia do §G aplicada a outro dado. **Confiança: 80%.**

Rejeitados: `localStorage` (dispensa vira permanente — não é o que a US9 pede) e estado do componente
(morre ao sair da aba e volta a incomodar no mesmo valor).

**Proíbe**: o aviso bloquear o cálculo · alterar qualquer número · sumir junto com um erro de validação
(erro e aviso são categorias diferentes — US2) · dinheiro sem o formato do produto.

---

## I — T212 (resumo fixo do preço, mobile 390px): `sticky` no topo, nunca `fixed` no rodapé

**Decisão**: `position: sticky` no topo da coluna do formulário, **dentro** do fluxo. **Confiança: 75%.**

**Por que não `fixed` acima da TabBar**: aquele slot **já é do toaster** — `.tf-toaster` fica em
`bottom: calc(var(--tabbar-h) + var(--space-3))` (folha do produto, copiada em
`handoff-019/tf-components.css:721`). Um resumo fixo ali colidiria com **todo** toast do app, e o projeto
já pagou (016/PR-B) por sobreposição que headless não desenha. `sticky` também não precisa de matemática
de viewport e não briga com o teclado do celular.

**Risco herdado do ADR-0031**: `sticky` morre em silêncio se um ancestral ganhar `overflow` diferente de
`visible` — guarda de geometria nos **dois eixos**, medindo que o resumo continua visível durante a
rolagem a 390px (caixa, não `toBeVisible`).

Esta é a **única** mudança estrutural autorizada no mobile (US12 AC1); a garantia estrutural do 018 não
é gasta em mais nada.

---

## J — Vocabulário "canal"→"marketplace": pelas chaves de i18n, e o diff de teste é lido separado

**Decisão**: a troca acontece **nos valores** de `messages.pt-br.ts` (e no texto embutido que virar
chave), **nunca** em símbolos, chaves, rotas ou nomes de arquivo. Medido pelo brief: 153 ocorrências sob
`apps/`, 31 em `messages.pt-br.ts`, **48 num único spec** cujo nome carrega a palavra.

**Regra de revisão (R3)**: o diff de **teste** é lido **separado** do diff de **produto**. Uma
busca-e-troca cega que atualiza asserção e código junto transforma o teste em tautologia e ninguém vê. E
**payload congelado não se toca**: um orçamento antigo com `"canal"` dentro do documento abre idêntico —
é registro imutável, não texto de tela (ADR-0019).

**Proíbe**: renomear `channel*` · hard-code novo de texto · tocar em payload persistido · alterar o nome
de `cf-010-canais.spec.ts`.

---

## K — O que este incremento NÃO toca (registro, para o plano não descobrir na fatia)

`packages/fee-ingest` e qualquer tarifa (`catalogVersion` intocado — o 017 corre em paralelo) · o gate de
entitlement (`app/entitlement/`) · a fórmula da calculadora (a PR-C **não** bumpa
`PRICING_MODEL_VERSION`; só a PR-E bumpa, e para MINOR) · o ramo mobile fora da T212 · o mecanismo de
imutabilidade do E4 (só o enum cresce) · o outbox (nenhuma escrita nova entra nele).
