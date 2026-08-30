# Formulário de impressora — os 5 campos que decidem depreciação e energia

## O que desenhar
O formulário de cadastro/edição de uma impressora no Catálogo (aba **Impressoras**). É o formulário mais
longo do Catálogo e o único que alimenta dois custos que o vendedor não enxerga sozinho: a **depreciação
da máquina** (valor ÷ vida útil) e a **energia** (consumo × horas × tarifa). O vendedor chega aqui uma vez
por impressora — no primeiro uso do produto, ou quando compra máquina nova — e depois só reencontra a peça
para conferir/ajustar. Ela aparece em dois lugares diferentes: no **mobile**, dentro de uma gaveta (Sheet)
ancorada à direita, aberta por "Adicionar impressora" ou por tocar num item da lista; no **desktop
(≥1280px)**, o formulário É a ficha do mestre-detalhe — a coluna direita de 560px, com a lista de
impressoras à esquerda. É o MESMO formulário nos dois lugares, montado em molduras diferentes.

## Por que este prompt existe
A auditoria classificou como `PROTOTIPO_PARCIAL`: o canvas 018 desenha os cinco campos com rótulos,
prefixos e sufixos idênticos aos implementados, e o DS documenta as props `hint` e `optional` do `Field` —
então o conjunto de campos e a FORMA da dica/tag têm desenho. Sobrevive sem autoridade nenhuma:
(a) a **ordem** — o canvas põe *Consumo médio* antes de *Vida útil da máquina*, o código faz o contrário;
(b) o **texto da dica** e a decisão de dar dica a UM campo só; (c) **qual** campo leva a tag "opcional";
(d) o arranjo em **coluna única** contra a grade do canvas; (e) o comportamento dentro dos **560px** da
ficha — este formulário é literalmente o motivo de a ficha ter rolagem interna própria (research §F: "o
caso do formulário de impressora com todos os campos"). Um protótipo antigo (§E5) descrevia outra
impressora — "modelo, h/dia, dias/mês, payback, nível de uso" — que pertence ao modelo de precificação
**descartado**; não use essa referência.

## O que já existe hoje (não invente do zero — corrija)
Ordem implementada, com os textos literais em pt-BR:

| # | Rótulo (literal) | Prefixo | Sufixo | Obrigatório | Ajuda |
|---|---|---|---|---|---|
| 1 | "Nome" | — | — | sim (`*`) | placeholder "Ex.: Ender 3" |
| 2 | "Valor da máquina" | `R$` | — | sim (`*`) | nenhuma |
| 3 | "Vida útil da máquina" | — | `h` | sim (`*`) | nenhuma |
| 4 | "Consumo médio" | — | `kW` | sim (`*`) | dica: "Consumo médio real da impressora, não a potência de placa (~0,12 kW)." |
| 5 | "Reserva de manutenção" | `R$` | `/h` | não | tag "opcional" à direita do rótulo |

Rodapé: dois botões alinhados à direita — "Voltar" (fantasma) e "Salvar" (primário) ou "Salvar alterações"
no modo edição. Título da gaveta: "Nova impressora" / "Editar impressora". Sucesso: toast "Impressora
salva." — e só depois de um 2xx real.

→ **A ordem diverge do canvas.** O canvas põe Consumo médio (3º) antes de Vida útil (4º). Decida uma e
diga qual, porque a ordem é o roteiro mental: "quanto custou → quanto tempo dura → quanto gasta de luz".

→ **A dica some quando o campo erra.** O `Field` do DS troca a dica pela mensagem de erro. Ou seja: a
única frase que impede o vendedor de copiar a potência da etiqueta desaparece exatamente quando ele
digitou algo errado nesse campo. Resolva no desenho (dica e erro coexistindo, ou a ajuda saindo do rodapé
do campo para um `InfoTip` no rótulo).

→ **A ajuda é desigual entre a Calculadora e o Catálogo.** Os MESMOS três campos (Consumo médio, Vida útil
da máquina, Reserva de manutenção) já têm textos longos homologados de `InfoTip` na Calculadora — ex.:
"A impressora se gasta imprimindo. Espalhar o preço dela pelas horas faz cada peça devolver um pedaço da
máquina… Ex.: 1.200 h/ano × 3 anos = 3.600 h." Aqui, nenhum deles aparece. O vendedor que cadastra a
impressora pelo Catálogo tem MENOS ajuda do que quem digita o mesmo número na Calculadora.

→ **Os avisos de plausibilidade não rodam aqui.** A frase "Confira o consumo: {v} kW. Acima de 5 kW já é
faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts: 120 W
são 0,12 kW. Nada foi recusado." existe e é disparada na Calculadora, não neste formulário. Um 350 (watts
digitado como kW) é salvo em silêncio e envenena todo cálculo futuro.

