# Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)

## O que desenhar
Dois avisos informativos que fecham o cartão de um canal Shopee dentro da calculadora de preço. O
vendedor está preenchendo o slot do marketplace (comissão, taxa fixa, frete, tipo de vendedor,
volume de pedidos) e, logo abaixo da grade de taxas, das legendas de faixa e do selo de procedência,
o produto admite duas coisas que não sabe: (1) que a Shopee **não publica** a fórmula de uma taxa
regressiva que atinge exatamente este vendedor neste preço, e (2) que o **frete aferido** pela
transportadora pode gerar uma recobrança retroativa que o cálculo não modela. O primeiro é
condicional (só aparece na combinação CPF + alto volume + preço que o motor recusou precificar); o
segundo é estático — está sempre lá em qualquer slot Shopee, mesmo depois de o vendedor editar tudo.
São as duas frases em que a marca cumpre a promessa de "verdade forjada": preferir dizer "não sei" a
entregar um número inventado.

## Por que este prompt existe
Nunca houve desenho: `autoridade: NENHUMA`. Nenhum protótipo cobre "taxa não publicada" ou "frete
aferido" — as duas únicas menções à Shopee no `claude-design-prototype.md` a listam como opção de
canal com taxa fixa + comissão. Foi **inferido sem desenho**: (a) que o aviso do frete vira uma linha
compacta com o corpo escondido atrás de um ⓘ, (b) que o tom dos dois é `info` e não perigo, (c) que
ambos vivem colados no fim do slot, e (d) que dois avisos com o mesmo peso de verdade podem ter
**formas diferentes** na mesma tela. A forma compacta em si é legítima — o dono a usou no canvas
`Abas-Desktop.dc.html` (aba Orçamentos, "1 registro(s) pendente(s) neste dispositivo") —, mas ela
nasceu de uma **medição de altura** em 016/PR-F, não de uma decisão de hierarquia: a seção Shopee
media 1248px a 360px e os dois avisos ocupavam 48% dela. Ou seja: uma admissão de ignorância foi
espremida por falta de espaço, e ninguém desenhou quanto ela deve pesar.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dentro do cartão do canal, de cima para baixo: grade de taxas → legenda de faixa
("Tabela por faixa de preço — valores da faixa do seu anúncio.") → legenda do subsídio de frete →
checkboxes de sobretaxa → selo de procedência → **os dois avisos**, com 8px entre eles.

| Peça | Forma hoje | Condição para aparecer |
|---|---|---|
| Aviso da taxa regressiva | Alerta completo, tom `info`: ícone ⓘ + título em semibold + corpo longo (~370 caracteres) sempre visível | Canal = Shopee **e** "Pessoa física (CPF)" **e** "Mais de 450 pedidos nos últimos 90 dias? = Sim" **e** o motor recusou precificar algum nível (preço fora de toda faixa publicada) |
| Aviso do frete aferido | Linha compacta de uma só altura: ícone ⓘ + título curto + botão ⓘ (InfoTip) que guarda o corpo num popover | Sempre, em qualquer slot Shopee — nunca some |

Textos literais em pt-BR, homologados, que o desenho deve usar **sem reescrever**:

- Título 1: **"A Shopee não publica a fórmula completa desta taxa"**
- Corpo 1: **"Para vendedores CPF com mais de 450 pedidos nos últimos 90 dias, a Shopee cobra uma
  taxa adicional regressiva abaixo de R$ 12,00 — mas só divulga dois pontos: “um produto de R$10 tem
  uma taxa de R$6,50, enquanto um de R$8 terá taxa de R$6”. Sem a fórmula completa, não aplicamos
  nenhuma estimativa — informe a taxa manualmente se precisar calcular este preço."**
- Título 2: **"Frete aferido pode gerar cobrança retroativa"**
- Corpo 2 (hoje dentro do popover): **"Se o peso ou as dimensões cadastrados forem menores que os
  aferidos pela transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra
  no cálculo — é um risco a considerar ao cadastrar o anúncio."**
- Rótulo acessível do gatilho ⓘ: **"Sobre o frete aferido"**

