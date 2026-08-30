# Calcular no desktop — as entradas em duas colunas e o preço no rodapé

## O que desenhar
A tela **Calcular preço** em desktop: a que o vendedor abre todo dia, e a única sem desenho desktop próprio.
É onde ele digita o custo da peça (filamento, energia, máquina, mão de obra), escolhe o markup, configura os
canais de marketplace e lê o preço sugerido. Vive dentro do shell com a barra lateral recolhível (018), como
primeira aba. Hoje, de 1024px para cima, o corpo abre para 1120px e as seções de entrada se partem em duas
colunas, com o resultado num rodapé centralizado de largura total. Desenhe a tela inteira — cabeçalho, as
duas colunas, o rodapé de resultado — em 1280px e 1920px, no estado normal e nos estados reais do código.

## Por que este prompt existe
O corte em duas colunas nunca foi desenhado: um agente decidiu qual seção mora em qual coluna, em que ordem,
e onde o resultado fica. `PROTOTIPO_PARCIAL` — em 2026-07-02 um protótipo desktop da Calcular **existiu**,
mas era a versão E1 (4 campos básicos, 3 colapsáveis, 2 cartões de preço, 1 card de detalhamento), o
artefato não está no repositório, e a tela de hoje ganhou catálogo, tempo em h+min, pergunta da máquina,
outros custos, canais de marketplace, cenários e histórico. Do protótipo só sobreviveu um número:
`--content-max` 1120px. Pior: **a única instrução desktop que a autoridade dá para esta tela** (§F.3,
"desktop 2 colunas" para Varejo × Atacado) **não é a que o código implementa** — os dois cartões de preço
são `auto-fit minmax(210px, 1fr)` e o corte em duas colunas foi aplicado às *seções de entrada*, que é outra
coisa. O dono já reprovou o desktop das outras quatro abas exatamente por esse motivo.

## O que já existe hoje (não invente do zero — corrija)

Ordem vertical atual, do topo:

1. **Título** "Calcular preço", centralizado (`tf-page-header--center`).
2. **A promessa**, centralizada, em legenda: *"Calcular custo e markup é grátis, sem limite. Vender em
   marketplaces, salvar e exportar fazem parte do Premium."*
3. **Botão fantasma alinhado à direita**: ícone + *"Minhas simulações"*. → em 1120px de largura ele fica
   sozinho num trecho vazio enorme, longe do título; parece perdido.
4. **Cartão "Usar do catálogo"** (só Premium com itens salvos): legenda *"Preenche os campos com o item
   salvo — você ainda pode editar tudo."* + os selects *"Filamento salvo"* e *"Impressora salva"*
   (placeholder *"Escolher…"*).
5. **A grade de duas colunas** (`min-width: 1024px`, `1fr 1fr`, `align-items: start`):

| Coluna | Conta ativa (Premium) | Conta grátis / deslogada |
| --- | --- | --- |
| Esquerda | Custos da peça · Mão de obra e custos · Outros custos | Custos da peça · Mão de obra e custos |
| Direita | Markup · Marketplace | Markup · **Outros custos** (migrou de coluna) |
| Largura total | — | O portão de Marketplace, atravessando as duas colunas |

→ **O buraco medido**: com a conta grátis, o portão de marketplace (205px de altura) na coluna direita
contra 2.521px de coluna esquerda deixou **1.671px de vazio** a 1440px. O remendo foi mandar o portão
atravessar a grade e mudar "Outros custos" de coluna conforme a assinatura. O desenho precisa resolver isso
de verdade, não com um caso especial por estado de conta.

6. **Rodapé de largura total, centralizado**, com cada filho capado em **720px**: o card *"Como chegamos no
   preço"* (detalhamento + *"Preços por canal"* fundido no mesmo card), o aviso de atacado acima do varejo,
   os dois cartões de preço lado a lado, e os botões *"Salvar cenário"* e *"Salvar no histórico"* (Premium,
   ausentes fora dele). → o cap de 720px ninguém desenhou: joga fora 400px de largura no bloco mais
   importante. → **não existe painel de resultado fixo**: quem edita o markup no fim de uma coluna de
   2.500px não vê o preço mudar — precisa rolar até o rodapé. É a decisão mais cara que ninguém tomou.

## Conteúdo e dados reais

