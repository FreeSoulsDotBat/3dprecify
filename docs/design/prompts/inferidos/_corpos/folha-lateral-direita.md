# Folha lateral (Sheet) — a superfície que hoje entra pela direita sem ninguém ter escolhido

## O que desenhar
A folha modal do Precifica3D: o painel ancorado numa borda da tela que cobre o app inteiro com um
scrim e recebe UM formulário ou UMA decisão curta. Ela é a superfície de escrita mais usada do
produto no celular — é por ela que o vendedor cadastra filamento, impressora, produto e kit, salva
um orçamento congelado, salva uma simulação, renomeia uma simulação, escolhe o que exportar,
escolhe um período no Histórico e vê a oferta do Premium na Conta. São 12 aberturas, 8 arquivos,
1 primitivo. Desenhe o primitivo (a moldura, a ancoragem, o cabeçalho, a rolagem, o rodapé de
ações, o gesto de sair) e mostre-o com 3 conteúdos reais, do mais curto ao mais longo.

## Por que este prompt existe
A ancoragem NUNCA foi desenhada, e o código contraria o único desenho que existe. `dialog.tsx`
fixa `side = "right"` como PADRÃO; das 12 folhas do app apenas uma declara o lado — e declara
`"right"`. As outras 11 entram pela direita porque ninguém escolheu. O kit de protótipo de
2026-07-02 desenhou folha em duas telas (`CatalogScreen.jsx`, `HistoryScreen.jsx`) e as duas são
`placement="bottom"`; o §D.2 repete "entra de baixo (mobile) / centralizado (desktop)" e o §E8
chama o upsell de "bottom-sheet contextual". Nenhuma das três rodadas de auditoria tocou no
assunto. O canvas 018 resolve o desktop REMOVENDO a folha ("ficha do item à direita, sem sheet",
≥1280px) — o que deixa exatamente 390px, onde a folha vive de verdade, sem desenho nenhum.
→ A pergunta central deste prompt não é estética: **de que lado esta folha entra no celular, e o
que o gesto de sair dela é**, dado que hoje ela cobre 92% da largura vindo do lado e disputa
leitura com o "voltar" do sistema.

## O que já existe hoje (não invente do zero — corrija)

Moldura (`dialog.css`):

| Propriedade | Valor de hoje | Leitura |
| --- | --- | --- |
| Ancoragem | direita, `top:0; bottom:0` | → padrão implícito, contraria o protótipo |
| Largura | `min(92vw, 26rem)` = 358,8px a 390px · 416px a 768px | → no celular é quase tela cheia mas parece painel |
| Cantos | `radius-xl` só nas bordas internas (esq.) | coerente com a ancoragem |
| Rolagem | `overflow: auto` na folha inteira | → cabeçalho e ações rolam junto |
| Fechar | `×` absoluto no topo-direito, 44×44px, `aria-label="Fechar"` | → fica SOBRE o conteúdo; o título reserva `space-10` à direita |
| Alça de arrasto | não existe | → nada indica que dá para arrastar/deslizar para sair |
| Movimento | nenhum: sem `transition`, sem keyframes | → a folha não desliza, ela APARECE |
| Rodapé de ações | não existe no primitivo | → montado caso a caso; em algumas é um botão solto no fim do formulário |
| `--sheet-left` | existe no CSS, **zero consumidores** | código morto |

Título: caixa alta, `font-title`, `tracking-wide`, `fs-lg`, `text-strong`.
Descrição: `fs-body-sm`, `text-muted`, logo abaixo do título.

Os 12 conteúdos reais e seus títulos literais: "Novo filamento" / "Editar filamento" · "Nova
impressora" / "Editar impressora" · "Novo produto" / "Editar produto" · "Montar kit" / "Editar
kit" · "Salvar em Orçamentos" · "Salvar simulação" · "Renomear simulação" (duas origens
diferentes) · "Exportar" · "Período…" · "Assinar o Premium".

## Conteúdo e dados reais

