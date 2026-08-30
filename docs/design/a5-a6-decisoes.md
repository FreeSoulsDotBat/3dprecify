# A5 · A6 — decisões de design (follow-ups da homologação T072 do 016)

Origem: `specs/016-correcao-homologacao/dod-evidence.md` §Polish, achados A5 e A6.
Autoridade: designer-ux, 2026-08-07. Destino: implementação direta por `dev-frontend`.
Base medida no código real: `apps/web/src/shared/ui/price-hero.{tsx,css}`,
`apps/web/src/shared/ui/info-tip.{tsx,css}`, `apps/web/src/shared/ui/field.{tsx,css}`,
`apps/web/src/features/bom/assembly-summary.{tsx,css}`,
`apps/web/src/shared/i18n/messages.pt-br.ts`,
`apps/web/src/styles/tokens/{typography,spacing}.css`.

Ordem de leitura para implementar: **A5 → A5-b → A5-c → A5-d** (as emendas são correções de campo,
cada uma disparada por uma medição real; A5-b/c/d valem para o cartão fixado do kit).

---

## A5 — o preço-herói: centavos e símbolo deixam de ser decoração

### Causa medida (não é escolha de escala, é base de `em` errada)

`.tf-price__cur` é `0.42em` e `.tf-price__dec` é `0.5em`, mas o `em` resolve contra
`.tf-price__amount`, que **não tem `font-size`** e portanto herda 16px do body. O tamanho do
preço vive em `.tf-price__int`, que é **irmão**, não ancestral. Daí os 6,72px (0,42 × 16) e os
8px (0,5 × 16) que a homologação fotografou — exatamente os números do achado. As proporções
escritas no CSS sempre estiveram certas; a base estava no lugar errado.

### DECISÃO (valores exatos)

Mover a base tipográfica do inteiro para o contêiner e deixar o inteiro herdar:

```css
.tf-price__amount {
  font-size: var(--fs-price);            /* NOVO — a base do em passa a ser o preço */
}
.tf-price__int {
  font-size: 1em;                        /* era var(--fs-price) */
}
.tf-price__cur {
  font-size: 0.4em;                      /* era 0.42em */
  transform: translateY(-0.55em);        /* INALTERADO — ver "não pode acontecer" */
}
.tf-price__dec {
  font-size: 0.5em;                      /* INALTERADO — só a base muda */
}
/* os dois modificadores migram de __int para __amount, sem mudar de valor */
.tf-price--lg .tf-price__amount { font-size: clamp(3rem, 12vw, 4.75rem); }
.tf-price--md .tf-price__amount { font-size: var(--fs-2xl); }
```

Nenhum token novo, nenhuma escala nova, nenhuma media query nova: `--fs-price`, `--fs-2xl` e as
duas `clamp()` já existentes continuam governando o tamanho.

**Valores resultantes a 360px** (dominância inteiro : centavos : símbolo = 1 : 0,50 : 0,40):

| variante | onde vive hoje | base (inteiro) | R$ | centavos |
|---|---|---|---|---|
| `md` | Varejo/Atacado da calculadora (`calculator-form.tsx`) | 36px (`--fs-2xl`) | **14,4px** (era 6,72) | **18px** (era 8) |
| default | `assembly-summary.tsx` (grid 2 col) | 40px (piso da `clamp`) | **16px** | **20px** |
| `lg` | não usado hoje | 48px (piso da `clamp`) | 19,2px | 24px |

**Viewports maiores** — nada a decidir, a `clamp()` já responde: o braço `9vw` do default engata
a partir de 444px e satura em 60px a partir de 667px (R$ 24px · centavos 30px); o `12vw` do `lg`
engata a partir de 400px e satura em 76px a partir de 633px (R$ 30,4px · centavos 38px); `md` é
fixo em 36px em todo viewport, por ser a variante dos cartões de resultado que precisam caber em
dois no desktop.

### PORQUÊ

Num produto cujo objeto é preço, o centavo é informação de negócio: 18px é o corpo do texto da
casa (`--fs-base` = 16px) mais um passo, ou seja, os centavos passam a ser **legíveis como número**
e não como sobrescrito ornamental, enquanto os 36px do inteiro mantêm 2:1 de dominância — o olho
continua caindo primeiro no inteiro. E a correção é de **base**, não de escala: as proporções
0,4/0,5 são as que o DS já declarava, agora aplicadas ao que o autor original quis aplicá-las.