**Custos da peça** (grade `auto-fit minmax(170px, 1fr)`, 2 a 4 campos por linha): "Custo do rolo" (R$) ·
"Peso do rolo" (kg, típico 1) · "Gramas usadas" (g) · "Consumo médio" (kW, ~0,12) · "Tarifa de energia"
(**o campo mais largo da tela: prefixo "R$" e sufixo "/kWh" em volta do número**) — estes cinco
obrigatórios — · "Reserva de manutenção" (R$ /h) e "Taxa de falha" (%), opcionais. No mesmo card: o tempo de
impressão em **h + min**, e a pergunta da máquina — *"Com que frequência ela roda?"* (Poucas horas por
semana · Quase todo dia · Praticamente o dia todo, mínimo 240px cada), *"Em quantos anos quer que ela se
pague?"*, a legenda derivada *"≈ R$ 1,25 por hora de impressão"* e o escape *"Ajustar horas direto"*.

**Mão de obra e custos**: "Mão de obra (horas)", "Valor da hora", "Tempo de acabamento", "Valor do
acabamento". **Outros custos**: 0..N itens nomeados, legenda *"Embalagem, etiqueta, taxas, etc. Cada item
soma ao custo total."*, *"Adicionar custo"* / *"Remover custo"*, campos "Nome do custo" (placeholder
*"Ex.: Embalagem"*) e "Valor". **Markup**: "Markup varejo" (%) e "Markup atacado" (%), com a dica *"Margem
sobre o custo total (não sobre o preço de venda)."*

**Marketplace**: switch *"Incluir marketplaces no preço"*, e um bloco por canal com Marketplace, Modalidade,
Comissão, Taxa fixa, Comissão mínima/item, Frete (*"Descontado do valor recebido (não é embutido no
anúncio)."*), mais as perguntas da Shopee (*"Você vende como"*; *"Mais de 450 pedidos nos últimos 90
dias?"*). Cada seção tem um ⓘ no título.

**Números verdadeiros** (a semente que o produto mostra na primeira visita, e que devem aparecer nas
pranchetas): custo total **R$ 16,16**; markup varejo 50% → **Preço varejo R$ 24,24**; markup atacado 30% →
**Preço atacado R$ 21,01**. As linhas do detalhamento: Material · Energia · Máquina · Falha / perdas ·
Acabamento · Mão de obra · (cada "outro custo" pela sua própria linha) · **Custo total** em destaque ·
Preço varejo (legenda "markup 50%") · Preço atacado (legenda "markup 30%"). Os dois cartões de preço são
`tf-price` tamanho md, centralizados, com legenda "markup 50%" / "markup 30%", tons accent e energy.
Desenhe **também** uma prancheta com um preço de seis dígitos (R$ 950.096,00) — é o caso que já quebrou.

## Estados obrigatórios
- **Repouso / foco / hover / pressionado** nos campos e botões — o foco precisa ser visível dentro de uma
  coluna densa, não só num campo isolado.
- **Formulário inválido**: o rodapé inteiro **some** e no lugar fica um alerta de perigo com
  *"Confira os campos destacados para ver o preço."* → em duas colunas o campo culpado pode estar fora da
  vista de quem lê o alerta lá embaixo. Mostre esse estado.
- **Aviso de plausibilidade** (informativo, nunca erro, nunca bloqueia): *"Confira o consumo: 120 kW. Acima
  de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. (…) Nada foi recusado."*
- **Atacado acima do varejo** (informativo, no rodapé): *"O preço de atacado ficou acima do varejo. Nada foi
  recusado — só confira se é isso mesmo."*
- **Grátis / deslogado**: switch de marketplace desabilitado com a razão ao lado —
  *"Vender em marketplaces faz parte do Premium."* — e o portão atravessando as duas colunas.
  Sem "Salvar cenário" e sem "Salvar no histórico" (ausentes, não desabilitados).
- **Catálogo de taxas desatualizado / offline**: *"Não foi possível atualizar as taxas"* com o corpo
  *"Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as
  taxas manualmente."* + *"Tentar novamente"*. Nunca vendido como "não é Premium".
- **Falha ao ler o catálogo salvo**: *"Não foi possível carregar seus itens salvos agora."* + *"Tentar novamente"*.
- **Faixa sem tarifa publicada**: *"Sem tarifa publicada para a faixa de preço deste anúncio — informe a
  comissão do canal para precificar."* · **Canal no prejuízo**: *"Canal não-lucrativo neste preço (frete
  maior que a margem)."*
- **Simulação carregada**: a barra de contexto no topo (nome, alterações não salvas, Renomear / Duplicar /
  Salvar alterações / Abrir origem) — e, se a base é um kit, o resumo somente-leitura no lugar dos campos.