→ **A linha de resumo da lista discorda do canvas.** Implementado: "R$ 2.400,00 · 4680 h · 0,12 kW".
Canvas: "0,12 kW · 4.680 h de vida útil" com o dinheiro à parte. Note o `4680` sem separador de milhar.

## Conteúdo e dados reais
Use estes valores — são os do canvas 018 e são plausíveis:

- **Ender 3 V3** — Valor R$ 2.400,00 · Vida útil 4.680 h · Consumo 0,12 kW · Reserva R$ 0,50 /h
- **Bambu A1 mini** — Valor R$ 1.899,00 · Vida útil 3.600 h · Consumo 0,10 kW · Reserva R$ 0,40 /h

Formato e limites reais: números em pt-BR (vírgula decimal); campos de dinheiro ganham agrupamento de
milhar **ao sair do campo** ("2400,00" vira "2.400,00"). Teclado numérico no mobile. Placeholder padrão dos
numéricos: "0,00". Vida útil deve ser **> 0** (é denominador). Tetos: valor da máquina < R$ 10.000.000.000,
vida útil < 1.000.000 h, consumo < 100.000 kW, reserva < 1.000.000.000.000 /h. "Reserva de manutenção" em
branco vale **zero** — não é erro. Desenhe um caso longo: nome com 60+ caracteres sem espaço (o vendedor
cola código de modelo), e um valor de 10 dígitos, para provar que a coluna de 560px aguenta.

## Estados obrigatórios
1. **Repouso** — os 5 campos vazios (criar) ou preenchidos (editar).
2. **Foco** — anel de foco visível em campo, botão e no card da lista.
3. **Hover / pressionado** — nos dois botões do rodapé e nos cards da lista (desktop).
4. **Erro por campo**, com as frases literais: "Campo obrigatório." · "Informe um número válido." ·
   "Não pode ser negativo." · "Valor muito alto." · e a específica da vida útil: "A vida útil deve ser
   maior que zero." Mostre um quadro com o formulário em erro múltiplo.
5. **Salvando** — botão "Salvar" em carregamento; os campos continuam legíveis.
6. **Falha de escrita** — alerta de perigo acima do rodapé, com o texto honesto que o servidor der.
7. **Offline** — alerta calmo (info, nunca perigo) no topo do painel: título "Modo leitura offline",
   corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.";
   e o bloqueio de escrita: "Criar e editar precisam de conexão."
8. **Degradado (cache antigo)** — legenda "pode estar desatualizada" sob o item na lista.
9. **Premium pausado (lapsed)** — o formulário inteiro inerte, "Salvar" **substituído** pela linha de
   reativação: título "Reative o Premium", corpo "Reative o Premium para voltar a criar e editar. Seus
   itens estão salvos."; e no topo, "Premium pausado" / "Seus itens continuam aqui e podem ser usados no
   cálculo. Para criar ou editar, reative o Premium." O botão "Voltar" continua ativo.
10. **Vazio do catálogo** — "Nenhuma impressora salva ainda" / "Salve os dados da sua impressora uma vez e
    reutilize em cada cálculo." + botão "Adicionar impressora".
11. **Carregando a lista** — spinner; **erro de carga** — "Não foi possível carregar seu catálogo." +
    "Tentar novamente".

## Viewports
- **Mobile 390px** — a gaveta lateral em altura cheia, com teclado numérico aberto: prove que o rodapé
  "Voltar / Salvar" e o campo em foco convivem com o teclado.
- **Desktop 1280px** — o corte onde o mestre-detalhe nasce: lista à esquerda em coluna única + ficha de
  560px à direita, com os 5 campos e o rodapé. É AQUI que se decide a rolagem interna da ficha: mostre o
  estado em que o formulário é mais alto que a janela.
- **Desktop 1920px** — a lista vira duas colunas de cards; a ficha continua com 560px fixos.

## Regras que o desenho não pode quebrar
- **Freemium é binário e calmo**: sem Premium ativo, nada de CRUD falso — a interceptação acontece no
  toque, não no envio. Nenhum preço e nenhuma data na linha de reativação.
