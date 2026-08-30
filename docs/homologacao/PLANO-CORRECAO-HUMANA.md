# Plano de correção — homologação humana (parte 1: grátis / não-logado)

**Fonte**: `homologação/Relatório.md` + `Instruções.txt` (dono, 2026-08-05).
**Regra desta análise** (instrução do dono): para cada ponto, dizer **o conserto**, a **complexidade**,
e se ele **bate ou não com as decisões já tomadas** — e, quando não bater, decidir juntos se a
decisão muda na documentação. Onde eu não entendi, **pergunto** em vez de inferir.

**Decidido nesta sessão**: `Histórico → Orçamentos`, `Cenários → Simulações`, **só rótulos** (rotas
ficam). O Histórico **não** será removido — ele e as Simulações são opostos por construção, e o par
de nomes antigo era a causa da confusão.

---

## Grupo 0 — o que pode NÃO ser defeito (itens 15–19)

**Sintoma relatado**: logado sem premium, Catálogo / Kits / Orçamentos / Simulações mostram
**"Não foi possível carregar…"** em vermelho, em vez do teaser honesto.

**O que eu medi**: o cliente **já trata** o caso — `features/catalog/catalog-panel.tsx:177` tem um
ramo explícito para `ENTITLEMENT_REQUIRED` que renderiza o teaser. O erro genérico é o ramo
seguinte, para falha de verdade.

