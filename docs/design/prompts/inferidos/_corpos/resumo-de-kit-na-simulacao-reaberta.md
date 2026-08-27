# Simulação de kit reaberta dentro de Calcular

## O que desenhar

O bloco somente-leitura que aparece no TOPO da aba **Calcular** quando o vendedor reabre uma simulação salva
cuja base de custo é um **kit** (várias peças). Uma simulação de kit não tem como preencher o formulário de
peça única que existe logo abaixo — então, em vez de hidratar campos, o produto mostra aqui o recálculo do
kit inteiro com os preços de hoje, por marketplace. Quem usa: vendedor Premium que salvou uma comparação de
canais em cima de um kit e voltou dias depois para ver quanto ele custa/rende agora. A peça vive entre a barra
de contexto "Simulação: {nome}" (com "Abrir origem", "Duplicar", "Fechar simulação") e o formulário da
calculadora. Origem no código: `features/calculator/kit-basis-summary.tsx`, montado por
`pages/calcular/calcular-page.tsx`.

## Por que este prompt existe

O dono DESENHOU um rollup de kit — no canvas 018, no aside da aba **Kits** — e é exatamente esse vocabulário
que falta aqui: card "Total do kit" com uma linha `tf-brow` de custo, `tf-price tf-price--accent tf-price--md`
para Varejo (2.25rem, inteiro/decimais separados), `tf-price` menor (1.5rem) para Atacado, um card "Preços por
canal (kit)" com linhas `tf-brow` (marketplace + `tf-brow__sub` + valor à direita) e o aviso de peças
excluídas como `tf-field__hint` DISCRETO. O canvas 018 exclui **Calcular** por escrito, e o bloco construído
não usa nada disso: tudo em 12px `text-muted`, sem hierarquia de preço, com um `Alert tone="info"` reciclando
uma frase de erro de outra tela. E o coração do achado nunca foi desenhado por ninguém: **um resumo
somente-leitura flutuando sobre um formulário órfão** — os campos da calculadora abaixo continuam com os
valores de antes da reabertura, sem relação com os preços exibidos em cima, e nada na tela diz isso.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual de cima para baixo, dentro de um único `Card padding="sm"`:

| # | Elemento | Texto literal hoje | Tipografia hoje |
|---|---|---|---|
| 1 | Título | `"Kit: {nome}"` (ex.: "Kit: Kit suporte + base") | 14px semibold, `--text-strong` |
| 2 | Legenda | `"Preços por canal do kit, recalculados com os preços de hoje."` | 12px `--text-muted` |
| 3 | Aviso de peças fora do total (só se houver) | `"Corrija os campos deste canal para ver os preços. (2)"` | `Alert tone="info"` |
| 4 | Bloco por marketplace | "Mercado Livre" / "Shopee" / "Amazon" / "Outro" / "—" | 14px medium |
| 5 | Preço varejo do canal | `"Varejo: R$ 24,24"` | 12px `--text-muted` |
| 6 | Preço atacado do canal | `"Atacado: R$ 16,16"` | 12px `--text-muted` |
| 7 | Fallback sem nenhuma linha válida | `"Confira os campos destacados para ver o preço."` | `Alert tone="info"` |

→ **Problema 1 (o principal):** nada aqui diz que os campos abaixo NÃO são esta simulação. O comentário no
código admite: os campos "ficam como estavam antes da reabertura".
→ **Problema 2:** o item 3 concatena a frase de erro de OUTRA tela (a linha de canal da calculadora) com um
número entre parênteses. O produto já tem a frase certa, usada na aba Kits:
`"{n} peça(s) fora do total — confira os avisos nas peças acima."`
→ **Problema 3:** o preço do kit — o número que o vendedor veio ver — está em 12px cinza, do mesmo tamanho da
legenda. Na aba Kits o mesmo dado é `PriceHero`/`tf-price--accent`.
→ **Problema 4:** o item 7 é um `Alert tone="info"` de tom errado (não é informação, é ausência de preço) e
usa a frase da calculadora de peça única. Existe frase honesta pronta: `"Sem preço ainda"` +
`"O preço do kit aparece assim que ao menos uma peça estiver completa e válida."`
→ **Problema 5:** custo total, líquido recebido e contagem de peças por canal existem no dado e não aparecem.

