# Barra de abas inferior do mobile — as 5 seções

## O que desenhar
A barra fixa no rodapé do app no celular: cinco seções (Calcular · Catálogo · Kits · Orçamentos · Conta)
que são a navegação principal do produto inteiro. Ela está presente em TODAS as telas do mobile, sobre o
conteúdo, e é o elemento que o vendedor toca dezenas de vezes por dia — é por ela que ele sai de um
orçamento e vai ver o catálogo de filamentos, e volta. Vive colada no fundo da janela (`position: fixed`),
respeitando a área segura do iPhone; o conteúdo da página reserva altura embaixo para nunca ficar
escondido atrás dela. Existe SÓ no mobile: acima de 425px de largura o app troca para um menu lateral, que
já tem desenho próprio no canvas do 018.

## Por que este prompt existe
O único desenho que existe dessa barra (protótipo de 2026-07-02, §D.2 e §E3) fixa **quatro** seções —
"Calcular · Catálogo · Histórico · Conta", altura 64px, ícone 24 + rótulo caption, alvo ≥44px, e o ativo
marcado **por COR (roxo `--accent`)**. O produto de hoje tem **cinco** células (Kits entrou em 008/K1, uma
mudança de IA aprovada pelo dono depois do protótipo) e o rótulo "Histórico" virou **"Orçamentos"**
(016/US2) — um rótulo 43% mais longo, na barra que ficou 25% mais cheia. Ninguém desenhou o resultado.
Além disso o código **contraria o protótipo em dois pontos**: o ativo ganhou uma pílula roxa de 28×3px
colada no topo da célula (o desenho pedia cor, não pílula) e o ícone encolheu para 22px sem que nada
autorizasse. E não existe nenhuma regra sobre o que acontece quando cinco rótulos com `white-space: nowrap`
não couberem — em 360px cada célula tem ~72px.

## O que já existe hoje (não invente do zero — corrija)
Barra `.tf-nav--tabbar`: fixa no rodapé, fundo `--surface-card`, borda superior 1px `--border-subtle`,
altura `--tabbar-h` = **64px**, mais `env(safe-area-inset-bottom)` embaixo. A lista é flex e cada célula é
`flex: 1 1 0` — **larguras rigorosamente iguais**, independentemente do tamanho do rótulo.

| Ordem | Rótulo literal (pt-BR) | Ícone (22px) | Rota |
|---|---|---|---|
| 1 | "Calcular" | calculadora | `/calcular` |
| 2 | "Catálogo" | caixa/pacote | `/catalogo` |
| 3 | "Kits" | caixas empilhadas | `/kits` |
| 4 | "Orçamentos" | histórico (relógio com seta) | `/historico` |
| 5 | "Conta" | pessoa em círculo | `/conta` |

- O landmark se anuncia como "Navegação principal"; o item ativo é anunciado como página atual.
- Dentro da célula: ícone em cima, rótulo embaixo, `gap: 2px`, padding `--space-1`, rótulo em
  `--fs-caption` (12px) com **`white-space: nowrap`**.
- Ativo = cor `--accent-text` + peso semibold + **pílula 28×3px `--accent`, raio pill, no topo da célula**.
- Foco de teclado = fundo `--accent-soft` + **anel INTERNO** (`inset`, `--focus-ring`), nunca a caixa de
  contorno externa — e o anel interno existe justamente porque, no item que JÁ está ativo, um fundo suave
  sozinho não mudava nada ao receber foco (reprovava WCAG 2.4.7). Essa distinção precisa sobreviver ao
  desenho.
- → **Problema 1:** em 360px sobram ~72px por célula e "Orçamentos" em 12px pede ~76–80px. Com `nowrap` e
  sem nenhuma regra de truncar/abreviar/reduzir, o rótulo mais importante da barra é o que corre risco de
  encostar no vizinho ou vazar da célula. É a decisão central deste desenho.
- → **Problema 2:** não existe estado de **pressionado** nem de **hover** no tabbar (o CSS só define hover
  no botão de recolher, que é do desktop). No celular, o toque não tem retorno visual nenhum.
- → **Problema 3:** a pílula superior e o ícone de 22px contrariam a única autoridade de desenho existente
  (cor + 24px). Decida conscientemente, não por inércia.

## Conteúdo e dados reais
- Os cinco rótulos são **texto homologado**: "Calcular", "Catálogo", "Kits", "Orçamentos", "Conta". Não
  reescreva nem traduza. "Orçamentos" substituiu "Histórico" de propósito, porque o par
  Histórico/Cenários não comunicava a diferença entre preço congelado e preço recalculado hoje.
- A barra não exibe número nenhum: sem contadores, sem valores, sem badges hoje.
- Nenhuma seção é bloqueada pela barra. Kits e Orçamentos são áreas Premium, mas o usuário gratuito
  **navega** até elas e encontra lá dentro o convite honesto — a barra nunca desabilita, nunca põe
  cadeado, nunca esconde uma aba.
- Tamanho mínimo de alvo: 44×44px (`--touch-min`), medido por célula.
- Vizinhos que disputam o mesmo rodapé e precisam aparecer nas pranchetas de contexto: os toasts sobem
  para 64px + `--space-3` acima do chão, e as barras fixas de resumo (ex.: o total do kit) param em
  64px + `--space-2` + área segura. Já houve um defeito real de um total de kit parado a 8px do chão, ou
  seja, 56px DENTRO da barra, com os dígitos cortados.

## Estados obrigatórios
1. **Repouso** — ícone + rótulo em `--text-muted`, peso medium.
2. **Ativo (seção atual)** — roxo + peso semibold + o marcador que você decidir (pílula ou só cor).
   Desenhe pelo menos uma prancheta com "Orçamentos" ativo, que é o rótulo mais longo e o que a barra
   mais sofre.
