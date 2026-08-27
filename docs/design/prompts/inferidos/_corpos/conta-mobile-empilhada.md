# Aba Conta no celular — a coluna única (identidade · plano · tema · privacidade · Sair)

## O que desenhar
A tela **Conta** do Precifica3D em largura de celular (tudo abaixo de 1280px). É a última das cinco abas
e a única onde o vendedor vê quem ele é, qual o plano dele, se o pagamento está em dia, o que fazemos com
os dados dele, e onde ele sai do app. Ele chega aqui em três momentos muito diferentes: por curiosidade
("sou premium mesmo?"), por urgência (o cartão foi recusado e ele tem um prazo correndo), ou vindo de um
teaser de outra aba com `?assinar=1` — nesse caso a oferta de assinatura já abre montada por cima da tela.
Desenhe a coluna inteira, do cabeçalho ao botão Sair, mais a gaveta da oferta que sobe do rodapé.

## Por que este prompt existe
O único desenho mobile desta tela é de 2026-07-02, **antes de existir cobrança**. Ele tinha: linha de
avatar 52px + nome + e-mail + selo binário, um cartão de marketing "TRUTH'S FORGE PREMIUM" com coroa,
um grupo rotulado "PREFERÊNCIAS" com três linhas (Tema escuro / Recalcular ao digitar / Moeda), um cartão
com "Ajuda e glossário" + "Sair" em vermelho, e o rodapé "Precifica3D · Truth's Forge · v0.1". Desses,
**quatro blocos não existem no código de hoje** (marketing, "Recalcular ao digitar", "Ajuda e glossário",
rodapé de versão) e **dois blocos do código nunca foram desenhados** (o aviso de privacidade e a linha de
plano com seus 7 estados e suas ações). O empilhamento atual não foi desenhado: ele é o que sobra quando a
grade de 3 colunas do desktop (`Abas-Desktop.dc.html`, que só descreve 1920px) colapsa na ordem do código.

## O que já existe hoje (não invente do zero — corrija)
Ordem de cima para baixo, exatamente como o app renderiza:

| # | Bloco | O que mostra hoje |
|---|-------|-------------------|
| 0 | Cabeçalho | Título "Conta" |
| 1 | Cartão de identidade | Círculo de 44px com a **inicial maiúscula** sobre a cor de destaque + o e-mail em uma linha, truncado com reticências. Sem nome, sem "Conectado como", sem foto |
| 2 | Cartão do plano | Rótulo "Plano" · selo de estado · legenda · nota · fila de botões alinhada à direita |
| 3 | Cartão do tema | Rótulo "Tema" + interruptor (ligado = escuro). No desktop isto vira um controle segmentado "Claro/Escuro"; **no celular o dono decidiu manter o interruptor** |
| 4 | Cartão de privacidade | Título "Como tratamos seus dados" + dois parágrafos longos |
| 5 | Sair | Botão secundário com ícone de saída, alinhado à esquerda, texto "Sair" |

→ **Problema 1**: os dois parágrafos de privacidade caem **entre o tema e o Sair** — o bloco mais denso e
menos acionável da tela fica no meio do caminho, empurrando a saída para fora da primeira dobra.
→ **Problema 2**: não há nenhum agrupamento nomeado. São cinco cartões soltos de mesmo peso; identidade,
cobrança, preferência, aviso legal e ação destrutiva têm a mesma temperatura visual.
→ **Problema 3**: para quem é **Gratuito**, a única coisa que fala de Premium é uma linha de selo cinza e
um botão. Não há nenhuma superfície que diga o que ele ganharia — a promessa só aparece depois de tocar.
→ **Problema 4**: o botão fantasma "Recarregar" está sempre visível ao lado da ação principal, inclusive
em "Premium ativo", onde não há nada a recarregar.
→ **Problema 5**: não há versão/build em lugar nenhum — o suporte não tem o que pedir ao vendedor.

## Conteúdo e dados reais
Textos literais em pt-BR (não reescreva os que já foram homologados; onde eu apontar que a frase é ruim,
está dito por quê):

- **Identidade**: e-mail real, ex. `jonatan.fbossan@gmail.com` — desenhe também um caso longo tipo
  `contato.comercial.impressoes3d@meudominiomuitolongo.com.br` para ver a reticência funcionar.
- **Plano**: rótulo `"Plano"`. Selos possíveis: `"Gratuito"` (neutro), `"Premium"` (verde),
  `"Premium pausado"` (neutro), `"Não foi possível confirmar seu plano."` (neutro).
- **Legendas** (segunda linha, cinza discreto): `"Plano anual · renova em 31/12/2026"` · `"ativo até
  31/12/2026 · não renova"` · `"pagamento pendente — regularize"` · `"cortesia · expira em 30/09/2026"` ·
  `"via programa beta"` · `"Seus itens salvos continuam disponíveis para leitura."` · sufixo offline
  `" · última informação do servidor"`.
