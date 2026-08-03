# F11a — Homologação visual do fluxo GRATUITO

## Resumo

Renderei 5 superfícies públicas × 3 larguras (360/768/1440), deslogado e free, nos estados
alcançáveis da matriz da F08 — **84 screenshots** em `evidencias/f11a/`, geometria lida do DOM.
**Sete achados; dois bloqueiam.** Os dois graves estão na calculadora a **360px** e ambos são
invisíveis a `toBeVisible`/`toContainText` e a asserção de overflow: (1) o campo **Tarifa de
energia** colapsa para **33px** de largura útil e, com 5+ caracteres, mostra na tela um número
**diferente** do que entra na conta — digitei `1000,00`, a tela exibiu `0,00` e o cálculo cobrou
R$ 600,00 de energia; (2) o cartão-herói de preço **quebra o número no meio** para valores ≥ R$ 10 mil
— `R$ 18.130,08` renderiza como `18.13` / `0` / `,08` em três linhas, com `scrollWidth === clientWidth`
(a asserção geométrica PASSA). Fora isso: a promessa "a calculadora é grátis" **não lidera** — vive a
97–99% da página, enquanto a primeira restrição Premium aparece na primeira dobra. Sem transbordo
horizontal em nenhuma das 15 combinações; banner offline honesto; contraste sem suspeitos.
Quatro hipóteses minhas foram **derrubadas ao medir** e estão registradas como não-achados.

---

## Ambiente medido

Pilha subida à mão e conferida antes de qualquer diagnóstico (regra do preview órfão):
Postgres :5433 (banco `precifica3d_e2e` recriado + `alembic upgrade head` até a revisão `0005`),
backend :8100 (`/health` → `{"status":"ok"}`), emulador Firebase Auth :9099, `vite preview` :4173
servindo um build **feito nesta sessão** (`dist/assets/index-CtQ4NiHe.js`). Branch `012-e6-billing-pr-c`.
Nenhum processo pré-existente nessas portas — verificado por `netstat` antes de subir.

Contas free criadas pelo seam `window.__e2eAuth.signUp` (uma por largura, e-mails `f11a-*@e2e.local`).

---

## Achados

### [F11a-001] O campo "Tarifa de energia" mostra um número diferente do que entra na conta (360px)

- Severidade: **Alto**
- Bloqueia provisionamento: **sim**
- Certeza: **97%**
- Local: `/calcular` e `/` @ **360px** — `apps/web/src/features/calculator/calculator-schema.ts:304`
  (`tariffPerKwh` é o único campo com prefixo `R$` **e** sufixo `/kWh`), sobre
  `apps/web/src/shared/ui/field.css:100` (`.tf-inputwrap__affix { flex: 0 0 auto }` — os dois afixos
  não encolhem) e `field.css:114` (`.tf-input { min-width: 0 }` — o input encolhe até sumir),
  com `.tf-input--num { text-align: right }` (`field.css:137`) e `overflow-x: clip` computado.
- Evidência (`getBoundingClientRect` + `scrollWidth`/`clientWidth`, medido, não inferido):

  | largura | `clientWidth` do input | valor `1,00` | valor `0,895` | valor `0,89321` | valor `1000,00` |
  |---|---|---|---|---|---|
  | **360** | **33px** | sw 36 (−3) | sw 46 (**−13**) | sw 67 (**−34**) | sw 67 (**−34**) |
  | 768 | 93px | sw 94 (−1) | — | — | sw 94 (−1) |
  | 1440 | 93px | sw 94 (−1) | — | — | sw 94 (−1) |

  Como o texto é alinhado à direita e o overflow é `clip`, o que some são os **dígitos da frente**.
  Screenshots: `calcular-360-tarifa-7char.png` — valor real `1000,00`, tela mostra **`R$ 0,00 /kWh`**;
  `calcular-360-tarifa-6char-big.png` — valor `123,45`, tela mostra **`R$ 3,45 /kWh`**;
  `calcular-360-tarifa-0_89321.png` e `calcular-360-tarifa-conta-de-luz-cortada.png` — valor
  `0,89321` (o formato que a conta de luz brasileira imprime), tela mostra **`R$ )321 /kWh`**.
  Contraprova de que só os pixels mentem: com `1000,00` no campo, `el.value === "1000,00"` e a
  conta mudou de `Energia R$ 0,60` para **`Energia R$ 600,00`**, `Custo total R$ 620,00`
  (`calcular-360-tarifa-1000-mostra-parcial.png`). A 768 e 1440 o mesmo valor cabe (−1px, folga
  de padding) — o defeito é **exclusivo de 360**, a largura mínima declarada.
  O campo **não tem `maxLength`**: digitei `0,89321` caractere a caractere e ele aceitou os 7.