*Alternativas descartadas:* (a) subir `--fs-caption`/criar `--fs-price-dec` — inventa escala nova
e vaza para telas que não são preço, confiança 30%; (b) reescrever os spans com px absolutos por
variante — três lugares para errar a cada mudança de token, confiança 40%; (c) a decisão acima,
3 linhas mudadas e duas migradas, **confiança 92%**.

### O QUE NÃO PODE ACONTECER

1. **Reintroduzir o scroll do item 9 (PR-B/016).** A altura da linha **não muda**: a caixa de linha
   já era ditada pelo filho `__int` (36/40px × `line-height: 1.2`); depois da mudança o strut do
   contêiner passa a ter o mesmo tamanho, e os centavos (0,5em) e o R$ (0,4em) ficam folgados
   dentro dela. Se `scrollHeight > clientHeight` aparecer em `.tf-price__amount`, a mudança
   **foi implementada errada** (provavelmente `line-height` mexido junto) — não se resolve com
   `overflow-y: hidden`, que esconde a barra sem remover o overflow.
2. **`transform: translateY(-0.55em)` do R$ não sobe junto com a fonte para fora do cartão.** O
   `em` do transform resolve contra o próprio `.tf-price__cur`: −0,55 × 14,4 = −7,9px em `md`, com
   o topo do glifo a ~18,4px acima da baseline contra 26,2px do inteiro — o símbolo permanece
   **dentro da faixa de altura de caixa alta do inteiro**. Não alterar esse valor; se alterado,
   ele passa a colidir com o `__label` acima.
3. **Overflow horizontal a 360px.** A linha do valor fica ~21px mais larga. O caminho de escape já
   existe e é intencional (`flex-wrap` entre R$ / inteiro / centavos, depois `overflow-x: auto`),
   mas o inteiro **nunca** pode quebrar dentro de si (`word-break: keep-all`, 015/A6 — número
   partido é outro número). O ponto apertado é `assembly-summary.tsx`. **Remédio pré-autorizado:**
   `size="md"` nos dois `PriceHero` do resumo. **Ele foi aplicado e NÃO bastou no cartão fixado —
   ver as emendas A5-b, A5-c e A5-d abaixo, que são a decisão vigente para aquele bloco.**
4. **Esquecer de migrar os dois modificadores.** Se `--md` continuar em `.tf-price__int`, o R$ e os
   centavos passam a ser calculados sobre 40px dentro de um cartão de 36px — erro invisível a olho
   nu e visível na asserção abaixo.

### ASSERÇÃO RECOMENDADA

Teste de componente (jsdom não computa `clamp`/`em` — **precisa ser no browser**, Playwright, a
360×800), na tela `/calcular` com a semente do 016:

1. **Proporção, pinada em px:** para o cartão "Preço varejo" (`md`), `getComputedStyle` de
   `.tf-price__int` = `36px`, `.tf-price__cur` = `14.4px`, `.tf-price__dec` = `18px`.
2. **A REGRA, para sobreviver a uma troca de token:** `int > dec > cur`, **e** `dec >= 16px`
   (centavos nunca abaixo do corpo de texto), **e** `cur >= 14px`, **e** `dec <= 0.55 * int`
   (o inteiro continua dominante).
3. **Zero regressão de layout:** `document.documentElement.scrollWidth <= 360`, e para cada
   `.tf-price__amount` da página `scrollHeight <= clientHeight` (o eixo Y do item 9 — medir os
   **dois** eixos, headless não desenha a barra clássica).
4. **Não-vacuidade por mutação:** removendo `font-size: var(--fs-price)` de `.tf-price__amount`, a
   asserção (1) tem de falhar com `6.72px`/`8px`. Se passar, o teste está medindo o elemento errado.

---

## A5-b — emenda 2026-08-07: o cartão FIXADO do kit (o remédio pré-autorizado não bastou)