- **Notas** (terceira linha): `"até 12/09/2026, senão o Premium pausa."` · `"Seus itens salvos continuam
  disponíveis; nada é apagado."` · `"Seu acesso de cortesia continua depois disso."`
- **Botões do plano**: `"Assinar Premium"` · `"Assinar novamente"` · `"Gerenciar assinatura"` ·
  `"Atualizar forma de pagamento"` · `"Cancelar assinatura"` · e o fantasma `"Recarregar"`.
- **Oferta (gaveta)**: título `"Assinar o Premium"`; `"A calculadora é grátis e continua grátis."`;
  `"O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar."`; dois cartões de
  plano com rádio — **Plano anual** `R$ 155,88/ano`, selo `"recomendado"`, `"equivalente a R$ 12,99/mês"`,
  `"~19% de economia frente ao mensal"` (pré-selecionado) e **Plano mensal** `R$ 15,99/mês`,
  `"cobrança todo mês, cancele quando quiser"`; e os dois avisos de rodapé
  `"Você paga no Mercado Pago (Pix ou cartão)."` e `"O cartão nunca passa pelo nosso app."`
- **Privacidade**: `"Como tratamos seus dados"` + `"Para entrar, usamos o Login com Google, que nos
  informa seu e-mail — usado apenas para identificar sua conta."` + `"Não vendemos seus dados nem fazemos
  rastreamento para publicidade."` (as outras três frases do aviso existem no app e **não** são mostradas
  aqui; não há link para a página completa da política).
- Nenhum número desta tela é calculado no cliente: plano, datas e origem vêm do servidor.

## Estados obrigatórios
Do cartão de identidade:
1. **Carregando** — o cartão só com o indicador de carga centralizado (mesma altura, sem pulo de layout).
2. **Erro de sessão** — alerta de perigo, título `"Não foi possível carregar sua conta"`, corpo
   `"Sua sessão expirou. Entre novamente."`, **sem** botão de repetir (repetir não resolve).
3. **Erro genérico** — o mesmo alerta com a mensagem do erro + botão `"Tentar novamente"`, empilhado
   ABAIXO do alerta (nunca ao lado: essa foi a origem de um botão nascido fora da tela).
4. **Pronto** — avatar + e-mail.

Do cartão do plano (sete estados reais, todos precisam de prancheta ou de uma tira comparativa):
5. **Gratuito** — selo neutro, sem legenda, botão `"Assinar Premium"`.
6. **Premium por assinatura ativa** — selo verde + `"Plano anual · renova em 31/12/2026"`, botões
   `"Gerenciar assinatura"` e `"Cancelar assinatura"`.
7. **Cancelada, período correndo** — selo **verde** (o premium ainda está ativo) + `"ativo até 31/12/2026
   · não renova"` + a nota de que nada é apagado; botão `"Assinar novamente"`.
8. **Carência (pagamento recusado)** — selo **continua verde**, e quem carrega a cautela é o TEXTO, em
   tom informativo: `"pagamento pendente — regularize"` + `"até 12/09/2026, senão o Premium pausa."`;
   `"Atualizar forma de pagamento"` é **primário e preenchido** — é a única ação que recupera o plano.
9. **Cortesia/beta** — selo verde + `"cortesia · expira em 30/09/2026"`, **sem** botão de ação.
10. **Premium pausado** — selo neutro + `"Seus itens salvos continuam disponíveis para leitura."`,
    botão `"Assinar novamente"`.
11. **Desconhecido (o servidor não respondeu)** — selo neutro com a frase inteira
    `"Não foi possível confirmar seu plano."`, sem nenhuma ação de compra.
12. **Offline** — qualquer estado acima com o sufixo `" · última informação do servidor"` colado na
    legenda; o selo continua dizendo o que o servidor disse por último, e diz que é velho.

Da oferta e do resto:
13. **Gaveta da oferta aberta** sobre a coluna (é o caminho do celular; no desktop ela é inline).
14. **Já premium dentro da oferta** — só a frase `"Você já é Premium."`, sem cartões e sem botão.
15. **Oferta indisponível** — `"O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi
    cobrado."`
16. **Botões** em repouso, pressionado, com carga (o "Recarregar" e o "Tentar novamente" giram) e
    desabilitado; **interruptor do tema** nos dois lados, com foco visível.

## Viewports
- **390px — a prancheta principal.** É a largura em que a maioria dos vendedores vê esta tela.
- **360px — a prancheta adversarial.** Este projeto já mediu 100,5px de transbordo horizontal exatamente
  neste cartão de plano; refaça o estado 8 (carência: dois botões largos + selo + duas linhas de texto)
  aqui e prove que nada sai da tela.
