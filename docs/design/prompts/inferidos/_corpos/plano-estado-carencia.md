# Linha do plano na Conta — o estado de CARÊNCIA (pagamento recusado, prazo correndo)

## O que desenhar
A primeira linha da tela **Conta** (`/conta`) é um card horizontal com o rótulo "Plano", um selo de estado, uma legenda e as ações do lado direito. Desenhe **um estado específico** dessa linha: **carência** — a renovação foi recusada pelo Mercado Pago, o Premium **continua ligado**, e há um prazo em dias correndo até ele pausar. É a tela em que o vendedor pagante descobre que o cartão falhou; ele chega aqui pelo menu (Conta é a última aba) ou vindo de um e-mail do PSP, ansioso, e precisa entender em segundos: (1) ainda tenho Premium? (2) até quando? (3) o que eu clico para resolver? Desenhe a linha em carência **lado a lado com a linha em Premium saudável e com a linha em Premium pausado**, porque o problema central é a distinção entre elas.

## Por que este prompt existe
Este estado inteiro nasceu em código, sem nenhum desenho: o protótipo de 2026-07-02 (`AccountScreen`, §E7) tem **dois** estados de plano — `Premium` / `Gratuito` — e **uma única legenda de uma linha** ("renova em 01/09/2026"); não há carência, nem segunda linha, nem prazo, nem hierarquia de ações. A redação e a regra vieram só de uma spec textual (`ux-billing` §9-G1), e nem ela chegou ao produto sozinha: o estado precisou ser **corrigido duas vezes por medição de homologação** — T028/A3 (carência e assinatura saudável tinham temperatura visual **idêntica**: mesmos pixels de selo, as duas frases no mesmo cinza neutro) e 015/A8 (a única ação que recupera o Premium era a **mais fraca** da linha, sem preenchimento, ao lado de um botão secundário). Ou seja: a hierarquia visual estava invertida em relação ao risco, e ninguém desenhou — mediu-se depois. É isso que este prompt vem fechar.

## O que já existe hoje (não invente do zero — corrija)
Linha "Plano" em carência, exatamente como está no produto:

| Elemento | Conteúdo literal hoje | Observação |
|---|---|---|
| Rótulo | "Plano" | texto de corpo, acima do selo |
| Selo | "Premium", tom **success (verde)** | verde **de propósito**: o Premium ESTÁ ativo |
| Legenda (linha 1) | "pagamento pendente — regularize" | pintada em `--info-text` — **única exceção** ao `--text-muted` de todos os outros estados |
| Nota (linha 2) | "até 12/09/2026, senão o Premium pausa." | mesma cor `--info-text`; só existe neste estado |
| Ação primária | "Atualizar forma de pagamento" | botão **preenchido**; abre `mercadopago.com.br/subscriptions` em **nova aba** — o cartão nunca é digitado aqui |
| Ação secundária | "Recarregar" | botão fantasma, com estado de carregando |

→ **Problemas a resolver no desenho, não a copiar:**
- → A cautela hoje é carregada **inteiramente pela cor do texto**. Um vendedor com pouca visão, ou lendo sob sol, vê duas frases cinza-azuladas ao lado de um selo verde. Falta uma marcação de **forma**, não só de cor (o desenho decide qual: faixa, ícone, contorno do card, agrupamento — não degrade o selo).
- → A frase quebra em duas linhas que só juntas fazem sentido ("pagamento pendente — regularize" + "até 12/09/2026, senão o Premium pausa."). A segunda começa em minúscula e depende da primeira; a leitura em voz alta fica truncada, e no mobile a linha 1 pode ficar longe da linha 2 se algo se intrometer.
- → **O prazo — o dado mais urgente da tela — está enterrado no fim da segunda linha**, em corpo de legenda. Não há contagem de dias restantes em lugar nenhum.
- → Dois botões lado a lado a 8px: "Atualizar forma de pagamento" (vai para fora do app) e "Recarregar" (fica). Nada indica que o primeiro **sai do produto**.
- → Existe uma frase escrita e **nunca renderizada**: `planRefreshHint` = "Mudou de plano agora?". Ela explicaria por que "Recarregar" está ali; hoje é código morto. Decida no desenho se ela aparece (e onde) ou se some.

