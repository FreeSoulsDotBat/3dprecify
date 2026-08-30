# Carregando — o anel que substituiu o esqueleto

## O que desenhar
O estado de espera do Precifica3D: o que o vendedor vê entre pedir uma tela e ela existir. Hoje isso é
sempre a mesma coisa — um anel girando, sozinho, centralizado, no lugar de todo o conteúdo — e aparece em
nove pontos da jornada: ao abrir o Catálogo, ao abrir Kits, ao abrir Orçamentos (duas vezes: o gate do
plano e a lista sob os filtros), ao abrir um orçamento salvo, ao editar um produto, ao abrir a Conta, ao
abrir a gaveta de Simulações e ao voltar do Mercado Pago depois de pagar. Quem usa é o vendedor de peças
3D, quase sempre nos primeiros 1–3 segundos de cada tela premium, muitas vezes com internet ruim. Desenhe
o sistema de espera inteiro: o esqueleto de lista e de detalhe, a espera com rótulo, o anel como peça
residual e a transição para conteúdo / vazio / erro.

## Por que este prompt existe
O protótipo desenhou o esqueleto e o app construiu outra coisa. `CatalogScreen.jsx:42-49` monta três linhas
de esqueleto no formato exato da lista real (círculo 36×36 + duas linhas de texto, 55% e 35%, com
divisórias); a §D.2 pede "Skeleton — placeholders de loading (linhas/cards) com shimmer discreto
respeitando reduced-motion"; a rodada V3 registra "#14 Demo: carregando — skeleton visível no escuro
(1,79:1), reduced-motion honrado" como CORRIGIDO E MEDIDO. Nada disso foi construído: `Skeleton` e
`ProgressBar` têm ZERO ocorrências no app, inclusive em CSS. **Para Catálogo e Orçamentos o desenho existe
e foi ignorado — isto aqui é uma correção, não uma criação.** Para Conta, Kits, Produto, Simulações e
retorno de checkout não há desenho de carregamento em autoridade nenhuma: essas cinco esperas nunca foram
desenhadas por ninguém.

## O que já existe hoje (não invente do zero — corrija)

O único componente de espera do app é o anel (`shared/ui/spinner.tsx` + `spinner.css`):

| Propriedade | Valor real hoje |
| --- | --- |
| Tamanhos | `sm` 15px · `md` 20px (padrão) · `lg` 28px |
| Espessura do anel | 2px (`sm`/`md`), 3px (`lg`) |
| Cor | `--accent`; trilha = a mesma cor a 28% de opacidade, só o topo do anel é sólido |
| Giro | 0,7s, linear, infinito; `prefers-reduced-motion` global neutraliza |
| Rótulo | `"Carregando…"` — **visualmente oculto**, só o leitor de tela ouve |
| Papel | `role="status"` |

Os nove pontos, com o que cada um mostra hoje:

| Onde | O que aparece | → Problema |
| --- | --- | --- |
| Catálogo (lista de filamentos/impressoras/produtos) | anel centralizado, `py-8` | → mudo; e a ≥1280px **colapsa o mestre-detalhe inteiro** (lista + ficha) num ponto |
| Kits — gate do plano | anel + `"Verificando seu plano…"` | ok: é o único com frase e cabeçalho preservados |
| Orçamentos — gate do plano | anel centralizado | → mesmo gate do Kits, mas **sem** a frase |
| Orçamentos — lista, sob a barra de filtros | anel centralizado | → a lista some, a página encolhe e volta a crescer |
| Orçamento salvo (detalhe) | anel centralizado | → a página inteira vira um ponto |
| Produto (edição) | anel centralizado | → depois vira "não encontrado" ou o formulário: dois saltos |
| Conta — cartão de identidade | anel dentro de um `Card` | ok-ish: é o único que preserva forma |
| Simulações (gaveta lateral) | anel centralizado | → mudo |
| Retorno do checkout | `Card` com anel + `"Confirmando seu pagamento…"` + corpo + 2 botões | ok: espera com forma e saída |