- **Falha de rede nunca é vendida como "não é premium"**, e vice-versa. Offline é info; erro de escrita é
  perigo; premium pausado é info.
- **Frase honesta nunca mora em placeholder** (o placeholder recorta). A dica do consumo, a tag "opcional"
  e a legenda de degradação vivem em elementos de largura cheia.
- **Alvos ≥44px** em botões, cards da lista e ícones de ação (duplicar/excluir).
- **Contraste medido contra o fundo real** — inclusive o card selecionado da lista, que troca o fundo.
- **Procedência do número**: a reserva de manutenção é por HORA (o sufixo "/h" não pode sumir no
  estreitamento); o consumo é medido, não é o da etiqueta.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não estimado**: um nome de 500 caracteres sem espaço já gerou 4.948px de
  rolagem horizontal a 1440px no card da lista. Desenhe o nome longo quebrando.
- **Texto ocluso passa em teste**: `toBeVisible` aprova elemento coberto. A ficha rola por dentro
  (`max-height` da janela) — se o rodapé "Salvar" ficar fora da área rolável, ninguém salva.
- **Sufixo cortado**: no 390px, um sufixo largo compete com o rótulo pela mesma linha apertada; por isso o
  gatilho de ajuda fica na LINHA DO RÓTULO, nunca na linha do controle.
- **A máscara de milhar se perde ao reabrir programaticamente** (follow-up conhecido) — desenhe o valor
  reaberto já agrupado: "R$ 2.400,00", não "2400".
- **Screenshot só vale em 1:1**; assertiva geométrica pega o que o texto não pega.

## Entregável
Pranchetas, tema **escuro como padrão** e **claro como first-class** (ambos desenhados, não derivados):
1. Mobile 390px — gaveta em repouso (criar, campos vazios).
2. Mobile 390px — gaveta em edição preenchida (Ender 3 V3), com teclado numérico.
3. Mobile 390px — erros múltiplos + a dica do consumo coexistindo com o erro.
4. Desktop 1280px — mestre-detalhe completo, ficha com os 5 campos e rodapé.
5. Desktop 1280px — ficha rolando por dentro (topo e fim visíveis em dois recortes).
6. Desktop 1920px — lista em duas colunas + ficha.
7. Premium pausado (um viewport basta) e Offline (um viewport basta).
8. Nome longo/valor de 10 dígitos, no 1280px.

Reutilize os primitivos: o quadro de campo (rótulo + `*` obrigatório + tag "opcional" + dica + erro) é o
`Field`; os quatro numéricos são `NumberField` com prefixo `R$` / sufixos `h`, `kW`, `/h`; o Nome é o
input de texto simples; rodapé com `Button` fantasma + `Button` primário com estado de carregamento;
avisos com `Alert` nos tons info/perigo; vazio com `EmptyState`; ficha e cards da lista com `Card`;
gatilho de ajuda com `InfoTip`. **Não crie primitivo novo** — se algo parecer faltar, diga qual e por quê,
em vez de desenhar um componente inédito.

## Perguntas em aberto para o dono
1. **Ordem dos campos**: canvas (Valor → Consumo → Vida útil → Reserva) ou código (Valor → Vida útil →
   Consumo → Reserva)? A ordem muda o roteiro de raciocínio do vendedor.
2. **Nível de ajuda**: os três campos (Consumo, Vida útil, Reserva) recebem os `InfoTip` longos já
   homologados na Calculadora, ou o Catálogo fica só com a dica curta do consumo? Hoje o mesmo vendedor
   tem ajudas diferentes para o mesmo número em telas diferentes.
3. **Aviso de plausibilidade neste formulário**: o "Confira o consumo… Nada foi recusado." deve aparecer
   ao salvar uma impressora com 350 kW, ou o aviso continua exclusivo da Calculadora?
4. **Vida útil por ritmo**: a Calculadora já oferece derivar as horas por ritmo de uso + payback
   ("Com que frequência ela roda?" / "Em quantos anos quer que ela se pague?"). O cadastro da impressora
   deve oferecer o mesmo caminho, ou continua pedindo horas cruas?
5. **Resumo do item na lista**: "R$ 2.400,00 · 4.680 h · 0,12 kW" (código, com milhar corrigido) ou
   "0,12 kW · 4.680 h de vida útil" com o valor à parte (canvas)?