→ Problema 1: **duas verdades da mesma natureza, com dois pesos visuais diferentes**, e o motivo é
espaço, não importância. O desenho precisa decidir a hierarquia entre elas de propósito.
→ Problema 2: o corpo 1 é um bloco corrido de ~370 caracteres com uma citação entre aspas curvas
dentro. A 390px isso vira 8–10 linhas de parede. A citação dos dois pontos oficiais (R$ 10 → R$ 6,50;
R$ 8 → R$ 6,00) é o dado mais concreto da frase e está enterrada no meio do parágrafo.
→ Problema 3: o corpo 2 está **atrás de um clique**. Uma admissão de risco financeiro só é lida por
quem tocar no ⓘ; quem não tocar leva só o título.
→ Problema 4: os dois avisos aparecem depois do selo de procedência, no fim de um cartão longo — bem
longe do campo "Comissão", que é onde a ação pedida pelo aviso 1 ("informe a taxa manualmente")
acontece.

## Conteúdo e dados reais
- Os dois pontos oficiais são **verbatim da fonte** (art. 26839) e não podem ser reformulados,
  arredondados nem completados: R$ 10,00 → taxa R$ 6,50 · R$ 8,00 → taxa R$ 6,00. O limite da faixa
  é **R$ 12,00**; o gatilho de volume é **450 pedidos em 90 dias**.
- A fórmula linear que "encaixa" nesses dois pontos é **deliberadamente inexistente** no produto. O
  desenho não pode sugerir um gráfico, uma curva, uma interpolação nem um "valor estimado".
- Campos do formulário que compõem a condição, com os rótulos reais: **"Você vende como"**
  (Pessoa física (CPF) / Pessoa jurídica (CNPJ)) e **"Mais de 450 pedidos nos últimos 90 dias?"**
  (Sim / Não).
- O que o vendedor vê no lugar do preço quando o motor recusa: **"Sem tarifa publicada para a faixa
  de preço deste anúncio — informe a comissão do canal para precificar."** e o selo **"sem
  referência — informe as taxas"**. O aviso 1 é o *porquê* dessas duas frases; hoje nada os liga
  visualmente.
- Nenhum dos dois avisos bloqueia o cálculo, nenhum tem botão de ação, nenhum é dispensável (não há
  "×" para fechar), nenhum tem número calculado pelo produto.

## Estados obrigatórios
- **Aviso 1 ausente** (o caso mais comum): CNPJ, ou volume "Não", ou preço dentro de faixa publicada
  — só o aviso 2 existe no fim do cartão. Desenhe esta prancheta: é o repouso real.
- **Aviso 1 presente**: as três condições verdadeiras ao mesmo tempo, junto com o slot já mostrando
  "Sem tarifa publicada…" e o selo "sem referência". Os três precisam ler como uma explicação só.
- **Aviso 1 aparecendo por edição**: o vendedor troca "Você vende como" para CPF e o aviso surge
  entre o selo e o aviso 2. Mostre como a chegada é percebida sem empurrar a tela inteira de susto.
- **Aviso 2 em repouso**: título visível, corpo (onde quer que ele fique) no seu estado padrão.
- **Aviso 2 com o detalhe aberto** — se o desenho mantiver o ⓘ: popover com o corpo completo,
  ancorado ao gatilho, sem cobrir o campo que o vendedor acabou de editar.
- **Foco de teclado** no gatilho ⓘ: anel visível sobre o fundo tingido do alerta (o alerta info tem
  fundo próprio; o anel precisa contrastar contra ELE, não contra o fundo da página).
- **Hover / pressionado** do gatilho ⓘ (em ponteiro fino ele abre no hover; em toque só no toque).
- **Vendedor sem premium / free**: os avisos são conteúdo do cálculo aberto, não recurso premium —
  mostre que eles **não** ganham cadeado nem selo de assinatura.
- **Offline**: os dois textos são estáticos e continuam idênticos sem rede. Nada de spinner, nada de
  "não foi possível carregar" — não há nenhum estado de carregamento aqui, e não deve haver.

## Viewports
- **Mobile 390px — obrigatório.** É o viewport que criou a compressão (a medição original foi a
  360px). Desenhe os dois avisos no fim do cartão do canal, com o selo de procedência visível acima
  para dar a escala real de quanto do cartão eles ocupam.
- **Desktop 1280px — obrigatório.** O cartão do canal é largo; o título 2 cabe folgado numa linha e
  ainda sobra medida. A pergunta que o desenho responde aqui é se o corpo 2 ainda precisa ficar
  escondido quando existe espaço para ele — a compressão foi resposta a uma medição de mobile.
- 1920px não é necessário: o cartão do canal tem largura máxima e o resultado repete o de 1280px.