A guarda mediu o que a decisão A5 mandou medir, e achou o aperto num lugar diferente do que a
minha conta de gutters supunha: **`.assembly-summary__pinned`** (a barra sticky "Total do kit",
014/T118). Ali cada `.tf-price__amount` tem **89px** de `clientWidth`, e com `size="md"` já
aplicado o valor soma ~97px (R$ 17,5 + inteiro 45,1 + centavos 26,0 + 8 de gaps) ⇒ o `",24"`
quebra para a segunda linha. Antes da correção de base cabia por acidente (cur/dec a 6,7/8px
somavam ~72px): a correção não criou o aperto, **expôs** o aperto.

### A opção (ii) está fechada — por aritmética, sem precisar destravar nada

Não há largura presa em nenhum `w-fit`. Os 89px medidos reconstroem a linha inteira:
`2 × 89 (amount) + 4 × 24 (padding lateral do próprio PriceHero) + 8 (gap do grid) = 282px`, contra
os ~296px úteis dentro do Card fixado a 360px (328 − ~16 de padding × 2). **O Card já está
esticado**; a largura não sumiu, ela foi para os 96px de padding dos dois heroes. E o teto
`--app-max: 460px` prova que nenhum breakpoint salva duas colunas: mesmo no limite da coluna móvel
cada célula chegaria a ~138px, e `"R$ 1.234,56"` em `md` precisa de ~148px.

**E o argumento que encerra (iii) e (iv):** 89px não comportam `"R$ 1.234,56"` nem em **16px de
texto corrido** (~94px). Uma célula que não cabe um total de kit realista no corpo do texto não é
célula para dinheiro em tamanho nenhum — logo não existe solução tipográfica, (iii) morre sem
precisar da escala nova que eu mesmo rejeitei, e (iv) venderia "preço quebrado" como recurso
justamente no número pelo qual o vendedor abriu a tela.

### DECISÃO — (i) com de-cromagem: uma coluna, rótulo à esquerda / valor à direita, SEM breakpoint

O par fixado deixa de ser dois cartões lado a lado e vira duas **linhas de leitura**, no mesmo
padrão do `BreakdownRow` que já está logo acima dele. Só o bloco FIXADO muda; o resumo não-fixado
mantém o `grid-cols-2` e o tom `accent`.

1. Em `assembly-summary.tsx`, **no bloco fixado**, trocar `className="grid grid-cols-2 gap-2"` por
   `className="assembly-summary__pinned-prices"`. Os dois `PriceHero` mantêm `size="md"` (base
   36px, pré-decisão A5).
2. Em `assembly-summary.css`:

```css
/* A5-b — a barra fixada é um READOUT compacto, não uma grade de cartões: a 360px duas colunas
   deixam 89px por valor, largura que não comporta "R$ 1.234,56" nem em texto corrido. Uma coluna
   com rótulo à esquerda e valor à direita devolve largura ao número E deixa a barra MAIS BAIXA
   que a grade de dois cartões — o oposto do custo de altura que se temia ao empilhar. */
.assembly-summary__pinned-prices {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}
.assembly-summary__pinned-prices .tf-price {
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  /* o tom accent pinta `color: var(--accent-contrast)` (claro, para fundo roxo); sem o fundo isso
     vira texto claro sobre superfície clara. `--accent-text` é o token de texto accent SOBRE
     superfície — mantém a ênfase e o contraste. */
  color: var(--accent-text);
}
.assembly-summary__pinned-prices .tf-price__label {
  white-space: nowrap;
}
```

**Números a 360px.** Altura do bloco de preços: 2 × 43,2 (`36px × line-height 1.2`) + 8 (gap) =
**94,4px**, contra ~107px da grade de dois cartões ⇒ **a barra fixada encolhe ~13px**. Nenhum
token novo, nenhuma variante nova, nenhum breakpoint. Confiança **90%**.
**Correção de campo:** a largura que eu previ para o valor (~216px) estava errada porque o rótulo
mede ~101–109px, não ~60 — ver A5-c.

### O QUE NÃO PODE ACONTECER

1. **Aplicar o override fora do fixado.** O resumo não-fixado mantém os dois cartões `accent` lado
   a lado — é lá que o par tem largura e é lá que o realce de cartão paga o espaço que ocupa.
2. **Esquecer o `color`.** Manter `.tf-price--accent` sem o fundo roxo e sem `color: var(--accent-text)`
   pinta `--accent-contrast` (claro) sobre superfície clara: preço ilegível, e nenhuma asserção de
   texto vê isso (é a lição de contraste do 014 com outra roupa).
