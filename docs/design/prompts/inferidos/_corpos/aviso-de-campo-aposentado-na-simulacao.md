# Aviso de campo aposentado ao reabrir uma simulação antiga

## O que desenhar

O bloco de aviso que aparece na tela **Calcular** quando o vendedor reabre uma **simulação salva antes de o
campo "Desperdício (g)" ser aposentado do modelo de preço**. O documento salvo ainda carrega esse campo; o
motor de cálculo de hoje recusa a chave, então a simulação reabre e **recalcula um preço diferente do que ela
dava no dia em que foi salva**. Este aviso é a única coisa no produto que explica essa diferença. Ele vive
logo abaixo da barra de contexto "Simulação: {nome}", acima de todo o formulário, e some quando a simulação é
fechada. Quem o lê é o vendedor que abriu uma simulação antiga esperando o mesmo número e viu outro.

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. Não existe protótipo, nem `ux-*.md` do increment 016, nem uma prancheta
no canvas — o protótipo mais antigo é de 2026-07-02, quase um ano antes de o campo existir para ser
aposentado. Uma IA decidiu sozinha que a explicação de uma **divergência de preço** é uma faixa de texto
informativa no topo da página: sem mostrar a diferença, sem antes/depois, sem nenhuma ligação com o número
que mudou — e, quando a simulação é de kit, **dois avisos idênticos empilhados**. Pior: a mesma regra de
negócio já foi desenhada certo em outro lugar do produto (no Histórico, a nota estrutural fica **colada ao
número**, e a frase diz "parte da diferença **acima** pode vir daí"). Aqui a mesma verdade ficou órfã no topo.

## O que já existe hoje (não invente do zero — corrija)

Ordem vertical real da tela Calcular com uma simulação carregada:

| # | Bloco | Texto literal hoje |
|---|---|---|
| 1 | Título da página + promessa freemium | (centralizados) |
| 2 | Botão de navegação | "Meus cenários" |
| 3 | Barra de contexto (card `tf-card` padding sm) | "Simulação: {nome}" · legenda "Recalculado com os preços de hoje" · selo "Alterações não salvas" · "Fechar simulação" · ações "Abrir origem" · "Renomear" · "Duplicar" · "Salvar alterações" |
| 3b | Dentro da barra, quando a origem degradou | "Os valores atuais foram mantidos e continuam editáveis." |
| **4** | **ESTA PEÇA** — `tf-alert` tom info, ícone `info` 20px, **sem título**, só corpo | **"O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."** |
| 4b | Só quando a simulação é de KIT: **um segundo alerta idêntico**, com a mesma frase, imediatamente antes do resumo do kit | (mesma frase) |
| 5 | Formulário (uma coluna no mobile, duas a partir de 1024px) | campos de custo, markup, canais |
| 6 | Rodapé centralizado, largura máx. 720px | "Como chegamos no preço", cartões "Preço varejo" / "Preço atacado", "Salvar cenário" |

→ **Problema 1:** o aviso está no bloco 4 e o número que ele explica está no bloco 6. No mobile 390px isso são
várias telas de rolagem; no desktop o formulário vira duas colunas e o preço desce para o rodapé centralizado.
A palavra "abaixo" na frase promete uma proximidade que não existe.
→ **Problema 2:** o aviso não mostra **nada** da diferença — nem o valor de antes, nem quanto mudou, nem em
qual dos dois preços (varejo/atacado) mudou.
→ **Problema 3:** no caso de kit, dois alertas com a **mesma frase literal**, um em cima do outro.
→ **Problema 4:** o `tf-alert` está sendo usado sem título; a frase inteira é um parágrafo corrido de
`--fs-body-sm`, do mesmo peso de qualquer outra legenda da página.

## Conteúdo e dados reais

- Nome do campo aposentado: sempre em pt-BR — **"Desperdício (g)"**. A chave técnica (`wasteGrams`) **nunca**
  aparece na tela. Hoje é o único campo aposentado, mas a frase aceita **vários nomes separados por vírgula**
  ("Desperdício (g), Outro campo (un)") — desenhe prevendo dois ou três nomes na mesma linha.
- A frase é montada de um template com `{campo}`: o desenho não pode quebrar a linha de um jeito que dependa
  do comprimento do nome.
