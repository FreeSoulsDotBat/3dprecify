# Congelar um orçamento a partir de uma simulação aberta

## O que desenhar

A ação que transforma uma **simulação** (estratégia viva, recalculada com os preços de hoje toda vez que abre) em um **orçamento** (documento congelado, imutável, com data). Ela vive na aba **Calcular**, com uma simulação carregada — a barra de contexto "Simulação: {nome}" no topo da página. Quem usa é o vendedor premium que abriu uma estratégia salva, olhou os preços recalculados e decidiu: *este é o preço que vou cotar para este cliente*. O desenho precisa cobrir **onde a ação mora** (hoje ela troca de lugar conforme o tipo de base), **o botão**, e a **folha de confirmação** que abre em cima dele — porque é ali, e só ali, que o vendedor pode ser avisado de que está criando outro tipo de objeto.

## Por que este prompt existe

A ponte entre o objeto vivo e o congelado foi resolvida **por posicionamento de botão**, sem desenho. Com simulação escalar (avulsa ou de produto) aberta, o botão comum do rodapé passa a carregar a procedência da simulação — e nada na tela diz isso. Com simulação de **kit** aberta, esse mesmo botão é **suprimido** e um botão idêntico reaparece **lá em cima**, junto do resumo do kit. A exclusão mútua é correta tecnicamente (o rodapé mostra campos que não são os do kit), mas ninguém desenhou o resultado: o mesmo rótulo, em dois lugares, sem explicação.
A metade **receptora** já está desenhada — o canvas 018 (ficha de Orçamentos, card "Ficha técnica") traz "Registro criado a partir de: {nome}" e o link de origem, a 1920px. O que nunca foi desenhado é o lado **emissor**. E há uma divergência declarada: o `ux §8` prescreve o botão **dentro da barra de contexto da simulação**, que não é onde ele está hoje.

## O que já existe hoje (não invente do zero — corrija)

Ordem real da página com uma simulação carregada:

| # | Elemento | Base AVULSA / PRODUTO | Base KIT |
|---|---|---|---|
| 1 | Barra de contexto `Simulação: {nome}` + "Recalculado com os preços de hoje" + ações (Abrir origem · Renomear · Duplicar · Salvar alterações · Fechar simulação) | presente | presente |
| 2 | Card "Kit: {nome}" com "Preços por canal do kit, recalculados com os preços de hoje." | ausente | presente |
| 3 | **Botão "Salvar em Orçamentos"** | ausente aqui | **aqui**, logo abaixo do card do kit |
| 4 | Formulário da calculadora (campos escalares) | editável | **presente, com valores obsoletos que não são o do kit** |
| 5 | Resultado + "Preços por canal" | presente | presente (mas do formulário, não do kit) |
| 6 | Botão "Salvar simulação" | presente | presente |
| 7 | **Botão "Salvar em Orçamentos"** | **aqui**, no rodapé | suprimido |

→ **Problema 1:** o mesmo rótulo em duas posições distantes, sem nada que explique a troca.
→ **Problema 2:** na base KIT o botão fica no topo e o formulário abaixo continua mostrando números antigos — o vendedor pode ler o rodapé e achar que é aquilo que vai congelar.
→ **Problema 3:** nem o botão nem a folha dizem que existe um vínculo sendo criado.

Textos literais de hoje, todos homologados (não reescreva sem motivo):
- Botão: **"Salvar em Orçamentos"** (variante secundária, com ícone de disquete/`save` 18px à esquerda).
- Folha — título: **"Salvar em Orçamentos"**; intro: **"Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje."**
  → esta intro é o ponto fraco: *"nesta tela"* é ambíguo justamente no caso KIT (a tela tem duas telas) e ela **não menciona a simulação de origem**. É a única frase da jornada onde o vínculo poderia ser dito no ato.
- Campos da folha: **"Rótulo (opcional)"** com dica **"Cliente, pedido…"** · **"Validade da proposta"** com sufixo **"dias"** · grupo **"Preço que você está cotando"** com as opções **"Varejo"** e **"Atacado"**.
- Linha de data: **"Cotado em 20/08/2026"**. Botão de envio: **"Salvar em Orçamentos"**.
- No destino: **"Registro criado a partir de: Vaso hexagonal — versão feira"** (card "Ficha técnica").

