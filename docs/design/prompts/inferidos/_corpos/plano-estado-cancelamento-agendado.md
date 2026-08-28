# Linha do plano na Conta — cancelamento agendado ("ativo até 31/12/2026 · não renova")

## O que desenhar
A linha do **Plano** dentro do card de plano da tela **Conta**, no estado em que o vendedor **já pediu o
cancelamento e ainda está pagando o período corrente**: o Premium continua ligado, mas há uma data de corte
marcada. É a primeira coisa que ele vê quando volta à Conta depois de cancelar — e é a única superfície do
produto que responde "o que eu perco, e quando". A peça é uma linha composta: rótulo `Plano`, selo verde
`Premium`, uma legenda com a data, uma nota de tranquilização que pode ganhar uma terceira frase, e as ações
à direita (`Assinar novamente` + `Recarregar`). Origem no código: `apps/web/src/features/billing/plan-panel.tsx`
(estado `subscription-canceled`), `plan-view.ts`, `apps/web/src/pages/conta/conta-page.tsx`.

## Por que este prompt existe
Este estado nunca foi desenhado. O protótipo de 2026-07-02 (§E7 "plano atual (Free/Premium)") renderiza **um
selo binário e UMA legenda de uma linha** — não existe no artboard nenhum elemento equivalente à segunda linha
(a nota), e a busca por "não renova / ativo até / apagado / cortesia" no canvas dá zero. Toda a redação veio de
`specs/012-e6-billing/ux-billing.md` §4.3, texto, sem prancheta. Pior: a rodada de correção do protótipo
(`claude-design-prototype-fixes.md`, item 2) mandou **remover** a frase "Cancele quando quiser" do overlay
Premium porque "a política de cancelamento ainda não foi decidida pelo produto" — ou seja, a autoridade de
desenho fecha a porta neste assunto, e o código a atravessou assim mesmo. A terceira frase (cortesia) está
marcada no próprio código como "recomendação §10-F1, ~70%, **pendente de ratificação do dono**".

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dos elementos, de cima para baixo, dentro de um `tf-card`:

| Elemento | Texto literal hoje | Estilo atual |
| --- | --- | --- |
| Rótulo | `Plano` | `--text-body` |
| Selo | `Premium` | badge tom `success` (verde) |
| Legenda (mesma linha do selo) | `ativo até 31/12/2026 · não renova` | `--fs-caption`, `--text-muted` |
| Nota (linha própria) | `Seus itens salvos continuam disponíveis; nada é apagado.` | `--fs-caption`, `--text-muted` |
| 3ª frase (condicional, **emendada na mesma nota, só com um espaço**) | `Seu acesso de cortesia continua depois disso.` | idem — indistinguível da anterior |
| Ação primária | `Assinar novamente` | botão pequeno, preenchido |
| Ação secundária | `Recarregar` | botão pequeno, fantasma |

→ **Problema 1**: as três frases têm exatamente a mesma cor, o mesmo tamanho e nenhuma hierarquia. A nota que
tranquiliza ("nada é apagado") e a nota que **muda o fato** ("sua cortesia continua depois disso") leem como a
mesma letra miúda, coladas numa única linha de texto corrido.
→ **Problema 2**: a legenda afirma um corte em 31/12/2026 e a linha de baixo promete que nada é apagado. Sem
desenho, isso lê como contradição; a peça precisa mostrar visualmente que são coisas diferentes — o que
**para** (a cobrança e a edição) e o que **fica** (os dados, em leitura).
→ **Problema 3**: `Assinar novamente` sugere um checkout novo; o vendedor que só quer desfazer o cancelamento
não sabe se é isso. Ver "Perguntas em aberto".
→ **Problema 4**: no desktop (≥1280px) este mesmo estado faz aparecer, **logo abaixo do card**, um segundo card
`Assinar o Premium` com a oferta inteira — e o botão `Assinar novamente` apenas rola até ele. A relação entre os
dois cards nunca foi composta.

## Conteúdo e dados reais
- **Data de corte** (`activeUntil`): data do servidor, formato pt-BR `dd/mm/aaaa` — exemplo real `31/12/2026`.
  É o fim do período **já pago**. Nunca é inventada; quando o servidor não a manda, a legenda encolhe para
  apenas `não renova` (sem "ativo até"), e a nota continua igual.
- **Cortesia sobrevivente**: existe quando o vendedor carrega um grant de cortesia que vai **além** da data de
  corte (ex.: assinatura termina em `31/12/2026`, cortesia vale até `15/03/2027`). A borda é estrita: empate na
  mesma data **não** acende a frase.
- **Selo**: sempre `Premium`, tom verde. O premium **está ativo** durante todo o período — degradar o selo aqui
  seria a mentira na direção oposta (dizer que ele já perdeu o que ainda pagou).
- **Origem do dado**: quando a leitura é a última resposta guardada no aparelho (offline), a legenda ganha um
  terceiro segmento: `ativo até 31/12/2026 · não renova · última informação do servidor`.
- **Sem dinheiro nesta peça.** Preço só aparece no card de oferta que fica abaixo; esta linha não mostra valor.

## Estados obrigatórios
1. **Repouso, com data, sem cortesia** — selo `Premium` + `ativo até 31/12/2026 · não renova` + nota
   `Seus itens salvos continuam disponíveis; nada é apagado.` + `Assinar novamente` e `Recarregar`.
2. **Repouso, com cortesia sobrevivente** — as três frases. Desenhe como a terceira deixa de ser letra miúda:
   ela é a que corrige a data de corte que está logo acima.