- Impacto: o vendedor lê na tela uma tarifa que não é a dele — e o número exibido é **plausível**,
  não quebrado. Ou ele confia no que vê e acha que a conta está errada, ou redigita achando que não
  registrou. É um campo de precificação na tela mais importante do produto, no fluxo que a promessa
  central diz ser grátis. Gatilho preciso: **≥5 caracteres** no campo a 360px; o padrão `1,00`
  (4 caracteres) renderiza inteiro, então a primeira dobra não denuncia nada.

### [F11a-002] O cartão-herói quebra o preço no meio do número (360px, valores ≥ R$ 10 mil)

- Severidade: **Alto**
- Bloqueia provisionamento: **sim**
- Certeza: **96%**
- Local: `/calcular` @ **360px** — `apps/web/src/shared/ui/price-hero.css`, regra `.tf-price__int`
  (`overflow-wrap: anywhere; word-break: break-word`) e `.tf-price__amount` (`flex-wrap: wrap`),
  ambas introduzidas pelo conserto "D2" cujo comentário no próprio arquivo diz *"let a huge price
  wrap instead of pushing horizontal overflow at 390px"*.
- Evidência: peça cara realista (rolo R$ 450,00 · 980 g · máquina R$ 85.000,00 · 96 h · markup 300%)
  → preço varejo **R$ 18.130,08**. Medido no span `.tf-price__int` (`font-size: 36px`):

  | largura | altura do span | linhas | largura do span | largura do cartão | `scrollWidth − clientWidth` |
  |---|---|---|---|---|---|
  | **360** | **72px** | **2** | 108px (= 100% do contêiner) | 158px | **0** |
  | 768 | 36px | 1 | 124,1px | 218px | 0 |
  | 1440 | 36px | 1 | 124,1px | 218px | 0 |

  A altura do cartão vai de 143px para **201,7px** só a 360. **A asserção geométrica passa**
  (`scrollWidth === clientWidth`, transbordo de página 0) porque o número **quebra** em vez de
  transbordar — só a imagem denuncia. Screenshots: `calcular-360-cartao-numero-quebrado.png`
  (lê-se `18.13` / `0` / `,08` em três linhas) contra `calcular-1440-cartao-numero-ok.png`
  (`R$ 18.130 ,08` numa linha só). Limiar medido por varredura de markup: `1.050` (5 glifos) cabe;
  `18.130` (6 glifos) não — ou seja, **qualquer preço a partir de R$ 10.000,00** quebra a 360.
- Impacto: o cartão-herói é o único número que o vendedor olha de relance, e ele passa a ler
  `18.13` com um `0` órfão embaixo — erro de três ordens de grandeza numa peça encomendada, num
  lote, ou num kit. É a mesma classe do transbordo do PDF que a E4 pagou: o conserto do transbordo
  horizontal está certo e a consequência visual nunca foi homologada com imagem.

### [F11a-003] A promessa "a calculadora é grátis" não lidera — ela fecha a página

- Severidade: **Médio**
- Bloqueia provisionamento: **não**
- Certeza: **99%** (a medição; o julgamento de que ela *deveria* liderar vem do critério desta fase)
- Local: todas as larguras — `apps/web/src/pages/calcular/calcular-page.tsx:459`, que renderiza
  `t.freemiumNote` como **último elemento** da página. A cópia existe e é honesta
  (`messages.pt-br.ts:238`).
- Evidência (posição absoluta lida do DOM, `/calcular`):

  | largura | altura do documento | y da 1ª ocorrência de "grátis" | % da página | telas de rolagem | y da 1ª menção a "Premium" |
  |---|---|---|---|---|---|
  | 360 | 3529px | **3413px** | **97%** | **4,6** | **267px** (1ª dobra) |
  | 768 | 3405px | **3355px** | **99%** | 3,7 | 283px (1ª dobra) |
  | 1440 | 3405px | **3355px** | **99%** | 3,7 | 283px (1ª dobra) |

  A primeira dobra a 360 (`calcular-360-primeira-dobra.png`) contém exatamente uma afirmação de
  valor: **"Salvar faz parte do Premium."**. A palavra "grátis" não aparece em lugar nenhum dela.
  E `/` renderiza a própria calculadora (h1 `Calcular preço`, screenshots `raiz-*` idênticos aos
  `calcular-*`) — não há landing onde a promessa pudesse liderar antes.
  Observação de método: o teste que cobre essa frase (`calcular.test.tsx:90`) usa
  `toBeInTheDocument()` — presença, não posição. É a lição da US4 se repetindo.