→ Sete das nove esperas são **um ponto girando mudo**. → Nenhuma preserva a altura do conteúdo que vem:
a página encolhe para ~64px e salta para a lista cheia. → O botão em carregamento (`tf-btn` com `loading`)
já faz certo: anel `sm` inline, rótulo mantido, `aria-busy`, interação bloqueada — é o padrão a estender.

## Conteúdo e dados reais
Frases pt-BR que **já existem e são homologadas** (use estas, não invente sinônimos):

- `"Verificando seu plano…"` — gate premium (Kits e Orçamentos).
- `"Verificando sessão…"` — arranque do app, antes de saber quem está logado.
- `"Confirmando seu pagamento…"` + `"Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada."` + botões `"Atualizar"` e `"Voltar para a Conta"`.
- `"Carregando…"` — hoje só para leitor de tela.
- Erro frio, por superfície: `"Não foi possível carregar seu catálogo."` · `"Não foi possível carregar seus orçamentos."` · `"Não foi possível carregar suas simulações."` · `"Não foi possível carregar seus itens salvos agora."` · `"Não foi possível carregar sua conta"` — todas com o botão `"Tentar novamente"`.

Formas reais que o esqueleto precisa imitar: linha de catálogo = avatar/ícone redondo 36px + nome (ex.:
"PLA Preto 1kg") + resumo em texto menor (ex.: "R$ 89,90 · 1000 g"); linha de orçamento = nome do produto
+ data + preço `R$ 24,24`; detalhe de orçamento = cabeçalho, selo de procedência, bloco de preço grande e
uma pilha de linhas de composição de custo. Use "…" (reticência única), como o app já usa.

## Estados obrigatórios
1. **Carregando — lista** (o principal): três linhas de esqueleto no formato real, dentro do cartão, com as
   divisórias da lista verdadeira. Altura igual à da lista que vai chegar.
2. **Carregando — detalhe**: blocos de esqueleto no formato da ficha (cabeçalho, bloco de preço, 4 linhas).
3. **Carregando com rótulo** (gate/sessão/pagamento): frase visível, nunca só o anel. `"Verificando seu plano…"`.
4. **Carregando dentro do botão**: anel `sm` + rótulo original, botão desabilitado.
5. **Anel** nos três tamanhos, com trilha e ponta visíveis nos dois temas.
6. **Movimento reduzido**: shimmer e giro parados — desenhe o equivalente estático (o esqueleto continua
   legível, o anel vira arco fixo ou ponto pulsante desligado). Não pode virar um retângulo invisível.
7. **Erro frio** (o que vem depois quando falha): `Alert` de perigo com a frase da superfície + `"Tentar novamente"`.
8. **Vazio** (o que vem depois quando não há nada): `EmptyState` com ícone, título e ação.
9. **Offline com dados em cache**: NÃO é carregando — a lista aparece com a legenda de procedência. Mostre
   que o esqueleto não pode aparecer por cima de dados que o vendedor já tem.
10. **Premium pausado**: o gate resolveu e é `lapsed` — o esqueleto sai e entra o teaser/aviso. O que não
    pode existir é o caminho "não respondeu → mostro teaser".

## Viewports
- **Mobile 390px** — obrigatório: todas as nove esperas existem no mobile, e é onde a internet é pior.
  Verifique também 360px na prancheta do cartão de erro da Conta (ver armadilhas).
- **Desktop 1280px** — obrigatório: é o corte do mestre-detalhe (018). Precisa mostrar como a espera se
  comporta com dois painéis: hoje ela apaga os dois. Desenhe o esqueleto de lista à esquerda e o que o
  painel da ficha mostra à direita.
- 1920px opcional, só se o esqueleto de lista mudar de contagem de linhas em tela alta.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como "não premium".** Enquanto o plano não respondeu, a tela diz que está
  verificando — nunca oferece assinatura, nunca sugere que o acesso acabou.
- **Nada promete sucesso.** No retorno do checkout a espera é "confirmando", nunca "processado"/"ativado".
- **Frase honesta nunca em placeholder** nem cortada: as frases de espera vivem em elemento de largura
  cheia, fora de campo de formulário.
