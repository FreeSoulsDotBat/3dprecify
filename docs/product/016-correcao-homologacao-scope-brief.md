# 016 — Scope brief: correção da homologação humana + decisões de dados de marketplace

**Status**: rascunho de escopo de produto (entrada do `/speckit-specify`) · **Autor**: product-owner · **Data**: 2026-08-05
**Branch prevista**: `016-correcao-homologacao` (cortada de `develop`)
**Origem**: `homologação/Relatório.md` + `homologação/Instruções.txt` (dono, 2026-08-05), analisados em
`docs/homologacao/PLANO-CORRECAO-HUMANA.md`, com as decisões de dado em
`docs/homologacao/OBTENCAO-DINAMICA-DADOS.md` §"Decisões do dono — TOMADAS em 2026-08-05" e as lacunas
estruturais em `docs/homologacao/ESTRUTURA-DADOS-MARKETPLACES.md`.

> **Este brief especifica COMPORTAMENTO, não arquitetura nem pixels.** A forma do schema, o caminho de
> migração, o componente de teaser, a grade do desktop e o mecanismo do tooltip são chamada do
> `arquiteto` / `designer-ux` / Claude Design na rodada seguinte (Princípio VIII).
> **Nenhuma decisão do dono é reaberta aqui.** Elas entram como restrições dadas. Onde eu discordo,
> está na §8 "Ressalvas do PO" — sem alterar o escopo.
> **Nenhum número de tarifa é inventado neste documento** (Constituição II): todo valor citado vem
> medido de `OBTENCAO-DINAMICA-DADOS.md` com a sua procedência, e o que não é público é nomeado como
> **lacuna**, não preenchido.

---

## 1. Visão

O dono homologou a aplicação como usuário **grátis** e encontrou dezenove pontos: a primeira dobra
promete uma coisa e entrega outra, cinco telas de cortesia mostram cinco variações diferentes do mesmo
recado, onze campos do formulário pedem números que o vendedor não sabe onde achar, e a seção de
marketplace mostra campos que o marketplace escolhido não cobra. O 016 conserta isso e, na mesma
entrega, fecha a virada de modelo de negócio que o dono decidiu em 2026-08-05: **marketplace passa a
ser Premium**, com a promessa da primeira dobra reescrita para dizer a verdade nova. Junto vão as
decisões de dado que mudam número na tela — a tarifa de R$ 2,00/item do plano Individual da Amazon, o
custo fixo do Mercado Livre pós-reforma de 02/03/2026, e o aviso honesto da Shopee onde a fórmula não
é publicada. **Por quê agora**: v1 é E1–E6 e o E6 está em PR-C; este é o último ponto em que dá para
mudar a fronteira do freemium e o schema de tarifa **antes** de haver usuário pagante e dado em
produção — depois disso, cada uma dessas mudanças vira migração com cliente em cima.

---

## 2. Restrições dadas (decisões do dono — NÃO reabrir)

| # | decisão | data | consequência que o escopo carrega |
| --- | --- | --- | --- |
| D1 | **Marketplace vira Premium** | 2026-08-05 | switch desabilitado e falso no grátis + botão assinar; promessa da 1ª dobra reescrita; **Clarification datada** onde a promessa antiga está registrada |
| D2 | **Desperdício: opção A — remoção completa** | 2026-08-05 | bump **MAJOR** do `PRICING_MODEL_VERSION` + migração + **regra de leitura** para documentos salvos |
| D3 | **Custo de máquina: trocar a PERGUNTA, não a fórmula** | 2026-08-05 | valor + ritmo (3 opções) + payback em anos → deriva as horas na tela; motor intocado, sem bump |
| D4 | **Rótulos**: Histórico→**Orçamentos**, Cenários→**Simulações** | 2026-08-05 | só rótulos; rotas ficam |
| D5 | **Histórico NÃO é removido** | 2026-08-05 | Orçamentos e Simulações são opostos por construção |
| D6 | **Teaser unificado** em 5 telas | 2026-08-05 | um padrão só: título · título+subtítulo da feature · botão Assinar · legenda pequena |
| D7 | Amazon `minPerItem` = **R$ 1,00 uniforme + vigia** | 2026-08-05 | nada muda no dado servido hoje; o vigia é ingestão (fora — §6) |
| D8 | Amazon plano Individual: **modelar `fixedFee` = 2,00** | 2026-08-05 | dado do catálogo muda + bump de `catalogVersion`; preços exibidos SOBEM para quem é Individual |
| D9 | Token ML da casa no CI: **direção aprovada** | 2026-08-05 | **só direção** — a implementação segue gateada (§6, out-of-scope) |
| D10 | ML custo fixo: **estender o schema completo** (logística × faixa de preço × peso) | 2026-08-05 | mudança estrutural no domínio de pricing → **escalação opus (ADR-0022)** |
| D11 | Shopee: **OCR no loop** com guardas | 2026-08-05 | é ingestão → fora do 016 (§6), as guardas viajam com ele |
| D12 | Shopee CPF < R$ 12: **aviso honesto** com os 2 pontos oficiais | 2026-08-05 | nada de fórmula não publicada sob selo de referência |
| D13 | Shopee item volumoso: **campo opcional** que soma R$ 50,00 | 2026-08-05 | toca o payload de cenário/cálculo → **escalação opus (ADR-0022)** |