## Conteúdo e dados reais

Dados disponíveis no recálculo (todos já calculados, nada é somado na tela):

- **Custo total do kit** — dinheiro, ex.: `R$ 38,90`. Rótulo já existente: `"Custo total"`.
- **Preço varejo / atacado do kit** — dinheiro, ex.: `R$ 24,24` e `R$ 16,16`; um kit grande chega a
  `R$ 1.234,56` (cinco dígitos + centavos é caso NORMAL, não extremo).
- **Por marketplace** (lista, 1 a 4 hoje: Mercado Livre, Shopee, Amazon, Outro; quando o canal não tem
  marketplace o rótulo é `"Canal"`): preço de anúncio varejo, recebido líquido varejo, preço de anúncio
  atacado, recebido líquido atacado, `"{n} peça(s) somaram neste canal"` e, quando houver,
  `"{n} peça(s) sem preço neste canal — não entrou na soma."`; canal sem nenhuma contribuição:
  `"Nenhuma peça com preço neste canal."`
- **Peças excluídas** — inteiro ≥ 0; excluída = a peça não pôde ser calculada, nunca zerada em silêncio.
- **Campo aposentado** (documento salvo antes da versão 4.0.0 do modelo) — frase persistente, já homologada:
  `"O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo
  abaixo não o inclui."`
- **Nome da base** — o nome do kit no catálogo; pode ter até 120 caracteres, e precisa truncar em uma linha.
- Abaixo do bloco existe ainda o botão de congelar no histórico (`"Salvar no histórico"`), que congela ESTE
  rollup, não os campos da calculadora — o desenho precisa deixar visualmente claro a que ele pertence.

## Estados obrigatórios

1. **Repouso, kit inteiro válido** — título, custo total, par varejo/atacado com hierarquia de preço, e a
   lista por canal. Legenda de procedência: `"Preços por canal do kit, recalculados com os preços de hoje."`
   (nunca uma data).
2. **Parcial** — uma ou mais peças fora do total: caption discreta `"{n} peça(s) fora do total — confira os
   avisos nas peças acima."` O total continua visível e continua verdadeiro para as peças que entraram.
3. **Nenhuma peça válida** — sem preço nenhum: `"Sem preço ainda"` + `"O preço do kit aparece assim que ao
   menos uma peça estiver completa e válida."` Nunca três zeros.
4. **Canal sem contribuição** — `"Nenhuma peça com preço neste canal."` no lugar dos quatro valores.
5. **Documento antigo (degradado)** — a frase do campo aposentado, persistente enquanto a simulação estiver
   aberta (não é toast, não pisca).
6. **Formulário órfão** — o estado que hoje não existe e é o motivo deste prompt: como a peça declara que os
   campos abaixo não pertencem a esta simulação (ver Perguntas em aberto).
7. **Offline** — o recálculo é local e continua funcionando: `"Você está offline. O cálculo continua
   funcionando."` Escrever (renomear/duplicar/salvar) é que fica indisponível:
   `"Esta ação precisa de conexão."`
8. **Premium pausado** — a simulação ABRE e RECALCULA; só a escrita congela:
   `"Premium pausado — reative para renomear, duplicar, editar ou excluir."`
9. **Foco / hover / pressionado / desabilitado** nos alvos que existem ao redor do bloco: "Abrir origem",
   "Fechar simulação", "Salvar no histórico". Anel de foco visível sobre o fundo real do card.
10. **Nome muito longo** — 120 caracteres truncados em uma linha, sem empurrar nada para fora.

## Viewports

- **Mobile 390px** — é onde o vendedor mais reabre simulação; desenhe primeiro. Verifique também a régua de
  **360px**, que é a largura onde este projeto já mediu aperto de dinheiro.
- **Desktop 1280px** — a partir dessa largura o app tem a barra lateral recolhível do 018; mostre o bloco com
  a coluna larga (o rollup por canal pode virar colunas; o par de preço não pode se perder num card de 900px).
A peça existe nos dois; não há versão exclusiva de um deles.

## Regras que o desenho não pode quebrar

