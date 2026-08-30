# Simulações em tela larga (≥1280px)

## O que desenhar
Toda a área de **Simulações** do Precifica3D quando o vendedor está no computador. Simulação é a
estratégia salva de precificação: uma combinação de marketplaces, taxas e markup que, ao ser reaberta,
**recalcula com os preços de hoje** (é o oposto de Orçamentos, que congela o dia). Ela vive inteira
dentro da aba **Calcular**: uma entrada "Minhas simulações" no topo da página, uma folha lateral com a
lista, uma folha de salvar, e — quando uma simulação está aberta — uma barra de contexto acima da
calculadora, mais o resumo somente-leitura de kit quando a base de custo é um kit. Quem usa: o vendedor
que, sentado no computador, quer comparar canais lado a lado antes de anunciar.

## Por que este prompt existe
Nada aqui foi desenhado para tela larga — nem adaptado. A medição da auditoria: zero ocorrências de
`useIsWide`, `matchMedia`, `min-width`, `md:` ou `lg:` em todo o código de Simulações. Em 1920px o
vendedor recebe **exatamente o layout de celular**: cartões de largura total dentro de um painel
estreito, uma barra de contexto como faixa fina atravessando a página, e uma folha de altura inteira
para dois campos. O canvas do dono (`Abas-Desktop.dc.html`) tem quatro pranchetas — Catálogo, Kits,
Orçamentos e Conta — e **nenhuma é Simulações**; a linha 454 é um placeholder explícito ("A tela
Calcular está no outro arquivo"), e é exatamente onde Simulações mora. Autoridade de desenho: NENHUMA.
O que foi inferido por omissão é justamente o que este prompt precisa resolver: que a lista **não** vira
lista+ficha (o padrão que o dono desenhou para as outras três telas), que a barra de contexto **não**
vira cabeçalho, e que a largura da tela não serve para nada.

## O que já existe hoje (não invente do zero — corrija)

**1. A entrada** — botão fantasma alinhado à direita, ícone `boxes` + "Minhas simulações". Visível para
todo mundo, inclusive grátis e deslogado (é a porta honesta). → hoje é um botãozinho perdido à direita de
uma página centrada; em 1920px ele fica sozinho num vazio de mais de mil pixels.

**2. A lista** (folha lateral) — título "Minhas simulações"; subtítulo, **só quando há lista**,
"Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre."; campo de busca **sem
rótulo visível**, placeholder "Buscar por nome…"; cartões empilhados; botão "Carregar mais" ao fim.
Cada cartão: nome em uma linha truncada · nota opcional em 2 linhas com reticências · "Atualizado há 2
dias" (nunca uma data) · e três botões-ícone à direita (lápis, cópia, lixeira = Renomear · Duplicar ·
Excluir). → os três ícones de 18px numa linha justificada à direita são alvos apertados e ilegíveis como
ação; → no desktop a folha estreita desperdiça a tela e força rolagem para uma lista que caberia inteira.

**3. A barra de contexto** (quando uma simulação está aberta) — cartão acima da calculadora com
"Simulação: {nome}", a legenda "Recalculado com os preços de hoje", o selo "Alterações não salvas"
quando há edição pendente, "Fechar simulação" à direita, e uma fileira que embrulha com "Abrir origem"
(só quando a referência ainda resolve), "Renomear", "Duplicar", "Salvar alterações". → em tela larga
essa fileira embrulha ou se espalha; ela é um **cabeçalho de trabalho**, não um cartão qualquer.

**4. Salvar** — botão secundário "Salvar simulação" com ícone `save`, **premium-only e simplesmente
ausente** para quem não tem Premium ativo (nunca desabilitado, nunca isca). Abre folha com título
"Salvar simulação", intro "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo.
Ao reabrir, ela recalcula com os preços de hoje.", campos "Nome" (obrigatório) e "Nota (opcional)", o eco
somente-leitura "Base de custo: avulsa" e o botão "Salvar simulação". → uma folha de altura inteira para
dois campos é desperdício em 1920px.

**5. Resumo de kit** (base de custo = kit) — cartão "Kit: {nome}" com a dica "Preços por canal do kit,
recalculados com os preços de hoje." e, por marketplace, "Varejo: R$ 24,24" / "Atacado: R$ 21,01".
→ é uma **tabela** disfarçada de lista vertical; no desktop deve virar comparação lado a lado.