**Três pendências do plano já se fecharam e não entram como abertas**: o subtítulo de Simulações foi
aprovado pelo dono; as explicações didáticas dos 11 tooltips foram autorizadas a serem **pesquisadas na
internet**, com foco em público leigo; e a **taxa fixa do Mercado Livre foi CONFIRMADA como existente**
(workflow 2026-08-05 — o campo fica no ML).

---

## 3. P0 — Verificação inicial (NÃO é conserto)

### V0. Medir o Grupo 0 (itens 15–19 do relatório): logado sem premium

**Isto é uma medição, não uma correção — pode não haver defeito.** O sintoma relatado (Catálogo · Kits ·
Orçamentos · Simulações mostrando *"Não foi possível carregar…"* em vermelho no lugar do teaser) tem uma
hipótese concorrente forte: os prints são anteriores ao conserto do backend do PR #42 (`ProactorEventLoop`),
quando **toda rota de banco devolvia 500** — e um 500 cai legitimamente no ramo de erro genérico. O
cliente **já trata** `ENTITLEMENT_REQUIRED` com um ramo próprio.

**Aceitação da verificação**: com o backend correto e uma conta logada **sem premium**, as cinco telas
são abertas e o que aparece é registrado com evidência (screenshot + a resposta HTTP observada).
- **Se o teaser aparecer** → não há defeito; V0 fecha como nota no `dod-evidence.md` e US1 já cobre o
  conteúdo do teaser.
- **Se o erro persistir** → é o achado mais grave da lista, vira a **primeira** fatia e reordena o §5.

> Consertar o que não está quebrado custa tanto quanto não consertar o que está. **Nenhuma tarefa de
> conserto para este grupo é planejada antes da medição.**

---

## 4. User stories

Priorização: **P1** = a verdade que o usuário lê primeiro · **P2** = o produto fica preenchível e
legível · **P3** = o motor e o dado ficam fiéis. Cada story é independente e testável.

### Grupo A — Teasers e rótulos (P1)

#### US1 — O teaser honesto é UM só, nas cinco telas (P1)
*Como visitante ou usuário grátis, quero entender numa olhada o que a feature faz e como assinar, sem
ler explicação de como o Premium funciona.*

Cinco superfícies, um padrão: **título da página · título + subtítulo da feature · botão "Assinar
Premium" · legenda pequena** — e nada mais.

**Aceitação (alto nível)**
1. Nas cinco telas — Simulações, "Usar do catálogo", Catálogo, Kits, Orçamentos — o grátis vê a mesma
   estrutura, com o mesmo componente, e as divergências atuais somem.
2. Somem especificamente: o subtítulo duplicado e o bloco "No Premium…" e a linha de preço de
   Simulações; o **modal "Cenários fazem parte do Premium"** deixa de existir; "Salvar faz parte do
   Premium." sai do "Usar do catálogo"; "+ Adicionar filamento" sai do Catálogo; **Entrar** e
   **Entendi** saem de Kits; **Entrar** e **Ir para a calculadora** saem de Orçamentos.
3. Em "Usar do catálogo", o botão fica **desabilitado** (visível, não escondido) e a explicação do que
   é o catálogo ocupa o lugar do texto removido.
4. Todo teaser oferece **um caminho de assinatura** (fecha o achado `[F11b-007]` da auditoria).
5. Nenhum teaser explica a mecânica do Premium — isso é da tela de compra.
6. O subtítulo de Simulações é o texto **já aprovado pelo dono**: *"Salve uma combinação de
   marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje."*
7. Regra de honestidade preservada: nada de falso salvamento, nada de no-op silencioso (FR-312).

#### US2 — Histórico vira Orçamentos, Cenários vira Simulações (P1)
*Como vendedor, quero dois nomes que digam o que cada coisa é, porque hoje eu não vejo diferença entre
"Meus cenários" e "Catálogo".*

**Aceitação**
1. Toda superfície visível ao usuário troca o rótulo: navegação, títulos de página, cabeçalhos, botões,
   toasts, vazios, teasers **e os artefatos exportados** (PDF/CSV) — sem sobrar ocorrência do par antigo.
2. **Rotas não mudam** (`/historico`, `/cenarios`), nem chaves de API, nem payloads persistidos.
3. O Histórico **não é removido**; os dois continuam existindo e o texto de cada um diz o que o
   diferencia do outro (congelado × recalculado hoje).
4. i18n: o par novo entra pelas chaves de tradução, não hard-coded.

> **Assunção declarada** (não é pergunta ao dono): a palavra "Orçamento" descreve o documento congelado
> exportável que já existe; não introduz obrigação fiscal nova, e o rodapé de "não é documento fiscal"
> que o PDF já carrega continua valendo.

### Grupo B — Layout (P2)

#### US3 — Header com a logo inteira e a sidebar na frente (P2)
**Aceitação**: a logo completa substitui o texto, com a variante certa por tema (os dois PNGs foram
fornecidos pelo dono em `homologação/`); a sidebar passa a ficar **à frente** do header, deixando o
caminho pronto para uma sidebar colapsável (o colapso em si **não** entra); nenhuma regressão de foco,
de leitura por leitor de tela ou de navegação por teclado.