## Conteúdo e dados reais

- **Rótulo**: texto livre, opcional, máx. 120 caracteres. Vazio vira ausência, nunca `""`. Exemplo: `Ana — pedido 214`.
- **Validade da proposta**: número inteiro, 1 a 3650, opcional, unidade "dias" à direita dentro do campo. Exemplo: `15`. Não expira nada — é a promessa do vendedor.
- **Preço que você está cotando**: rádios com o **valor em dinheiro ao lado de cada opção**, em negrito: `Varejo — R$ 24,24` / `Atacado — R$ 21,01`. Varejo vem pré-selecionado. Quando só existe um dos dois, aparece **só um rádio**.
- **Card do kit (base KIT)**: por marketplace, o nome do canal e até duas linhas — `Varejo: R$ 137,60` e `Atacado: R$ 119,90`. Pode trazer o aviso `Corrija os campos deste canal para ver os preços. (2)`.
- **Data**: do relógio do aparelho, no formato `20/08/2026`, mostrada **antes** de confirmar.
- Derivado e nunca editável aqui: o total congelado, a versão da fórmula e a procedência (id + nome da simulação **como estava ao abrir**).

## Estados obrigatórios

- **Ausente (sem Premium ativo)** — o botão **não existe**: não é cinza, não é isca. A calculadora grátis fica intacta. Desenhe a mesma região sem ele, para provar que não sobra buraco nem legenda órfã.
- **Repouso / hover / foco visível / pressionado** do botão secundário, nas duas posições.
- **Desabilitado** — quando não há preço válido; o rodapé mostra em vez disso: *"Confira os campos destacados para ver o preço."*
- **Ausente por kit sem linha precificável** — na base KIT, se nenhuma peça tem preço, o botão simplesmente não aparece (e o card mostra *"Confira os campos destacados para ver o preço."*).
- **Folha aberta** — repouso, com Varejo marcado.
- **Enviando** — botão de envio em carregamento, campos ainda legíveis.
- **Sucesso** — a folha fecha e aparece: *"Registro salvo em Orçamentos."* (tom sucesso).
- **Pendente (offline)** — *"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."* (tom informativo, **nunca** erro).
- **Envio pausado — Premium** — *"Envio pausado — o Premium não está ativo. O registro continua neste aparelho."*
- **Sessão expirada** — *"Envio pausado — sua sessão expirou. O registro continua neste aparelho."* (a palavra "conexão" **não pode** aparecer aqui).
- **Recusado pelo servidor** — *"Não foi possível registrar. O servidor não aceitou este registro."* (tom perigo).
- **Falha do aparelho** — *"Não foi possível guardar o registro neste aparelho. Ele não foi salvo."*; a folha **continua aberta**, com tudo preenchido.
- **Simulação com alterações não salvas** — o crachá "Alterações não salvas" está visível na barra de contexto enquanto o vendedor congela. Desenhe esse caso: o que vai para o orçamento é o que está na tela, não o que está salvo na simulação.
- **Simulação degradada** (referência de catálogo sumiu) — o alerta informativo da barra continua acima; o congelamento segue permitido.

## Viewports

- **Mobile 390px** — obrigatório: é onde a distância entre as duas posições do botão mais dói (o card do kit e o rodapé ficam a várias telas de rolagem um do outro). Desenhe a página com base KIT em duas capturas empilhadas, mostrando essa distância.
- **Desktop 1280px** — obrigatório: o canvas 018 fixou 1280px como o corte do layout largo, e é onde cabe uma alternativa com a ação junto da barra de contexto.
- 1920px é opcional; a aba Calcular ficou de fora do canvas 018 e não tem autoridade de layout desenhada.

## Regras que o desenho não pode quebrar

