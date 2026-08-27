# Premium pausado no Catálogo — a faixa calma, o formulário inerte e a linha de reativação

## O que desenhar
O estado que o assinante **em atraso** encontra ao abrir o Catálogo (`/catalogo`, abas Filamentos ·
Impressoras · Produtos · Kits). O servidor devolve `status: "lapsed"` e a tela inteira muda de modo: tudo
continua legível e utilizável no cálculo, mas nada pode ser criado, editado ou excluído. Precisa ser
desenhado em três lugares que hoje foram montados por peças: (1) a **faixa** acima da lista, (2) a
**ficha/formulário inerte** (à direita no desktop ≥1280px, dentro da gaveta no mobile, e na página cheia
de Produto), e (3) o **rodapé de reativação** que toma o lugar do Salvar. É o vendedor que já pagou, tem
dados salvos e voltou para trabalhar — o tom é calmo e não punitivo, nunca um paywall.

## Por que este prompt existe
Nada disso foi desenhado. O estado foi composto por inferência em quatro pontos independentes do código
(`catalog-panel.tsx`, `filament-form.tsx`, `printer-form.tsx`, `produto-page.tsx`), e o resultado visual do
formulário congelado é **o cinza nativo do navegador** de um `<fieldset disabled>` — nenhum token, nenhum
contraste medido, nenhuma decisão. O protótipo de 2026-07-02 **não cobre isto e cobre outra coisa**: o
canvas só conhece `plano ∈ {premium, free}` (`CatalogScreen.jsx`), o `writeBlocked` dele é `!isPremium`
— modela o GRÁTIS, não o pausado — e o badge "somente leitura" que aparece lá é atributo **da linha**
(TPU Flex), não do plano. E o §B do prompt original crava a fronteira como **binária** ("computar =
grátis; qualquer persistência = Premium"): "pausado" é um terceiro estado que a autoridade de desenho
nega existir. Sem desenho: a faixa, o formulário inerte, a linha de reativação e o desvio da lixeira.

## O que já existe hoje (não invente do zero — corrija)
**Faixa acima da lista** — `Alert` tom `info`, título **"Premium pausado"**, corpo **"Seus itens continuam
aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium."**
→ Só aparece se `!offline && !erro && lista.length > 0`. Com o catálogo **vazio**, ou **offline**, ou em
erro de carga, a faixa **some** e o vendedor fica sem nenhuma explicação para os campos apagados.

**Cada item da lista** ganha uma quarta legenda: **"somente leitura"**, no mesmo tamanho e na mesma cor
das outras legendas (resumo, nota, "pode estar desatualizada").
→ Quatro legendas empilhadas iguais; o estado do plano fica indistinguível de um dado do item.

**Formulário (gaveta no mobile / ficha de 560px no desktop)** — todos os campos dentro de um `fieldset`
desabilitado de uma vez.
→ Aparência = cinza do sistema operacional. Não há foco, não há explicação por campo, e o contraste do
texto apagado sobre o fundo escuro nunca foi medido.

**Rodapé** — o botão **"Salvar" / "Salvar alterações"** simplesmente **desaparece**; no lugar entra um
`Alert` `info` com título **"Reative o Premium"** e corpo **"Reative o Premium para voltar a criar e
editar. Seus itens estão salvos."**, ao lado de um **"Voltar"** que continua ativo.
→ A linha manda reativar e **não oferece caminho nenhum** para reativar (nenhum botão/link para a Conta).

**Ícones da linha (e do cabeçalho da ficha no desktop)** — lápis, cópia e lixeira continuam com aparência
normal. Tocar a **lixeira** abre a ficha somente-leitura em vez do confirmar de exclusão.
→ Honesto no efeito (não finge que exclui e depois falha), desonesto na aparência: o ícone promete excluir.

**Botão "Adicionar filamento" / "Adicionar impressora"** na barra da lista continua **totalmente ativo**;
abre "Novo filamento" com todos os campos inertes. Idem o ícone de duplicar.

## Conteúdo e dados reais
Filamento — **Nome** (obrigatório, placeholder "Ex.: PLA Azul") · **Material** ("Ex.: PLA") · **Custo do
rolo** (R$, obrigatório) · **Peso do rolo** (kg, obrigatório).
Impressora — **Nome** ("Ex.: Ender 3") · **Valor da máquina** (R$, obrigatório) · **Vida útil da máquina**
(h, obrigatório) · **Consumo médio** (kW, obrigatório, dica "Consumo médio real da impressora, não a
potência de placa (~0,12 kW).") · **Reserva de manutenção** (R$/h, **opcional**).
Resumos reais da lista: `PLA · R$ 89,90 / 1 kg` e `R$ 1.899,00 · 2.000 h · 0,12 kW`.
Contadores: "3 filamento(s)", "2 impressora(s)". Cabeçalho da ficha no desktop: kicker "Filamento salvo" /
"Impressora salva" acima do nome.
Produto e Kit **não** editam na ficha: a ficha resume e mostra **"Abrir para editar"** (que, pausado, leva
à página cheia igualmente inerte). Na página de Produto o preço **continua sendo recalculado ao vivo** com
os valores salvos — o número está vivo enquanto os campos estão congelados, e o desenho precisa dizer isso.

## Estados obrigatórios
- **Repouso pausado (lista cheia)**: faixa "Premium pausado" + itens completos + legenda "somente leitura".
- **Campo inerte**: precisa de um tratamento próprio (não o cinza do sistema) — valor legível, rótulo
  legível, unidade legível, e a clara ausência de cursor de edição.
- **Foco/hover/pressionado sobre o que ficou inerte**: nada deve responder como se aceitasse escrita; o que
  continua clicável ("Voltar", "Abrir para editar", busca, seleção de item) responde normalmente.
- **Rodapé de reativação**: sem "Salvar", com "Reative o Premium" + corpo, e "Voltar" ativo ao lado.
- **Pausado + offline** (os dois ao mesmo tempo): hoje só aparece "Modo leitura offline" / "Seus itens
  salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." — a faixa de pausado
  é suprimida. Desenhe a composição honesta das duas causas.
- **Pausado + catálogo vazio**: "Nenhum filamento salvo ainda" / "Salve seus filamentos uma vez e reutilize
  em cada cálculo." com o botão Adicionar — e nenhuma menção ao plano pausado. Corrigir.
- **Carregando**: spinner centralizado (a faixa ainda não existe).
- **Erro de carga**: `Alert` `danger` "Não foi possível carregar seu catálogo." + "Tentar novamente".
- **Leitura barrada pelo servidor (403)**: estado vazio com ícone de coroa e o texto **"Salvar faz parte do
  Premium."** → é copy de escrita usada numa falha de leitura; marcar como problema.
- **Busca sem resultado (desktop)**: "Nada encontrado para essa busca" / "Tente outro termo, ou limpe a
  busca para ver tudo de novo." + "Limpar busca" — precisa conviver com a faixa de pausado.
- **Nunca assinou (`none`)**: NÃO é este estado — cai no teaser Premium padrão. As duas telas não podem
  ficar parecidas a ponto de confundir quem já pagou com quem nunca pagou.

## Viewports
- **390px (mobile)**: lista em cartões + gaveta lateral com o formulário inerte. A faixa e as legendas
  competem por altura com a lista — mostre a dobra.
- **1280px (desktop, o corte real)**: mestre-detalhe, lista à esquerda e ficha de **560px fixos** à direita,
  com a faixa acima das duas colunas e a barra de busca/contador/Adicionar no topo da lista.
- **1920px**: a lista passa a **duas colunas** (regra em ≥1600px) e a ficha continua com 560px — é onde a
  faixa fica mais larga e mais fácil de ignorar.
Existe nos dois mundos; nenhum pode ser pulado.

## Regras que o desenho não pode quebrar
- **Pausado ≠ grátis ≠ offline ≠ erro.** Três causas diferentes, três frases diferentes; nunca vender falha
  de rede ou plano pausado como a mesma coisa.
- **Leitura permanece completa**: nenhum dado do vendedor pode ser escondido, borrado ou truncado por causa
  do plano. O que congela é a escrita.
- **Sem preço e sem data** na linha de reativação (mesma régua de honestidade do teaser).
- **Nada finge funcionar**: o bloqueio aparece **antes** do toque, não no "Salvar".
- **Frase honesta em elemento de largura cheia**, nunca dentro de placeholder ou de campo que corta.
- **Alvo ≥44px** para tudo que continua tocável; contraste do texto inerte **medido contra o fundo real**
  do card, nos dois temas — este é o ponto exato em que o cinza nativo falha hoje.

## Armadilhas já pagas neste projeto
- Nome de item colado pelo vendedor **sem espaços** gerou 4.948px de rolagem horizontal a 1440px; o card da
  lista precisa quebrar palavra, e a ficha de 560px também.
- Legenda apagada que passa em teste de texto e é ilegível na tela: `toBeVisible` não enxerga oclusão nem
  contraste — a faixa e o "somente leitura" precisam ser lidos numa imagem, não numa asserção.
- Valor grande (`R$ 1.899,00 · 2.000 h · 0,12 kW`) estourando a coluna do resumo em 390px.
- Frase honesta cortada por caber só em sufixo de placeholder — já aconteceu e voltou como regra.

## Entregável
Pranchetas, tema **escuro (padrão)** e **claro (first-class)**:
1. 390px — lista pausada com a faixa, três itens reais e a legenda "somente leitura".
2. 390px — gaveta "Editar filamento" inerte, com o rodapé de reativação e "Voltar".
3. 1280px — mestre-detalhe pausado completo (busca + contador + Adicionar + ficha inerte de 560px).
4. 1920px — a mesma tela com a lista em duas colunas.
5. Página cheia de Produto pausada: faixa no topo, cartão de nome com a linha de reativação no lugar do
   "Salvar produto", grade de custos/markup/marketplace inerte e o preço recalculado ao vivo.
6. Uma prancheta de **especificação do campo inerte**: um mesmo campo (rótulo + unidade + valor) em
   repouso editável, inerte, inerte-com-foco-tentado e inerte em erro pré-existente.
Reutilize os primitivos: `tf-card` para item e ficha, `tf-card--interactive` / `--selected` para a seleção
no desktop, o alerta de tom `info` para a faixa e para a linha de reativação, `tf-inputwrap` + `tf-input`
para os campos (crie a **variante inerte** deste primitivo, não um campo novo), o botão fantasma para
"Voltar" e os ícones de linha, e o estado vazio existente para busca/catálogo vazio. Nenhum primitivo novo.

## Perguntas em aberto para o dono
1. A linha "Reative o Premium" **oferece um caminho** (botão para a Conta/assinatura) ou continua sendo só
   um aviso sem ação? Hoje ela manda reativar e não abre porta nenhuma.
2. Com o plano pausado, o botão **"Adicionar filamento"** deve continuar ativo abrindo um formulário inerte,
   ficar desabilitado, ou sumir? Cada opção é uma tela diferente.
3. Os ícones de **lixeira e lápis** mudam de rótulo/forma quando pausado (ex.: virar um só "Ver"), ou
   continuam iguais e só desviam o destino?
4. A faixa "Premium pausado" deve aparecer **também** com o catálogo vazio, com erro de carga e junto do
   aviso de offline — e, nesse último caso, as duas frases convivem ou uma vence?
5. O estado pausado pode mostrar **quando** o acesso pausou ou até quando os dados ficam guardados? Hoje não
   mostra nada disso, e é a primeira pergunta de quem está em atraso.