- **Procedência sobrevive à espera**: quando os dados chegam de cache offline, a legenda de origem aparece
  junto com o conteúdo — o esqueleto não pode "limpar" essa marca.
- **Alvo ≥44px** em `"Tentar novamente"`, `"Atualizar"` e `"Voltar para a Conta"`.
- **Contraste medido contra o fundo real**, nos dois temas: o esqueleto no escuro foi medido em 1,79:1 no
  protótipo — mantenha-o visível sem virar um bloco chapado que parece conteúdo pronto.
- **O esqueleto não pode ser confundível com dado**: nada de números ou textos falsos dentro dele.

## Armadilhas já pagas neste projeto
- **O colapso e o salto**: a página encolhe para um ponto e cresce de volta. O esqueleto tem de ocupar a
  altura da lista real — desenhe a altura, não só a forma.
- **`toBeVisible` passa em qualquer coisa**: um anel sozinho satisfaz todo teste automatizado; foi
  exatamente assim que este estado atravessou nove telas sem ninguém notar. O desenho precisa ser
  verificável por imagem, com medidas.
- **Overflow a 360px**: o cartão de identidade da Conta já pariu o botão "Tentar novamente" fora do cartão
  E da viewport (right 378,5 > 360) porque o erro herdou uma linha flex feita para avatar+texto. O estado de
  erro que sucede a espera precisa de pilha própria.
- **Placeholder que corta a frase** (016): frase de espera nunca dentro de um campo.
- **Reduced-motion honrado no protótipo e nunca reconstruído**: se o desenho não entregar a variante
  parada, ela some de novo na implementação.

## Entregável
Pranchetas, tema escuro primeiro e tema claro como par de primeira classe para cada uma:

1. **Anatomia do anel** — `sm`/`md`/`lg`, trilha + ponta, nos dois temas, com a variante de movimento reduzido.
2. **Skeleton de lista — Catálogo**, 390px e 1280px (mestre-detalhe: esqueleto à esquerda + painel da ficha à direita).
3. **Skeleton de detalhe — orçamento salvo**, 390px e 1280px.
4. **Espera com rótulo — gate premium**, com o cabeçalho da página preservado e `"Verificando seu plano…"`.
5. **Cartão de retorno do checkout**, com as frases literais e os dois botões.
6. **Cartão de identidade da Conta**: carregando → carregado → erro (o trio, a 360px).
7. **Sequência de transição**: carregando → conteúdo · carregando → vazio · carregando → erro, na mesma
   caixa, mostrando que a altura não pula.

Reutilize os primitivos existentes e nomeie-os: `tf-card` (o contêiner de toda espera com forma),
`tf-btn` com estado `loading` (anel `sm` + rótulo), `tf-alert` tom perigo (erro frio), `tf-empty-state`
(vazio), `tf-page-header` (o cabeçalho que a espera não pode apagar), `tf-spinner` (só onde não há forma
conhecida). **Um único primitivo novo é esperado: `tf-skeleton`**, com variantes `text` (largura em %),
`circle` (36px) e `rect` (blocos de detalhe) — especifique cor de repouso, shimmer e a variante parada.
Nenhum outro componente novo.

## Perguntas em aberto para o dono
1. O esqueleto substitui o anel em **todas** as listas, ou o anel fica como padrão para esperas sem forma
   conhecida (gate de plano, verificação de sessão, retorno do checkout)?
2. As sete esperas mudas ganham **rótulo visível**? Se sim, qual frase para Catálogo, Orçamentos e
   Simulações — hoje só o leitor de tela ouve "Carregando…".
3. Existe **limiar de tempo**? Depois de N segundos a espera muda de aparência ou ganha uma frase do tipo
   "está demorando mais que o normal"? Nenhuma regra desse tipo está escrita em lugar nenhum.
4. No mestre-detalhe (≥1280px), durante a carga o painel da ficha mostra esqueleto também ou fica vazio
   com uma frase de instrução?
5. **Recarregamento** de dados já em tela (o vendedor puxa para atualizar, ou o app revalida): sinal
   discreto no topo, ou nada? Hoje o estado de carregando cobre só a primeira carga, e o silêncio na
   revalidação nunca foi decidido.
