# Aba Orçamentos no celular — a lista completa em 390px

## O que desenhar
A tela inteira da aba **Orçamentos** no celular (390px de largura): a pilha vertical que o vendedor vê ao tocar em "Orçamentos" na barra de abas inferior. É a aba premium mais aberta no telefone e a única prova de que as cotações dele existem — ele chega aqui para achar *o orçamento daquele cliente* e dizer quanto cobrou e quando. A peça vai do cabeçalho da página até o botão "Carregar mais" no fim da lista, passando por até três faixas de aviso empilhadas, a barra de filtros, e a pilha de cards de registro congelado. O detalhe de um registro é outra tela (o card leva para ela); aqui só a lista.

## Por que este prompt existe
A composição vertical abaixo de 1280px nunca foi desenhada. O que existe: o protótipo de 2026-07-02 (`claude-design-prototype.md` §E6/§G, `HistoryScreen.jsx`) desenhou uma lista mock de 390px com **outra anatomia** — `ListItem` com ícone quadrado accent-soft, título, subtítulo "data · markup 50%", valor à direita e chevron. O construído inverteu isso de propósito (FR-523: data ACIMA do dinheiro, sem chevron, sem ícone). E o canvas do dono (`Abas-Desktop.dc.html`, ago/2026) desenha o card com a anatomia exata de hoje — mas num artboard único de 1920px, sem nenhum breakpoint e sem nada sobre 390px. **Nenhuma das autoridades trata o que este prompt precisa resolver: os avisos de topo empilhados, a densidade da pilha longa e o [Carregar mais].**

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` + `.css`, textos em `messages.pt-br.ts` (`historico`).

Ordem vertical real, de cima para baixo:

| # | Elemento | Texto literal hoje | Quando aparece |
|---|---|---|---|
| 1 | Título h1 | "Orçamentos" | sempre |
| 2 | Legenda | "O que você cotou, com a data. Os valores ficam congelados como estavam no dia." | sempre |
| 3 | Alerta `info` | "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium." | Premium lapsed |
| 4 | Alerta `info` com título | "Modo leitura offline" / "Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar a ficar online." | servindo cache, offline |
| 4b | Alerta `danger` + botão | "Não foi possível carregar seus orçamentos." + [Tentar novamente] na MESMA faixa | servindo cache, online |
| 5 | Banner da fila (`info` ou `danger`) + até 3 botões | ver "Estados obrigatórios" | há registro não sincronizado |
| 6 | Barra de filtros | busca + chips de período | há lista ou filtro ativo |
| 7 | Pilha de cards | — | — |
| 8 | Botão centralizado | "Carregar mais" | há próxima página |

→ **Problema 1 a resolver no desenho:** 3, 4 e 5 podem coexistir. Três faixas + título + legenda + barra de filtros empurram o **primeiro card para fora da primeira tela** em 390px. O desenho precisa decidir a densidade, a ordem e — se for o caso — a compressão desses avisos, sem esconder nenhum dos três fatos.

Anatomia do card (`Card padding="sm"`, coluna, gap `--space-1`, o card inteiro é um link):
- `.tf-historico__label` — o rótulo do cliente, **negrito 600, uma linha, com reticências**;
- badge de sincronização à direita (só quando não sincronizado), empurrado por `margin-left:auto`;
- `.tf-historico__meta` — "Cotado em 12/07/2026 · Peça única" (ou "Kit · 4 peças"), caption 0.8125rem, cor muted;
- `.tf-historico__money` — linha `space-between`, `baseline`: à esquerda "Valor cotado", à direita o total em `strong` com `tabular-nums`;
- `.tf-historico__basis` — caption abaixo: "preço de varejo" ou "preço de atacado";
- ações inline só em card travado: [Tentar agora] ou [Tentar novamente] + [Descartar] (danger).

→ **Problema 2:** o rótulo é o **único** jeito de achar o orçamento certo — e é justamente o campo que trunca em uma linha; com o badge ao lado, sobra ainda menos. Data e dinheiro estão declarados no código como "a alegação, nunca truncam".
→ **Problema 3 (divergência a resolver):** o canvas do dono desenha a linha do dinheiro com a **base à esquerda** ("preço de varejo") e o total à direita — **sem a palavra "Valor cotado"**. O código mostra "Valor cotado" na esquerda e a base numa linha separada abaixo. São duas anatomias diferentes; o desenho de 390px precisa escolher uma (e a escolha vale para as duas larguras).
→ **Problema 4:** não há separador, cabeçalho fixo, agrupamento por mês nem contagem de registros. Com 40 registros a pilha é 40 cards iguais separados por `--space-4`.

## Conteúdo e dados reais
- **Rótulo**: texto livre do vendedor, opcional. Sem rótulo, cai para o nome da origem capturada, e sem origem para "Cálculo avulso". Exemplos reais para desenhar: "Maria — pedido 42", "Cliente Ana Paula Ribeiro — suportes de bancada 3ª remessa" (o caso que trunca), "Cálculo avulso".
- **Data**: `dd/mm/aaaa`, renderizada no fuso do aparelho no momento da cotação. Ex.: "Cotado em 12/07/2026".
- **Tipo**: "Peça única" ou "Kit · {n} peças" (n = número de linhas do documento congelado; ex. "Kit · 4 peças").
- **Total**: string monetária congelada, `R$ 1.234,56`. Desenhe também o caso grande: `R$ 12.480,00`. Nunca truncar.
- **Base**: "preço de varejo" | "preço de atacado".
- **Badges de sincronização** (literais): "Pendente neste dispositivo" · "Envio pausado · precisa de Premium" · "Envio pausado · sessão expirada" · "Não foi possível registrar" (esta em tom `danger`; as outras `info`).
- **Busca**: rótulo do campo "Buscar por rótulo", placeholder "Cliente, pedido…", `type="search"`, máx. 120 caracteres, debounce de 250 ms.
- **Chips de período**: "Tudo" (padrão), "30 dias", "90 dias", "Período…". O ativo vira `primary`, os demais `secondary`.
- **Faixa de período customizado ativa**: "Período: 01/07/2026 – 31/07/2026" + [Limpar filtro].
- **Folha do período**: título "Período…", campos "De" e "Até" (calendário), botões [Voltar] e [Aplicar].
- **Paginação**: o servidor pagina por keyset; "Carregar mais" traz a próxima página e some quando a última entra. Não há teto silencioso.

## Estados obrigatórios
1. **Repouso com lista** — 4 a 6 cards, um deles com rótulo longo que trunca e um com total de 5 dígitos.
2. **Verificando o plano** — só o título "Orçamentos" e um spinner centralizado (nada de teaser piscando).
3. **Sem Premium / deslogado** — o teaser fechado: "Guarde seus orçamentos com a data" / "Cada cotação fica guardada com a data e a versão da fórmula — para você provar depois o que cobrou, mesmo que o catálogo mude." / botão de assinar / "A calculadora continua grátis e sem limite."
4. **Plano não verificável** — "Não foi possível verificar seu plano." + [Tentar novamente]. **Nunca o teaser**: falha de rede não é "você não é premium".
5. **Premium pausado (lapsed)** — a lista aparece inteira e legível, com a faixa `info` do item 3 da tabela.
6. **Carregando a lista** — spinner centralizado, sem esqueleto de card hoje (avalie se o desenho pede um).
7. **Erro frio** (nada em cache, nada na fila) — "Não foi possível carregar seus orçamentos." + [Tentar novamente], centralizados. Nunca sobre dados que o vendedor já tem.
8. **Leitura offline** — faixa "Modo leitura offline" e a lista abaixo, íntegra.
9. **Vazio frio** — ilustração/ícone de histórico, "Nenhum registro ainda", "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data." + [Ir para a calculadora].
10. **Busca sem resultado** — "Nenhum registro encontrado para “Maria”." + [Limpar busca]. É um estado **diferente** do vazio frio e não pode se parecer com ele.
11. **Fila pendente, online** — "2 registro(s) pendente(s) neste dispositivo." + [Sincronizar agora].
12. **Fila pendente, offline** — "Sem conexão. 2 registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online." (sem botão de sincronizar).
13. **Fila bloqueada** — "1 registro(s) não foram enviados: o Premium não está ativo." + [Ver].
14. **Sessão expirada** — "1 registro(s) não foram enviados: sua sessão expirou." + [Ver] + [Entrar de novo].
15. **Fila com falha** — faixa `danger`: "1 registro(s) não puderam ser registrados." + [Ver].
16. **Card travado** — badge + a dupla [Tentar novamente] / [Descartar] dentro do próprio card, que continua sendo um link para o detalhe.
17. **Carregando mais** — o botão "Carregar mais" em estado de carregamento, com os cards já vistos intactos.
18. **Foco de teclado** e **pressionado** no card inteiro (é um alvo grande e clicável) e nos chips.
19. **Pilha longa** — 40 registros: mostre onde a leitura cansa e o que o desenho propõe (ou não) para isso.

## Viewports
**390px (obrigatório)** — é onde a peça vive e o único lugar onde ela nunca foi desenhada. Inclua também um recorte de **360px** para o pior caso real de aparelho pequeno (é a largura em que o projeto já mede overflow). **Não desenhe desktop aqui**: acima de 1280px esta aba vira mestre‑detalhe (lista de ~520px + o documento à direita), que é outra peça e já está no canvas do dono. Se algo do seu desenho de 390px implicar mudança no card do desktop (o Problema 3), diga isso explicitamente em vez de redesenhar a outra tela.

## Regras que o desenho não pode quebrar
- **A data vem antes do dinheiro. Sempre** (FR-523). Um card não pode ser lido como um preço vivo; a primeira coisa sob o rótulo é quando foi cotado.
- **"Valor cotado", nunca "Preço"** — preço é o que a calculadora diz hoje. Nada de tratamento de PriceHero, nada de cor que leia como "atual".
- **Total sem base é alegação ambígua**: a base ("preço de varejo"/"preço de atacado") acompanha o número em toda superfície.
- **Falha de rede nunca é vendida como "não é premium"** (estado 4) e **erro nunca cobre dados que o vendedor já tem** (estados 7 vs 8).
- **Freemium binário**: ou a lista inteira, ou o teaser. Nada de lista borrada, contagem provocativa ou card meio visível.
- **Lapsed não apaga nada**: ler continua livre; só escrever pede Premium ativo. O tom é calmo — "expirou/bloqueado/suspenso" são proibidos.
- **Nenhuma frase honesta dentro de placeholder** — placeholder carrega exemplo ("Cliente, pedido…"), nunca explicação.
- **Alvo ≥44px** em card, chips, botões das faixas e [Carregar mais]. Os chips hoje são `size="sm"`: se o desenho os mantiver pequenos, diga qual é a altura do alvo.
- **Contraste medido contra o fundo real** do card e da faixa `accent-soft`, nos dois temas.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido nos DOIS eixos** — o headless não vê barra de rolagem clássica; o projeto já perdeu um item por medir só X. A faixa da fila (`flex-wrap`) com três botões e o texto "Sem conexão. 2 registro(s) pendente(s)…" é o candidato número um a estourar em 360px.
- **Texto ocluso passa em teste** — `toBeVisible` não vê elemento coberto ou fora do container; o rótulo espremido pelo badge é exatamente esse caso.
- **Valor grande estoura a coluna** — foi um defeito real no PDF do E4. Desenhe com `R$ 12.480,00` ao lado de um rótulo longo, não com "R$ 24,24".
- **Frase honesta cortada** — o 016 pagou por isso: a frase de honestidade mora em elemento de largura inteira, o placeholder carrega só o exemplo.
- **A barra de abas fica fixa no rodapé** (com `safe-area-inset-bottom`): o último card e o [Carregar mais] não podem terminar embaixo dela.

## Entregável
Pranchetas de 390px, em **tema escuro (padrão) e tema claro (first-class)**, reutilizando os primitivos `tf-*` — nenhum componente novo:
1. **Repouso com lista** (5 cards, um truncando, um com total grande) — `tf-card--pad-sm` + `tf-badge` + `tf-btn--ghost` no "Carregar mais".
2. **Pior caso de topo**: as três faixas empilhadas (`tf-alert` info + info + danger) acima da barra de filtros — a prancheta que justifica este prompt.
3. **Barra de filtros** em repouso, com chip de período ativo e com a folha "Período…" aberta (`tf-input` + `tf-btn--sm` + `tf-sheet`).
4. **Vazio frio** e **busca sem resultado**, lado a lado, para provar que não se confundem (`tf-empty-state`).
5. **Portas do premium**: teaser QUOTES e "Não foi possível verificar seu plano." (`tf-premium-teaser`, `tf-alert--danger`).
6. **Cards em estado excepcional**: pendente, sessão expirada, falha com [Tentar novamente]/[Descartar] (`tf-badge--info` / `tf-badge--danger`, `tf-btn--danger`).
7. **Pilha longa** (40 registros, recorte de rolagem) com a sua proposta de densidade — separador, agrupamento ou nada, dito e justificado.
Em cada prancheta, marque as medidas do alvo tocável e as sobras horizontais em 360px.

## Perguntas em aberto para o dono
1. **Agrupamento e contagem**: a pilha longa ganha cabeçalho por mês ("Julho de 2026") e/ou uma contagem de registros? Hoje não há nenhum dos dois, e é decisão de produto, não de layout.
2. **Anatomia da linha do dinheiro**: fica "Valor cotado" + total, com a base numa linha abaixo (código de hoje), ou base à esquerda + total à direita, sem "Valor cotado" (canvas de 1920px)? A resposta vale para as duas larguras.
3. **Três avisos ao mesmo tempo**: podem ser condensados numa faixa só quando coexistirem, ou os três fatos precisam ser lidos separadamente mesmo custando a primeira tela?
4. **Paginação**: "Carregar mais" continua sendo o gesto no celular, ou o dono quer carregamento ao rolar? (Isso muda o fim da lista e a relação com a barra de abas fixa.)
