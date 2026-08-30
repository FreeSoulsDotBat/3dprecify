# Cartão — clicável, selecionado, e as três variantes que nunca foram vistas

## O que desenhar
O cartão (`tf-card`) é a superfície em que este produto inteiro se apoia: 36 lugares do app o usam. O que
nunca foi desenhado é o cartão que **reage** — o `tf-card--interactive`, que levanta no hover, afunda no
clique e ganha anel no teclado — e o cartão **selecionado**, que no desktop (≥1280px) marca qual item da
lista mestre está aberto na ficha à direita. Isso vive nas duas listas mestre-detalhe do desktop: Catálogo
(Filamentos · Impressoras · Produtos · Kits) e Orçamentos. O vendedor passa o mouse por uma coluna de 4 a 40
cartões, clica em um, e precisa enxergar sem pensar qual está aberto. Desenhe a FAMÍLIA do cartão: os
estados de interação, o selecionado como membro da família, e as variantes `inverse` / `accent` / `ghost`
que existem no código e nunca apareceram em contexto nenhum.

## Por que este prompt existe
O par PARADO já é seu: o desenho de 2026-07-02 (`Abas-Desktop.dc.html`) tem os cartões da lista do Catálogo
(l.105) e os registros de Orçamentos (l.280), e §D.1 lista as variantes em prosa — mas prosa documenta o
código, não o desenha. Ficaram sem desenho: o **hover** (`translateY(-2px)` + sombra maior + borda mais
forte), o **foco**, o **selecionado como parte da família** (hoje ele é classe de feature, o `card.tsx` não
sabe o que é "selecionado") e as variantes `inverse`/`accent`/`ghost`. E o código **contraria o seu desenho
em dois pontos**, marcados abaixo com →.

## O que já existe hoje (não invente do zero — corrija)

| Peça | Como está no código | Situação |
| --- | --- | --- |
| Repouso | fundo `--surface-card`, borda 1px `--border-subtle`, raio `--radius-card`, sombra `--shadow-card` (= `--shadow-sm`), padding `--space-5` | desenhado |
| Hover (clicável) | sobe 2px, sombra `--shadow-md`, borda vira `--border-default`; transição 190ms `--ease-out` | **nunca desenhado** |
| Pressionado | volta a `translateY(0)` — nenhuma outra mudança | **nunca desenhado** |
| Foco (teclado) | `outline: none` + anel sólido 2px roxo (`--ring`) colado na borda; **a sombra do cartão some** enquanto focado | **nunca desenhado** |
| Selecionado (Catálogo) | `border-color: var(--accent)` **+ `background: var(--accent-soft)`** | → o seu desenho (l.601) pinta **só a borda** accent; o código pinta o fundo também |
| Selecionado (Orçamentos) | `border-color: var(--accent)` + `background: var(--accent-soft)` | bate com o desenho (l.625) |
| Cartão de Orçamentos | é um `<Card>` comum dentro de um link — **não tem `tf-card--interactive`** | → o seu desenho l.280 usa `tf-card--interactive tf-card--pad-sm`: hoje a lista do Catálogo levanta no hover e a de Orçamentos não |
| Paddings | `none` (0) · `sm` (`--space-4`) · `md` (`--space-5`, padrão) · `lg` (`--space-7`) | só `sm`/`md`/`lg` aparecem em contexto |
| `flat` / `outline` | sem sombra; `outline` ainda troca a borda para `--border-default` | usadas de fato |
| `ghost` / `inverse` / `accent` | existem no CSS e **não são usadas em lugar nenhum do app** (0 ocorrências em 36 usos) | **nunca desenhadas, nunca usadas** |
| Conteúdo do cartão do Catálogo | nome (semibold, `--text-strong`) + resumo em caption `--text-muted`; **sem selo e sem linha de dinheiro própria** | → o seu desenho tem selo no canto superior direito e o dinheiro em linha separada `tf-tnum` |
| Avisos dentro do cartão | "pode estar desatualizada" e "somente leitura" entram como mais uma caption cinza no rodapé de **cada** cartão | → repetido 20 vezes numa lista de 20; precisa de hierarquia |