**Folha curta — "Período…"** (Histórico): dois campos de data "De" e "Até", botão "Aplicar".
Abre sem `×` (`showClose={false}`) → hoje só se sai por Esc ou pelo scrim, e isso não é dito.

**Folha média — "Salvar em Orçamentos"**: intro "Vamos guardar os valores exatamente como estão
nesta tela, com a data de hoje." · campo "Rótulo (opcional)", dica "Cliente, pedido…", máx. 120
caracteres · campo "Validade da proposta" com o sufixo "dias" DENTRO do campo (número inteiro,
1 a 3650) · grupo "Preço que você está cotando" com "Varejo" e "Atacado" (ex.: R$ 24,24 e
R$ 21,01 — o de atacado só aparece quando existe) · ação "Salvar em Orçamentos".

**Folha longa — "Exportar"**: grupo "O que exportar" com "Orçamento para o cliente (PDF)" e
"Meus orçamentos (CSV)" · interruptor "Incluir detalhamento de custos" (sempre começa DESLIGADO)
· abaixo dele, a frase de dano, em texto corrido de largura inteira: "Seu cliente veria as linhas
gravadas — material, energia, máquina, falhas, acabamento, mão de obra e os seus outros custos —
e poderia calcular a sua margem." (para kit, a variante curta: "Seu cliente veria o custo total
gravado do kit — e poderia calcular a sua margem.") · a descrição do que viaja: "O orçamento leva:
itens, quantidades, o valor cotado, a data, a validade, o rótulo deste registro (impresso como
“Referência”), e identifica você pelo nome e e-mail da sua conta." · ação "Gerar PDF" ou
"Baixar CSV". Esse é o pior caso de altura: desenhe-o com o teclado ABERTO e o texto rolado.

**"Salvar simulação"**: intro "Guardamos a estratégia desta tela — canais, taxas ajustadas, base
de custo. Ao reabrir, ela recalcula com os preços de hoje." · "Nome" (obrigatório, 120) · "Nota
(opcional)" (500, área de texto de 3 linhas).

## Estados obrigatórios
- **Repouso** — folha aberta, scrim `surface-overlay` sobre o app, foco já dentro dela.
- **Foco visível** — anel `--ring` em cada campo, no `×` e nos botões; o `×` é o primeiro alvo
  focável e precisa ser óbvio como tal.
- **Rolagem** — conteúdo mais alto que a tela: mostre onde o título e o `×` ficam quando o
  usuário rolou (→ hoje somem; decida se o cabeçalho gruda).
- **Teclado aberto** (390px) — o campo em edição visível e a ação principal alcançável.
- **Enviando** — botão em `loading` com o rótulo mantido; a folha NÃO fecha antes da resposta.
- **Erro de escrita, folha aberta** — as escolhas ficam intactas. Frases reais: "Não foi possível
  gerar o arquivo." · "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." ·
  "Salvar uma simulação precisa de conexão." · "Dê um nome à simulação." (só depois da 1ª tentativa
  de salvar — o campo intocado não grita).
- **Bloqueio ANTES de abrir** — o gatilho fica desabilitado com a razão em TEXTO ao lado, nunca em
  tooltip: "Exportar precisa de conexão." · "Exportar precisa do Premium ativo." · e, dentro da
  folha, na opção que de fato está morta: "Sincronize para exportar."
- **Premium pausado (lapsed)** — a folha de catálogo abre em LEITURA, com o aviso calmo acima; não
  abre um formulário que vai falhar no envio.
- **Sem permissão** — para quem não tem Premium ativo, o gatilho de salvar não existe (não é botão
  cinza, não é isca). A folha simplesmente não é alcançável por ali.
- **Fechamento com alterações** — hoje só a barra de contexto de cenário confirma; nas demais,
  tocar no scrim descarta calado. → decida o comportamento do primitivo.

## Viewports
- **390px — obrigatório e principal.** É o único lugar onde esta peça continua existindo depois do
  018, e é onde o problema mora: 358,8px de painel sobre 390px de tela.