3. **Foco de teclado** — anel interno acompanhando o raio do item, distinguível **mesmo sobre o item já
   ativo**. Mostre os dois: foco no inativo e foco no ativo.
4. **Pressionado / toque** — não existe hoje; proponha um (não pode ser só a mudança de cor do ativo,
   porque o toque acontece antes da rota trocar).
5. **Rótulo apertado** — a prancheta de 360px com os cinco rótulos, mostrando explicitamente sua regra
   (truncar? reduzir? abreviar? só ícone no inativo?).
6. **Área segura do iPhone** — a mesma barra com a faixa do indicador de home embaixo: o rótulo não pode
   ficar tangenciando a borda inferior.
7. **Tema claro e tema escuro** — os dois são primeira classe; o contraste do `--text-muted` sobre
   `--surface-card` precisa ser medido nos dois.
8. **Não existem** aqui: carregando, vazio, erro, desabilitado. A navegação é sempre a mesma e sempre
   navegável — se você desenhar um desses, está inventando estado que o produto não tem.
9. **Offline / sessão expirada** — hoje a barra **não muda**; quem avisa é uma faixa no TOPO da tela. Se o
   seu desenho quiser tocar nisso, é pergunta para o dono (abaixo), não decisão sua.

## Viewports
- **360px** — obrigatório, é a largura em que a conta não fecha (~72px por célula) e onde a regra do
  rótulo longo se prova ou se quebra.
- **390px** — a referência principal do projeto (~78px por célula).
- **425px** — o último pixel em que a barra existe: em 426px o app troca para o menu lateral. Vale uma
  prancheta para mostrar que a barra não fica ridícula esparramada.
- **Sem desktop.** Acima de 425px esta peça não é montada — o menu lateral (e o rail recolhido de 76px)
  são outra peça, já desenhada no canvas do 018.

## Regras que o desenho não pode quebrar
- Alvo de toque ≥44×44px em cada uma das cinco células, inclusive em 360px.
- A barra nunca gera rolagem horizontal: em 360px a soma das cinco células mais bordas é exatamente a
  largura da janela, nem 1px a mais.
- Nenhum rótulo pode ser cortado no meio de forma silenciosa. Se a decisão for truncar, o truncamento
  precisa ser visível e legível ("Orçamen…" é honesto; um "Orçament" cortado pela borda não é).
- A barra nunca vende bloqueio: nada de cadeado ou aba apagada em cima de área Premium — a honestidade
  freemium acontece dentro da página, com o convite completo.
- O indicador de foco precisa ser diferente do indicador de ativo, inclusive quando estão no mesmo item.
- Contraste medido contra `--surface-card` real de cada tema, não contra o fundo da página.
- O conteúdo por baixo continua reservando exatamente a altura da barra + área segura; se você mudar a
  altura, diga o número novo com todas as letras, porque três outros elementos se ancoram nele.

## Armadilhas já pagas neste projeto
- **Texto que passa em teste e não aparece na tela.** Asserções de texto são cegas a oclusão e a
  transbordo — dois rótulos encostados passam em todo teste automatizado. Aqui só a imagem decide.
- **Transbordo medido nos DOIS eixos.** Uma barra de rolagem clássica não existe em headless; já
  perdemos uma homologação por medir só um eixo.
- **Elemento fixo comendo o conteúdo.** O total do kit já parou dentro desta barra (56px de sobreposição)
  com os dígitos cortados. Qualquer mudança de altura reabre esse risco.
- **Frase honesta em espaço apertado.** Copy homologada não cabe em elemento estreito — aqui isso vira:
  não resolva o aperto de "Orçamentos" trocando o rótulo por conta própria.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro**, para 360px, 390px e 425px:
1. A barra em repouso com "Calcular" ativo.
2. A barra com **"Orçamentos" ativo** em 360px — a prancheta que prova a regra do rótulo longo.
3. Detalhe ampliado de uma célula nos quatro estados: repouso, ativo, foco de teclado, pressionado.
4. Uma prancheta de contexto: a barra com um toast acima dela e com a faixa de área segura do iPhone.
5. Se propuser truncar/abreviar/reduzir, mostre a alternativa descartada lado a lado, para o dono
   escolher vendo.

Reutilize os primitivos existentes: a barra é `tf-nav` na variante tabbar, cada célula é um
`tf-nav__item` com `tf-nav__icon` (ícone do conjunto do DS) e `tf-nav__label`; cor de ativo pelo token
semântico de acento, foco pelo token de anel. **Não crie primitivo novo** — se precisar de algo que não
existe, diga qual é e por quê, em vez de desenhar um componente paralelo.

## Perguntas em aberto para o dono
1. **Quando "Orçamentos" não couber em 360px, o que acontece?** Truncar com reticências, abreviar com uma
   palavra curta homologada, reduzir a fonte abaixo de 12px, ou aceitar só-ícone nos inativos? Se a
   resposta for abreviar, qual é a palavra — "Orçam.", "Preços", outra? É copy, e copy é sua.
2. **A pílula do ativo fica ou o ativo volta a ser só cor**, como o protótipo de 2026-07-02 mandava?
3. **A barra deve sinalizar estado do app** (offline, orçamento na fila do outbox, Premium pausado) com
   um pontinho sobre o ícone, ou isso continua exclusivamente na faixa do topo?
4. **Kits continua sendo uma das cinco seções de topo para o usuário gratuito**, ou a IA de cinco itens
   deve ser reavaliada agora que os rótulos ficaram mais longos?