3. **A barra fixada crescer.** A decisão só é válida se a altura NÃO aumentar — uma barra sticky
   come viewport exatamente na tela em que o vendedor compõe o kit (014/T118 nasceu disso).
4. **Voltar a "caber por acidente".** O guard tem de medir com um valor de 5 dígitos, não com a
   semente: foi um valor curto que deixou este defeito dormir até agora.

---

## A5-c — emenda 2026-08-07 (2ª medição): os 8px que faltavam no extremo de 5 dígitos

MEDIDO com `"R$ 24.215,76"` a 360×800: root do hero fixado = **286px** úteis; o valor pede **173px**
(cur 17 + int 122 + dec 26 + 2 gaps de 4) e o rótulo pede **~101–109px** — o `flex-shrink` padrão
espremia o `amount` para 165px, derrubando o `",76"`. **O erro foi meu e é de conta, não de
decisão**: estimei o rótulo em ~60px ignorando que `text-transform: uppercase` +
`letter-spacing: var(--tracking-caps)` (0,06em) engordam a caixa alta em quase 70%. A forma segue
certa; faltava declarar **quem cede** quando os dois não cabem.

### DECISÃO — (d) **com** a valve estrutural de (a); o gap NÃO é tocado

```css
/* A5-c — no readout fixado o rótulo é PRÉ-CABEÇALHO, o valor é o conteúdo. `--fs-caption` é o
   degrau de rótulo mais baixo do DS (nenhum token novo) e devolve ~8–16px ao número. */
.assembly-summary__pinned-prices .tf-price__label {
  font-size: var(--fs-caption);   /* 12px — era --fs-sm (13px) */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  /* `white-space: nowrap` já vem da regra A5-b */
}
/* A valve: declarado quem cede. O número NUNCA encolhe nem quebra; a pressão residual é paga
   pelo rótulo, e só depois pelo scroll-X de último recurso que o próprio hero já tem (015/A6). */
.assembly-summary__pinned-prices .tf-price__amount {
  flex: 0 0 auto;
  max-width: 100%;
}
```

**PORQUÊ, e por que não as outras três.** O rótulo aqui é um **pré-cabeçalho**: o vendedor abriu a
tela pelo número, e a linha 1 ser varejo e a linha 2 ser atacado já é dita pela ordem. A valve
troca "coube na minha conta" por **"cede sempre o mesmo lado"**.
*Rejeitadas:* **(b) `flex-wrap`** — barra sticky de altura variável que cresce **exatamente quando
o total é alto** é o defeito que a 014/T118 existe para impedir (15%); **(c) fechar nos espaços** —
knife-edge de 0–4px, e o gap de 12px é o que faz as duas colunas se lerem como colunas (20%);
**(a) sozinha** — aceita reticência no caso NORMAL de 5 dígitos tendo folga de graça um degrau
abaixo (60%). A composta: **93%**.

### O QUE NÃO PODE ACONTECER

1. **A reticência virar rotina.** Ela é seguro, não layout — ver A5-d, que é o que faltava para ela
   nunca disparar no caso normal.
2. **Diminuir também o rótulo FORA do fixado.** `--fs-caption` vale só dentro de
   `.assembly-summary__pinned-prices`; nos cartões accent do resumo o rótulo continua `--fs-sm`.
3. **`flex: 0 0 auto` sem `max-width: 100%`.** Sem o teto, um valor absurdo (R$ 999.999,99) empurra
   overflow horizontal na PÁGINA em vez de acionar o `overflow-x: auto` do próprio amount.
4. **Fechar folga futura no gap ou no tracking.** Já foi decidido que não: qualquer folga sai do
   rótulo, pela valve, nunca do número.

### ASSERÇÃO RECOMENDADA — substitui a asserção 3 da A5-b

A asserção "barra ≤ baseline da grade" era comparativa e o baseline também muda na mutação. Troque
por **invariância**, que é mais forte e não tem baseline móvel:

1. **Invariância de altura:** `boundingBox().height` de `.assembly-summary__pinned` é **idêntica**
   com `R$ 24,24` e com `R$ 24.215,76`.