- Impacto: a promessa central do produto ("a calculadora é grátis e pública") só é lida por quem
  rolar 3,7 a 4,6 telas. Quem abre e desiste na primeira dobra leva a mensagem oposta.

### [F11a-004] Sete gatilhos de ajuda com alvo de toque de 28×28px

- Severidade: **Médio**
- Bloqueia provisionamento: **não**
- Certeza: **99%**
- Local: `/calcular` e `/` nas **três** larguras — `button.tf-infotip__trigger`.
- Evidência: `getBoundingClientRect` = **28×28px** (mínimo 44×44) nos 7 gatilhos: "Sobre os custos
  da peça", "Sobre os ajustes opcionais", "Sobre mão de obra e custos", "Sobre outros custos",
  "Sobre o markup", "Sobre o cálculo do preço", "Sobre o marketplace" — idêntico a 360, 768 e 1440.
  Em `/sign-in`, o link "Como tratamos seus dados" mede **181,4×20px** (altura 20 < 44), nas três
  larguras. Screenshots: `calcular-360-deslogado.png`, `signin-360-deslogado.png`.
- Impacto: no celular — o alvo declarado do produto — a explicação de cada bloco de custo é a peça
  que ensina o vendedor a confiar no cálculo, e ela é o menor alvo da tela. Erra-se o toque e
  abre-se outra coisa. A F12 mede isso formalmente; aqui é geometria bruta.

### [F11a-005] A 1440 a calculadora usa 37% da largura disponível e rola 3,8 telas

- Severidade: **Baixo**
- Bloqueia provisionamento: **não**
- Certeza: **95%** (medição 100%; a severidade depende de haver ou não um layout desktop previsto,
  o que eu não encontrei especificado e **não inferi**)
- Local: `/calcular` @ 1440 — `apps/web/src/pages/calcular/calcular-page.tsx:244`
  (`className="mx-auto flex w-full max-w-md flex-col gap-4"`). O mesmo `max-w-md` está em
  `catalogo-page.tsx:142,150`, `produto-page.tsx:221,234,262` e `bom-page.tsx:145,426`.
- Evidência: viewport 1440 → `main` mede **1200px** (sidebar 240px), e a `section` de conteúdo mede
  **448px** com `max-width: 448px` computado, começando em `left: 616`. Sobram **752px (63%)** de
  main vazio, e o documento tem **3405px** de altura = **3,8 telas** de 900px.
  Screenshot: `calcular-1440-deslogado.png`.
- Impacto: o vendedor no desktop rola quase 4 telas de um formulário de coluna única enquanto dois
  terços do monitor ficam brancos. Não engana ninguém — cansa.

### [F11a-006] O marketplace padrão é o único sem tabela de referência

- Severidade: **Médio**
- Bloqueia provisionamento: **não** (é consequência da fatia ML da 014 não ter sido feita, não um bug)
- Certeza: **98%**
- Local: `/calcular`, painel Marketplace, todas as larguras.
- Evidência: o `<select>` "Marketplace" abre em **`MERCADO_LIVRE`** (medido: `select.value`), e
  `GET http://localhost:8100/api/v1/fee-catalog` devolve para `MERCADO_LIVRE` **`"entries": []`** —
  zero tarifas — enquanto `AMAZON` traz `categorySpine` populada. O painel então exibe *"Este canal
  ainda não tem taxa de referência — informe a comissão nos campos abaixo"*, os quatro campos de
  taxa vazios e o selo *"sem referência — informe as taxas"*, e a seção "Preços por canal" diz
  *"Informe a comissão do canal para ver os preços"* — **sem preço nenhum**.
  Screenshots: `calcular-360-marketplace-ml-sem-referencia.png`, `calcular-360-deslogado.png`.
  Trocando para Amazon, o mesmo painel calcula: `Preço para anunciar R$ 36,35 / Recebido líquido
  R$ 30,90` (`calcular-360-marketplace-amazon.png`).
- Impacto: a primeira impressão do recurso de marketplace, sem o vendedor tocar em nada, é a de um
  produto que não sabe nada — e justamente sobre o canal mais usado no Brasil. A mensagem é honesta;
  o **padrão** é que escolhe mostrar o pior caso.