## Conteúdo e dados reais
Textos literais, exatos como estão hoje:
- Cartão de filamento: nome `"PLA Azul"`, resumo `"PLA · R$ 120,00 / 1 kg"` (material · custo do rolo / peso).
- Cartão de impressora: nome `"Ender 3 V3"`, resumo `"R$ 1.899,00 · 4.000 h · 0,12 kW"` (valor da máquina ·
  vida útil em horas · potência média).
- Contadores acima da lista: `"{n} filamento(s)"`, `"{n} impressora(s)"`, `"{n} produto(s)"`, `"{n} kit(s)"`.
- Legendas de estado dentro do cartão: `"pode estar desatualizada"` (leitura offline) e `"somente leitura"`
  (Premium pausado).
- Cartão de Orçamentos (a ordem é obrigatória — a data vem ANTES do dinheiro): rótulo do registro
  (`"Cliente Ana · pedido 412"`), selo de sincronização quando o estado não é "sincronizado", meta
  `"Cotado em 12/08/2026 · Kit · 3 peças"` ou `"… · Peça única"`, depois `"Valor cotado"` + **R$ 148,90** em
  negrito, e a legenda da base do preço.
- Busca acima da lista: placeholder `"Buscar no catálogo…"`, rótulo `"Buscar no catálogo"`.
- Vazio da busca (não é o vazio do catálogo): `"Nada encontrado para essa busca"` /
  `"Tente outro termo, ou limpe a busca para ver tudo de novo."` / botão `"Limpar busca"`.
- O nome é campo livre do vendedor: pode vir com 500 caracteres sem espaço nenhum (aconteceu na homologação).

## Estados obrigatórios
Desenhe cada um destes, no cartão da lista do Catálogo e no de Orçamentos:
1. **Repouso** — a base matte.
2. **Hover** — o cartão sobe 2px, sombra `--shadow-md`, borda `--border-default`. Mostre o cursor.
3. **Pressionado** — volta ao chão (`translateY(0)`), sem piscar de cor.
4. **Foco por teclado** — anel roxo sólido 2px. Resolva: hoje o anel **substitui** a sombra do cartão, então
   um cartão focado fica mais chapado que os vizinhos.
5. **Selecionado (repouso)** — o item aberto na ficha à direita.
6. **Selecionado + hover** e **selecionado + foco** — os três sinais juntos, que é exatamente o que nunca foi
   visto num desenho. O selecionado precisa continuar legível com o anel por cima.
7. **Offline / desatualizado** — o cartão continua clicável e diz `"pode estar desatualizada"`.
8. **Premium pausado (somente leitura)** — o cartão continua clicável (a ficha abre em leitura) e diz
   `"somente leitura"`. Não é desabilitado, e não pode parecer erro.
9. **Cartão não clicável** — o mesmo cartão sem `interactive` (Conta, resultado do Calcular, privacidade):
   precisa ser distinguível à distância de um clicável parado.
10. **As três variantes órfãs em contexto** — `accent` (fundo `--accent-soft`, sem borda, sem sombra),
    `inverse` (plano preto da marca, texto claro) e `ghost` (transparente, sem borda, padding 0): mostre um
    uso plausível de cada uma **ou** diga no desenho que devem ser aposentadas.
- Não existe estado desabilitado no cartão. Se você achar que precisa de um, é decisão do dono.

## Viewports
- **Desktop 1280px** — o corte do mestre-detalhe. Lista em **uma** coluna ao lado da ficha; é aqui que o
  clicável+selecionado nasce.
- **Desktop 1920px** — a lista do Catálogo vira **duas colunas** (a partir de 1600px). O hover e o
  selecionado precisam ler bem em cartões lado a lado, não só empilhados.
- **Mobile 390px** — só como prancheta de referência: no mobile o cartão **não** é clicável (a linha tem um
  botão interno) e nada aqui deve mudá-lo. O mobile não se mexe; desenhe-o para mostrar que a família fecha.

## Regras que o desenho não pode quebrar
- **Alvo de toque e clique ≥44px** de altura no cartão clicável, inclusive no padding `sm`.
- **Contraste medido contra o fundo real**, não contra branco: a borda `--accent` e o fundo `--accent-soft`
  precisam separar o selecionado do vizinho **nos dois temas** — no escuro `--accent-soft` é roxo a 18% de
  opacidade sobre um cinza quase preto, uma diferença fina.