2. **Sem quebra no extremo realista** (`R$ 24.215,76`): `dec.top < int.bottom` **e**
   `scrollWidth <= clientWidth` nos dois amounts fixados.
3. **Sem reticência no extremo realista:** para os dois `.tf-price__label` fixados,
   `scrollWidth <= clientWidth`.
4. **A valve funciona no absurdo** (`R$ 999.999,99`): o número continua sem quebrar
   (`dec.top < int.bottom`) e `document.documentElement.scrollWidth <= 360`. Aqui a reticência no
   rótulo é **resultado esperado**, não falha.
5. **Não-vacuidade por mutação:** revertendo `font-size: var(--fs-caption)` para `--fs-sm`, a
   asserção (2) tem de falhar em `R$ 24.215,76`; removendo `flex: 0 0 auto`, a (4) tem de falhar.

---

## A5-d — emenda 2026-08-07 (3ª medição): a premissa errada era o TEXTO, e a asserção 2 fica de pé

MEDIDO: o readout fixado não diz "VAREJO"/"ATACADO" — ele reusa
`messages.calculator.results.varejo/atacado` = **"Preço varejo" / "Preço atacado"**. Em
`--fs-caption`: 100px (cabe raspando) e **111px contra 101px disponíveis** ⇒ a reticência aparece
no caso NORMAL de 5 dígitos. A valve da A5-c fez exatamente o que foi desenhada para fazer — o
preço saiu inteiro —, mas a asserção 3 da A5-c (sem reticência no caso realista) proíbe isso, e
com razão.

### DECISÃO — (a): o readout fixado ganha rótulos CURTOS próprios, e o guard NÃO é afrouxado

Strings novas, em namespace do bloco que as usa (`assembly-summary.tsx` já importa `messages.bom`):

```ts
// messages.pt-br.ts → bom
/* A5-d — o readout FIXADO tem orçamento de largura: ~101px a 360px, em --fs-caption. "Preço
   varejo/atacado" (111px) estoura e aciona a reticência no caso normal de 5 dígitos. Aqui o
   "Preço" é redundante três vezes — o cartão se chama "Total do kit", a linha ao lado começa com
   "R$" e o valor está em corpo de preço —, e num readout compacto redundância custa o número.
   CONTRATO: qualquer tradução destas duas chaves tem de caber em ~85px a 12px; acima disso a
   valve trunca (por desenho) e o guard reprova. Os rótulos longos seguem intactos no resumo
   não-fixado e na calculadora, onde há largura para eles. */
pinned: {
  varejo: "Varejo",     // ~55px em --fs-caption
  atacado: "Atacado",   // ~63px em --fs-caption
},
```

Em `assembly-summary.tsx`, **só no bloco fixado**, `label={t.pinned.varejo}` / `label={t.pinned.atacado}`
(hoje `tc.results.varejo/atacado`). Folga resultante: **~38–46px** — a reticência deixa de ser
alcançável por qualquer valor realista, e continua existindo como seguro.

**Por que chave NOVA e não reusar `calculator.captions.varejo` ("Varejo", já existe).** O texto
coincide hoje; o papel não. Reusar acopla duas superfícies com contratos diferentes — a `captions`
não tem orçamento de largura, esta tem — e a primeira vez que alguém reescrever uma delas vai
mexer na outra sem saber. Chave por papel é o que mantém o i18n honesto, e o comentário acima é o
lugar certo para o orçamento de largura morar: junto da string que ele governa.

### PORQUÊ

Num readout compacto a redundância é paga em pixels do número: o contexto já diz três vezes que
aquilo é preço. "Varejo" e "Atacado" são exatamente o que distingue as duas linhas — nada de
informação se perde, e o que se ganha é a garantia de que a palavra aparece INTEIRA.

*Rejeitadas:* **(b) manter o texto e afrouxar o guard** — seria relaxar a asserção até ela caber no
defeito, que é o oposto do que um guard existe para fazer, e ainda normalizaria "Preço vare…" na
tela do total (confiança 10%); **(c) degrau abaixo de `--fs-caption`** — inventa escala nova (já
rejeitado duas vezes) e a 11px o rótulo do total do kit começa a virar ruído (15%). Decisão (a):
**confiança 95%**.