## Regras que o desenho não pode quebrar
- **Nunca fabricar número.** Nenhuma estimativa, faixa "de R$ X a R$ Y", barra de progresso ou
  gráfico dos dois pontos. Os dois pontos são citação, não série de dados.
- **A frase honesta vive em elemento de largura total**, nunca como sufixo de placeholder nem dentro
  de um campo — esta regra foi paga em 016/PR-F, quando um sufixo cortou para "2,50 (= 50".
- **Tom informativo, não alarme.** Nada aqui está errado nem quebrado: são riscos e lacunas de fonte.
  Vermelho de perigo mentiria tanto quanto esconder.
- **Ausência não é silêncio.** Se o desenho tirar o corpo 2 de trás do ⓘ, ele não pode encurtar a
  frase até virar um aviso sem conteúdo; se mantiver o ⓘ, o gatilho precisa parecer clicável e ter
  alvo ≥44px.
- **Falha de rede jamais aparece como restrição de plano** e nada aqui muda com entitlement.
- Contraste ≥4.5:1 do título e do corpo **medido contra o fundo tingido do alerta**, nos dois temas.

## Armadilhas já pagas neste projeto
- **Altura medida, não estimada**: a seção Shopee media 1248px a 360px e estes dois avisos eram 48%
  dela. Se o desenho devolver corpo visível ao aviso 2, precisa devolver altura em outro lugar —
  diga onde.
- **Placeholder que corta a frase honesta** (016/PR-F): frase de honestidade só em bloco próprio.
- **Overflow horizontal medido**: "R$ 12,00" e as aspas curvas “ ” no meio do corpo 1 não podem
  quebrar de forma a deixar um símbolo órfão na linha; a citação inteira deve ler como uma unidade.
- **Texto ocluso passa em teste**: um alerta empurrado para fora do cartão ou coberto por um popover
  ainda "existe" para o código. Desenhe as caixas onde elas realmente caem.
- **InfoTip vs. Escape** (016/PR-C): o popover fecha no Escape e não pode reabrir sozinho — o estado
  fechado depois do Escape é um estado de desenho, com o gatilho ainda focado.

## Entregável
Pranchetas, tema escuro como padrão e tema claro como first-class (as duas versões de cada):
1. **390px — repouso**: fim do cartão do canal Shopee com selo + só o aviso 2.
2. **390px — condição completa**: "Sem tarifa publicada…" + selo "sem referência" + aviso 1 + aviso 2,
   mostrando a hierarquia proposta entre os dois.
3. **390px — detalhe do frete aberto** (ou a alternativa que o desenho propuser no lugar do ⓘ).
4. **1280px — os dois avisos no cartão largo**, evidenciando o que muda com medida sobrando.
5. **Um quadro de anatomia** do aviso 1: como a citação dos dois pontos oficiais se destaca dentro do
   corpo sem virar tabela nem sugerir interpolação.

Reutilize os primitivos existentes, sem criar novos: `tf-alert` com `tf-alert--info` para o aviso 1
(ícone `info`, `tf-alert__title` + `tf-alert__text`); `tf-alert--info tf-alert--compact` para a linha
de uma altura, se ela sobreviver ao desenho (é a mesma variante do canvas de Orçamentos do dono);
`InfoTip` (Radix Popover skin da casa) para qualquer detalhe revelado; `FeeSeal`/`tf-badge` para o
selo acima, que entra só como contexto. Se o desenho concluir que o aviso 2 precisa voltar a ser um
alerta completo, diga isso explicitamente e mostre a altura resultante — não deixe implícito.

## Perguntas em aberto para o dono
1. **Peso relativo**: os dois avisos devem ter a mesma forma (ambos completos, ou ambos compactos com
   detalhe sob demanda), ou é correto que o condicional pese mais que o permanente? A regra atual
   ("o que é raro grita, o que é constante sussurra") nunca foi escrita nem ratificada.
2. **O aviso 2 pode ser dispensável?** Ele é estático e se repete em todo slot Shopee — um vendedor
   que abre cinco slots lê a mesma frase cinco vezes. Pode aparecer uma vez por página, ou por
   sessão, ou virar item permanente de um lugar de "riscos do canal"?
3. **Proximidade da ação**: o aviso 1 pede "informe a taxa manualmente", mas nasce no fim do cartão,
   longe do campo "Comissão". Ele deve migrar para junto da grade de taxas (ou ancorar-se ao campo)
   mesmo isso quebrando a ordem "avisos por último"?