#### US4 — O desktop deixa de ter buracos, e o preço final deixa de rolar (P2)
**Aceitação**: acima do breakpoint de desktop as seções da calculadora se distribuem em colunas, com
título + subtítulo no topo e o **total centralizado ao final de tudo**; a largura útil ocupada sobe do
patamar atual (a auditoria mediu **37% a 1440px** — `[F11a-005]`); **o scroll dos cartões de preço final
desaparece por consequência do ganho de largura**, e não por remoção da guarda — o número nunca quebra
no meio nem transborda (a guarda `[F11a-002]` fica, e é asseverada por **geometria**, não por texto);
os textos dos cartões ficam centralizados; a 360px nada regride.

#### US5 — "Preços por canal" some dentro de "Como chegamos no preço" (P2)
**Aceitação**: os descritivos de preço passam a viver num único lugar, sem duplicar linha nem perder
informação; os marcadores laranja e roxo ao lado de "Material" e "Energia" são removidos; a ordem de
leitura resultante é estável e determinística.

### Grupo C — Campos do formulário (P2)

#### US6 — Onze campos passam a se explicar sozinhos (P2)
*Como vendedor leigo, quero saber por que o campo está na conta **e** como descobrir o valor dele na
minha máquina, sem sair do app.*

Campos: Consumo médio · Tarifa de energia · Vida útil da máquina · Reserva de manutenção · Taxa de falha
· Tempo de acabamento · Valor do acabamento · Mão de obra (horas) · Valor da hora (+ os dois que a US8
introduz, se aplicável).

**Aceitação**
1. Ícone `?` à direita do rótulo de cada campo; tooltip no hover **e** acessível por teclado/toque
   (mobile não tem hover — a superfície não pode depender dele).
2. Cada explicação responde **duas** perguntas: *por que este número entra na conta* e *como você
   descobre o seu*. Linguagem de público leigo, pt-BR, sem jargão de engenharia.
3. O conteúdo é **pesquisado em fonte externa** (autorizado pelo dono) e cada explicação carrega a sua
   procedência no material de apoio; nenhum número é apresentado como recomendação sem fonte.
4. Reusa o componente `InfoTip` existente (mecanismo barato; o caro é o conteúdo).
5. Nenhum tooltip altera cálculo, validação ou obrigatoriedade.

#### US7 — Tempo de impressão em horas **e** minutos (P2)
**Aceitação**: a entrada vira dois campos (h + min) e a conversão acontece **na borda** — o motor
continua recebendo um decimal e **não muda**; o caminho de volta funciona: uma simulação salva ou um
orçamento congelado que guardam `5.5` reabrem exibindo **`5h 30min`**; arredondamento e casos de borda
(0, minutos ≥ 60, valores fracionários herdados) são determinísticos e sem número ruim.

#### US8 — Custo de máquina: trocar a pergunta (P2)
*Como vendedor, eu não sei a "vida útil da máquina em horas" — ninguém publica isso — mas eu sei quanto
paguei na impressora e com que frequência ela roda.*

**Aceitação**
1. A tela passa a perguntar **três** coisas: quanto custou a impressora (sabe) · com que frequência ela
   roda, em **três opções sem digitar** (sabe) · em quantos anos quer que ela se pague (decide).
2. Os três ritmos são os aprovados pelo dono: *poucas horas por semana* ≈ 780 h · *quase todo dia*
   ≈ 3.600 h · *praticamente o dia todo* ≈ 9.900 h (base anual × payback escolhido).
3. A tela **diz o derivado em voz alta** — ex.: *"≈ R$ 1,11 por hora de impressão"* — e oferece
   **"ajustar"** para quem quiser digitar as horas direto.
4. **A FÓRMULA NÃO MUDA**: o motor continua recebendo `machineValue` + `machineLifetimeHours`; a
   derivação vive na tela. **Sem bump, sem migração.**
5. O campo continua **obrigatório na prática** (é denominador; 35% do custo no vetor canônico) —
   torná-lo pulável não o torna compreensível, só faz o vendedor cobrar menos sem saber.
6. Um documento salvo com `machineLifetimeHours` fora dos três ritmos reabre no modo "ajustar", com o
   número dele intacto.

#### US9 — Máscara monetária e seções que fazem sentido juntas (P2)
**Aceitação**: "Valor da máquina" passa a usar o modo `currency` do `NumberField` (milhar pontuado);
"Ajustes opcionais" deixa de ser seção separada e funde em "Custos da peça"; "Tempo de acabamento" e
"Valor do acabamento" migram para "Mão de obra e custos"; nenhuma mudança de modelo, de validação ou de
resultado — reorganização pura, provada por igualdade numérica antes/depois.

### Grupo D — Remoção do Desperdício (P3, risco alto)

#### US10 — O campo "Desperdício" morre, e os documentos antigos continuam abrindo (P3)
> **⚠ Escalação opus obrigatória (ADR-0022)** — altera a superfície de `packages/pricing-core`.

*Decisão dada (D2, opção A)*: remoção completa, não só da tela. Escopo medido:
`filaments.default_waste_grams` · `products.waste_grams` (NOT NULL) · `bom_lines.waste_grams` · payload
congelado dos orçamentos · config das simulações · **54 ocorrências** no código.