## Conteúdo e dados reais
- **Data**: sempre `dd/mm/aaaa` em pt-BR (`12/09/2026`). É afirmação real do servidor (`graceUntil`), nunca estimativa — pode ser exibida com confiança.
- **Duração da janela**: entre **7 e 10 dias** (a regra é `max(janela de retentativa do MP = 10 dias, piso contratual = 7 dias)`, ancorada no fim do período pago). Desenhe o pior e o melhor caso de texto: "até 12/09/2026" e um dia distante como "até 31/12/2026".
- **Preços reais do plano** (aparecem na oferta logo abaixo, não nesta linha): "R$ 15,99/mês" e "R$ 155,88/ano · equivalente a R$ 12,99/mês".
- **Se `graceUntil` vier nulo**, a segunda linha **não é escrita** — o card fica só com "pagamento pendente — regularize". Desenhe essa variante: ela não pode parecer quebrada nem perder o tom de cautela.
- **Modo offline / dado guardado**: a legenda ganha um sufixo com separador " · última informação do servidor" → "pagamento pendente — regularize · última informação do servidor". Essa é a variante mais longa de todas e é onde a linha estoura.
- **Vizinhança**: acima não há nada (é a primeira linha da Conta); abaixo vem o card de **oferta** ("Assinar Premium", planos anual/mensal) — que em carência **não é oferecido** —, depois identidade da conta e o controle de Tema. No desktop (≥1280px) a Conta é uma grade de três colunas e a linha do plano ocupa a primeira.

## Estados obrigatórios
Desenhe a carência em **todas** estas condições, e mais os três estados vizinhos para comparação:

1. **Carência, repouso** — selo verde "Premium" + "pagamento pendente — regularize" + "até 12/09/2026, senão o Premium pausa." + botão preenchido "Atualizar forma de pagamento" + fantasma "Recarregar".
2. **Carência sem data** — sem a segunda linha (`graceUntil` nulo).
3. **Carência offline / dado guardado** — legenda com o sufixo " · última informação do servidor".
4. **"Recarregar" carregando** — o botão fantasma com indicador de carga; o resto da linha **não pisca nem some** (o vendedor não pode perder o prazo de vista durante a atualização).
5. **Foco de teclado** em cada um dos dois botões — anel visível contra o fundo real do card, nos dois temas.
6. **Hover e pressionado** do botão primário, e do fantasma.
7. **Estado vizinho A — Premium saudável**: selo verde "Premium" + "Plano mensal · renova em 01/09/2026" em cinza neutro; ações "Gerenciar assinatura" (fantasma) + "Cancelar assinatura" (fantasma) + "Recarregar".
8. **Estado vizinho B — Premium pausado**: selo neutro "Premium pausado" + "Seus itens salvos continuam disponíveis para leitura." + botão "Assinar novamente".
9. **Estado vizinho C — não sabemos**: selo neutro + "Não foi possível confirmar seu plano." e apenas "Recarregar" (nenhuma ação de cobrança é oferecida quando o servidor não respondeu).

## Viewports
- **Mobile 390px** — obrigatório: é o uso dominante e é a largura onde o defeito já aconteceu (ver armadilhas). Mostre a linha com o texto mais longo (variante 3) e com os dois botões.
- **Desktop 1280px** — obrigatório: a Conta vira grade de três colunas e a linha do plano fica numa coluna estreita, com a oferta inline logo abaixo nos estados que a oferecem. A carência **não** oferece assinatura, então essa coluna fica curta — mostre como ela não parece "vazia por erro".
- 1920px é o mesmo arranjo de 1280px com mais folga; desenhe só se algo mudar.