## Conteúdo e dados reais
- **Nome**: obrigatório, máximo 120 caracteres. Vazio ⇒ "Dê um nome à simulação."; longo ⇒ "Máximo de
  120 caracteres."
- **Nota**: opcional, máximo 500 caracteres ⇒ "Máximo de 500 caracteres." Pode vir sem espaço nenhum.
- **Atualizado {quando}**: "agora mesmo", "há 7 min", "há 3 h", "há 2 dias", "há 5 semanas". Nunca data.
- **Base de custo**: "avulsa", "referência do catálogo" ou "kit do catálogo".
- **Dinheiro**: sempre `R$ 24,24`, e precisa caber `R$ 1.234,56` e `R$ 12.345,67` sem estourar coluna.
- **Marketplaces**: "Mercado Livre", "Shopee", "Amazon", "Outro". Canal inválido no kit:
  "Corrija os campos deste canal para ver os preços." (com a contagem entre parênteses); rollup inteiro
  inválido: "Confira os campos destacados para ver o preço."
- **Aviso de campo aposentado** (persistente, nunca toast): "O documento salvo continha Desperdício (g).
  O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."

## Estados obrigatórios
- **Carregando a lista**: apenas um spinner centrado, sem esqueleto falso de dados.
- **Erro frio** (nada em cache): alerta de perigo "Não foi possível carregar suas simulações." + botão
  "Tentar novamente". Nunca uma parede de erro por cima de dados que já estão na mão.
- **Vazio**: ícone `boxes`, "Nenhuma simulação salva ainda", "Monte uma comparação de canais na
  calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." + "Voltar para a
  calculadora". (→ "toque" é copy de celular; no desktop ela mente. Anote como problema, mas **não
  reescreva**: a frase é homologada — veja Perguntas em aberto.)
- **Busca sem resultado**: "Nenhuma simulação encontrada para “{termo}”." + "Limpar busca".
- **Offline (leitura)**: alerta informativo "Modo leitura offline" / "Suas simulações continuam aqui e
  podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente";
  ações de escrita desabilitadas com a razão "Esta ação precisa de conexão."
- **Premium pausado (lapsed)**: alerta "Premium pausado" / "Suas simulações continuam aqui e podem ser
  abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."; razão nas
  ações: "Premium pausado — reative para renomear, duplicar, editar ou excluir."
- **Sem Premium / deslogado**: **um** teaser no lugar da lista — "Salve suas simulações" / "Salve uma
  combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os
  preços de hoje." / "A calculadora continua grátis." Sem subtítulo de lista junto (seriam duas promessas
  coladas — defeito já corrigido uma vez).
- **Degradado** (a referência de catálogo sumiu): legenda informativa que diz que os valores manuais
  foram mantidos — **jamais** "removido/excluído/deletado".
- **Alterações não salvas**: selo neutro na barra de contexto; "Salvar alterações" só habilita com
  alteração real; fechar pede confirmação "Descartar as alterações não salvas desta simulação?" com
  "Voltar" e "Descartar" (nunca "Cancelar").
- **Excluir**: diálogo central "Excluir a simulação “{nome}”?" / "Esta ação não pode ser desfeita." com
  "Voltar" e "Excluir".
- **Repouso, foco visível, hover, pressionado, desabilitado** em cada botão, ícone e cartão — inclusive
  o cartão inteiro, que hoje é clicável (abrir).

## Viewports
- **1280px** — o corte real do produto (`useIsWide`, decisão do dono): acima dele a composição desktop
  monta; abaixo dela nada muda. Desenhe o caso apertado, com a barra lateral de 240px já descontada.
- **1920px** — a tela do vendedor no dia a dia, e onde o problema dói hoje (o resto da tela vazio). As
  outras pranchetas do dono usam `max-width: 1720px` no conteúdo; siga o mesmo teto.
- **390px** — desenhe **como referência do que existe hoje**, sem redesenhar: o mobile é intocado por
  propriedade (o código do celular é o mesmo, não um equivalente). Serve para provar que a peça larga é
  uma composição nova e não um estiramento.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou a lista, ou **um** teaser. Nunca lista quebrada, nunca dois teasers, nunca
  botão de salvar cinza para quem não tem Premium — ele é **ausente**.