- **768px — nunca foi desenhado e existe.** Até 1279px a tela ainda é UMA coluna; num tablet os cartões
  esticam para ~700px de largura, o e-mail para de truncar e a linha do plano fica quase vazia no meio.
  Mostre o que a coluna faz com a largura sobrando (largura máxima? centraliza?).
- Desktop está fora deste prompt (já existe desenho a 1920px).

## Regras que o desenho não pode quebrar
- **Premium é binário.** Nada de "quase premium", nada de barra de progresso de plano.
- **Falha de rede nunca vira "você não é premium".** Servidor mudo = `"Não foi possível confirmar seu
  plano."`, jamais o selo "Gratuito" com botão de compra.
- **A carência mantém o selo verde.** Degradar o selo diria ao vendedor que ele já perdeu algo que ainda
  está pago — a mentira na direção oposta, e mais cara.
- **Dado velho é dito, não escondido**: o sufixo de offline é visível, não um ícone.
- **A frase honesta nunca mora num placeholder nem num rótulo cortado** — ela é texto de largura cheia.
- **Sem padrão escuro**: nenhuma escassez falsa, nenhum "de/por" riscado sobre o preço anual, e a saída
  segura de qualquer confirmação tem afordância **igual ou maior** que a ação destrutiva.
- **Alvo de toque ≥ 44px** em tudo (inclusive nos rádios da gaveta) e **contraste medido contra o fundo
  real do cartão**, não contra o fundo da página, nos dois temas.

## Armadilhas já pagas neste projeto
- **O transbordo de 100,5px**: os botões do plano são UM item flex; um item mais largo que o cartão não
  quebra sozinho — o botão nasceu inteiro **fora da viewport**, em x=396,3 numa tela de 390. Desenhe a
  quebra dos botões para a linha de baixo explicitamente, e mostre-a.
- **O botão espremido no erro**: a linha do identidade foi feita para avatar+texto; no ramo de erro ela
  espremia o alerta a uma palavra por coluna. Erro empilha, sempre.
- **Quebra entre `R$` e o número**: a 390px a linha do preço quebrava depois de "equivalente a R$". O
  símbolo e o valor andam juntos — nenhuma assertiva automática vê isso, só a imagem.
- **Duas palavras "Atualizar" a 8px de distância** já confundiram: por isso o nosso botão virou
  `"Recarregar"` e só o do Mercado Pago diz "Atualizar forma de pagamento". Não desfaça isso.

## Entregável
Pranchetas, tema **escuro como padrão e claro como cidadão de primeira classe**:
1. A coluna completa a 390px, estado Gratuito (a maioria dos vendedores).
2. A coluna completa a 390px, estado Premium ativo.
3. Uma tira com os **7 estados do cartão do plano** lado a lado, na mesma largura de 390px.
4. O cartão do plano em **carência a 360px**, com a régua mostrando que nada passa de 360.
5. A gaveta da oferta aberta a 390px (planos anual/mensal), mais o estado "já é Premium".
6. Os três estados do cartão de identidade (carregando / erro de sessão / erro com repetição).
7. A coluna a 768px.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para os cinco blocos, `tf-badge` (tom
sucesso/neutro) para o selo, `tf-btn` nas variantes primária / secundária / fantasma, `tf-alert` (tom
perigo) no erro de identidade, `tf-switch` no tema, `tf-sheet` na gaveta da oferta, `tf-spinner` na carga
e `tf-icon` no ícone de saída. Se um bloco pedir algo que os primitivos não têm, diga qual e por quê em
vez de inventar um componente.

## Perguntas em aberto para o dono
1. O vendedor **gratuito** ganha de volta um cartão de valor do Premium no celular (o "TRUTH'S FORGE
   PREMIUM" do protótipo de 2026-07-02), ou a linha de plano + o botão bastam? Isso muda a altura da tela
   inteira e é decisão de produto, não de layout.
2. A ordem muda? Especificamente: o aviso de privacidade continua **entre o tema e o Sair**, vai para
   o fim (abaixo do Sair) ou vira um bloco recolhido?
3. Os cartões passam a viver sob **títulos de seção** (algo como "Preferências" / "Sobre seus dados"),
   como o protótipo antigo fazia, ou seguem soltos?
4. Volta um **rodapé de versão/build** ("Precifica3D · v…")? O suporte hoje não tem número para pedir.
5. O aviso de privacidade ganha **link para a política completa**? Hoje o código deliberadamente não tem
   um, e a página existe e é alcançável por outro caminho.
6. O `"Recarregar"` fica sempre visível, ou só nos estados em que recarregar resolve alguma coisa
   (desconhecido, offline, recém-assinado)?