### O QUE NÃO PODE ACONTECER

1. **Trocar o rótulo fora do fixado.** `results.varejo/atacado` ("Preço varejo/atacado") continuam
   na calculadora e no resumo não-fixado, intactos — lá a palavra "Preço" é o que nomeia o número.
2. **Alguém "consertar" depois voltando a chave longa.** É o mesmo defeito de novo, e ele volta
   silencioso: o preço não quebra (a valve segura), só a palavra some. Por isso a asserção 3 da
   A5-c permanece **literal**, sem afrouxamento.
3. **Tradução futura sem orçamento.** Uma locale com "Al por menor" (~90px) ainda cabe; acima de
   ~85px o guard reprova — que é o comportamento desejado, não um falso positivo.

### ASSERÇÃO RECOMENDADA (fecha o conjunto)

1. **Asserção 3 da A5-c mantida como está** (`label.scrollWidth <= label.clientWidth` a
   `R$ 24.215,76`), agora satisfeita com ~38px de folga em vez de −10px.
2. **Texto exato, para pegar a regressão de copy:** os dois rótulos do bloco fixado são
   `"Varejo"` e `"Atacado"` (`textContent` exato, sem reticência de CSS a mascarar — `textContent`
   não vê `text-overflow`, por isso ele vem **junto** da medição de `scrollWidth`, nunca sozinho).
3. **O resumo não-fixado não mudou:** os rótulos de fora do fixado continuam `"Preço varejo"` /
   `"Preço atacado"`.
4. **Não-vacuidade por mutação:** trocando `t.pinned.varejo` de volta por `tc.results.varejo`, a
   asserção (1) tem de falhar em `R$ 24.215,76`.

---

## A6 — o alvo de toque do InfoTip: 28×28 visual, 44×44 clicável

### DECISÃO (valores exatos)

Área de toque estendida por **pseudo-elemento `::after` fora do fluxo**, no próprio gatilho —
o botão continua ocupando 28×28px de layout e pintando 28×28px de skin:

```css
.tf-infotip__trigger {
  /* … tudo o que já existe permanece: 28px, inline-flex, radius-pill, flex-shrink: 0 … */
  position: relative;            /* NOVO — âncora do ::after */
}
/* Piso de alvo de toque da casa (INV-2 ≥44px) sem inflar o glifo: a área clicável é
   estendida por um pseudo-elemento FORA DO FLUXO, então o botão continua ocupando
   28×28 de layout e pintando 28×28 de skin. Assimétrico de propósito — ver abaixo. */
.tf-infotip__trigger::after {
  content: "";
  position: absolute;
  inset: -12px -8px -4px;        /* top -12 · left/right -8 · bottom -4  ⇒  44 × 44 */
}
```

Conta: largura 8 + 28 + 8 = **44px**; altura 12 + 28 + 4 = **44px**.

**Por que a extensão vertical é assimétrica (12 em cima, 4 embaixo):** no `.tf-field__label-row`
o gatilho é `align-items: flex-end`, ou seja, colado no fundo da linha do rótulo, e abaixo dele há
apenas `gap: var(--space-2)` = **8px** até o topo do `.tf-inputwrap` (48px de altura, alvo real e
concorrente). Com −8px embaixo a área de hit encostaria exatamente na borda do input; com −4px
sobram 4px de folga. Para cima há o `--field-gap` (12px) e, acima dele, apenas texto não
interativo (hint/erro do campo anterior), então os 12px extras não roubam clique de ninguém.

**Impacto no fluxo a 360px: zero.** `position: absolute` retira o `::after` do fluxo, então
`.tf-field__label-row` (altura ditada pelo `min-height` de 2 linhas do `.tf-field__label`), a
posição do input e o alinhamento inline do ⓘ com o rótulo ficam **byte-idênticos**. Nenhuma
mudança em `field.tsx` / `field.css` — o `labelAddon` (016/PR-C, B4) continua irmão do `<label>`,
que é o que preserva o nome acessível do campo.