- Preços de exemplo verdadeiros do produto (use estes, não invente): **R$ 16,16**, **R$ 24,24**, **R$ 21,01**.
  Rótulos dos cartões de preço: "Preço varejo" e "Preço atacado".
- **O documento de simulação NÃO guarda o preço antigo nem a versão do modelo** (só o congelado do Histórico
  guarda `modelVersion`). Ou seja: com os dados de hoje é **impossível** mostrar "antes R$ 24,24 → agora
  R$ 21,01" nesta tela. Desenhe a peça sabendo disso — e se a sua melhor proposta exigir o valor antigo, marque
  a prancheta como **"depende de decisão do dono"** em vez de inventar o número.
- Frase irmã, já homologada, que resolve o mesmo problema no Histórico (referência de tom, **não** para copiar
  aqui): "O valor congelado foi calculado pelo modelo {versao}, que incluía o campo Desperdício. O modelo atual
  não tem mais esse campo — parte da diferença acima pode vir daí."
- A legenda da barra de contexto é **"Recalculado com os preços de hoje"** e **nunca** há data em nenhuma
  superfície de simulação — o aviso também não pode trazer data.

## Estados obrigatórios

1. **Ausente (o caso comum).** Documento salvo depois da aposentadoria: nada é renderizado. Nenhum espaço
   reservado, nenhuma faixa vazia.
2. **Repouso, simulação escalar (avulsa ou de produto).** Um alerta info com a frase completa.
3. **Repouso, simulação de kit.** Hoje o alerta aparece **duas vezes**; o desenho precisa resolver isso — uma
   declaração só, no lugar certo, com o resumo do kit logo abaixo.
4. **Vários campos aposentados.** Mesma frase, com dois ou três nomes em `{campo}` — a linha cresce.
5. **Convivendo com a nota de degradação.** Quando a origem degradou, "Os valores atuais foram mantidos e
   continuam editáveis." já aparece dentro da barra de contexto: mostre a prancheta com os dois avisos juntos
   e prove que não viram uma parede de faixas coloridas.
6. **Convivendo com "Alterações não salvas".** O selo neutro na barra logo acima do aviso.
7. **Offline / Premium pausado.** O aviso **não muda** — ele é derivado do documento, não de rede. As ações da
   barra é que ficam desabilitadas com a legenda "Esta ação precisa de conexão." Desenhe para deixar claro que
   o aviso não é um erro de conexão.
8. **Sem estado de carregando e sem estado de erro próprios.** A peça é pura derivação do documento já
   carregado — não invente spinner nem "tentar de novo".
9. **Foco/hover/pressionado** só se o seu desenho introduzir algum controle (ex.: "ver o que mudou"). Se
   introduzir, ele precisa de alvo ≥44px e estado de foco visível.

## Viewports

- **Mobile 390px** — obrigatório: é onde a distância entre o aviso e o preço é pior (o formulário inteiro
  entre os dois) e onde a frase de 150 caracteres ocupa 4 linhas ao lado de um ícone de 20px.
- **Desktop 1280px** — obrigatório: a partir de 1024px o formulário vira duas colunas e a página abre até
  ~1120px, com o rodapé de preço centralizado em 720px. O aviso continua em largura total no topo. Meça e
  anote na prancheta a distância vertical entre o aviso e o cartão "Preço varejo".
- 1920px não precisa de prancheta própria: o conteúdo continua limitado a ~1120px centralizados.

## Regras que o desenho não pode quebrar

- **Persistente, nunca um toast.** A divergência de preço tem de continuar visível enquanto a simulação
  estiver aberta. Nada que pisque e suma.
- **Nome do campo sempre em pt-BR.** "Desperdício (g)", nunca `wasteGrams`.
- **Nunca dizer "removido/excluído/deletado"** sobre dados do vendedor — o campo saiu do modelo, o documento
  dele continua íntegro.
- **Nunca vender isso como problema de conexão nem como limite de plano.** Não é falha de rede e não é
  freemium: é mudança de modelo. Nada de "Assinar" perto desta peça.
- **Nunca esconder a degradação atrás de um "saiba mais" fechado por padrão.** A frase principal fica visível
  no repouso; um detalhe expansível pode existir *além* dela, nunca no lugar dela.