### [F11a-007] Amazon sem categoria: campo "Comissão" vazio ao lado de um preço que já tem 15% descontado

- Severidade: **Baixo**
- Bloqueia provisionamento: **não**
- Certeza: **80%** (medi o número; a leitura de que isso confunde é julgamento meu)
- Local: `/calcular`, painel Marketplace com `AMAZON` e sem categoria escolhida, todas as larguras.
- Evidência: os quatro campos ("Comissão", "Taxa fixa", "Comissão mínima/item", "Frete") estão com
  `value: ""` e `placeholder: "0,00"` — a tela lê **`Comissão 0,00 %`** em cinza. Ao mesmo tempo a
  seção "Preços por canal" mostra `Preço para anunciar R$ 36,35` → `Recebido líquido R$ 30,90`, o
  que embute **15,0%** de comissão. A única explicação é o selo cinza pequeno abaixo dos campos:
  *"categoria não informada — usando a maior alíquota da tabela"*.
  Screenshots: `calcular-360-marketplace-amazon.png`,
  `calcular-360-amazon-precos-por-canal-sem-categoria.png`.
- Impacto: o número que o vendedor procura primeiro (a alíquota) está em branco, e o selo que a
  explica é o elemento de menor peso visual do painel.

---

## Não-achados — hipóteses minhas derrubadas ao medir

Registro porque cada uma teria virado achado falso se eu tivesse parado na primeira leitura.

1. **"Usar do catálogo" deslogado não faz nada.** FALSO. Minha primeira leitura comparou um recorte
   curto de `innerText` e não viu diferença. Medindo o DOM: **+24 nós, +221 caracteres, 2 elementos
   `[role=dialog]`**. Abre uma folha honesta — *"SALVAR FAZ PARTE DO PREMIUM / Para salvar seu
   catálogo, entre e ative o Premium. / **Calcular e ver a conta continuam grátis.**"* com
   `[Assinar Premium] [Entrar] [Entendi]`. Reproduzido a 360 deslogado, 360 free e 1440 deslogado.
   Evidência: `calcular-360-usar-do-catalogo-deslogado-apos-clique.png`.
2. **O e-mail truncado na topbar é um corte.** FALSO. `text-overflow: ellipsis`, `overflow: hidden`,
   `white-space: nowrap` **e atributo `title` com o e-mail inteiro**. Truncamento correto, com
   escape. Evidência: `calcular-768-topbar-email-truncado.png`.
3. **A barra de abas fixa cobre campos ao receber foco.** FALSO como defeito do produto. Com
   `el.focus()` programático 2 campos ficavam sob a barra (topo 671,5 · barra em 675) — mas isso é
   artefato do **meu** método. Com **toque real**, o campo pousa em `top: 346,5` / `bottom: 392,5`,
   `elementFromPoint` acerta o próprio input nos três pontos de sondagem e **0px** ficam ocultos.
   No fim do documento, nenhum conteúdo fica preso sob a barra. Evidência:
   `calcular-360-campo-sob-barra-fixa.png`.
4. **O cartão de preço transborda com valor alto.** FALSO — ele **quebra** (isso virou o F11a-002).
   `scrollWidth − clientWidth = 0` e transbordo de página `0` em todos os casos adversariais.

Também verificado e **sem achado**:
- **Transbordo horizontal**: `scrollWidth − clientWidth = 0` nas 15 combinações do varrimento base
  (5 rotas × 3 larguras) e também sob valores adversariais (`999999,99` de rolo, `999999` g).
  Nenhum elemento com `right > innerWidth` ou `left < 0`.
- **Banner offline**: aparece nas três larguras, em `/calcular` e `/catalogo`, deslogado e free, com
  cópia honesta — *"Você está offline. O cálculo continua funcionando."*. Não sobrepõe conteúdo.
- **Contraste**: varredura de razão WCAG sobre todo texto folha de `/calcular` @360 → **0 suspeitos**
  abaixo do mínimo, em tema **claro e escuro**. Medição formal é da F12.
- **Formatação pt-BR**: `R$ 10,00`, `R$ 4.532,52`, `R$ 18.130,08` — vírgula decimal e ponto de
  milhar corretos; **zero** ocorrências de decimal com ponto e **zero** datas ISO nas telas do
  fluxo gratuito (não há data exibida aqui).
- **Contador do seletor de categoria** (o defeito da 014): digitei "brinquedo" → *"1 categoria
  encontrada"* e **1** resultado. Contador e lista concordam. Evidência:
  `calcular-360-amazon-busca-categoria.png`.