**A hipótese que preciso descartar**: esses prints foram tirados **antes** do conserto do backend
(o `ProactorEventLoop`, PR #42), quando **toda rota de banco devolvia 500** — e um 500 cai
legitimamente no ramo de erro genérico.

**Ação**: reproduzir com o backend correto, numa conta logada sem premium. **Se o teaser aparecer,
não há defeito** e o item se fecha. Se o erro persistir, é o achado mais grave da lista e vira o
primeiro conserto.

> **Não planejo conserto para este grupo enquanto não medir.** Consertar o que não está quebrado
> custa tanto quanto não consertar o que está.

---

## Grupo 1 — o teaser do grátis (itens 3, 4, 12, 13, 14)

Cinco telas, **um padrão só**: no grátis, mostrar *título da página · título+subtítulo da feature ·
botão "Assinar Premium"* — e nada mais. Sem explicar como o Premium funciona (isso é da tela de
compra), sem botões parasitas.

| item | o que sai | o que fica |
| --- | --- | --- |
| **3** Simulações | subtítulo duplicado · bloco "No Premium…" · linha de preço · **modal "Cenários fazem parte do Premium"** | título · subtítulo reescrito · botão · legenda pequena |
| **4** Usar do catálogo | "Salvar faz parte do Premium." | botão **desabilitado** · explicação do que é o catálogo · botão Assinar |
| **12** Catálogo | "+ Adicionar filamento" | título · subtítulo · botão |
| **13** Kits | botões **Entrar** e **Entendi** | idem |
| **14** Orçamentos | botões **Entrar** e **Ir para a calculadora** | idem |

**Complexidade: BAIXA-MÉDIA.** É um componente de teaser único aplicado a cinco lugares — hoje cada
um tem a sua variação. Vira um só, e some a divergência.

**Alinhamento**: **bate** com a decisão de teaser honesto (FR-312), e **melhora** — a auditoria já
tinha achado que a cortesia não oferece caminho de assinatura (`[F11b-007]`). Este conserto resolve
aquele achado de brinde.

**Pendência sua**: o texto do subtítulo de Simulações. Proposta:
> *"Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser —
> sempre com os preços de hoje."*

---

## Grupo 2 — os campos do formulário (itens 5, 6, 7)

### 2a. Tooltips de explicação — **11 campos**

Consumo médio · Tarifa de energia · Vida útil da máquina · Reserva de manutenção · Taxa de falha ·
Tempo de acabamento · Valor do acabamento · Mão de obra (horas) · Valor da hora.

Ícone `?` à direita do rótulo, tooltip no hover.

**Complexidade: BAIXA no mecanismo, MÉDIA no conteúdo.** O componente `InfoTip` **já existe** e já é
usado nos títulos de seção — é reusá-lo por campo. O caro é escrever 11 explicações que digam
*por que o campo está na conta* **e** *como o vendedor descobre o valor na máquina dele*, que foi
exatamente o que você pediu. Isso é conteúdo de domínio, não código.

> **Preciso de você aqui**: eu sei explicar *por que* cada campo entra na conta (está na fórmula).
> Não sei dizer com autoridade *como o vendedor descobre* o consumo médio da impressora dele ou a
> vida útil da máquina. Se você me der essas duas, eu escrevo as onze.

### 2b. Tempo de impressão em horas **e minutos**

**Complexidade: MÉDIA.** O motor recebe `printTimeHours` decimal e **isso não muda** — a conversão
fica na borda (dois campos → um decimal). O cuidado é o caminho de volta: uma simulação salva ou um
orçamento congelado guardam `5.5`, e a tela tem de reabrir mostrando `5h 30min`.

**Alinhamento: bate.** É mudança de entrada, não de fórmula.

### 2c. Máscara monetária em "Valor da máquina"

**Complexidade: BAIXA.** O `NumberField` já tem modo `currency`; o campo não está usando.

### 2d. Custo de máquina — **DECIDIDO 2026-08-05: trocar a pergunta, não o campo**

**O problema, nas palavras do dono**: o valor importa, mas "vida útil da máquina em horas" complica a
vida do vendedor. E ele estava certo de recusar a minha primeira proposta (campo opcional com default):
**tornar o campo pulável não o torna compreensível** — só faz o vendedor pular e cobrar menos sem saber.

**O número que decidiu a conversa**: no vetor canônico, a máquina é **R$ 10,00 de R$ 28,65 = 35% do
custo**. Tirar da equação faria o vendedor precificar 35% abaixo do custo real — o contrário do
propósito do produto. Então o campo fica; o que muda é a PERGUNTA.

**Hoje** perguntamos "vida útil da máquina (h)" — conceito de engenharia que **não existe em lugar
nenhum para consultar**. Fabricante não publica. É estimativa, e o vendedor não tem como fazê-la.

**Passa a perguntar três coisas que ele sabe ou decide:**

| pergunta | natureza |
| --- | --- |
| Quanto custou sua impressora? | **sabe** — está na nota |
| Com que frequência ela roda? | **sabe** — três opções, sem digitar |
| Em quantos anos quer que ela se pague? | **decide** — escolha de negócio (owner 2026-08-05: perguntar, não assumir) |

**Os três ritmos** (aprovados pelo dono), com R$ 4.000 e payback de 3 anos:

| escolha | vira | custo/hora | peça de 5h |
| --- | --- | --- | --- |
| Poucas horas por semana | ~780 h | R$ 5,13 | **R$ 25,65** |
| Quase todo dia | ~3.600 h | R$ 1,11 | **R$ 5,55** |
| Praticamente o dia todo | ~9.900 h | R$ 0,40 | **R$ 2,00** |

A tela mostra o derivado em voz alta — **"≈ R$ 1,11 por hora de impressão"** — com um "ajustar" para
quem quiser digitar as horas direto.

**A FÓRMULA NÃO MUDA.** O motor continua recebendo `machineValue` + `machineLifetimeHours`; a
derivação vive na tela. Sem bump, sem migração.

**E ensina algo que hoje está escondido**: o spread entre R$ 25,65 e R$ 2,00 é a verdade econômica da
máquina ociosa. Hoje o produto esconde essa lição atrás de um campo que ninguém consegue preencher.

**Complexidade: MÉDIA**, toda na tela.

### 2d-bis. Consumo médio (ANTIGO — mantido para registro)

> ### ⚠ CONFLITO TÉCNICO — este eu não consigo fazer como pedido
>
> **`machineLifetimeHours` é um DENOMINADOR.** O motor o valida com `assertPositive` — *"must be a
> finite number > 0"* — porque o custo de máquina é `valor ÷ vida útil`. Com **0**, a conta é uma
> divisão por zero.
>
> Opcional-com-default-0 funciona para *Valor da máquina* e *Consumo médio* (eles só somam 0 à
> conta). Para *Vida útil*, não.
>
> **Três saídas, e a escolha é sua:**
> 1. **Vida útil continua obrigatória** — as outras duas viram opcionais. Menor mudança, e mantém a
>    fórmula intacta.
> 2. **Vida útil opcional, e quando vazia o custo de máquina é 0** — o campo some da conta em vez de
>    dividir. Coerente com "opcional contribui 0", mas muda a fórmula: hoje um valor de máquina sem
>    vida útil é erro; passaria a ser silêncio.
> 3. **Os três juntos**: "custo de máquina" vira um bloco opcional — ou você preenche os dois
>    (valor + vida útil), ou o bloco inteiro contribui 0. É o mais honesto dos três, e o que mais
>    mexe na tela.
>
> Minha recomendação é a **3**: ela trata os dois campos como o par que eles são, e evita o estado
> "tenho o valor da máquina mas ele não entra na conta" — que é o pior dos mundos, porque o vendedor
> vê o número que digitou sendo ignorado.

### 2e. Fundir "Ajustes opcionais" em "Custos da peça", e mover acabamento para "Mão de obra"

**Complexidade: BAIXA.** É reorganização de seções, sem mudança de modelo.

**Alinhamento: bate.** A separação atual não é decisão registrada em ADR — é layout.

### 2f. Matar o campo "Desperdício"

> ### DECIDIDO 2026-08-05: **opção A — remoção completa**
>
> O dono: *"vamos ter que mudar a fórmula então, pois essa redundância não é aceitável."*
> Escolhida a **A** (remover de tudo) sobre a B (remover da tela, deixar as colunas).
>
> **Escopo medido**: `filaments.default_waste_grams` · `products.waste_grams` (NOT NULL) ·
> `bom_lines.waste_grams` · payload congelado dos orçamentos · config das simulações · **54
> ocorrências** no código.
>
> **O caminho que morde**: "Recalcular hoje" e reabrir uma simulação **recomputam a partir do
> documento salvo**. Com o motor deixando de aceitar `wasteGrams`, esses documentos precisam de uma
> regra de leitura — senão quebram ao abrir. Isso é parte do trabalho, não um detalhe.
>
> **Bump MAJOR** do `PRICING_MODEL_VERSION` (remoção de campo de entrada é quebra).
>
> **Nota honesta que fica registrada**: orçamentos já congelados **continuam contendo** `wasteGrams`
> — é o que foi cotado, e a imutabilidade existe para isso. A "limpeza total" não fica total; ela
> limpa o presente, não o passado. Foi o argumento a favor da B, e o dono decidiu pela A mesmo assim.
>
> ### ⚠ ALINHAMENTO — isto toca o domínio de preço (análise original, mantida)
>
> `wasteGrams` **é entrada da fórmula** (`material = (gramas + desperdício) × custo/kg`). Removê-lo:
> - muda a superfície do `pricing-core` → **bump de `PRICING_MODEL_VERSION`**;
> - **orçamentos congelados já gravados contêm `wasteGrams`**. Eles não mudam (é o ponto do
>   congelamento), mas passam a citar um campo que a tela não tem mais. O PDF de um orçamento antigo
>   vai continuar imprimindo uma linha que o app não sabe mais explicar.
>
> **Concordo com o seu diagnóstico**: "Desperdício" e "Taxa de falha" **são ambíguos entre si**, e
> essa ambiguidade é real. Mas eles não medem a mesma coisa:
> - **Desperdício** = material que sai do rolo e não vira peça (purga, suporte, brim) — perda de
>   MATERIAL, sempre acontece;
> - **Taxa de falha** = a impressão inteira que deu errado — perda de material **e** de tempo de
>   máquina, acontece às vezes.
>
> **A pergunta que eu preciso te fazer**: você quer *remover* o desperdício, ou quer que os dois
> fiquem *distinguíveis*? Se for o segundo, o conserto é de rótulo e tooltip — muito mais barato e
> sem tocar na fórmula. Se for o primeiro mesmo, eu faço, e o custo está escrito acima.

---

## Grupo 3 — layout (itens 1, 2, 8, 9, 11)

| item | conserto | complexidade | alinhamento |
| --- | --- | --- | --- |
| **1** header | sidebar na frente do header (prepara colapsável) + **logo completa** (você forneceu os dois PNGs) | **BAIXA** a logo, **MÉDIA** a reestruturação | bate |
| **2** espaço vazio no desktop | distribuir seções em colunas; título+subtítulo no topo, **total centralizado no fim** | **MÉDIA** | bate — e resolve o `[F11a-005]` da auditoria (a 1440 a calculadora usa 37% da largura) |
| **8** detalhes laranja/roxo | remover os marcadores de Material e Energia | **BAIXA** | bate |
| **9** preços finais | **sem scroll** + textos centralizados | **BAIXA** | ⚠ ver nota |
| **11** Preços por canal | fundir em "Como chegamos no preço" | **MÉDIA** | bate |

> **Nota do item 9**: o scroll que você viu é o conserto `[F11a-002]` da auditoria — o preço deixou
> de **quebrar no meio do número** e passou a rolar quando não cabe. Tirar o scroll sem mais nada faz
> o número voltar a quebrar ou transbordar. **O conserto certo é o layout do item 2**: com as seções
> distribuídas no desktop, o cartão ganha largura e o scroll deixa de existir sozinho. Os dois itens
> são o mesmo conserto visto de dois lados.

---

## Grupo 4 — Marketplace (item 10) — **o maior**

### 4a. Campos dirigidos pelo marketplace

O catálogo **já modela isto** (`determinantsSchema` por marketplace); a tela é que renderiza uma
grade fixa de 4 campos para todos. Dirigir a grade pelo schema resolve **três** coisas de uma vez:
campo inexistente não aparece · a categoria vira só mais um eixo · o ML deixa de ter um seletor vazio.

**Complexidade: MÉDIA-ALTA.** É reescrever a seção de canal. Não precisa de dado novo.

**Fato a conferir**: você citou "não existe taxa fixa no Mercado Livre" e suspeitou estar errado.
**Acredito que exista** (custo fixo por item abaixo de um limiar), mas **não verifiquei na fonte**.
Posso conferir como fiz com a Shopee. A sua regra vale de qualquer jeito.

### 4b. Marketplace vira premium

> ### DECIDIDO 2026-08-05: **CONFIRMADO — marketplace vira premium**
>
> O dono confirmou depois de ver o conflito. Portanto, e na mesma entrega:
> 1. o switch fica desabilitado e falso no grátis, com botão de assinar abaixo;
> 2. **a promessa da primeira dobra é reescrita** para dizer a verdade nova — hoje ela diz
>    "Calcular e ver a conta é grátis", e a conta que o vendedor quer ver inclui a comissão;
> 3. a virada entra como **Clarification datada na spec 007**, porque contradiz o SC-109.
>
> Sem (2) e (3), a mudança seria uma contradição silenciosa — que é a classe `[F02-000]` que a
> auditoria passou 16 fases medindo.
>
> ### ⚠ CONFLITO COM DECISÃO REGISTRADA (análise original, mantida)
>
> A calculadora grátis é a **superfície de aquisição**, e isso está em decisão registrada (SC-109,
> US6/007: *"free calculator stays fully usable"*). Nesta mesma semana você aprovou **subir** a
> promessa *"Calcular e ver a conta é grátis"* para a primeira dobra (`[F11a-003]`).
>
> Se o marketplace vira premium, o grátis passa a calcular **custo e markup, sem canal de venda** — e
> a frase "ver a conta é grátis" fica ambígua, porque a conta que o vendedor quer ver é justamente
> quanto sobra depois da comissão.
>
> **Não estou dizendo que está errado** — é a sua chamada, e há um argumento forte a favor (o
> marketplace é o valor real do produto; dá-lo de graça enfraquece o Premium). Só não posso mudar
> isso em silêncio: seria contradizer uma decisão de duas semanas atrás sem registrar.
>
> **Se você confirmar**, eu: (a) faço a mudança, (b) atualizo a promessa da primeira dobra para
> dizer a verdade nova, (c) registro a virada como Clarification datada na spec 007.

### 4c. Retirar "frete até a transportadora" de Outros custos

**Complexidade: BAIXA** (é texto de exemplo). **Bate** — o campo Frete já existe na seção do canal.

### 4d. Busca de categoria com lista e subitens

**Complexidade: MÉDIA.** O `CategoryPicker` já busca por texto e já tem a árvore de 38 nós da Amazon;
o que falta é navegar a hierarquia visualmente. A auditoria já tinha achado dois defeitos aqui: a
lista de resultados **parece um segundo campo preenchido**, e o contador dizia *"8 encontrados"*
quando 31 batiam.

### 4e. Mover a seção para antes de "Como chegamos no preço" e depois de "Markup"

**Complexidade: BAIXA.** Ordem de renderização.

---

## O que eu acho que faltou homologar

Você pediu para eu apontar cenários esquecidos. Estes não aparecem no relatório:

1. **Offline.** O app é PWA e promete calcular sem rede. Nada no relatório tocou isso, e é uma
   promessa de primeira dobra.
2. **Erro de rede de verdade** (backend fora do ar) — diferente do 403 de premium. Vale ver se a
   mensagem é honesta e se o "Tentar novamente" funciona.
3. **Sessão expirada** no meio do uso.
4. **A tela `/conta` no grátis** — o relatório cobriu Catálogo, Kits, Orçamentos e Simulações, mas
   não a Conta.
5. **Tema claro.** Todos os prints são do tema escuro. A auditoria mediu contraste nos dois, mas
   ninguém *olhou* o claro.
6. **A 404 e a tela de erro** — existem e têm cópia própria.
7. **Mobile real.** Os prints são desktop; a auditoria achou **dois Altos bloqueantes a 360px** que
   só existem no estreito.

---

## Ordem proposta

| # | bloco | por quê primeiro |
| --- | --- | --- |
| 1 | **medir o Grupo 0** | pode não haver defeito; e se houver, é o mais grave |
| 2 | **Grupo 1** (teasers) + rótulos | maior clareza por menor custo, e fecha um achado da auditoria |
| 3 | **Grupo 3** layout (itens 1, 2, 8, 9, 11) | o item 2 resolve o 9 de graça |
| 4 | **Grupo 2** campos e tooltips | depende das suas respostas sobre desperdício e vida útil |
| 5 | **Grupo 4** marketplace | o maior, e depende da decisão sobre premium |

---

## Decisões tomadas em 2026-08-05

| # | decisão | consequência |
| --- | --- | --- |
| 1 | **Marketplace vira premium** | + reescrever a promessa da primeira dobra + Clarification na 007 |
| 2 | **Desperdício: opção A**, remoção completa | bump MAJOR + migração + regra de leitura para documentos salvos |
| 3 | **Custo de máquina: trocar a pergunta** | valor + ritmo (3 opções) + payback em anos; fórmula intacta |
| 4 | **Rótulos**: Histórico→Orçamentos, Cenários→Simulações | só rótulos; rotas ficam |
| 5 | **Histórico NÃO é removido** | são opostos por construção; o par de nomes é que confundia |

## Ainda aberto

1. **As explicações de domínio dos outros campos** (§2a) — consumo médio, tarifa de energia, reserva
   de manutenção, taxa de falha, acabamento, mão de obra. A da máquina foi resolvida trocando a
   pergunta; as outras ainda precisam de conteúdo que eu não tenho autoridade para inventar.
2. **O subtítulo de Simulações** — aprova o texto proposto?
3. **Taxa fixa no Mercado Livre** — conferir na fonte (eu acredito que exista; não verifiquei).