- **768px — obrigatório.** Aqui a folha vira mesmo um painel lateral (416px sobre 768px), e a
  mesma peça precisa ler bem nos dois.
- **1280px+ — não desenhar a folha.** O canvas 018 já decidiu: mestre-detalhe com ficha fixa à
  direita, sem sheet. Se algum conteúdo desta lista não couber na ficha, isso é pergunta ao dono,
  não desenho novo.

## Regras que o desenho não pode quebrar
- A frase honesta ("Seu cliente veria as linhas gravadas…", "Sincronize para exportar.") vive em
  elemento de largura inteira, NUNCA em placeholder e nunca em tooltip — placeholder corta e some
  ao digitar; tooltip não existe no toque.
- Falha de rede jamais é vendida como falta de Premium, e vice-versa: são frases distintas e o
  desenho precisa de lugar para as duas.
- Freemium é binário: sem Premium ativo o gatilho não existe; nada de folha aberta que termina em
  403.
- Nenhuma ação destrutiva mora nesta folha — excluir é diálogo centrado, com o nome ecoado.
- Todo alvo tocável ≥44×44px, inclusive o `×` e os rádios.
- Contraste medido contra o `surface-card` real por trás do scrim, nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: nesta largura, 92vw + `space-5` de padding dos dois
  lados deixa pouco para um valor grande; um `R$ 1.234,56` ou um nome de 120 caracteres tem de
  quebrar, não empurrar. A homologação já mediu 100,5px de transbordo com um botão nascido fora da
  viewport.
- **Texto ocluso passa em teste**: o `×` absoluto pode cobrir o fim do título — nenhum
  `toContainText` vê isso. Desenhe a reserva de espaço explicitamente.
- **Sufixo dentro do campo**: "dias" e as máscaras de milhar já cortaram texto uma vez; o campo
  precisa de largura para "3650" + "dias" sem colisão.
- **Folha que desmonta antes do retorno**: já houve app congelado (overlay órfão) e toast que nunca
  apareceu porque a folha sumiu antes da confirmação. O desenho tem de deixar claro em que momento
  a folha some e onde a confirmação aparece.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class), ambas em 390px e 768px:
1. **A moldura anotada** — ancoragem, largura, cantos, scrim, cabeçalho (título + `×`), área
   rolável e rodapé de ações, com as medidas escritas.
2. **Folha curta** — "Período…" (De/Até + "Aplicar").
3. **Folha longa** — "Exportar" em PDF com o interruptor LIGADO, texto de dano visível, rolada até
   o fim.
4. **Folha com teclado aberto** — "Salvar em Orçamentos" editando "Validade da proposta".
5. **Estados** — enviando, erro com folha aberta, gatilho desabilitado com a razão em texto ao
   lado, e leitura em Premium pausado.
Reutilize os primitivos existentes: `tf-dialog--sheet` (moldura), `tf-dialog__title` /
`tf-dialog__desc` / `tf-dialog__x` (cabeçalho), `tf-input` + `tf-inputwrap` + `Field` (campos),
`tf-switch` (o opt-in de custos), `tf-btn` primário/secundário/ghost (ações), `tf-alert` tom `info`
para offline e Premium pausado, `tf-card` só quando a folha listar itens. Não crie primitivo novo;
se faltar um, diga qual e por quê em vez de desenhá-lo.

## Perguntas em aberto para o dono
1. **Lado.** No celular a folha volta a entrar de BAIXO (como os dois únicos protótipos que
   existem e como o §D.2 escreve), ou fica na direita que o código escolheu sozinho? Isso muda o
   gesto de sair, os cantos, a altura e a relação com o "voltar" do Android.
2. **Fechar com alterações não salvas** vira regra do primitivo (confirmar sempre, como a barra de
   contexto de cenário já faz) ou continua caso a caso?
3. **Cabeçalho fixo.** Título e `×` grudam no topo durante a rolagem — ou continuam rolando junto
   com o conteúdo, como hoje?
4. **`--sheet-left`**: código morto sem consumidor. Some do sistema, ou existe um uso previsto que
   nunca foi escrito?
