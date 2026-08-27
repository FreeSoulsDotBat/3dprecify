# Densidade dos primitivos no desktop (≥1280px)

## O que desenhar

Uma **prancha de densidade**: como cada primitivo `tf-*` deve se comportar quando a janela passa de
1280px de largura. Não é uma tela — é a régua que as quatro abas redesenhadas do 018 (Catálogo, Kits,
Orçamentos, Conta) vão herdar. Quem "usa" essa peça é o vendedor sentado num monitor de 1920px com
mouse e teclado, na jornada inteira: preencher um custo, abrir uma ficha lateral, confirmar um diálogo,
ler um toast, trocar de seção num grupo segmentado. Hoje ele vê, a 1920px, exatamente o mesmo corpo que
o vendedor de celular vê a 390px.

## Por que este prompt existe

Foi inferido que **nada muda**. Medição: `grep -rn "@media" apps/web/src/shared/ui` devolve DUAS linhas
em toda a camada de primitivos — `switch.css:54` (`prefers-reduced-motion`) e `toast.css:15`
(`min-width: 768px`, que só reposiciona o toaster). Nenhum primitivo tem regra de largura. A autoridade é
`PROTOTIPO_PARCIAL` e o verificador foi explícito: o canvas do 018
(`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) **decide densidade por encaixe e inline** —
`tf-btn--sm` em uma dúzia de botões ("Sair", "Duplicar", "Excluir", "Remover peça"), `tf-card--pad-sm`
nos cartões laterais, `h1` forçado a `1.75rem`, preço a `2.25rem` e `1.5rem` — e o diretório
`design/assets/` **não existe**, então o `<link rel="stylesheet" href="assets/app.css">` da linha 12 é
morto: as classes `tf-*` do canvas não têm pele, e a aparência que o arquivo entrega vem só do inline.
Ou seja: **o dono nunca viu a densidade dos primitivos renderizada**. É essa a queixa que abriu o 018 —
os quadros novos estão desenhados, as peças dentro deles seguem com corpo de celular.

## O que já existe hoje (não invente do zero — corrija)

Valores medidos no código (`apps/web/src/shared/ui/*.css` + `styles/tokens/spacing.css`,
`styles/tokens/typography.css`). Tudo abaixo vale **igual em 390px e em 1920px**:

| Peça | Hoje (valor único, sem faixa de viewport) | |
|---|---|---|
| `tf-btn` | altura 48px, padding lateral 20px, texto 16px, piso `min-width/min-height: 44px` | → a 1920 é um botão de polegar |
| `tf-btn--sm` / `--lg` | 36px / 56px; padding 16px / 28px; texto 14px / 18px | → o canvas usa `--sm` em quase tudo: **sinal de que o padrão está grande demais no desktop** |
| `tf-card` | padding 20px (`--space-5`); `--pad-sm` 16px; `--pad-lg` 28px | → cartão lateral fica apertado, cartão de lista fica gordo |
| `tf-inputwrap` | altura 48px, padding lateral 16px, `min-width: 8rem` (128px) | → o piso de 128px foi calibrado para grade 2-col de celular |
| `.tf-field__label` | **reserva de DUAS linhas** (`min-height: calc(2 * 1.2 * 1em)` a 13px ≈ 31px) | → o comentário no código diz por quê: alinhar grades de 2 colunas. **É um problema de celular ocupando ~15px de vazio por campo, em toda linha do desktop** |
| `.tf-field__hint` / `__error` | 12px | → legenda de 12px a 1920px é ilegível a distância de monitor |
| `tf-dialog` (modal) | `width: min(92vw, 32rem)` = teto 512px, padding 24px, `max-height: 85vh` | → 512px num quadro de 1920px |
| `tf-dialog--sheet-right/left` | `width: min(92vw, 26rem)` = teto **416px**, padding 20px | → a ficha do 018 tem **560px**; a folha não alcança |
| `tf-dialog__title` | 22px, caixa alta, `padding-right: 40px` (espaço do X) | |
| `tf-dialog__x` | 44×44px, a 12px do topo/direita | |
| `tf-empty` | `max-width: 28rem` (448px), padding 40/20, ícone 56×56, título 22px, texto 14px | → 448px centralizado dentro de uma coluna de **1720px** |
| `tf-toaster` | `min(92vw, 30rem)` = 480px; a ≥768px vai para o canto inferior direito (24px) | → única regra responsiva que existe; o corte é 768, não 1280 |
| `tf-toast` | padding 12/12/12/16, mensagem 14px, fechar 44×44 | |
| `tf-segmented__item` | `min-height: 44px`, padding 8/16; `--sm` 12px, padding 8/12; `--md` 14px; ícone 16px | → a bandeja rola na horizontal quando não cabe (correto, mantenha) |
| Coluna da página | `--content-max` 1120px; a ≥1280 vira `--content-max-wide` **1720px**; sidebar 240px, rail recolhido 76px; gutter 16px no mobile, **32px** no desktop | ✔ isto **já** tem faixa de viewport — só o miolo não tem |

## Conteúdo e dados reais

- Escala de espaço disponível (não invente outra): 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56 · 64px.
- Alturas de controle existentes: **36 / 48 / 56px**, e o piso de toque **44px**.
- Escala tipográfica existente: 12 · 13 · 14 · 16 · 18 · 22 · 28 · 36 · 48px; preço a
  `clamp(2.5rem, 9vw, 3.75rem)` (a 1920px bate o teto de 60px), `tf-price--md` = 36px.
- Números de verdade para preencher os exemplos (são os valores da semente do app, não invente outros):
  preço sugerido **R$ 24,24**, custo **R$ 16,16**, alternativa **R$ 21,01**. Um caso adversarial
  obrigatório: **R$ 1.234.567,89** dentro do mesmo componente.
- Rótulo longo real para testar a reserva de duas linhas: **"Reserva de manutenção"** (é o exemplo
  citado no próprio comentário do código) e **"Tarifa de energia"** (o campo com prefixo de moeda **e**
  sufixo de unidade ao mesmo tempo — o pior caso já medido).
- Grupo segmentado real do 018: as seções do Catálogo — **Filamentos · Impressoras · Produtos · Kits**.

## Estados obrigatórios

Desenhe cada estado **na densidade nova**, não só em repouso:

- **Repouso** — botão, campo, cartão, pílula.
- **Hover** (só existe no desktop, e é aqui que ele estreia de verdade): `tf-btn--secondary` muda a
  borda para `--border-strong`; `tf-card--interactive` sobe 2px e ganha sombra média; `tf-inputwrap`
  troca a borda; a pílula não selecionada clareia o texto.
- **Foco visível** — anel `--ring` no botão/campo; na pílula selecionada é **outline** de 2px com offset
  2px (troca de fundo sumiria justamente no item já destacado).
- **Pressionado** — `scale(0.97)` no botão; `tf-card--interactive` volta a `translateY(0)`.
- **Desabilitado** — opacidade 0,55 no botão, cursor `not-allowed`; campo desabilitado ganha fundo
  `--bg-muted` e opacidade 0,6.
- **Carregando** — `tf-btn--loading` (cursor `progress` + spinner na cor do texto).
- **Erro no campo** — borda `--danger` que **permanece vermelha com foco dentro** (o anel vira vermelho,
  não roxo) + linha de erro em `--danger-text`, 12px.
- **Aviso de plausibilidade** — é um estado SEPARADO do erro: tom `--info-text`, dentro do hint. O
  número não foi recusado; pintar de vermelho diria o contrário do que a frase diz.
- **Vazio** — `tf-empty` com ícone, título 22px e ação; mostre-o **dentro da coluna larga**, que é onde
  o problema aparece.
- **Toast** nos três tons (info/sucesso/erro) na posição de desktop (canto inferior direito).
- **Pílula selecionada** — fundo `--surface-raised` + `--shadow-xs`. Não use `--surface-card`: no tema
  escuro ele é o mesmo `#14151a` da bandeja (contraste medido **1,00:1** — a pílula não existia na
  tela). Isso já foi pago no review do PR #58.

## Viewports

- **1920px** — a prancha principal. É a largura em que o dono julgou o desktop errado.
- **1280px** — o corte. Acima dele o app é estruturalmente outro (mestre-detalhe, rail recolhível); a
  densidade nova só pode existir a partir daqui.
- **1279px** — desenhe o par de fronteira ao lado do 1280 para provar que a troca não quebra nada.
- **390px** — obrigatório, e **idêntico ao que existe hoje**. O mobile não se mexe; a prancha do 390
  serve de prova visual disso, não de proposta.

## Regras que o desenho não pode quebrar

- **O mobile não muda.** Toda decisão desta prancha nasce acima de 1280px. Se um valor novo também
  melhora o celular, isso é assunto de outro prompt.
- **A escala é fechada.** Use apenas os degraus de espaço e de tipo que já existem; densidade nova é
  escolher outro degrau, nunca inventar 22px de padding.
- **Contraste medido contra o fundo real** — a pílula dentro de um cartão dentro de uma bandeja são três
  superfícies empilhadas; foi exatamente esse empilhamento que produziu 1,00:1 na Conta.
- **Estado nunca só por cor** (WCAG 1.4.1) e indicador de estado nunca abaixo de 3:1 (1.4.11): a seleção
  precisa de relevo, não só de matiz.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega número; aviso, degradação e
  procedência moram em elemento de largura cheia.
- **Nada de transbordo horizontal de página.** Um contêiner que se declara rolável (a bandeja
  segmentada) pode rolar; a página não.

## Armadilhas já pagas neste projeto

- **Cortar altura por corte de viewport quebra o alvo de toque.** Existe laptop com tela sensível a
  toque acima de 1280px; o piso de 44px não é decoração. Ver "Perguntas em aberto".
- **Diminuir `min-width` do campo derruba a grade.** O piso de 128px do `tf-inputwrap` existe porque o
  input carrega `min-width: 0` e nada segurava o invólucro; o pior caso (prefixo de moeda + sufixo de
  unidade) já estourou o viewport uma vez e teve de virar grade que reflui.
- **Valor grande estoura a coluna** — R$ 1.234.567,89 num `tf-price` ou numa célula de tabela; isso não
  aparece em teste de texto, só na imagem.
- **Texto ocluso passa em teste.** Oclusão não é propriedade de texto: se o desenho encolher o padding e
  a legenda encostar no botão, nenhuma asserção existente acusa. Marque as folgas com medida.
- **O canvas do 018 não renderizou os `tf-*`** (a folha `assets/app.css` não existe). Não trate a
  aparência daquele arquivo como aprovação de densidade — trate como intenção a ser desenhada agora.

## Entregável

Pranchetas, **tema escuro como padrão e tema claro como first-class** (as duas versões de cada uma):

1. **Régua de controles** — `tf-btn` nas quatro variantes (primary/secondary/ghost/danger-ghost) e nos
   três tamanhos, com a altura escolhida cotada em px, lado a lado com o valor de hoje.
2. **Régua de formulário** — `tf-field` + `tf-inputwrap` numa grade de 2 colunas com "Reserva de
   manutenção" e "Tarifa de energia", mostrando o que acontece à reserva de duas linhas do rótulo.
3. **Superfícies** — `tf-card` nos três paddings, dentro da coluna de 1720px, com a lista mestre à
   esquerda e a ficha à direita.
4. **Camadas flutuantes** — `tf-dialog` modal e `tf-dialog--sheet-right` (a folha que edita filamento e
   impressora no desktop), com a largura cotada.
5. **Vazio e feedback** — `tf-empty` dentro da coluna larga, `tf-toast` nos três tons no canto inferior
   direito, `tf-segmented` com Filamentos · Impressoras · Produtos · Kits.

Reutilize os primitivos existentes — nenhum componente novo. O que muda é o **corpo** deles acima de
1280px, e cada mudança vem com o número em px anotado na prancha para virar token direto.

## Perguntas em aberto para o dono

1. **O piso de 44px cai no desktop?** O verificador observa que alvo de ponteiro não precisa de 44px,
   mas o app é PWA e roda em laptop com tela sensível a toque. Manter 44 acima de 1280, ou baixar (e
   para quanto)?
2. **A altura padrão de controle a ≥1280 é 48px, 44px ou 40px?** O canvas usa `tf-btn--sm` (36px) em
   quase tudo — isso é a resposta pretendida, ou só o que coube naquele encaixe?
3. **A reserva de duas linhas do rótulo morre no desktop?** Ela existe para alinhar grade de 2 colunas
   no celular; acima de 1280 há largura para o rótulo em uma linha só.
4. **A folha lateral vai a 560px** (a medida da ficha do 018) ou fica no teto atual de 416px? Hoje as
   duas medidas se contradizem.
5. **O estado vazio segue centralizado em 448px** dentro de 1720px, ou passa a ocupar a coluna da lista?
6. **O toaster continua trocando de posição a 768px**, ou o corte dele também passa para 1280?
