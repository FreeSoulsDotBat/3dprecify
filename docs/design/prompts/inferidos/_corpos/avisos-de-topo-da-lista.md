# Faixas de aviso no topo de Orçamentos

## O que desenhar
A pilha de faixas de aviso que aparece na aba **Orçamentos** (a lista de documentos congelados), entre o
cabeçalho da página e a barra de filtros — portanto ACIMA do primeiro registro. São três avisos de página
que podem coexistir: "Premium pausado", o par "Modo leitura offline" / "erro de carga com Tentar novamente
dentro da faixa", e a faixa da fila de envio. Quem vê é o vendedor que abriu Orçamentos para consultar o
que já cotou — ele não veio resolver um problema de sistema, veio ler um número. Desenhe a pilha inteira
(a convivência entre as faixas), não cada faixa isolada.

## Por que este prompt existe
Nenhum desenho jamais definiu a CONVIVÊNCIA. O código escolheu sozinho a ordem (pausado → offline/erro →
fila), a regra de silenciar o alerta genérico quando a sessão expirou, e a densidade de até três faixas
antes do primeiro registro em 390px. Autoridade parcial: `claude-design-prototype-fixes.md` item 17 cobre
"Não foi possível carregar. Tente de novo." + botão "Tentar novamente" (verificado no protótipo de
2026-07-02), mas como estado de falha de carga — nunca como uma faixa fina COM BOTÃO DENTRO sobre dados que
o vendedor já tem em cache. "Modo leitura offline" e "Premium pausado" não têm desenho em autoridade
alguma: o protótipo só conhecia free × premium (o estado `lapsed` nasce depois, com a entitlement de
E2/E6), e o banner offline do shell é outro objeto, em outro lugar da tela. O desenho desktop de 018
(`Abas-Desktop.dc.html`, linha 264) desenha SÓ a faixa da fila — e a desenha diferente do que foi
construído (ver abaixo), o que é uma contradição a resolver, não um detalhe.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` + `historico-page.css` + `messages.pt-br.ts`.
Ordem real de renderização, de cima para baixo:

| # | Faixa | Quando aparece | Tom | Ação dentro |
|---|-------|----------------|-----|-------------|
| 1 | Premium pausado | entitlement `lapsed` | info | nenhuma |
| 2a | Erro de carga sobre cache | leitura veio do cache **e** o aparelho está online | danger | botão "Tentar novamente" |
| 2b | Modo leitura offline | leitura veio do cache **e** o aparelho está offline | info | nenhuma |
| 3 | Fila de envio | há registros não sincronizados | info ou danger | até 3 botões |

Textos literais de hoje (não reescrever sem motivo dito):
- Pausado: **"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear,
  excluir ou exportar, reative o Premium."** (uma frase única, sem título, sem botão).
- Offline: título **"Modo leitura offline"** + corpo **"Seus registros continuam aqui. Novos registros
  ficam pendentes neste dispositivo até você voltar a ficar online."**
- Erro sobre cache: **"Não foi possível carregar seus orçamentos."** + botão **"Tentar novamente"**.
- Fila, um texto por precedência falhou > bloqueado > sessão > pendente:
  "{n} registro(s) não puderam ser registrados." (danger) · "{n} registro(s) não foram enviados: o Premium
  não está ativo." · "{n} registro(s) não foram enviados: sua sessão expirou." · "Sem conexão. {n}
  registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online." ·
  "{n} registro(s) pendente(s) neste dispositivo."
- Botões da fila: **"Ver"** · **"Entrar de novo"** · **"Sincronizar agora"** (este com estado de carga).

→ **Problema 1**: a faixa 2a põe o botão DENTRO do Alert, num contêiner com `flex-wrap` e
`justify-content: space-between`. Em 390px o botão quebra para a segunda linha e encosta na direita, sem
alinhamento com nada. Esse padrão "Alert que contém botão" não está desenhado em lugar nenhum do produto.
→ **Problema 2**: o desenho desktop existente usa uma variante `tf-alert--compact` de UMA linha, com o
texto no lugar do `tf-alert__title` e o botão FORA do corpo do alerta, à direita, centrado verticalmente.
O construído usa outra composição. Uma das duas tem de morrer — decida no desenho.
→ **Problema 3**: três faixas empilhadas somam ~3 × (padding 16px + duas linhas de texto) e empurram o
primeiro registro para fora da primeira tela em 390px.
→ **Problema 4**: com Premium pausado, a mesma causa pode ser dita duas vezes — a faixa 1 e a faixa 3
("o Premium não está ativo") aparecem juntas.

Vizinhança que NÃO é esta peça, mas divide a tela: o banner do shell de sessão expirada ("Sua sessão
expirou" / "Entre de novo para continuar de onde parou." / "Entrar de novo") e o banner offline global do
shell ("Você está offline. O cálculo continua funcionando."). Ambos ficam acima, fora da página. Mais
abaixo, o erro FRIO (nada em cache) é outro objeto: alerta centralizado + botão "Tentar novamente" embaixo,
no lugar da lista.

## Conteúdo e dados reais
- `{n}` é uma contagem inteira de registros, tipicamente 1–5, sem teto — desenhe também com 12.
- Não há dinheiro dentro das faixas. O dinheiro está logo abaixo, nos cards: rótulo "Valor cotado" com
  valores como **R$ 24,24** e **R$ 1.234,56**, sob "Cotado em 07/08/2026".
- O que a barra de filtros mostra logo abaixo das faixas: campo com placeholder "Cliente, pedido…" e os
  chips "30 dias" · "90 dias" · "Tudo" · "Período…".
- Nada aqui é opcional em conteúdo: cada faixa só existe quando o fato existe.

## Estados obrigatórios
1. **Nenhuma faixa** — o caso normal e o mais importante de desenhar: filtros e primeiro registro colados
   no cabeçalho.
2. **Só pausado** (info, frase única acima).
3. **Só offline** (info, com título "Modo leitura offline" + corpo de duas linhas).
4. **Só erro sobre cache** (danger, com "Tentar novamente" inline) — repouso, hover, foco visível e
   pressionado do botão dentro de um fundo já tingido de vermelho suave.
5. **Fila com 1 pendente, online** — texto + "Sincronizar agora".
6. **Fila sincronizando** — "Sincronizar agora" em carga, texto inalterado.
7. **Fila com problema** (danger) — texto de falha + "Ver"; e a variante sessão expirada com "Ver" +
   "Entrar de novo" lado a lado.
8. **Fila offline** — texto longo "Sem conexão. {n} registro(s)…", SEM botão de sincronizar (o código não
   oferece uma ação que não pode funcionar).
9. **Pilha de três** — pausado + offline + fila, empilhadas, em 390px: mostre onde fica a dobra.
10. **Sessão expirada** — o alerta genérico de carga é SILENCIADO (a causa conhecida cala a genérica);
    quem fala é o banner do shell e a faixa da fila. Desenhe esse recorte para provar que ele é legível.

## Viewports
- **390px** — obrigatório: é onde a pilha dói. Mostre a pilha de três e onde o primeiro card começa.
- **1280px** — a lista de Orçamentos vira mestre-detalhe (lista à esquerda, documento congelado à direita).
  As faixas ficam ACIMA da grade de duas colunas, ocupando a largura toda. Desenhe uma faixa com botão
  nessa largura: o espaço vazio entre texto e botão fica enorme e precisa de uma decisão.
- **1920px** — só se a decisão de largura máxima da faixa mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- Falha de rede NUNCA pode ser vendida como falta de Premium, e vice-versa: são quatro causas distintas
  (offline · erro de servidor · Premium pausado · sessão expirada) e cada faixa nomeia exatamente a sua.
- Degradação é dita, nunca escondida: se a lista veio do cache, a faixa existe. E as linhas abaixo
  continuam renderizando — nunca uma parede de erro sobre dados que o vendedor já tem.
- Freemium binário: "pausado" não é punitivo. Nada foi apagado, ler continua funcionando; só escrever
  precisa de Premium ativo. Palavras banidas: "expirou", "bloqueado", "suspenso" (para o plano).
- Frase honesta vive em elemento de largura cheia, nunca em placeholder e nunca truncada com reticências.
- Alvo de toque ≥44px para qualquer botão dentro das faixas, inclusive os `sm`.
- Contraste medido contra o fundo tingido do alerta (info-soft / danger-soft), não contra o fundo da
  página.

## Armadilhas já pagas neste projeto
- Overflow horizontal medido em px: a faixa de fila em 390px tem texto longo + até dois botões na mesma
  linha. Já custou 100,5px de estouro numa peça irmã, com um botão nascendo fora da viewport.
- Texto ocluso passa em teste: `toBeVisible` é verdadeiro para um elemento coberto. Se uma faixa cobrir o
  primeiro card no desktop com a coluna grudenta, o teste não vê — o desenho tem de ver.
- Legenda cortada: a frase de pausado tem 130 caracteres. Em 390px são 4 linhas; não a comprima num chip.
- Um número grande em `{n}` ("12 registro(s) não puderam ser registrados.") muda a quebra de linha.
- Headless não enxerga barra de rolagem clássica: a densidade da pilha é decisão de desenho, não de teste.

## Entregável
Pranchetas em **tema escuro (padrão)** e **claro (first-class)**:
1. 390px — os 10 estados listados, como uma coluna de recortes do topo da página.
2. 390px — a pilha de três, tela inteira, com a dobra marcada.
3. 1280px — as faixas sobre o mestre-detalhe, incluindo a faixa com botão em largura total.
4. Uma prancheta de **anatomia**: a faixa com ação — decidir entre o botão dentro do corpo do alerta ou
   fora dele à direita, com as medidas.

Reutilize os primitivos existentes, não crie novos: `tf-alert` com `tf-alert--info` / `tf-alert--danger`
(ícone + `tf-alert__title` + `tf-alert__text`), `tf-btn--secondary` + `tf-btn--sm` para as ações inline,
`tf-badge` para os chips de período abaixo. Se propuser a variante compacta de uma linha, nomeie-a
`tf-alert--compact` — ela já existe no desenho desktop de 018 e não existe no produto.

## Perguntas em aberto para o dono
1. Quando o Premium está pausado E há registros bloqueados na fila, a mesma causa aparece em duas faixas.
   A faixa da fila deve calar (como a genérica cala sob sessão expirada), ou as duas devem falar?
2. Existe teto de faixas simultâneas? Se três é demais, qual é a regra — colapsar em uma faixa única
   "3 avisos" que expande, ou sacrificar a menos urgente?
3. A faixa "Premium pausado" deve ganhar uma ação ("Reativar Premium") ou continuar só texto? Hoje ela é a
   única sem saída, e a saída existe em outro lugar do app.
4. A variante de uma linha (`tf-alert--compact`, botão fora do corpo) do desenho desktop substitui o padrão
   construído em TODAS as faixas com ação, ou é exclusiva do desktop?
