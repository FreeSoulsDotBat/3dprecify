# Vincular uma peça do kit a um produto salvo — o seletor e o selo de origem

## O que desenhar
Dentro da aba **Kits** (`/kits`, "Monte seus kits"), cada peça do kit é um card recolhido que mostra
`Peça 1 · Vaso G` ou `Peça 2 (avulsa)`, a quantidade em `un` e o custo. Ao expandir ("Editar esta peça"),
o vendedor recebe a calculadora inteira daquela peça — e, no topo dela, o mecanismo desta prancheta: a
escolha entre digitar a peça na mão ou **apontá-la para um produto já salvo no catálogo**. É o que faz o
kit *referenciar* o catálogo em vez de duplicá-lo: uma peça vinculada e intocada é salva como referência
viva (muda o produto, muda o kit); uma peça vinculada e depois **editada** deixa de ser referência e vira
uma peça nova no catálogo. Desenhe o controle de vínculo, o selo que declara a origem da peça, e o
momento em que esse selo muda de sentido.

## Por que este prompt existe
O mecanismo nunca foi desenhado — foi inferido por IA a partir do requisito textual. O canvas 018 chega
perto: desenha um botão de rodapé **"Usar produto salvo"** que só aparece na peça NÃO vinculada, e o selo
de origem no **cabeçalho** da linha (`do catálogo: Vaso G` / `— Manual —`). Mas o que está no ar diverge
do desenhado: **não existe botão nenhum** — existe uma lista suspensa dentro do editor expandido, e a
legenda de origem mora lá dentro, não no cabeçalho. E três coisas não existem em artboard nenhum: **o que
o botão abriria** (não há prancheta de seletor), o estado **"ajustado por você"** (busca por `ajustado` no
`.dc.html`: zero ocorrências) e o caso de **zero produtos salvos**. Nada disso existe abaixo de 1280px.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/widgets/bom-line-editor/bom-line-editor.tsx` (o seletor + o selo),
`apps/web/src/features/bom/bom-line-card.tsx` (o cabeçalho da linha), textos em
`apps/web/src/shared/i18n/messages.pt-br.ts` (`messages.bom`).

| Elemento | Como está hoje | Observação |
|---|---|---|
| Rótulo do controle | `"Usar produto salvo"` | rótulo de campo (justo), acima da lista |
| Controle | lista suspensa nativa (`tf-select`), caret `▾` | → **problema**: sem busca, sem teto de itens |
| Primeira opção | `"— Manual —"` (valor vazio) | é o padrão; escolhê-la desvincula |
| Demais opções | um item por produto salvo, só o **nome** | ordem = a da API, sem agrupar, sem filtrar |
| Selo de origem (vinculado) | `"do catálogo: {nome}"` → `do catálogo: Vaso G` | legenda pequena, logo abaixo da lista |
| Selo após editar | `"do catálogo: {nome} · ajustado por você"` | → **nunca desenhado, em nenhuma largura** |
| Aviso de consequência | `"Você ajustou esta peça — ela será salva como uma peça nova no catálogo."` | aparece **fora** deste bloco, lá embaixo, junto do campo `Nome da peça no catálogo` |
| Cabeçalho da linha | `Peça 1 · Vaso G` / `Peça 2 (avulsa)` | → o cabeçalho **não** reflete o "ajustado por você" |
| Zero produtos salvos | o bloco inteiro **não é renderizado** | → **problema grave**: nenhuma pista de que a opção existe |
| Carregando / falha de leitura / cache offline | **nada** — a tela usa só a lista de itens e ignora os estados `isLoading`, `isError` e `stale` que o dado já traz | → carregando é indistinguível de "você não tem produtos" |

→ Consequência prática do último item: com rede lenta o bloco some e volta; e um vendedor com 40 produtos
salvos, offline, vê uma lista que pode estar desatualizada sem nenhum aviso.

## Conteúdo e dados reais
- Cada opção carrega **apenas** o nome do produto (ex.: `Vaso G`, `Suporte de celular`,
  `Peça 1 · Kit suporte + base`). Não há preço, foto, material nem data na opção — se o desenho quiser uma
  segunda linha por item (material, custo unitário), isso é decisão de produto (ver perguntas).
- Nomes longos e repetitivos são o caso comum, não a exceção: peças materializadas por um kit anterior
  nascem com o padrão `Peça {n} · {kit}`. Desenhe com `Peça 1 · Kit suporte + base`, não com "Vaso G".
- Ao vincular, os campos da peça são **pré-preenchidos com os valores atuais do produto** e continuam
  editáveis. Nenhum preço é copiado — o preço é sempre recalculado.
- Números vizinhos, para calibrar o entorno: `42 g`, `3 h 30 min`, custo unitário `R$ 21,84`,
  `Total da linha (3×) R$ 65,52`, quantidade `3 un`.
- A quantidade vizinha tem teto real (2.147.483.647) e já avisa acima dele — não é assunto desta peça, mas
  divide o mesmo card.

## Estados obrigatórios
1. **Manual (repouso, padrão)** — controle mostrando `— Manual —`, sem selo abaixo; o cabeçalho lê
   `Peça 2 (avulsa)`.
2. **Vinculado e intocado** — controle com o nome do produto; selo `do catálogo: Vaso G`. É a peça que será
   salva como **referência viva**.
3. **Vinculado e ajustado** — selo `do catálogo: Vaso G · ajustado por você`. O estado que nenhum artboard
   mostra e que muda o destino da peça: ela deixa de ser referência e vira peça nova no catálogo. A frase
   de consequência já existe: `"Você ajustou esta peça — ela será salva como uma peça nova no catálogo."` —
   decida no desenho onde ela deve viver (hoje mora longe do selo).
4. **Zero produtos salvos** — hoje: nada. Precisa de um estado que diga que a opção existe e o que fazer
   para tê-la.
5. **Carregando a lista** — leitura online em voo, sem cache. Tem que ser distinguível do estado 4.
6. **Falha ao ler a lista, sem cache** — erro honesto + "tentar de novo"; **nunca** apresentado como "você
   não tem produtos" e **nunca** como "isso é premium".
7. **Servindo do cache do aparelho (offline, ou leitura falhou com cache)** — a lista funciona, mas pode
   estar desatualizada, e isso precisa ser dito.
8. **Peça degradada** — o produto referenciado foi apagado depois do kit salvo: a linha reabre com os
   últimos valores conhecidos e mostra `"Os valores atuais foram mantidos e continuam editáveis."`. As
   palavras "removido/excluído" são proibidas. Revincular a outro produto retira essa legenda.
9. **Foco / hover / pressionado / desabilitado** do controle e de cada item escolhível.
10. **Muitos produtos** — desenhe com pelo menos 25 itens, para mostrar o que acontece quando a lista não
    cabe. É o ponto que motivou este prompt.

## Viewports
- **390px** — obrigatório: a peça existe no mobile e é lá que a lista sem busca dói mais (vira roda do
  sistema). Mostre também o selo de duas partes (`do catálogo: {nome} · ajustado por você`) com nome longo
  em coluna estreita.
- **1280px** — o corte em que Kits vira duas colunas: peças à esquerda (largura fluida), resumo fixo de
  480px à direita. Este bloco vive na coluna da esquerda.
- **1920px** — opcional, só se o comportamento do seletor mudar em relação a 1280px.

## Regras que o desenho não pode quebrar
- **Procedência do número dita, nunca escondida**: quem olha a peça precisa saber, sem clicar, se aqueles
  valores vieram do catálogo, do catálogo com ajuste, ou da mão do vendedor.
- **Nenhuma frase honesta dentro de placeholder** — placeholder some ao digitar e corta em campo estreito;
  legendas de origem e avisos ficam em elemento próprio, de largura cheia.
- **Falha de rede nunca vendida como falta de premium**, e nunca como lista vazia.
- **Degradação em tom calmo**, sem acusar o vendedor e sem afirmar remoção.
- Alvo tocável **≥44px** no controle e em cada item de lista.
- Contraste medido contra o fundo real: o bloco fica **dentro de um card**, não sobre o fundo da página —
  nos dois temas.
- O vínculo **não copia preço**: nada no desenho pode sugerir que um preço veio junto do produto.

## Armadilhas já pagas neste projeto
- **Lista de resultados que lê como um segundo campo preenchido** (014, visto só no screenshot): se o
  desenho propuser busca com resultados abaixo, o bloco de resultados precisa se distinguir de um campo — e
  a contagem precisa ser verdadeira. Dizer "8 encontrados" com 31 correspondências é mentira medida, já
  cometida aqui.
- **Texto ocluso passa em teste**: asserção de texto não enxerga elemento sobreposto ou estourado. Nome
  longo ao lado de `· ajustado por você` é exatamente esse caso — desenhe o corte.
- **Overflow horizontal medido em 360/390px** já custou bloqueador em outra tela deste app.
- **Sufixo cortado**: uma frase honesta pendurada no fim de outra string é a primeira coisa a sumir;
  considere separar `do catálogo: {nome}` e `ajustado por você` em dois elementos.
- **Estado ausente porque a condição não renderiza**: o bloco inteiro sumir quando não há produtos salvos é
  essa armadilha já materializada.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class)**:
1. O bloco de vínculo em repouso, vinculado e **ajustado por você**, a 390px e 1280px (6 quadros).
2. O seletor **aberto** com 25+ produtos — a proposta de como escolher numa lista que cresce sem teto.
   É a peça central deste prompt.
3. Os quatro estados de lista: vazia (sem produtos salvos), carregando, falha sem cache, cache offline.
4. A linha degradada (produto apagado depois do kit salvo).
5. Um quadro de anatomia mostrando onde o selo de origem deve viver — dentro do editor expandido (como
   está no ar) ou no cabeçalho da linha (como o canvas 018 desenhou) — e qual dos dois você recomenda,
   com o motivo escrito no quadro.

Reutilize os primitivos existentes: o card da peça é `tf-card`; o controle atual é `tf-select` dentro de
`tf-inputwrap`, com rótulo de campo justo; a quantidade vizinha usa `tf-inputwrap--sm` com afixo `un`; o
aviso de linha inválida usa `tf-alert--danger`; os botões do rodapé da peça são `tf-btn--ghost tf-btn--sm`;
números em `tf-tnum`. Se o seletor precisar de busca, reaproveite o desenho do seletor de categoria que já
existe neste app (campo de busca + lista de resultados + chip escolhido + "Limpar") em vez de criar um
padrão novo. Não crie primitivo novo sem dizer, no próprio quadro, por que nenhum dos existentes serve.

## Perguntas em aberto para o dono
1. **O vínculo é lista suspensa ou botão que abre um seletor com busca?** O canvas 018 desenhou o botão
   "Usar produto salvo"; o código tem a lista suspensa. Os dois não podem estar certos.
2. **A opção mostra só o nome, ou nome + segunda linha (material / custo unitário)?** Hoje é só o nome, e
   nomes como `Peça 1 · Kit suporte + base` se parecem demais entre si.
3. **Onde mora o selo de origem** — no cabeçalho da linha (visível com a peça recolhida) ou dentro do
   editor expandido (como está no ar)? Só o cabeçalho torna a origem visível sem abrir a peça.
4. **"Ajustado por você" deve aparecer também no cabeçalho recolhido**, junto de `Peça 1 · Vaso G`? É a
   informação que muda o destino da peça no salvamento.
5. **Sem nenhum produto salvo, o que o vendedor vê?** Nada (como hoje), um controle desabilitado com
   explicação, ou um convite para cadastrar um produto — e, nesse caso, para onde o convite leva?
6. **Desvincular ("— Manual —") mantém os valores preenchidos** — é o que o código faz hoje, em silêncio.
   Isso deve ser dito na tela?