3. **Sem data** — legenda apenas `não renova`; o resto igual. A linha não pode "murchar" nem parecer quebrada.
4. **Offline / dado guardado** — legenda com o sufixo `última informação do servidor`. Precisa caber sem cortar:
   a frase honesta **não pode** virar reticências (é a terceira ocorrência dessa armadilha no projeto).
5. **Recarregando** — o botão `Recarregar` em carregamento (rótulo permanece legível, o alvo não encolhe).
6. **Foco, hover e pressionado** dos dois botões, com anel de foco visível sobre o fundo do card em ambos os temas.
7. **Vizinhos que NÃO são esta peça, e que o desenho não pode misturar**: erro de leitura do plano mostra
   `Não foi possível confirmar seu plano.` sem selo verde; premium já caído mostra `Premium pausado` +
   `Seus itens salvos continuam disponíveis para leitura.`. Não invente um híbrido entre eles e este estado.

## Viewports
- **390px (mobile)** — obrigatório: é onde o estado nasceu e onde ele já transbordou de verdade.
- **1280px (desktop)** — obrigatório: é o corte medido do produto, e é a partir dele que a coluna do plano ganha
  ~1,15 de 3 frações da grade **e** o card de oferta aparece inline logo abaixo. Desenhe os dois cards juntos.
- **1920px** — opcional, só para mostrar que a coluna larga não deixa as três frases virarem uma faixa
  interminável de texto de uma linha só.

## Regras que o desenho não pode quebrar
- **A data é fato do servidor, não promessa nossa.** Onde não há data, não há frase com data.
- **A degradação é dita, não escondida**: o que acontece depois de 31/12/2026 (itens em leitura, nada apagado)
  precisa ser legível sem esforço, não uma nota de rodapé.
- **O selo continua verde.** Cautela mora no texto, nunca num selo rebaixado que afirmaria uma perda que ainda
  não ocorreu.
- **Falha de rede nunca é vendida como perda de premium** — o rótulo offline é sobre a *origem do dado*.
- **Frase honesta fora de placeholder e fora de elemento estreito**: as três frases vivem em elementos de
  largura total.
- **Alvo de toque ≥44px** nos dois botões, inclusive quando a linha quebra.
- **Contraste medido contra o fundo real do card** (não contra o fundo da página), nos dois temas — o texto
  `--text-muted` sobre o card é justamente o par que costuma reprovar.

## Armadilhas já pagas neste projeto
- **Transbordo medido, não estimado**: nesta mesma linha, a 390px, as ações somaram 453,5px contra 316px de
  conteúdo útil do card; a página foi a 491px de largura de rolagem (**100,5px de transbordo**) e um dos botões
  **nasceu inteiramente fora da viewport**, em x=396,3 — com o modal aberto, sobrava uma faixa clara à direita
  com o botão solto à mostra. O card quebra a linha das ações; **nunca** rola na horizontal.
- **Duas ações lado a lado com a mesma primeira palavra** já confundiram aqui (`Atualizar` × `Atualizar forma de
  pagamento`), e por isso o nosso botão virou `Recarregar`. Mantenha os dois rótulos visualmente distinguíveis.
- **Texto ocluso passa em teste**: a sobreposição não é propriedade do texto. Componha com caixas, não confiando
  que "o texto está lá".
- **Valor/frase longa estoura coluna**: teste a composição com a legenda mais longa possível (data + `não renova`
  + `última informação do servidor`) e com a nota de três frases juntas.

## Entregável
Pranchetas, tema **escuro** como padrão e **claro** como equivalente de primeira classe:
1. 390px — estado 1 (duas frases), repouso.
2. 390px — estado 2 (três frases, cortesia sobrevivente).
3. 390px — estado 4 (offline) com o botão `Recarregar` em carregamento; e a variação sem data.
4. 1280px — a coluna do plano com o card `Assinar o Premium` inline logo abaixo, mostrando a relação entre eles.
5. Folha de estados dos dois botões: repouso, hover, foco, pressionado, carregando.
6. Tema claro do estado 2.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para o card do plano, `tf-badge` tom `success`
para o selo `Premium`, `tf-btn` pequeno preenchido para `Assinar novamente` e `tf-btn` pequeno fantasma para
`Recarregar`, tipografia de legenda para as três frases. Se a solução exigir separar visualmente a nota da
terceira frase, faça-o com espaçamento, peso ou ícone dentro do que já existe — não com um componente novo.

## Perguntas em aberto para o dono
1. **Ratificar ou derrubar a §10-F1**: a frase `Seu acesso de cortesia continua depois disso.` fica? Se fica, ela
   é uma terceira frase emendada, uma linha própria, ou substitui a data de corte por outra ("ativo até
   15/03/2027 por cortesia")? Hoje ela está no produto marcada como pendente de sua ratificação.
2. **Desfazer o cancelamento**: existe caminho para o vendedor *retomar* a assinatura antes de 31/12/2026, ou o
   único caminho é assinar de novo? O rótulo `Assinar novamente` afirma a segunda hipótese; se a primeira for
   possível, a ação e o texto mudam.
3. **Contagem regressiva**: o desenho pode dizer quanto tempo falta ("faltam 12 dias") ou só a data? Contagem
   pressiona — e a política de cancelamento sem padrão escuro é uma decisão sua, não minha.
4. **O selo deve carregar alguma marca de "agendado"** (um ponto, um sufixo), ou o verde puro + a legenda bastam?