**Aceitação**
1. O campo some da tela, do catálogo (filamentos/produtos), das linhas de BOM dos kits e da entrada do
   motor; o motor **rejeita** `wasteGrams` em vez de ignorá-lo em silêncio.
2. **Bump MAJOR** do `PRICING_MODEL_VERSION` (remoção de campo de entrada é quebra).
3. **Regra de leitura para documentos salvos, e é a parte que morde**:
   - um **orçamento congelado** anterior continua abrindo, exibindo e exportando exatamente o que foi
     cotado, `wasteGrams` incluído — a imutabilidade (ADR-0019) não é tocada;
   - **"Recalcular hoje"** e **reabrir uma simulação** recomputam a partir do documento salvo: a entrada
     é mapeada para o modelo novo **descartando** `wasteGrams`, e a tela **diz que descartou** — o
     usuário não pode descobrir a diferença sozinho;
   - nenhum documento salvo, de qualquer versão, quebra ao abrir.
4. O preço recalculado de um documento antigo **fica menor** que o congelado por um motivo novo
   (estrutural, não churn de catálogo) e a diferença é explicada onde ela aparece.
5. **Nota honesta que fica registrada**: a limpeza é do presente, não do passado — orçamentos já
   congelados continuam contendo `wasteGrams`. Foi o argumento a favor da opção B, e o dono escolheu a
   A mesmo assim.
6. A ambiguidade que motivou a remoção não pode voltar por omissão: o material de apoio de "Taxa de
   falha" e das gramas passa a dizer o que cobre e o que não cobre (ver §8 Ressalva 1).

### Grupo E — Marketplace Premium e campos dirigidos (P3)

#### US11 — Marketplace vira Premium, e a promessa é reescrita na mesma entrega (P3)
**Aceitação**
1. No grátis, o switch de marketplace fica **desabilitado e falso**, com botão de assinar logo abaixo —
   visível, nunca escondido; sem cálculo de canal, sem número parcial, sem fake.
2. A **promessa da primeira dobra é reescrita** para dizer a verdade nova. Hoje ela diz *"Calcular e ver
   a conta é grátis"*, e a conta que o vendedor quer ver inclui a comissão.
3. A virada entra como **Clarification datada** na spec onde a promessa antiga está registrada. **Nota
   factual do PO** (não reabre a decisão, corrige o endereço): **SC-109 mora na spec 005**
   (`specs/005-marketplace-multichannel/spec.md:253`), enquanto a 007 carrega **FR-313 e SC-310**
   (`specs/007-e2-catalog-entitlement/spec.md:265,304`) — a Clarification precisa entrar **nas duas**,
   senão o registro fica pela metade.
4. O que continua grátis fica dito com precisão: custo e markup, sem canal de venda.
5. Sem (2) e (3) a mudança seria uma **contradição silenciosa** — a classe `[F02-000]` que a auditoria
   passou 16 fases medindo. Os três itens são **uma** entrega, não três.

#### US12 — Os campos da seção de canal são dirigidos pelo marketplace (P3)
*Como vendedor, não quero ver "Taxa fixa" num marketplace que não cobra taxa fixa, nem um seletor de
categoria vazio.*

**Aceitação**
1. A grade fixa de 4 campos dá lugar a uma seção **dirigida pelo `determinantsSchema`** do marketplace
   escolhido: campo que o marketplace não tem **não aparece**; a categoria vira só mais um eixo.
2. Casos concretos que precisam ficar certos: **Shopee não varia por categoria** → o seletor de
   categoria some; **Amazon é plana** (38 linhas, 1 nível) → lista, não árvore; **Mercado Livre tem taxa
   fixa** (confirmado 2026-08-05) → o campo fica, e o seletor de categoria do ML **deixa de vir vazio**.
3. A seção muda de lugar: **depois de "Markup" e antes de "Como chegamos no preço"**.
4. "frete até a transportadora" sai dos exemplos de "Outros custos" — o campo Frete já existe na seção
   do canal, e citá-lo nos dois lugares convida a contagem dupla.
5. Nenhum dado novo é exigido: o schema já é mais capaz do que a tela usa.
6. Regressão zero no cálculo: para uma combinação já suportada, o resultado é byte-idêntico ao de hoje.

#### US13 — Achar a categoria por busca **e** por lista com subitens (P3)
**Aceitação**: o seletor permite navegar a hierarquia visualmente, além de buscar por texto; a lista de
resultados **não pode parecer um segundo campo preenchido** (defeito achado na homologação do 014); o
contador diz a verdade (o mesmo achado registrou *"8 encontrados"* com 31 correspondências); estado
honesto de "não informada"; a asserção de layout é **geométrica**, e há screenshot — texto extraído é
cego para os dois defeitos acima.

### Grupo F — Dados e schema de marketplace (P3)

#### US14 — O plano Individual da Amazon passa a custar os R$ 2,00/item que ele custa (P3)
> **⚠ Escalação opus obrigatória (ADR-0022)** — leaf de dinheiro no catálogo de tarifas.

**Aceitação**: as entradas `plan = INDIVIDUAL` passam de `fixedFee = 0` para **2,00** (tarifa oficial por
item vendido, MEDIDA e estável desde ≥dez/2020); `catalogVersion` **bumpa** (ele é congelado em snapshot
imutável e precisa continuar respondendo qual tabela precificou o registro); `minPerItem` **continua 1,00
uniforme** (D7 — não é reaberto); o plano **Profissional** (R$ 19/mês) **fica fora** — é custo mensal do
vendedor (lacuna E1), não custo por item; o preço exibido para quem é Individual **sobe**, e isso é
consequência aceita e comunicada (§7 R1).