- **Foco e seleção não podem colidir**: o anel de foco é roxo e a borda do selecionado é roxa. Um cartão
  selecionado E focado tem que dizer as duas coisas — resolva por espessura, afastamento ou brilho, não por cor.
- **Seleção nunca é só cor**: o item aberto também é anunciado para leitores de tela, mas visualmente hoje só
  existe cor. Considere um segundo sinal (barra lateral, marca) para daltonismo.
- **Degradação dita, não escondida**: `"pode estar desatualizada"` e `"somente leitura"` ficam VISÍVEIS, em
  elemento de largura cheia — nunca truncadas, nunca dentro de placeholder.
- **Falha de rede nunca vira "não é premium"**: o cartão offline continua sendo o item salvo do vendedor.
- **Movimento**: o levantar de 2px roda em 190ms e precisa sumir sob `prefers-reduced-motion` — nenhuma
  legibilidade pode depender da animação.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido**: um filamento com 500 caracteres sem espaço gerou **4.948px** de rolagem
  a 1440px, porque o cartão da lista não quebrava o nome (a ficha da direita já quebrava). O desenho precisa
  mostrar o nome comprido quebrando dentro do cartão, e a coluna sem crescer.
- **Valor grande que estoura a linha**: mostre um cartão de Orçamentos com **R$ 12.480,55** ao lado de um
  selo — o trio rótulo + dinheiro + selo é onde a linha estoura.
- **Texto ocluso passa em teste**: asserção de texto não vê colisão. Desenhe as caixas, com folga real entre
  o nome e o selo do canto.
- **Anel de foco com raio errado**: no cartão de Orçamentos o clicável é o link em volta, e o contorno de
  foco herda um raio pequeno — desenha um quase-retângulo em volta de um cartão arredondado. Diga qual é o
  raio do foco do cartão.
- **Se parece clicável, tem que ser botão**: um cartão clicável que não é botão de verdade recebe o papel de
  botão mas **não responde ao Enter**. Todo cartão que você desenhar como clicável é um botão.

## Entregável
Pranchetas, em **tema escuro (padrão) e claro (first-class, não um remendo)**:
1. **Matriz de estados** do cartão clicável do Catálogo: repouso · hover · pressionado · foco · selecionado ·
   selecionado+hover · selecionado+foco (7 quadros, lado a lado, mesmo conteúdo).
2. **Lista mestre a 1280px** com 5 cartões, um selecionado e outro sob o mouse — para ver os três sinais
   convivendo.
3. **Lista a 1920px em duas colunas**, um selecionado.
4. **Lista de Orçamentos a 1280px**, com selo de sincronização, valor alto e um cartão aberto.
5. **Casos-limite**: nome de 500 caracteres · cartão offline (`"pode estar desatualizada"`) · cartão em
   Premium pausado (`"somente leitura"`).
6. **Variantes**: `default` · `flat` · `outline` · `accent` · `inverse` · `ghost`, cada uma com um uso
   plausível ou marcada como "aposentar".
7. **Mobile 390px** de referência, cartão não clicável.
Reutilize os primitivos existentes: `tf-card` (+ `tf-card--interactive`, `tf-card--pad-sm`) para a
superfície, `tf-badge` para o selo do canto, `tf-tnum` para todo número de dinheiro, `tf-input` +
`tf-inputwrap` na busca acima da lista e `tf-btn--ghost tf-btn--sm` no "Carregar mais". Nenhum primitivo
novo — o que falta aqui é estado, não componente.

## Perguntas em aberto para o dono
1. **O selecionado do Catálogo pinta o fundo?** Seu desenho marca só a borda `--accent`; o código também
   pinta `--accent-soft`, igual ao de Orçamentos. As duas telas devem dizer "escolhido" da mesma forma, ou o
   Catálogo é mais discreto de propósito?
2. **O cartão de Orçamentos levanta no hover?** Seu desenho diz que sim (`tf-card--interactive`); o código
   diz que não. Hoje as duas listas clicáveis do desktop se comportam diferente.
3. **`inverse`, `accent` e `ghost` ficam ou saem?** Não são usadas em nenhum dos 36 cartões do app. Se ficam,
   qual é o uso que justifica cada uma?
4. **O selo do canto superior direito do cartão do Catálogo** existe no seu desenho e não no código. Que
   informação ele carrega — o aviso de "desatualizada" / "somente leitura", ou outra coisa?