**Sobreposição aceita conscientemente:** os −8px à esquerda cobrem os 4px de `gap` do label-row
mais ~4px da borda direita da caixa do `<label>` (que é `flex: 1 1 auto`, mas cujo **texto** é
alinhado à esquerda — a faixa coberta é vazia em toda a UI atual). Como o `::after` pertence a um
elemento posicionado e posterior no DOM, ele vence o hit-test nesses 4px; o custo é perder 4px de
"clicar no rótulo para focar o input", numa faixa em branco. Aceito.

**Hover em ponteiro fino:** a extensão vale para **todos** os ponteiros (2.5.8 não é só toque:
mouse impreciso e tremor também ganham), então o popover passa a abrir ~8px antes do glifo. É
aceitável e até desejável (a pílula acende antes do dedo chegar). **Remédio já autorizado, não
perguntar de novo:** se a homologação visual reportar aberturas espúrias, envelope a regra
`::after` em `@media (pointer: coarse)` — e só ela.

*Alternativas descartadas:* (a) `min-width/min-height: 44px` + margem negativa — o `background`
de hover e o `border-radius: pill` passariam a pintar 44px, que é exatamente "inflar o visual",
confiança 20%; (b) `padding: 8px` + `background-clip: content-box` + margem negativa −8px —
funciona, mas mistura três propriedades acopladas e o raio da pílula fica dependente do clip,
confiança 55%; (c) a decisão acima, **confiança 94%** (padrão clássico, uma regra, fluxo intacto).

### O QUE NÃO PODE ACONTECER

1. **Um ancestral com `overflow: hidden` recortar a área.** Região recortada não é clicável: o
   `::after` volta a valer 28px sem nenhum sinal visual. Vale para os gatilhos que vivem em títulos
   de seção dentro de `Card`, não só os de `Field`.
2. **O visual crescer.** `boundingClientRect` do próprio `<button>` tem de continuar **28×28**, e a
   pílula de hover/`[data-state=open]` tem de continuar 28px. Se o botão medir 44, a implementação
   escolheu a alternativa errada.
3. **Roubar clique de um alvo real.** Nenhum ponto do `.tf-inputwrap` do mesmo campo pode resolver
   para o gatilho. Idem para dois InfoTips adjacentes (nenhum caso hoje, mas 44px lado a lado com
   `gap: 4px` se sobreporiam — se surgir, o `gap` do contêiner precisa ir a ≥16px).
4. **Deslocar qualquer coisa a 360px.** A jornada 360 foi homologada limpa (T072, 84%): a altura do
   `.tf-field__label-row` e o topo do `.tf-inputwrap` têm de ficar iguais aos de antes.
5. **Mexer no contrato de a11y do Radix.** `aria-label`, Escape, outside-click e o `suppressHover`
   (016/PR-C R3) permanecem intocados — isto é uma regra de CSS, não uma mudança de comportamento.

### ASSERÇÃO RECOMENDADA

O guard de alvos de toque existente **não cobre esta superfície** porque mede o `boundingBox` do
elemento — que continua (e deve continuar) 28×28. A propriedade certa é **hit-testing**, não
geometria do glifo. Playwright, a 360×800, varrendo os 16 gatilhos de `/calcular`:

1. **Área clicável ≥44×44, medida por hit-test:** para cada `.tf-infotip__trigger`, calcule o
   retângulo pretendido a partir do box do botão (`x−8, y−12, 44, 44`) e assere que
   `document.elementFromPoint()` nos **4 cantos** (1px para dentro) e no centro devolve um elemento
   cujo `closest(".tf-infotip__trigger")` é **aquele mesmo botão**. Sem isso, "44px" é uma
   afirmação sobre CSS, não sobre o dedo.
2. **Prova de ponta a ponta, com clique real:** `page.mouse.click()` no canto superior-esquerdo do
   retângulo (fora do glifo) abre o popover — `[data-state="open"]` e o conteúdo visível.
3. **O visual NÃO inflou:** `boundingBox()` do botão = `{ width: 28, height: 28 }` para os 16.
4. **O fluxo não mexeu:** altura do `.tf-field__label-row` e `y` do `.tf-inputwrap` idênticos ao
   baseline medido antes da mudança (registre os dois números no PR).
5. **Não-vacuidade por mutação:** removendo a regra `::after`, a asserção (1) tem de falhar nos
   cantos (eles passam a resolver para o `<label>` ou para o `body`). Um guard que passa com e sem
   a regra não está medindo nada.