#### US15 — O custo fixo do Mercado Livre passa a ser logística × faixa de preço × peso (P3)
> **⚠ Escalação opus obrigatória (ADR-0022)** — mudança estrutural no domínio de pricing.

*Decisão dada (D10)*: estender o schema completo, como eixo próprio do custo fixo, **separado do frete**
— o dono escolheu contra a recomendação de aproximar pelas tabelas de frete; a fidelidade estrutural
venceu a economia de schema.

**Aceitação**
1. O custo fixo do ML deixa de ser função só da faixa de preço e passa a depender também de **tipo de
   logística** (Flex/`self_service`, ME1, `custom`, `not_specified` pagam; ME2 Coleta/Agências/Full
   **não** pagam) e de **peso**; o limiar de **R$ 79** continua (acima dele, ninguém paga); **não varia
   por categoria** (categoria afeta só o percentual).
2. O eixo de logística vira algo que a tela **pergunta** ao vendedor no canal ML (hoje ninguém pergunta).
3. **Nenhum número não publicado entra sob selo de "referência"**: onde a fonte oficial não publica o
   valor, a combinação resolve para **"sem referência — informe"**, com campo manual, jamais um número
   de blog. As tabelas reproduzidas por terceiros são REPORTADO e não sobem a fato.
4. A regra dos 50% abaixo de R$ 12,50 **não é gravada como número** enquanto não houver prova em fonte
   autenticada (`price=8` → `fixed_fee == 4,00`).
5. O piso de comissão do ML permanece **"não determinado"** — nunca gravar "não existe" a partir de
   ausência de menção.
6. As tabelas de frete medidas (3 × 29 × 8, verificadas célula a célula) **não entram aqui** — elas são
   insumo da lacuna E3 (frete real), cada coisa no seu eixo.

> **Dependência que decide o corte**: os **valores** do custo fixo ML só existem via API autenticada, e o
> token da casa está fora deste incremento (§6). Ver a **pergunta Q2** — é ela que diz se US15 entra em
> 016 como *schema honesto sem números* ou sai para depois.

#### US16 — Item volumoso na Shopee (P3)
> **⚠ Escalação opus obrigatória (ADR-0022)** — toca o payload de cálculo/cenário.

*Decisão dada (D13)*: campo opcional, não aviso — o dono escolheu contra a recomendação.

**Aceitação**: no canal Shopee existe um campo opcional **"Item volumoso"**; marcado, ele soma
**R$ 50,00** (taxa oficial de manuseio, art. 3305, vigência 02/02/2026) ao cálculo; desmarcado, o
resultado é byte-idêntico ao de hoje; o campo diz de onde vem o valor e a partir de quando vale; o
**ajuste de frete aferido** (art. 4478) **não** vira campo — é incalculável por natureza (recálculo caso
a caso) e fica como aviso (US17).

### Grupo G — Avisos honestos (P3)

#### US17 — Onde a Shopee não publica a regra, a calculadora diz isso (P3)
**Aceitação**
1. Para um canal Shopee de perfil **CPF** com preço **abaixo de R$ 12**, a tela exibe um aviso de que a
   taxa regressiva **não é publicada pela Shopee** e mostra os **dois pontos oficiais**: R$ 10 → R$ 6,50
   e R$ 8 → R$ 6,00 (verbatim, art. 26839), com o contexto em que valem (CPF acima de 450 pedidos/90 dias).
2. **Nenhuma fórmula não publicada é aplicada** — a hipótese linear (R$ 4 + 0,25 × preço) é colinear com
   os dois pontos e **não é fato**; ela não entra em lugar nenhum.
3. O aviso do **ajuste de frete aferido** (peso/dimensão aferidos ≠ cadastrados) aparece como
   informação, sem tocar o cálculo.
4. Os avisos não bloqueiam o cálculo, não fabricam número e não somem quando o campo é editado.
5. **Dependência**: (1) exige saber que o perfil é **CPF** — ver a pergunta **Q6**.

---

## 5. Fatiamento em PRs

O projeto entrega em fatias autorizadas uma a uma pelo dono, squash-merge em `develop` (ADR-0006).
A base é a "Ordem proposta" do plano; onde eu mudo, digo por quê.

### Corte proposto (recomendado, confiança ~75%)

| # | fatia | conteúdo | por quê nessa posição |
| --- | --- | --- | --- |
| **V0** | *(medição, pode não virar PR)* | §3 | pode não haver defeito; se houver, é o mais grave e passa a ser a fatia 1 |
| **PR-A** | teasers + rótulos | US1, US2 | maior clareza por menor custo; fecha `[F11b-007]` de brinde; não depende de nada |
| **PR-B** | layout | US3, US4, US5 | o item 2 do relatório resolve o item 9 de graça; independente do resto |
| **PR-C** | campos, sem tocar a fórmula | US6, US7, US8, US9 | todo o valor didático **sem** bump e **sem** migração — entrega grande com risco baixo |
| **PR-D** | remoção do Desperdício | US10 | **sozinha**: é a única fatia com bump MAJOR + migração + regra de leitura; um rollback dela não pode arrastar PR-C junto |
| **PR-E** | marketplace Premium + campos dirigidos | US11, US12, US13 | a virada de freemium e a seção dirigida são a mesma tela; a Clarification datada viaja com o código |
| **PR-F** | dado de marketplace | US14, US16, US17 | mudanças de dado/campo com escalação opus, todas verificáveis por número na tela |
| **PR-G** | ML custo fixo | US15 | maior mudança de schema; separada porque o **dado** depende do token (§6) e a fatia pode ficar só com o schema honesto — ou sair (Q2) |

