# Os dois avisos de honestidade do orçamento repreçado

## O que desenhar

Duas ressalvas curtas dentro da aba **Orçamentos** (o documento congelado, imutável), no detalhe de um
registro. A primeira aparece quando o app **reemitiu um documento antigo com a data de hoje** por não
conseguir repreçar (a origem sumiu do catálogo, ou o aparelho estava offline e ela não carregou). A
segunda aparece quando um número novo fica ao lado de um valor congelado **calculado por uma versão da
fórmula que não existe mais** (o modelo pré-4.0.0, que tinha o campo Desperdício). Quem lê é o vendedor
decidindo se recota um cliente — o momento em que uma frase omitida vira preço errado no WhatsApp.

## Por que este prompt existe

As duas frases nasceram em 2026-08 (SC-818 do 014 e T037 do 016) — **um mês depois** do protótipo
(2026-07-02) e da spec textual. Não existem em `claude-design-prototype.md`, nem nos dois fixes, nem
em `HistoryScreen.jsx`; a ficha técnica do canvas do dono traz só três linhas (versão da fórmula,
origem com link, nota do relógio do aparelho). Nenhuma das duas ressalvas aparece em qualquer lugar do
canvas. Uma IA decidiu sozinha **dois pesos visuais diferentes para duas ressalvas equivalentes** — e
deu o peso MENOR justamente para a mais grave.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/historico/{snapshot-detail-page,recalc-today,compare-today}.tsx` e
`historico-page.css`.

| # | Onde aparece hoje | Forma atual | Texto literal em pt-BR |
|---|---|---|---|
| 1 | Detalhe do registro, logo abaixo de "Valores congelados em 12/08/2026" e ACIMA de todos os números | parágrafo cinza `tf-historico__meta`, 0.8125rem, `--text-muted` | "Estes valores foram reaproveitados de um congelamento anterior — a origem não estava disponível para repreçar." |
| 2 | Diálogo "Recalcular hoje", entre a descrição e os botões | `Alert tone="info"` (ícone + caixa) | "O valor congelado foi calculado pelo modelo 3.1.0, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí." |
| 3 | Card "Comparar com hoje", entre as duas linhas de valor e a nota final | o MESMO `Alert tone="info"`, texto idêntico | (idem acima) |

Vizinhança real do aviso 1, na ordem da tela: "Cotado em 12/08/2026 às 14:32" → "Valor cotado
R$ 24,24" → "preço de varejo" → "Validade da proposta: 15 dias" → *(banner "Premium pausado" quando
for o caso)* → "Valores congelados em 12/08/2026" → **aviso 1** → Peças do kit → Detalhamento → Preços
por canal → Ficha técnica ("Calculado com a fórmula versão 3.1.0", "Registro criado a partir de:
Vaso G", "Abrir produto", o explicador longo, "Data registrada pelo seu aparelho…").

Problemas a resolver no desenho:

- → **O aviso mais grave é o mais fraco.** "A data é de hoje mas o número não é de hoje" é o que
  impede o documento de mentir, e viaja como legenda de 13px, cinza, na mesma pele de outras quatro
  linhas cinzas da tela ("Valores congelados em…", "Validade da proposta…", "Data registrada pelo seu
  aparelho…", "Calculado com a fórmula versão…"). Some no meio.
- → **O aviso 1 não existe na LISTA.** O card mostra rótulo, "Cotado em {data} · Peça única", "Valor
  cotado R$ 24,24" e "preço de varejo" — nada mais. Um registro reaproveitado é **idêntico** a um
  repreço verdadeiro até o vendedor abrir. (Ver Perguntas.)
- → **Dois pesos para duas ressalvas equivalentes**, sem regra que explique por quê.
- → No desktop (≥1280px) a coluna do documento tem rolagem própria (`position: sticky`, altura máxima
  `100dvh` menos margens). O aviso 1 fica no topo e **pode rolar para fora da tela enquanto os números
  continuam visíveis** — exatamente o estado que ele existe para impedir.

## Conteúdo e dados reais

- Dinheiro: sempre `R$ 1.234,56`, com algarismos tabulares, nunca truncado. Valores plausíveis do
  seed: **R$ 16,16 · R$ 21,01 · R$ 24,24**; um kit chega fácil a **R$ 1.348,00**.
- `{versao}` no aviso 2/3 é uma versão semver real gravada no documento: **"3.1.0"** (pré-remoção) ou
  "3.0.0". A fórmula atual do app é **4.1.0**. A regra é `major < 4`, e nada além disso.
- O aviso 1 é ligado por um campo booleano gravado uma vez, para sempre, dentro do documento imutável
  (`repricedFromFrozen`). Não é derivado, não some, não pode ser corrigido depois.
- O aviso 2/3 é **derivado** da versão gravada — não há campo novo no documento.
- Data e hora vêm do aparelho, formato pt-BR: "Cotado em 12/08/2026 às 14:32".
- Diálogo, quando o repreço deu certo: "Isso cria um NOVO registro com os valores do seu catálogo hoje.
  O registro de 12/08/2026 continua como está." Botões: "Voltar" e "Recalcular".
- No card de comparação as duas linhas têm **peso idêntico** de propósito: "Cotado em 12/08/2026 —
  R$ 24,24" e "Hoje — R$ 27,90", com "preço de varejo" dito uma vez acima das duas, e abaixo:
  'Comparação informativa: este registro não muda. Para gravar o valor de hoje, use "Recalcular hoje".'

## Estados obrigatórios

1. **Repouso sem aviso** — documento repreçado de verdade, modelo 4.x: nenhuma das duas frases
   aparece. É o estado mais comum; desenhe-o para provar que o aviso não é decoração permanente.
2. **Documento reaproveitado** — aviso 1 presente. Mostre-o no detalhe **e** proponha a marcação
   equivalente no card da lista (ver Perguntas).
3. **Modelo aposentado no diálogo de recálculo** — aviso 2 dentro do diálogo, junto com "Voltar" e
   "Recalcular". Só aparece quando o repreço REALMENTE aconteceu (há número novo na tela).
4. **Modelo aposentado na comparação** — aviso 3 dentro do card "Comparar com hoje", entre os dois
   valores e a nota informativa.
5. **Os dois juntos** — é possível: um registro reaproveitado guarda a versão antiga, então ao abrir
   ele mais tarde (já online, origem de volta) o documento carrega o aviso 1 e a comparação carrega o
   aviso 3. Desenhe essa pilha; ela é o pior caso de ruído.
6. **Offline** — uma linha muda a mais, hoje também cinza: "Sem conexão: usando os valores do catálogo
   salvos neste aparelho, que podem estar desatualizados." Aparece no diálogo e na comparação, antes
   do aviso do modelo. Nunca em tom de erro.
7. **Comparação impossível** — no lugar dos dois valores: "Não foi possível calcular o valor de hoje
   para este registro com o seu catálogo atual." Só isso; o valor congelado fica onde estava.
8. **Recálculo sem origem** — a descrição do diálogo troca para: "Não foi possível localizar a origem
   deste registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro
   e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo." Neste caso o aviso 2
   **não** aparece (não há número novo para comparar) — e é justamente este caminho que gera o aviso 1
   no registro que nasce daí.
9. **Premium pausado** — "Recalcular hoje" some inteiro (é escrita) e o aviso 2 vai junto; a comparação
   e o aviso 3 continuam legíveis. No topo do documento: "Premium pausado — seus registros continuam
   aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium."
10. **Carregando / confirmando** — "Recalcular" fica ocupado com o rótulo mantido e os avisos visíveis.
11. **Foco / hover / pressionado** nos botões do diálogo e no "Comparar com hoje" (hoje fantasma), e
    foco visível no card do registro aberto na lista.

## Viewports

- **Mobile 390px** — obrigatório: documento, diálogo e card de comparação existem no telefone, e é lá
  que a frase longa do aviso 2 (~200 caracteres) mais ameaça empurrar os botões para fora.
- **Desktop 1280px** — obrigatório: aqui Orçamentos é mestre-detalhe; lista e documento dividem a
  largura e a coluna do documento rola sozinha. É o viewport onde o aviso 1 pode sair de vista.
- **Desktop 1440px+** — desejável: a lista volta a 520px fixos e o documento fica mais largo; vale ver
  se o aviso ganha ou perde presença.

## Regras que o desenho não pode quebrar

- Nenhuma das duas frases pode virar placeholder, tooltip, "ver mais", acordeão fechado ou legenda
  truncada com reticências. Frase honesta mora em elemento de largura cheia e é lida sem interação.
- Falha de rede **nunca** vira tom de erro nem sugestão de que falta Premium: offline e "origem não
  encontrada" são informação calma, não punição.
- O aviso 1 não pode ser mais fraco que a linha "Valores congelados em {data}" que ele qualifica — ele
  contradiz parcialmente essa linha, e o desenho tem de deixar isso legível.
- O aviso 2/3 não pode sugerir que **toda** a diferença vem do modelo: a frase diz "parte da diferença
  acima pode vir daí", e o desenho não pode transformar isso em veredito.
- O valor congelado nunca é reetiquetado como "Hoje", e as duas linhas da comparação mantêm o mesmo
  peso: destacar "Hoje" faria uma comparação informativa parecer a nova verdade.
- Contraste medido contra o fundo real da caixa (o `Alert` info tem fundo próprio); alvo ≥44px nos
  botões do diálogo; zero rolagem horizontal, medida nos dois eixos, não estimada.

## Armadilhas já pagas neste projeto

- **Frase honesta dentro de placeholder foi cortada** (016/PR-F): o sufixo sumia e a honestidade ia
  junto. Estas duas frases são longas; se couberem só cortando, o desenho está errado, não o texto.
- **Texto ocluso passa em teste** (014): `toBeVisible` não vê um aviso empurrado para fora da caixa
  rolante. Desenhe a caixa do diálogo com a frase inteira dentro, no telefone.
- **Rolagem vertical que o headless não enxerga** (016/PR-B): a coluna do documento no desktop rola de
  verdade; o aviso não pode depender de o vendedor rolar para cima.
- **Valor grande estoura a coluna** (E4/close-out): um kit de R$ 1.348,00 ao lado de um rótulo longo
  colidiu num PDF sem teste nenhum perceber — as duas linhas da comparação têm essa mesma forma.
- **Cinza empilhado vira invisível**: já são quatro linhas `--text-muted` seguidas antes do aviso 1.

## Entregável

Pranchetas, tema escuro (padrão) e tema claro (first-class, mesma fidelidade):

1. Detalhe a 390px **com** o aviso 1 — e a mesma prancheta sem ele, para comparar o peso.
2. Card da lista a 390px propondo a marcação do registro reaproveitado (se o dono disser sim).
3. Diálogo "Recalcular hoje" a 390px com o aviso 2, incluindo a variante offline (duas ressalvas
   empilhadas + dois botões).
4. Card "Comparar com hoje" a 390px, aberto, com os dois valores e o aviso 3.
5. Mestre-detalhe a 1280px com o documento reaproveitado à direita, mostrando o aviso ao rolar.
6. O pior caso: documento reaproveitado **e** modelo aposentado na mesma tela.

Reutilize os primitivos existentes, sem criar novos: **Card** para o documento, o card de comparação e
os cards da lista; **Alert** (tom `info`) para os avisos do modelo aposentado; **Badge** se a marcação
da lista for por selo; **Button** nas variantes secundária (Voltar/Recalcular hoje) e fantasma
(Comparar com hoje); **Dialog** para o recálculo; **Icon** para o ícone do alerta. Se o aviso 1 precisar
subir de peso, prefira reusar o `Alert` que já existe a inventar um quinto tratamento de legenda.

## Perguntas em aberto para o dono

1. **O registro reaproveitado deve se declarar na LISTA?** Hoje não se declara: o card é idêntico ao de
   um repreço verdadeiro, e a diferença só aparece ao abrir. Se sim, é selo, legenda ou mudança de tom?
2. **Os dois avisos devem ter o mesmo peso?** Se não, qual é o mais grave para você: "o número não é de
   hoje" ou "parte da diferença vem da fórmula antiga"?
3. **Quando os dois caem na mesma tela, mostram-se os dois?** Um resume o outro, um vira secundário, ou
   ambos ficam inteiros?
4. **A nota do modelo aposentado deveria aparecer também no documento congelado sozinho** (ao lado de
   "Calculado com a fórmula versão 3.1.0"), e não só quando há um número novo ao lado?