- **Premium pausado (lapsed)** · **campo desabilitado** dentro de um canal · **hover/pressionado** nos botões.

## Viewports
**1280px e 1920px são o entregável** — é aí que a peça existe e é aí que ninguém desenhou. Em 1280 a régua é
"cabe o suficiente para valer duas colunas"; em 1920 a pergunta é **o que acontece com os ~800px que sobram
hoje** ao lado dos 1120px fixos (a página não cresce, e a barra lateral do 018 já mudou o espaço
disponível). Desenhe também **390px como referência, não como redesenho**: a coluna única mobile mantém a
ordem de hoje e está aqui só para provar que o desenho desktop não a arrasta junto.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou o recurso está lá funcionando, ou o portão diz que é Premium. Nunca um recurso
  que parece disponível e falha ao tocar.
- **Falha de rede nunca é vendida como falta de assinatura** — o alerta de taxas desatualizadas e o de
  catálogo não podem parecer portão de Premium.
- **A procedência do número é dita**: nenhuma linha do detalhamento aparece sem rótulo, e "Preços por canal"
  mora dentro do mesmo card do detalhamento.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega só número/exemplo (já custou uma
  homologação aqui). **Alvo ≥44px** em todo controle, inclusive "Remover custo" e "Remover canal".
  **Contraste medido contra o fundo real do card**, não contra o fundo da página.
- Aviso é aviso: descritivo, nunca escrito como erro — o produto não recusou nada.

## Armadilhas já pagas neste projeto
- **Buraco vertical medido**: 1.671px de coluna vazia quando um bloco curto (o portão) fica ao lado de uma
  coluna de 2.521px. Qualquer proposta de duas colunas tem de responder o que acontece quando os dois lados
  têm alturas muito diferentes.
- **Estouro horizontal**: um preço de seis dígitos já quebrou no meio do dígito (`950.096` em duas linhas), e
  "Tarifa de energia" já deixou o número com 1px visível. Números não quebram — a caixa cede.
- **Texto que passa em teste e está ocluso**: ocultação não é propriedade do texto — desenhe com caixas, e
  deixe explícito onde há rolagem interna (captura headless não vê barra de rolagem clássica).

## Entregável
Pranchetas: (1) 1280px Premium normal, com os números da semente; (2) 1920px Premium, decidindo o espaço que
sobra; (3) 1280px conta grátis com o portão de marketplace (o caso do buraco); (4) 1280px formulário
inválido; (5) 1280px com simulação carregada + alerta de taxas desatualizadas; (6) 1280px com preço de seis
dígitos; (7) 390px de referência, sem alteração. Escuro é o padrão, claro é de primeira classe — entregue ao
menos a 1 e a 3 nos dois temas.
Reutilize os primitivos existentes, sem criar novos: `tf-card` por seção, `tf-section-title` com o ⓘ,
`tf-field` (com prefixo/sufixo) em todo campo, `tf-select` nos selects, `tf-switch` no "Incluir marketplaces
no preço", `tf-alert` (`danger`/`info`) nos avisos, `tf-button` (`primary`/`secondary`/`ghost`) nas ações e
`tf-price` (md, centralizado, tons accent e energy) nos dois cartões de preço.

## Perguntas em aberto para o dono
1. **O preço acompanha a rolagem?** Hoje o resultado é rodapé: quem mexe no markup no fim de uma coluna
   longa não vê o número mudar. Vira painel fixo à direita (terceira coluna), barra fixa no rodapé, ou
   continua onde está? Essa decisão muda a grade inteira.
2. **O corte é em 1024px ou 1280px?** O 018 fixou **1280px** para as outras quatro abas; esta tela corta em
   **1024px**. Duas telas do mesmo produto mudando de layout em larguras diferentes é incoerência visível.
3. **A página continua parando em 1120px a 1920px?** Ou o conteúdo respira até o limite do shell?
4. **O cap de 720px do rodapé fica?** Ele centraliza o resultado, mas em 1120px joga fora 400px de largura
   justamente no bloco mais importante.
5. **Marketplace é mesmo vizinho de Markup na coluna direita?** Ou a direita deveria ser reservada ao
   resultado, com todas as entradas à esquerda?
6. **"Outros custos" trocar de coluna conforme a assinatura é intencional** ou remendo? Um vendedor que
   assina vê a seção mudar de lugar.
7. **A §F.3 ("desktop 2 colunas" para Varejo × Atacado) segue valendo** para os dois cartões de preço, ou
   foi substituída pelo comportamento atual de empacotamento automático?