**Por que PR-D isolada, e não junto com PR-C** (que também mexe no formulário): PR-C não bumpa versão e
não migra dado; PR-D faz as duas coisas. Juntá-las põe a fatia de menor risco do incremento refém da de
maior risco, e transforma um rollback barato em caro. Confiança ~85%.

**Por que PR-E depois de PR-A**: o teaser unificado da US1 é o componente que a US11 usa no switch
desabilitado. Fazer PR-E antes duplicaria a variação que a US1 está eliminando.

**Sobre a ordem e a promessa falsa**: a promessa da primeira dobra é **verdadeira hoje** e só fica falsa
**quando US11 entrar**. Por isso o marketplace pode ficar por último sem deixar mentira no produto — mas
**a reescrita da promessa e a Clarification têm de estar na MESMA fatia**, nunca antes nem depois.

### Alternativas consideradas

**Opção 2 — três fatias grandes (A+B / C+D / E+F+G), no formato de E4/E5.**
*Prós*: menos cerimônia de autorização, menos rodadas de review, alinhado ao ritmo dos incrementos
anteriores. *Contras*: a fatia C+D mistura a mudança de menor risco com a de maior; um problema na
migração do desperdício segura os onze tooltips. *Escalabilidade*: pior — fatia grande com migração é
exatamente o que dá review ruim. **Confiança de que é inferior: ~80%.**

**Opção 3 — a virada de freemium primeiro (PR-E antes de tudo).**
*Prós*: fecha a decisão de negócio mais cedo e é a que mais muda a percepção do produto; o resto é
polimento em cima de uma fronteira já certa. *Contras*: entra sem o componente de teaser unificado, então
duplica trabalho da US1; e é a fatia mais cara — começar pela mais cara atrasa qualquer valor entregue.
*Escalabilidade*: neutra. **Confiança de que é inferior: ~70%** (subiria se o dono quiser a fronteira
fechada antes do E6 PR-C).

### O pipeline de ingestão: recomendação de corte

**Recomendo tirar do 016 e abrir o incremento 017 "ingestão mensal de tarifas".** Justificativa em três
fatos: (a) o loop **não dispara** hoje — `schedule` do GitHub lê do branch **default** (`main`) e o corte
de release está adiado até v1, então o gatilho prático é `workflow_dispatch` mesmo depois do YAML existir;
(b) o valor de 016 é **visível ao usuário em dias**, o da ingestão só aparece quando o loop rodar; (c) a
ingestão carrega dependências externas de natureza diferente (OCR, headless, token) que fazem a fatia
falhar por motivos que nada têm a ver com o produto.

*Alternativas*: **(ii) ingestão como PR-H do próprio 016** — prós: as decisões D7/D11 ficam
implementadas junto com quem as decidiu; contras: infla um incremento que já tem 17 stories e mistura
CI com produto; confiança de que é pior: ~70%. **(iii) só o vigia da `/precos` da Amazon dentro de 016**
(é o menor dos três e monitora o conflito R$ 1,00 × R$ 2,00 que o D7 deixou aberto) — prós: fecha o D7 de
verdade; contras: o alerta não é lido por ninguém enquanto o loop não roda; confiança de que é pior:
~55% — **esta é a alternativa que eu levaria ao dono se ele quiser o D7 fechado nesta rodada.**

---

## 6. Fora de escopo (explícito)

1. **US6-ML — habilitar o token da casa no CI.** A decisão do dono (D9) foi **só de direção**. A
   implementação continua **gateada pelas 8 condições do parecer do `seguranca` E por autorização
   separada do dono**; nada disso foi destravado. **Não iniciar em um "continue".** Junto ficam de fora:
   o teste único de suficiência da permissão *"Publicação e sincronização: Leitura"* contra
   `listing_prices` e `users/{id}/shipping_options/free`, e a coleta de comissão por categoria do ML.
2. **O pipeline de ingestão mensal** — vigia da `/precos` da Amazon (D7), OCR da Shopee com guardas
   (D11), ingestão das tabelas de frete do ML, `fee-refresh.yml`. Proposta: incremento **017** (§5).
3. **Frete real (lacuna E3)** — peso, dimensões, cubagem (divisor 6.000), distância e reputação como
   modelo de frete. As 3 tabelas oficiais (29 × 8 cada) estão medidas e verificadas, prontas para quando
   for a vez; **não é a vez.**
4. **Lacuna E1 completa — o catálogo não conhece o vendedor.** Ficam fora: Amazon Profissional
   R$ 19/mês (custo mensal, não por item), campanhas de Destaque da Shopee (+3,5% sobre a loja), e o
   perfil do vendedor como bloco próprio. O 016 só toca o mínimo que as US14/US17 exigem.