## Regras que o desenho não pode quebrar
- **O selo continua VERDE.** Degradar o selo diria ao vendedor que ele já perdeu algo — a mentira na direção oposta, e mais cara: ele pode parar de usar o que ainda pagou. A cautela mora no texto e na marcação de forma, nunca no selo.
- **Nada de alarme falso.** Sem vermelho de erro, sem ícone de perigo, sem contagem regressiva ansiosa em segundos. Isto é um aviso, não uma falha.
- **Nenhuma falha de rede pode ser vendida como perda de Premium** — o estado "não foi possível confirmar" é honesto e separado; nunca se disfarça de pausa.
- **Frase honesta nunca vive dentro de placeholder** nem de campo truncável: "até 12/09/2026, senão o Premium pausa." precisa de um elemento de largura total que a mostre inteira.
- **A ação que recupera o Premium é a mais forte da linha.** Ela é primária porque é a única que resolve; "Recarregar" jamais pode ter peso igual ou maior.
- **Sinalize a saída do app**: "Atualizar forma de pagamento" leva ao Mercado Pago em nova aba. O dado do cartão não passa por este produto e o desenho deve deixar isso legível.
- **Alvos ≥44px** de altura nos dois botões, inclusive quando a linha quebra.
- **Contraste medido contra o fundo real do card** (não contra o fundo da página) para o tom de cautela — nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido a 390px**: nesta mesma linha, as ações mediam 453,5px contra 316px de conteúdo útil, o `scrollWidth` da página ia a 491 (**100,5px de transbordo**) e um botão **nascia inteiramente fora da viewport** (x=396,3). Com um modal aberto, sobrava uma faixa clara à direita com o botão solto. Regra da casa: **quebra de linha, nunca rolagem horizontal** — e o bloco de ações precisa quebrar *dentro de si*, não só o card.
- **Colisão de rótulos**: o botão de recarregar já se chamou "Atualizar" e ficava a 8px de "Atualizar forma de pagamento" — mesma primeira palavra, lado a lado, no momento de maior ansiedade. Por isso hoje é "Recarregar". Não reintroduza duas ações que começam com a mesma palavra.
- **Temperatura visual idêntica**: carência e assinatura saudável já foram indistinguíveis num teste automatizado que passava — texto presente não é texto perceptível. Se as duas pranchetas lado a lado não se distinguirem **em preto e branco**, o desenho ainda não resolveu.
- **Texto que passa em teste e não aparece na tela**: ocultação e transbordo não são propriedades do texto. Toda frase de honestidade precisa caber medida em caixa, não só existir.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como primeira classe** (as duas versões de cada prancheta de repouso; os estados de interação podem ficar só no escuro):
1. Mobile 390px — carência em repouso (estados 1, 2, 3).
2. Mobile 390px — carregando + foco + hover/pressionado (estados 4–6).
3. Mobile 390px — a tira comparativa: carência acima de Premium saudável acima de Premium pausado acima de "não sabemos" (estados 7–9), para provar a distinção.
4. Desktop 1280px — a coluna do plano em carência, no contexto da grade de três colunas.

Reutilize os primitivos existentes, sem criar novos: o card da linha é o **`tf-card`**; o selo é o **`tf-badge`** em tom `success` (e `neutral` nos vizinhos); rótulo, legenda e nota usam a escala de **caption** do sistema; as duas ações são **`tf-btn`** — primária preenchida para "Atualizar forma de pagamento" e `ghost` para "Recarregar" —, com o estado de carga do próprio botão; se propuser uma faixa/realce de cautela, use o **`tf-alert`** em tom `info`, e não um bloco novo.

## Perguntas em aberto para o dono
1. A carência deve mostrar **dias restantes** ("faltam 6 dias") além da data, ou só a data? Contagem em dias é mais urgente e mais fácil de errar por fuso/arredondamento.
2. A frase escrita e nunca exibida "Mudou de plano agora?" deve aparecer ao lado de "Recarregar", ou deve ser apagada da base?
3. Em carência, a Conta deve mostrar **algum** caminho de reassinatura (hoje não mostra: a assinatura ainda existe, só o pagamento falhou) — ou o botão do Mercado Pago é a única saída, mesmo para quem quer trocar de plano no meio da carência?
4. Além da cor `info`, a carência pode ganhar uma marcação de forma (faixa, ícone, contorno do card)? E, se sim, ela vale para o card inteiro ou só para o par de frases?