- **Frase honesta fora de placeholder** — ela vive em elemento de largura total, nunca como sufixo de campo.
- **Sem data em nenhuma superfície de simulação.**
- Contraste medido de verdade: o texto do alerta info é `--info-text` sobre `--tf-info-soft`, nos dois temas.

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, nos dois eixos.** O headless não enxerga barra de rolagem clássica; já custou
  uma correção medir só o eixo X. A cadeia de `min-width: 0` da página existe justamente porque um preço muito
  longo esticava a página inteira. Um alerta com texto longo não pode reintroduzir isso.
- **Distância mata a mensagem — já medido.** Em 2026-08-03 a promessa freemium vivia a 97% da altura da página
  (4,6 telas de rolagem a 360px) e foi movida para a primeira dobra por decisão do dono. Aqui o erro é o
  espelho: a explicação está no topo e o número está no fim.
- **Texto ocluso passa em teste.** `toBeVisible` passa em elemento coberto ou estourado; o que decide é a
  geometria. Se o aviso encostar no rodapé fixo ou numa folha aberta, o teste não avisa.
- **Nome longo trunca.** O nome da simulação na barra logo acima é uma linha só, truncada — 120 caracteres não
  podem empurrar nada. O aviso abaixo herda essa vizinhança.
- **Empilhamento de faixas.** Barra de contexto + nota de degradação + este aviso + (kit) o aviso gêmeo podem
  somar quatro blocos antes do primeiro campo. Isso é um problema de desenho, não de código.

## Entregável

Pranchetas (tema **escuro** como padrão; **claro** como first-class para as pranchetas 1 e 3):

1. **Mobile 390px — simulação escalar, estado atual anotado**: barra de contexto + aviso + começo do
   formulário, com a distância até o preço marcada em px.
2. **Mobile 390px — simulação de kit**: como fica com o resumo do kit, resolvendo a duplicação.
3. **Mobile 390px — a proposta**: onde a declaração deve viver para ficar ligada ao número que mudou (junto do
   bloco de preço, ecoada no topo, ancorada, ou o que você defender) — com a justificativa escrita na prancheta.
4. **Desktop 1280px — a página com simulação carregada**, formulário em duas colunas e o rodapé de preço,
   mostrando a mesma solução no layout largo.
5. **Convivência**: uma prancheta com aviso de degradação + selo "Alterações não salvas" + este aviso juntos.
6. Variante com **dois nomes de campo** na frase.

Reutilize os primitivos existentes, sem criar novos: `tf-alert` tom **info** (ícone `info` 20px, corpo
`--fs-body-sm`) para a declaração; `tf-alert__title` se você decidir que a peça precisa de um título curto;
`tf-card` padding sm para a barra de contexto; `tf-badge` neutro para "Alterações não salvas"; `tf-button`
ghost/secondary/sm para as ações da barra e para qualquer controle novo que você propuser; o bloco de preço do
rodapé usa o `tf-price` existente com "Preço varejo" / "Preço atacado".

## Perguntas em aberto para o dono

1. **Mostrar a diferença exige guardar o preço antigo.** O documento de simulação não guarda preço congelado
   nem versão do modelo (só o Histórico guarda). Vale mudar isso para poder dizer "antes R$ 24,24 → hoje
   R$ 21,01", ou a declaração continua qualitativa ("parte da diferença pode vir daí")?
2. **A declaração deve ficar no topo, junto do preço, ou nos dois lugares?** Se nos dois, o texto se repete
   igual ou o de cima vira uma linha curta que aponta para o de baixo?
3. **No kit, a declaração é uma só, rolada para o kit inteiro, ou uma por linha afetada?** Hoje o código já
   deduplica para uma; o desenho pode querer nomear quais peças do kit tinham o campo.
4. **O aviso pode ser dispensado pelo vendedor?** Se sim, ele volta na próxima reabertura da mesma simulação
   ou fica dispensado para sempre?
5. **Existe uma ação a oferecer junto ao aviso** — por exemplo "salvar alterações" para o documento passar a
   viver no modelo atual e o aviso sumir de vez — ou a peça é puramente informativa?