- **Freemium é binário**: sem Premium ativo a ação **não existe**. Nada de botão cinza, cadeado ou isca dentro da calculadora.
- **Procedência dita, não deduzida**: se o desenho anunciar o vínculo com a simulação, tem de ser com o nome real dela, e no momento da ação.
- **Rede nunca vendida como Premium** e **Premium nunca vendido como rede**: os quatro estados de envio têm frases próprias e distintas.
- **Frase honesta fora de placeholder**: nada de explicar o congelamento dentro do campo "Rótulo" ou como texto-fantasma.
- **Alvo ≥ 44px** para o botão e para cada rádio (a linha inteira do rádio, com o valor, é área clicável).
- **Contraste medido contra o fundo real** do card/folha, nos dois temas — inclusive o valor em negrito ao lado do rádio.
- **Congelado é congelado**: nada no desenho pode sugerir que o orçamento vai continuar acompanhando a simulação.

## Armadilhas já pagas neste projeto

- **Valor grande estoura a coluna**: desenhe o rádio com `R$ 1.234,56` e com um rótulo de canal longo — já houve um PDF em que o nome do item passou por cima do preço, e o teste de texto não viu.
- **Overflow horizontal medido**: a linha "Varejo — R$ 1.234,56" e o nome do marketplace no card do kit precisam caber a 390px sem empurrar a página no eixo X.
- **Texto ocluso passa em teste**: o botão no topo, sob a barra de contexto, não pode ficar atrás de nenhum elemento fixo — a homologação já achou botão nascido fora da viewport.
- **Toast que nunca renderiza**: a folha fecha antes da resposta em alguns caminhos; o desenho deve prever a confirmação em um lugar que sobreviva ao fechamento (e mostrar onde ela aparece).
- **Placeholder que corta a frase**: o campo de validade é numérico e estreito; qualquer explicação vai para dica ou legenda, nunca para dentro dele.

## Entregável

Pranchetas, **tema escuro como padrão e tema claro como first-class** (as duas versões de cada uma):

1. **390px — base KIT, estado atual**: página com barra de contexto, card do kit e o botão no topo; segunda captura mostrando o rodapé sem o botão.
2. **390px — base AVULSA/PRODUTO, estado atual**: rodapé com "Salvar simulação" e "Salvar em Orçamentos" um abaixo do outro.
3. **390px — proposta**: a ação em **um lugar só**, com a distinção entre "guardar a estratégia" e "congelar um orçamento" visível, e o vínculo dito no ato.
4. **Folha de confirmação, 390px**: repouso · enviando · falha do aparelho (folha aberta com erro).
5. **Tira de estados**: ausente sem Premium · desabilitado · kit sem linha precificável · os cinco avisos de resultado.
6. **1280px**: a proposta no layout largo, com a região da barra de contexto.

Use os primitivos existentes: `Card` para a barra de contexto e o card do kit, `Button` secundário com `Icon name="save"` para a ação, `Sheet` para a folha, `Field` + `tf-input`/`tf-inputwrap` para rótulo e validade, `fieldset`/`tf-record__basis` para os rádios, `Alert` para os avisos persistentes e o padrão de toast para os transitórios, `Badge` neutro para "Alterações não salvas". **Não crie primitivo novo.**

## Perguntas em aberto para o dono

1. A ação fica **junto da barra de contexto da simulação** (como o `ux §8` prescreve) ou permanece **junto do resultado** que está sendo congelado? As duas leituras são defensáveis e mudam a prancheta 3.
2. O rótulo do botão deve **mudar** quando há simulação carregada (algo como "Congelar como orçamento") ou "Salvar em Orçamentos" atende os dois casos? Trocar copy homologada é decisão sua.
3. A intro da folha deve **nomear a simulação de origem** ("a partir de *Vaso hexagonal — versão feira*")? Hoje ela diz apenas "nesta tela".
4. No orçamento gerado a partir de uma simulação, a ficha técnica mostra o nome da origem mas **não oferece link de volta** — existem "Abrir produto" e "Abrir kit", não existe "Abrir simulação". Deve existir?
5. Na base KIT, o formulário escalar do rodapé continua visível com números que não são os do kit. Ele deve ser **ocultado** enquanto a simulação de kit está aberta?