- **`/privacidade`** e **`/sign-in`** nas três larguras: sem achado além do alvo de toque do link
  já contado no F11a-004.
- **Teaser do `/catalogo`** (deslogado e free, três larguras): idêntico, honesto, com preço
  `R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês`. "+ Adicionar filamento" abre a folha
  *"SALVAR FAZ PARTE DO PREMIUM — Para salvar seu catálogo, entre e ative o Premium."*.

---

## Não alcançado

- **Teclado virtual cobrindo campo a 360px.** Não produzi. Chromium headless não instancia teclado
  de software e `visualViewport` não encolhe, então o estado não existe no que eu rodei. Cheguei a
  calcular uma simulação ("14 dos 21 campos cairiam sob um teclado de ~46%") e a **descartei**: é
  aritmética sobre uma altura que eu inventei, não medição. Fica para dispositivo real ou Android
  WebView.
- **Carregando e erro em `/catalogo`.** O estado **não existe** para alcançar: interceptei
  `**/api/v1/**` com 500 e, separadamente, com 9s de atraso, deslogado **e** logado free, nas três
  larguras — a renderização é idêntica à normal, porque o teaser gratuito **não faz requisição**.
  Os 12 arquivos `catalogo-*-erro-500.png` / `catalogo-*-carregando.png` documentam exatamente isso:
  o teaser inalterado. Só um catálogo com dados (premium) exercita esses estados — F11b.
- **Carregando, erro e sem rede em `/privacidade` e `/sign-in`.** Rotas estáticas, sem chamada de
  API; não há estado a produzir. Não capturei variações.
- **Dado parcial em `/catalogo`.** Não alcançado no fluxo gratuito pelo mesmo motivo. O único estado
  de dado parcial que consegui produzir foi o do painel de marketplace (F11a-006 e F11a-007).
- **`/calcular` com backend fora do ar.** Não produzi um cenário distinto: derrubando a API, a
  calculadora continua calculando (o `pricing-core` é offline por decisão de arquitetura) e a única
  diferença observável é o painel de marketplace cair para "sem referência" — que já é o estado
  padrão hoje (F11a-006), então o estado de erro é **indistinguível** do estado normal. Isso é uma
  observação, não um achado medido: não consegui separar as duas causas pela tela.
- **Dispositivo real / WebView Android.** Fora do que esta fase pôde executar.

---

## Higiene da fase

`git status --porcelain` ao final acusa **apenas** `docs/homologacao/` (não rastreado). Nenhum
arquivo de `apps/`, `backend/`, `packages/`, `contracts/`, `scripts/` ou `specs/` foi tocado.
Os scripts de condução do navegador ficaram no scratchpad da sessão, fora do repositório.

---

## Verificação do main loop (protocolo da auditoria)

Toda afirmação numérica ou de existência vinda de subagente é conferida antes de entrar no
consolidado. Protocolo nascido na F01, onde um subagente reportou bytes NUL que não existiam.

| afirmação | como verifiquei | resultado |
| --- | --- | --- |
| `calculator-schema.ts:304` é o `tariffPerKwh` com prefixo **e** sufixo | `sed -n '302,306p'` | **confere** — `currency: true, unit: "/kWh"` |
| `.tf-input { min-width: 0 }` deixa o campo encolher | leitura de `field.css:114-116` | **confere** |
| `.tf-input--num { text-align: right }` | leitura de `field.css:137-142` | **confere** |
| não há `maxLength` no campo numérico | grep em `number-field.tsx` | **confere** — só `inputMode="decimal"` |
| `overflow-x: clip` | grep no CSS-fonte: **não existe declarado** | o achado diz **"computado"**, não declarado — provavelmente folha do agente de usuário, e **não verifiquei**. Não muda o diagnóstico: `min-width: 0` + `text-align: right` + ausência de `maxLength` já explicam o comportamento inteiro |
| `.tf-price__int` quebra dentro do número | leitura de `price-hero.css:74-80` | **confere, e o comentário confirma a intenção**: `overflow-wrap: anywhere` + `word-break: break-word`, com a nota "D2: let it shrink + break **within the amount**" |

**A nota do `price-hero.css` é o achado dentro do achado.** A quebra foi introduzida
DELIBERADAMENTE, para matar um transbordo horizontal — e `overflow-wrap: anywhere` é a regra certa
para **prosa** e errada para **dinheiro**. Trocou-se um defeito visível (transbordo) por um invisível
(número partido ao meio), e a troca nunca foi homologada com imagem. É exatamente a razão de esta
fase existir.