5. **Lacuna E2 — `fixedFee` como função do preço.** A sub-regra oficial da Shopee "abaixo de R$ 8 (CNPJ)
   o adicional é metade do preço" **não é modelada** neste incremento. Consequência conhecida e
   registrada: **superestimamos a taxa de itens muito baratos** — chaveiro é o caso mais comum de 3D.
   Ver a pergunta **Q8**.
6. **Isenção promocional da Amazon** ("comissão zero até R$ 500 mil") — benefício temporário e
   condicional por vendedor; **nunca** alimenta `commissionPct`.
7. **Piso de comissão** de ML e Shopee — permanece "não determinado" nos dois; ausência de menção não é
   negação.
8. **Closing fee de mídia da Amazon** — página oficial atrás de login; irrelevante para 3D hoje.
9. **Sidebar colapsável** — a US3 só prepara o terreno (sidebar à frente do header); o colapso não entra.
10. **Homologação com usuário premium** — o dono declarou que homologa o premium **depois** ("Vamos
    começar só com esses pontos"). O 016 é a correção do que ele viu como grátis.
11. **Os 7 cenários não homologados** (§9) são **medidos**, não consertados neste incremento: defeito
    encontrado vira follow-up priorizado, não escopo automático.

---

## 7. Riscos de produto

| # | risco | por quê importa | mitigação proposta |
| --- | --- | --- | --- |
| **R1** | **Os preços exibidos MUDAM em duas direções na mesma entrega** | desperdício removido → material **cai**; Amazon Individual `fixedFee` 2,00 → custo **sobe**. O vendedor que anotou o preço de ontem lê isso como bug | comunicação explícita (Q7): nota na tela, e o "Recalcular hoje" dizendo **por que** difere do congelado |
| **R2** | **O grátis perde uma capacidade que tinha** (marketplace) | é regressão de valor percebido, e contradiz uma promessa de duas semanas atrás | US11 inteira: promessa reescrita + Clarification datada + teaser com caminho de assinatura na mesma fatia |
| **R3** | **Orçamento congelado passa a citar um campo que a tela não tem mais** | o PDF antigo imprime uma linha que o app não sabe mais explicar | regra de leitura da US10 + legenda no documento antigo |
| **R4** | **Remover o Desperdício pode fazer o vendedor subprecificar** | purga, suporte e brim são material real que a Taxa de falha **não** cobre | US10 AC6 (o material de apoio passa a dizer que purga/suporte entram nas gramas). Ver §8 Ressalva 1 |
| **R5** | **`minPerItem` 1,00 mantido com conflito oficial × oficial aberto** | se a `/precos` refletir a prática, **subestimamos até R$ 1,00/item** exatamente onde peça 3D barata vende | decisão do dono (D7) + o vigia — que está em 017 (§5, alternativa iii) |
| **R6** | **O formulário GANHA campos no incremento cujo objetivo é simplificá-lo** | logística ML, perfil Shopee, volumoso, ritmo, payback, peso — a tensão é real e não some sozinha | campos **dirigidos pelo marketplace** (US12): cada vendedor vê só o do canal dele; nada aparece para quem não usa aquele canal |
| **R7** | **17 stories num incremento** | risco de o incremento não fechar e virar dívida | fatias autorizadas uma a uma; PR-A a PR-C entregam valor **sozinhas** e podem parar ali sem deixar meio-produto |
| **R8** | **Bump MAJOR com E6 (billing) em PR-C** | duas mudanças estruturais em voo ao mesmo tempo | ordenar PR-D depois do fechamento do E6, ou coordenar explicitamente com o `arquiteto` |

---

## 8. Ressalvas do PO (registro — **não** alteram o escopo)

1. **Desperdício (D2).** Concordo que "Desperdício" e "Taxa de falha" são ambíguos entre si — a
   ambiguidade é real e o dono está certo em recusá-la. Mas eles **não medem a mesma coisa**:
   desperdício é material que sai do rolo e não vira peça (purga, suporte, brim) e **sempre** acontece;
   taxa de falha é a impressão inteira que deu errado, e acontece **às vezes**. Removendo o primeiro sem
   redirecionar o conceito, o material de purga some da conta. Por isso a AC6 da US10 existe: as gramas
   passam a ser explicadas como "o que sai do rolo", não "o que vira peça". **Confiança de que a perda de
   fidelidade é material se a AC6 não for cumprida: ~80%.**
2. **Shopee volumoso (D13).** A taxa é **R$ 50,00 por PEDIDO** e a calculadora precifica por **unidade**.
   Somar R$ 50 à unidade superestima qualquer pedido com mais de um item. Não reabro a decisão de ter o
   campo; peço a definição do rateio na Q5. **Confiança de que o caso multi-item é frequente o bastante
   para importar: ~60%** (inferência, não medido nos nossos usuários).
3. **Amazon `minPerItem` (D7).** O risco aqui é **assimétrico**: subestimar a tarifa faz o vendedor
   perder dinheiro sem saber; superestimar só o faz cobrar um pouco mais. A escolha conservadora seria a
   oposta. Registro e sigo a decisão.
4. **Onde a Clarification vai.** SC-109 está na **spec 005**, não na 007; a 007 tem FR-313/SC-310. A
   decisão do dono ("Clarification datada na spec 007") está certa em intenção e incompleta em endereço —
   a virada precisa ser emendada nas **duas** specs. **Confiança: 95%** (lido diretamente nos arquivos).
5. **Tamanho do incremento.** 17 stories é grande para um incremento nosso (E4/E5 fecharam com 3 fatias).
   Recomendo o corte da ingestão para fora (§5) e aceito o resto como um só incremento **porque as
   fatias são independentes** — mas registro que 016 é o maior escopo desde o E2.

---

## 9. Cobertura de homologação exigida (não é escopo de conserto)

O plano apontou sete cenários que o relatório não tocou. Eles entram como **matriz de homologação** do
016 — medir e registrar, com defeito virando follow-up priorizado:

1. **Offline** (o app é PWA e promete calcular sem rede — promessa de primeira dobra).
2. **Erro de rede de verdade** (backend fora do ar), diferente do 403 de premium — a mensagem é honesta?
   o "Tentar novamente" funciona?
3. **Sessão expirada** no meio do uso.
4. **A tela `/conta` no grátis** (o relatório cobriu Catálogo, Kits, Orçamentos e Simulações, não a Conta).
5. **Tema claro** (todos os prints são do escuro; contraste foi medido, mas ninguém *olhou*).
6. **A 404 e a tela de erro** (existem e têm cópia própria).
7. **Mobile real a 360px** (os prints são desktop; a auditoria achou dois Altos bloqueantes só no estreito).

**Regra de homologação herdada, e o projeto pagou por ela três vezes**: um screenshot acha o que uma
asserção geométrica não acha, e uma asserção geométrica acha o que extração de texto não acha.
`toBeVisible`/`toContainText` passam num elemento totalmente ocluído. **Layout se afere com CAIXAS, e a
homologação visual sai com imagem.**

---

## 10. Perguntas para o `/speckit-clarify` (8 — nenhuma reabre decisão)

| # | pergunta | o que muda |
| --- | --- | --- |
| **Q1** | **"sem referência — informe as taxas"**: o dono pediu explicação e disse que decidiria depois de entender. O selo **fica como está**, muda de texto, ou sai? | aceitação da US12 e o comportamento de toda combinação não coberta |
| **Q2** | **US15 entra em 016?** O schema do custo fixo ML pode entrar **sem os valores** (combinações sem número público resolvem para "sem referência — informe"), ou espera o token da casa e sai do incremento? | inclui/exclui PR-G — a maior mudança de schema do incremento |
| **Q3** | **De onde vem o PESO** que o custo fixo ML novo exige? Derivamos das gramas de filamento (que é o que temos), perguntamos peso da peça embalada, ou pedimos dimensões para a cubagem (divisor 6.000, medido)? | escopo da US15 **e** número de campos novos no formulário (R6) |
| **Q4** | **Tipo de logística do ML** (Flex/ME1/Coleta/Agências/Full) na tela: obrigatório, opcional com default declarado, ou derivado de outra resposta? | aceitação de US12/US15; um default errado **inverte** quem paga custo fixo |
| **Q5** | **Shopee volumoso: R$ 50 é por PEDIDO**, e a calculadora precifica por UNIDADE. Somamos os R$ 50 inteiros à unidade (superestima multi-item) ou perguntamos "itens por pedido" para ratear? | aceitação da US16 |
| **Q6** | **Perfil do vendedor Shopee (CPF/CNPJ)**: vira determinante perguntado na tela (o aviso do <R$ 12 depende dele)? E o **+R$ 3/item** de quem passa de 450 pedidos/90 dias — entra ou fica de fora? | viabiliza ou não a US17 AC1; é a fatia mínima da lacuna E1 |
| **Q7** | **Comunicação da mudança de preço**: os números exibidos mudam (desperdício ↓, Amazon Individual ↑). Avisamos o usuário — nota na tela, changelog, nada? E o "Recalcular hoje" de um orçamento antigo passa a divergir por motivo novo: o app explica esse motivo? | aceitação de US10 e US14; é o R1 |
| **Q8** | **Shopee abaixo de R$ 8 (CNPJ)**: a regra oficial diz que o adicional é **metade do preço**, e hoje não a modelamos — **superestimamos** item barato. Modelar nesta rodada (é a lacuna E2, muda schema → opus), virar aviso, ou ficar fora com o desvio registrado? | pode acrescentar uma story ao Grupo F/G |

---

## 11. Definição de pronto do incremento

- `pnpm gate:all` verde (o mesmo comando literal do lefthook e da CI) + e2e + drift-guard de contrato.
- **V0 medido e registrado** antes de qualquer conserto do Grupo 0.
- Toda fatia com mudança visual homologada **com imagem** e com asserção de **geometria** onde houver
  layout (§9).
- Clarifications datadas escritas nas specs **005 e 007** antes do merge da PR-E.
- `PRICING_MODEL_VERSION` bumpado (MAJOR) e `catalogVersion` bumpado onde o conteúdo do catálogo mudar —
  os dois rótulos são congelados em snapshot imutável e precisam continuar dizendo a verdade.
- Nenhum número de tarifa sob selo de "referência" sem fonte oficial datada.
- `docs/token-ledger.md` com a linha de cada operação multi-agente.
