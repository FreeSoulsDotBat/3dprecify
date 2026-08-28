# Perguntas de perfil do vendedor no cartão de canal (Shopee: CPF/CNPJ e alto volume)

## O que desenhar

Duas perguntas cadastrais que hoje aparecem **dentro do cartão de canal** da tela Calculadora, e só
quando o canal escolhido é **Shopee**: "Você vende como" (Pessoa física / Pessoa jurídica) e, apenas se
a resposta for Pessoa física, "Mais de 450 pedidos nos últimos 90 dias?". Quem responde é o vendedor
leigo, no meio do fluxo de precificar uma peça — ele veio calcular preço, não preencher cadastro. A
resposta não é decorativa: ela escolhe **qual tabela de comissão da Shopee** o app usa, e portanto muda
o preço sugerido e o líquido na mesma tela. É preciso desenhar o par de perguntas, a revelação da
segunda, e — o que hoje não existe — **como a tela conta que não responder também é uma resposta**.

## Por que este prompt existe

Nasceram em 016/PR-F (2026-08-06), mais de um mês depois da última rodada do protótipo (2026-07-02) e
do sign-off "PARE de iterar com o Claude Design". Autoridade de desenho: **NENHUMA** — grep por "CPF",
"CNPJ" e "volume" nas quatro autoridades de layout, no readme do DS, na CalculatorScreen e no canvas
018 dá zero, e o protótipo não modela perfil de vendedor em lugar nenhum. Foi inferido por IA: que são
dois `select` nativos e não um par de escolhas visuais, que o placeholder "Selecione" representa "não
respondi", que a segunda pergunta aparece e some **no meio do cartão** mudando sua altura, e que a
consequência em dinheiro de não responder pode ficar sem nenhuma frase na tela.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/calculator/calculator-form.tsx` (bloco `plan.sellerProfile`),
textos em `apps/web/src/shared/i18n/messages.pt-br.ts`.

Ordem atual dentro do cartão de canal:

1. `select` "Marketplace" + botão ✕ "Remover canal" na mesma linha;
2. (outros marketplaces têm aqui "Modalidade" e/ou o seletor de categoria — **a Shopee não tem
   nenhum dos dois**, então as perguntas de perfil são o primeiro campo depois do marketplace);
3. **"Você vende como"** — `select` com placeholder;
4. **"Mais de 450 pedidos nos últimos 90 dias?"** — `select`, só quando a resposta acima é CPF;
5. grade de taxas: Comissão (%), Taxa fixa (R$), Frete (R$);
6. legendas: banda aplicada, subsídio de frete da Shopee;
7. selo de procedência (`Referência …`) e, na Shopee, os dois avisos honestos.

| Campo | Rótulo literal | Opções literais | Placeholder | Obrigatório |
|---|---|---|---|---|
| `sellerType` | "Você vende como" | "Pessoa física (CPF)" · "Pessoa jurídica (CNPJ)" | "Selecione" | Não |
| `highVolume` | "Mais de 450 pedidos nos últimos 90 dias?" | "Sim" · "Não" | "Selecione" | Não |

→ **Nada na tela diz que não responder assume o regime CNPJ.** A única pista é o texto do selo de
procedência, que nomeia a fonte "vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias)" — uma frase
técnica, no rodapé do cartão, que ninguém lê como resposta à pergunta de cima.
→ **A segunda pergunta entra e sai no meio do cartão**, empurrando a grade de taxas para baixo sem
aviso e sem transição desenhada.
→ **O mesmo placeholder "Selecione" serve para as duas perguntas**, inclusive para uma pergunta de
Sim/Não — onde "Selecione" não significa nada.
→ **Uma pergunta cadastral no meio de um formulário de precificação**: o rótulo "Você vende como" não
diz que se trata do documento com que a loja está registrada na Shopee. E os dois campos reservam
**uma linha só** de rótulo, sendo "Mais de 450 pedidos nos últimos 90 dias?" a frase mais longa do
cartão — exatamente o tipo que corta em 390px.

## Conteúdo e dados reais

- A pergunta só existe para a **Shopee** — ela vem do catálogo de tarifas (`determinantsSchema:
  { sellerProfile: ["CPF_ALTO_VOLUME"] }`). Para Mercado Livre, Amazon e "Outro" o bloco inteiro não
  aparece. Não desenhe uma versão genérica para todos os canais.
- **Só a combinação Pessoa física + Sim** muda de tabela. Pessoa jurídica (com qualquer volume),
  Pessoa física + Não, e qualquer pergunta em branco caem na **mesma tabela**, byte a byte.
- Diferença real em dinheiro (fonte: art. 26839 da Central do Vendedor Shopee, vigente 2026-03-01):
  **+R$ 3,00 por item vendido** na faixa. Tabela padrão: 20% + R$ 4,00 (de R$ 8,00 a R$ 80,00);
  14% + R$ 16,00 (R$ 80–100); 14% + R$ 20,00 (R$ 100–200); 14% + R$ 26,00 (acima de R$ 200,00).
  Tabela CPF de alto volume: 20% + R$ 7,00 (de R$ 12,00 a R$ 80,00), e as faixas seguintes com
  R$ 19,00 / R$ 23,00 / R$ 29,00.
- **Abaixo de R$ 12,00 a tabela CPF de alto volume não existe** — o nível de preço fica "sem
  referência" e a Shopee não publica a fórmula da taxa regressiva. É esse o caso que dispara o aviso
  "A Shopee não publica a fórmula completa desta taxa".
- Exemplo numérico para as pranchetas: peça com preço sugerido **R$ 24,24** (varejo) — em branco paga
  20% + R$ 4,00; com Pessoa física + Sim passa a 20% + R$ 7,00. As duas respostas são **opcionais**:
  sem validação, sem asterisco, sem mensagem de erro hoje.

## Estados obrigatórios

- **Repouso, nada respondido** — as duas perguntas em branco (só a primeira visível). Precisa mostrar
  que o cálculo já está usando a tabela padrão (CNPJ / CPF abaixo de 450 pedidos); hoje não mostra
  nada, e esse é o buraco central deste prompt. Mais **foco / hover / pressionado**, alvo ≥44px.
- **Pessoa jurídica escolhida** — a segunda pergunta não aparece (e se já tinha sido respondida antes,
  a resposta é ignorada pelo cálculo; ela não some do formulário, só deixa de ser lida).
- **Pessoa física escolhida, volume em branco** — a segunda pergunta aparece. Desenhe a entrada dela
  como parte da composição, não como um salto de altura.
- **Pessoa física + Não** — visualmente respondido, mas o cálculo é o mesmo da tabela padrão. O desenho
  deve deixar isso honesto, sem sugerir que a resposta "não fez nada".
- **Pessoa física + Sim** — tabela de alto volume; o cartão passa a mostrar o selo com a fonte "vendedor
  CPF com mais de 450 pedidos em 90 dias (taxa adicional de R$ 3,00 por item)".
- **Pessoa física + Sim com preço abaixo de R$ 12,00** — nível sem referência (selo "sem referência —
  informe as taxas") **mais** o alerta informativo, título literal "A Shopee não publica a fórmula
  completa desta taxa", corpo que cita os dois pontos oficiais e termina em "informe a taxa
  manualmente se precisar calcular este preço".
- **Offline / catálogo embutido** — o cartão exibe o selo "referência embutida (offline)"; as perguntas
  continuam funcionando normalmente (o mapeamento é local). Não invente estado de carregamento para
  elas: elas não fazem requisição.
- **Canal não-Shopee** — o bloco inteiro ausente. Mostre esse contraste em uma prancheta.

## Viewports

- **Mobile 390px** — obrigatório: é onde a peça vive de verdade e onde a frase de 450 pedidos corta
  (confira a leitura também a 360px, o piso já medido neste projeto).
- **Desktop 1280px** — o cartão de canal aparece numa coluna mais larga; a decisão aqui é se as duas
  perguntas ficam lado a lado (e o que a segunda faz com a altura) ou empilhadas como no mobile.

## Regras que o desenho não pode quebrar

- **A procedência do número é dita, sempre.** Se a tabela usada mudou por causa da resposta, o cartão
  diz qual regime está valendo — e diz também quando a resposta está em branco.
- **Não responder não pode parecer neutro.** É uma premissa de cálculo com efeito em dinheiro; a tela
  precisa afirmar a premissa, não escondê-la atrás de um placeholder.
- **Nenhuma frase honesta dentro de placeholder.** Este projeto já pagou por isso: em 77–187px úteis o
  texto corta no meio ("2,50 (= 50") e vira leitura errada. Frase explicativa vive em elemento de
  largura total.
- **Zero fórmula inventada.** Onde a Shopee não publica a regra (abaixo de R$ 12,00 para CPF de alto
  volume), a tela informa e oferece entrada manual — nunca estima.
- **Nada aqui é premium/freemium**: as perguntas existem para qualquer vendedor — sem cadeado, teaser
  ou degradação. Alvo ≥44px e contraste medido contra o fundo real do cartão (que já tem fundo próprio
  dentro da tela — não meça contra o fundo da página).

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, nos dois eixos.** A seção Shopee já mediu 1248px de altura a 360px e
  metade disso eram os dois avisos; e um scroll horizontal só apareceu quando alguém mediu o eixo
  vertical também. Desenhe com a soma do cartão em mente, não só com a peça isolada.
- **Rótulo comprido em rótulo de uma linha.** "Mais de 450 pedidos nos últimos 90 dias?" é a frase mais
  longa do cartão; se o desenho a encurtar, a informação "90 dias" e o número "450" não podem sumir.
- **Legenda que promete menos do que acontece.** Já houve legenda dizendo "+R$ 50" enquanto o anúncio
  subia R$ 74,28, porque a comissão incide sobre o custo adicionado. Se o desenho mostrar o impacto dos
  R$ 3,00, ele precisa dizer que o preço do anúncio sobe **mais** que isso.

## Entregável

Pranchetas, tema **escuro** (padrão) e **claro** (first-class), do cartão de canal inteiro com a peça
dentro dele — nunca a peça recortada, porque o problema é justamente a vizinhança:

1. 390px — Shopee, nada respondido, com a afirmação da premissa em uso;
2. 390px — Pessoa física selecionada, segunda pergunta revelada (mostre o antes/depois da altura);
3. 390px — Pessoa física + Sim, preço R$ 24,24, selo da tabela de alto volume;
4. 390px — Pessoa física + Sim, preço abaixo de R$ 12,00: sem referência + o alerta informativo;
5. 1280px — o mesmo cartão na coluna larga, com a decisão de arranjo das duas perguntas;
6. 390px — canal Mercado Livre, para mostrar a ausência do bloco.

Reutilize os primitivos existentes, não crie novos: o cartão é `tf-card`; a moldura rótulo+controle é
`tf-field`; as escolhas podem continuar em `tf-select` (nativo, abre a roda do sistema no mobile) ou
migrar para `tf-segmented`, que já existe na casa para escolha de valor com dois itens — **mostre as
duas alternativas e recomende uma**, considerando que "não respondido" precisa continuar existindo como
estado; a frase de premissa/procedência usa a legenda do cartão (mesmo estilo das legendas de banda e
subsídio); o alerta usa `tf-alert` tom informativo, e o detalhe longo pode colapsar em `tf-info-tip`
como já faz o aviso de frete aferido; o selo de procedência é o badge de selo já existente.

## Perguntas em aberto para o dono

1. Perfil do vendedor é uma propriedade **da conta** (perguntada uma vez, em Conta, e reaproveitada) ou
   **do cálculo** (perguntada em cada cartão de canal, como hoje)? Isso muda a peça de raiz.
2. Quando as perguntas estão em branco, a tela deve **afirmar a premissa** ("estamos usando a tabela de
   CNPJ") ou **pedir a resposta antes de precificar** (estado incompleto)? A segunda opção interrompe o
   fluxo de quem só quer um preço rápido.
3. O vendedor sabe se passou de 450 pedidos em 90 dias? Se não souber, a tela deve ensinar onde ver
   esse número no painel da Shopee — e isso é copy nova, que precisa de decisão.
4. "Você vende como" deve dizer explicitamente que se trata do documento cadastrado na Shopee (e não do
   documento da pessoa)? Hoje o rótulo é ambíguo e não há legenda.