- **Procedência do número**: o preço é recálculo com o catálogo de hoje, e a frase que diz isso fica em
  elemento de largura inteira — nunca dentro de placeholder, nunca truncada.
- **Nunca um zero falso**: sem linha válida não existe "R$ 0,00"; existe ausência declarada.
- **Degradação dita, não escondida**: peça excluída e campo aposentado aparecem, com tom calmo — o discreto do
  canvas 018 (`tf-field__hint`), não um alarme.
- **Falha de rede nunca vendida como falta de Premium** e vice-versa: offline e Premium pausado têm frases
  próprias e ambos mantêm o recálculo funcionando.
- **Somente leitura de verdade**: nenhum campo editável nesta peça; editar as peças do kit acontece em
  "Abrir origem".
- **Alvo ≥ 44px** em qualquer coisa tocável; contraste medido contra o fundo real do card (o 12px `text-muted`
  de hoje sobre card escuro é justamente o que precisa ser revisto).

## Armadilhas já pagas neste projeto

- **Dinheiro de 5 dígitos em duas colunas a 360px**: a barra de total do kit já foi consertada por isso — duas
  colunas deixavam ~89px por valor e "R$ 1.234,56" não cabe em 89px em nenhuma tipografia. Uma coluna por
  linha devolveu ~216px ao número.
- **Rótulo longo trava o número**: "Preço atacado" (111px) não cabe onde "Atacado" cabe; use rótulos curtos no
  readout.
- **Frase honesta cortada**: honestidade mora em elemento de largura inteira; placeholder carrega só número.
- **Texto ocluso passa em teste**: sobreposição não é propriedade de texto — desenhe as caixas, não confie em
  "o texto está lá".
- **Sticky dentro de sticky**: se o resumo virar coluna fixa no desktop, quem fixa é a coluna, não o card.
- **Copy reciclada de outra tela** gerou este prompt; toda frase aqui fala de kit e de peça.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. Mobile 390px — kit inteiro válido (estado 1), com o formulário da calculadora visível abaixo para mostrar a
   relação entre as duas partes.
2. Mobile 390px — parcial (estado 2) + documento degradado (estado 5) na mesma prancheta.
3. Mobile 390px — sem preço ainda (estado 3) e canal sem contribuição (estado 4).
4. Mobile 360px — variação de estresse com `R$ 1.234,56` e nome de kit de 120 caracteres.
5. Desktop 1280px — kit válido, com a barra de contexto da simulação acima e o botão de histórico abaixo.
6. Estados de offline e Premium pausado (podem dividir uma prancheta).

Reutilize os primitivos existentes: `tf-card` para o contêiner; `tf-price tf-price--accent tf-price--md` para
Varejo e `tf-price tf-price--md` para Atacado (o par que o canvas 018 já definiu); `tf-brow` (com
`tf-brow__label`, `tf-brow__sub`, `tf-brow__val`) para custo total e para cada linha de canal;
`tf-field__hint` para a caption de peças excluídas e para a de procedência; `tf-badge` só se houver um selo de
estado; `tf-alert` **apenas** para o aviso de campo aposentado. Não crie primitivo novo — se algo não couber
nos existentes, marque na prancheta e explique por quê.

## Perguntas em aberto para o dono

1. **O que acontece com o formulário da calculadora enquanto uma simulação de kit está aberta?** Esconder,
   desabilitar com uma frase, ou manter editável com aviso de que não pertence a esta simulação? É a decisão
   de produto que este prompt não pode tomar sozinho, e ela muda o desenho inteiro.
2. **Se o formulário continuar editável, o que "Salvar alterações" salva** — a simulação de kit (que não mudou)
   ou os campos de peça única (que não são dela)? Hoje os dois convivem na mesma tela.
3. **O resumo deve listar as peças do kit** (nome + quantidade, com as excluídas marcadas), ou só o total e o
   rollup por canal? O dado das peças existe; a aba Kits mostra a lista, esta superfície não.
4. **O título deve ser "Kit: {nome}" ou "Total do kit"** (o rótulo já desenhado no canvas 018)? São
   vocabulários diferentes para a mesma coisa em duas abas.