- **Procedência do número**: a promessa é "Recalculado com os preços de hoje". Nenhuma data em lugar
  nenhum da área — data é linguagem de Orçamentos.
- **Falha de rede nunca vendida como falta de Premium**: offline diz "precisa de conexão"; pausado diz
  "reative o Premium". São dois textos e dois estados diferentes.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega só exemplo; explicação vive em
  elemento de largura inteira (o projeto já pagou por uma frase cortada em sufixo de placeholder).
- **Alvo ≥44px** para cada uma das três ações do cartão, inclusive quando viram ícones.
- **Contraste medido contra o fundo real** do painel/ficha, não contra o fundo da página.
- **Degradação dita, não escondida**; e o aviso de campo aposentado permanece na tela enquanto a
  simulação estiver aberta.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido nos DOIS eixos** — em headless a barra de rolagem clássica não aparece;
  já houve rolagem no eixo vertical passando batida. Nenhuma coluna pode empurrar a página.
- **Nome de 120 caracteres e nota de 500 sem um único espaço**: têm de truncar com reticências visíveis,
  nunca empurrar "Duplicar"/"Salvar alterações" para fora.
- **Valor grande estourando a coluna**: teste o layout de preços com `R$ 12.345,67` (um PDF já quebrou
  assim, invisível para testes de texto).
- **Texto ocluso passa em teste**: nenhuma asserção acusa um elemento sob outro — desenhe as
  sobreposições explicitamente, inclusive **folha dentro de folha** (renomear abre uma segunda camada
  sobre a lista: a de baixo continua legível e o foco fica claro).
- **Máscara de milhar perdida ao reabrir programaticamente** — mostre o campo reaberto já com máscara.

## Entregável
Pranchetas em **1280px** e **1920px**, no **tema escuro (padrão)** e no **tema claro** (first-class):
1. **Simulações — lista** na largura cheia, com a busca, a lista e (se a resposta do dono for essa) a
   ficha à direita, no mesmo idioma das outras telas do dono: `minmax(0,1fr) 560px`, ficha `sticky`.
2. **Simulação aberta** — a barra de contexto como cabeçalho de trabalho acima da calculadora, com nome,
   promessa, selo de alterações e as quatro ações em uma linha só.
3. **Salvar simulação** na largura larga (dois campos + eco da base de custo).
4. **Resumo de kit** como comparação por marketplace lado a lado.
5. **Estados**: vazio · busca sem resultado · erro frio · offline · Premium pausado · teaser · degradado.

Reuse os primitivos existentes, sem criar novos: `Card` para cartão e barra de contexto, `Alert` (tons
`info`/`danger`) para offline/pausado/degradado/erro, `EmptyState` para vazio e busca vazia, `Field` +
`tf-input`/`tf-inputwrap` para busca, nome e nota, `Button` (`ghost`/`secondary`/`danger`) com `Icon`
(`boxes`, `pencil`, `copy`, `trash-2`, `save`), `Badge` neutro para "Alterações não salvas", `Sheet` para
salvar/renomear, `Dialog` central para excluir, `Spinner` para carregando, `PremiumTeaser` para a porta
honesta, e o `PageHeader` da aba Calcular como âncora superior.

## Perguntas em aberto para o dono
1. **Simulações vira mestre-detalhe como as outras três telas?** Se sim, **o que a ficha da direita
   mostra** — hoje não existe nenhuma prévia de simulação: abrir uma simulação *é* preencher a
   calculadora. Uma ficha exigiria decidir um conteúdo que o produto ainda não tem (prévia de preços por
   canal? só metadados? um botão "Abrir na calculadora"?).
2. **A área continua dentro de Calcular, ou Simulações ganha lugar próprio no menu no desktop?** Hoje é
   uma folha sobre a calculadora, e "Calcular Desktop" está fora deste incremento — isto muda onde a
   peça pode morar.
3. **A copy de celular ("toque em “Salvar simulação”", "Voltar para a calculadora") ganha versão de
   desktop?** Ela é homologada; trocá-la é decisão sua, não do desenho.
4. **A barra de contexto deve ficar fixa no topo** enquanto o vendedor rola a calculadora longa, ou rola
   junto com o conteúdo?
