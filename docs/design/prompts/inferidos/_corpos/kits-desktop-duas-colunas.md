# Kits no desktop: peças à esquerda, ficha do kit à direita

## O que desenhar
A tela **Monte seus kits** (`/kits`) na composição desktop de duas colunas, a partir de 1280px: à esquerda a lista de peças que o vendedor está montando (cada peça é um cartão que abre para edição), à direita uma coluna fixa de 480px com a ficha do kit — total, preços por canal, gravar orçamento e salvar. É o momento em que o vendedor de impressão 3D monta um anúncio composto ("Kit suporte + base") e precisa ver o preço do conjunto inteiro mudar enquanto mexe nas peças. Abaixo de 1280px a mesma tela é uma coluna única com o total colado no rodapé — esse é o mobile homologado e ele **não muda**; aqui o que se desenha é o desktop e a fronteira entre os dois.

## Por que este prompt existe
Esta é a única superfície da área com desenho do dono: `Abas-Desktop.dc.html` (linhas 155–243, 1920px) definiu a grade `minmax(0,1fr) 480px`, o aside grudado, o cartão "Total do kit", o "Preços por canal (kit)" e o cartão de salvar — tudo implementado. Mesmo assim quatro coisas foram decididas sem desenho: **(a)** o canvas põe "Ver meus kits" e "Adicionar peça" como ações no cabeçalho da página, e o código não tem isso — o cabeçalho recebe só título e descrição, e "Adicionar peça" só existe no fim da lista; **(b)** o canvas marca o total com um selo verde "Ao vivo" que nunca foi implementado (grep no código: zero ocorrências); **(c)** o par varejo/atacado, que o canvas desenha como **dois cartões** (Varejo em destaque a 2,25rem, Atacado a 1,5rem), no código continua sendo o *readout* de uma coluna — duas linhas rótulo-à-esquerda/valor-à-direita, com fundo, borda e sombra removidos — que foi projetado para os 89px por valor de um viewport de **360px**, e vale igualzinho a 1920px porque não há media query; **(d)** a coluna da direita rola por dentro (`max-height` + `overflow-y`) quando resumo + canais + salvar + recibo não cabem na altura da janela, e essa rolagem não está desenhada em lugar nenhum. Além disso, **abaixo de 1280px e para dentro de cada cartão de peça não existe desenho nenhum** — o protótipo de 2026-07 não tem esta aba.

## O que já existe hoje (não invente do zero — corrija)

Cabeçalho da página: título **"Monte seus kits"**, descrição **"Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas"**. Sem nenhum botão.
→ O canvas prometeu dois botões aqui ("Ver meus kits" secundário, "Adicionar peça" primário) e eles não vieram. Desenhe a linha de ações do cabeçalho e diga o que acontece com o "Adicionar peça" do fim da lista quando o do topo existir (duplicar não é problema; sumir com o de baixo, numa lista de 12 peças, é).

Coluna esquerda — cada peça é um cartão recolhido que expande:

| Elemento | Texto/valor real | Observação |
|---|---|---|
| Título da peça | `"Peça 1 · Suporte de parede"` ou `"Peça 1 · (avulsa)"` | prefixo `Peça {n}`; `(avulsa)` quando não vem do catálogo |
| Botão de expandir | rótulo acessível `"Peça 1 · … — Editar esta peça"` / `"Recolher"` | seta ▲/▼ à esquerda |
| Quantidade | campo numérico, sufixo `un`, placeholder `1` | inteiro ≥ 0; 96px de largura |
| Remover | botão fantasma com ✕, rótulo `"Remover peça — Peça 1 · …"` | |
| Linha de dinheiro | `R$ 12,72 /un · Total da linha (3×) R$ 38,16` | lida do motor, nada é multiplicado na tela |
| Nome no catálogo | campo `"Nome da peça no catálogo"`, placeholder `Peça 1 · Kit suporte + base` | só aparece quando a peça **não** salva como referência |

→ O canvas desenhou o cartão de peça com uma grade de 4 métricas (Gramas / Impressão / Custo unitário / Total da linha) que o código **não tem** — hoje há uma linha corrida de texto. Decida no desenho: a grade de 4 colunas do canvas é a versão desktop do resumo da peça, e o mobile fica com a linha corrida.
→ Não há desenho nenhum do cartão **expandido** (o editor de peça inteiro entra ali dentro, dentro dos 1fr da coluna esquerda). É a maior lacuna de todas.

Coluna direita — hoje, de cima para baixo: cartão **"Preços por canal (kit)"**, depois o cartão **"Total do kit"**, depois o botão **"Salvar em Orçamentos"** centralizado, depois o cartão de salvar (**"Nome do kit"** + **"Salvar kit"**).
→ Ordem invertida em relação ao canvas, que põe "Total do kit" **primeiro**. A manchete de dinheiro está abaixo da tabela de canais.

Cartão "Total do kit" hoje: título `"Total do kit"` (sem selo), linha `"Custo total" — R$ 38,16`, e o par comprimido `Varejo · R$ 95,40` / `Atacado · R$ 76,32` em duas linhas de leitura sem cartão nenhum.
→ O canvas quer: selo `tf-badge--success` **"Ao vivo"** ao lado do título; a linha de custo com um sub-rótulo contando as peças; **Varejo como cartão de destaque a 2,25rem** e **Atacado como cartão discreto a 1,5rem**.

## Conteúdo e dados reais
- **Custo total** — soma dos custos das peças × quantidade. Exemplo: `R$ 38,16`.
- **Varejo** / **Atacado** — os dois preços sugeridos do kit. Exemplo: `R$ 95,40` e `R$ 76,32`. Rótulos curtos **"Varejo"** e **"Atacado"** (não "Preço varejo": o rótulo longo mede 111px e estoura o orçamento do readout compacto — no cartão de destaque do desktop isso deixa de ser problema, mas o vocabulário homologado é este).
- **Caso adversarial obrigatório**: um kit de 40 peças caras chega a `R$ 12.345,67`. Desenhe o cartão de Varejo com esse número, não com `R$ 95,40`.
- **Peças fora do total**: `"3 peça(s) fora do total — confira os avisos nas peças acima."` — legenda pequena no pé do cartão de total.
- **Sem preço ainda**: quando nenhuma peça é válida, o cartão **não** mostra `R$ 0,00`; mostra `"Sem preço ainda"` + `"O preço do kit aparece assim que ao menos uma peça estiver completa e válida."`
- **Preços por canal (kit)**: um bloco por marketplace. Cada bloco tem o nome do canal (ex.: `Mercado Livre · Clássico`) e **quatro** linhas — `Varejo · Preço do anúncio`, `Varejo · Recebido líquido`, `Atacado · Preço do anúncio`, `Atacado · Recebido líquido` — mais `"2 peça(s) somaram neste canal"` e, quando houver, `"1 peça(s) sem preço neste canal — não entrou na soma."` Sem nenhuma peça: `"Nenhuma peça com preço neste canal."` → O canvas desenhou **uma linha por canal**; o real são quatro mais duas legendas. Com dois canais o cartão passa de 300px de altura sozinho — é ele que estoura a coluna.
- **Salvar**: campo `"Nome do kit"` (obrigatório), placeholder `"Kit suporte + base"`; botão `"Salvar kit"` (`"Salvando…"` enquanto envia). Depois de salvar aparece `"O que este kit fez no seu catálogo"` com linhas `"{nome} — criado no catálogo"` / `"{nome} — já existia no catálogo, referenciado"` e, se houve referência, o aviso `"As peças referenciadas usam os valores do produto que já estava salvo, não os que você digitou aqui."` + botão `"Ver meus kits"`.
- **Salvar em Orçamentos**: botão secundário com ícone de disquete, desabilitado enquanto nenhuma peça válida existe. Não é o mesmo que salvar o kit — congela o que foi cotado hoje.

## Estados obrigatórios
- **Repouso** — 3 peças recolhidas, ficha completa à direita, nada rolando.
- **Uma peça expandida** — o cartão cresce dentro da coluna esquerda com o editor completo; a coluna direita continua ancorada no topo.
- **Foco / hover / pressionado** — anel de foco visível nos cartões clicáveis, no campo de quantidade e nos botões; o cartão de peça inteiro é um alvo de toque, então o hover precisa dizer que ele abre.
- **Vazio** — nenhuma peça: ícone de pacote, `"Monte seu kit peça por peça"`, `"Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro."`, botão `"Adicionar peça"` e, abaixo, o ghost `"Ver meus kits"`. **Nesse estado a grade de duas colunas não existe** — o vazio ocupa a largura toda.
- **Sem preço ainda** — há peças, nenhuma válida: o cartão de total na sua versão honesta (acima), sem cartão de canais.
- **Peça inválida** — no cartão: `"Confira os campos desta peça — ela não entra no total até ser corrigida."`; no total: a legenda de peças fora.
- **Quantidade 0** — `"Quantidade 0 — não entra no total."` (é um zero verdadeiro, não uma exclusão).
- **Peça degradada** — a peça foi reaberta sobre o último valor conhecido porque o produto de origem sumiu: legenda calma reaproveitada do catálogo, **nunca** "produto removido/excluído".
- **Carregando o plano** — spinner + `"Verificando seu plano…"`.
- **Falha ao verificar o plano** — `"Não foi possível verificar seu plano."` + `"Tentar novamente"`. Isso é rede, **não** é "você não é premium".
- **Catálogo de tarifas desatualizado** — alerta informativo no topo, com botão de recarregar; não bloqueia nada, os preços continuam computando.
- **Sem premium** — a porta honesta do teaser ocupa a página inteira (um único teaser na tela, nunca dois).
- **Premium pausado** — `"Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo."` como faixa informativa; o botão "Salvar kit" continua **visível e clicável**, e responde com um aviso em tom informativo (não vermelho) quando tocado.
- **Salvando** — `"Salvando…"`, botão desabilitado.
- **Coluna direita mais alta que a janela** — o estado que ninguém desenhou: com dois canais + resumo + salvar + recibo, a ficha passa de 100vh e rola por dentro. Desenhe como isso se apresenta (o total tem que continuar legível; se a rolagem interna cortar a manchete de dinheiro, o desenho falhou).

## Viewports
- **1920px** — o viewport em que o dono desenhou; grade `1fr / 480px`, página limitada a 1720px.
- **1280px** — o primeiro pixel da composição desktop. É o caso apertado: 480px de ficha deixam ~700px de lista com o menu lateral. Prove que o cartão de peça expandido cabe aí.
- **1279px** — o último pixel antes do corte, com o total colado no rodapé. Não é para redesenhar o mobile; é para mostrar a fronteira e o que o vendedor perde/ganha ao cruzá-la.
- **390px** — só como referência do que **não pode mudar**: o readout compacto de uma coluna e a barra fixada no rodapé.

## Regras que o desenho não pode quebrar
- **Nenhum número é somado na tela.** Todo valor vem do motor de preço; o desenho não pode sugerir um total "aproximado" nem arredondar.
- **Peça excluída é dita, nunca zerada.** Uma peça inválida some do total *e* aparece uma legenda contando quantas.
- **Zero não é a mesma coisa que "ainda não".** `R$ 0,00` só quando o valor é realmente zero.
- **Falha de rede nunca é vendida como "não premium".** As duas frases são diferentes e têm ações diferentes.
- **Pausado é calmo.** As palavras "expirou", "bloqueado" e "suspenso" são proibidas. E a recusa de salvar em conta pausada é uma resposta esperada, não um erro vermelho.
- **Frase honesta em elemento de largura inteira**, nunca dentro de um placeholder (placeholder carrega número, não explicação).
- **Alvos ≥44px** — o cartão de peça, a quantidade, o remover.
- **Contraste medido contra o fundo real**: o par varejo/atacado é o caso conhecido — texto em tom accent sobre superfície clara já apagou uma vez quando o fundo do cartão foi removido.

## Armadilhas já pagas neste projeto
- **A regra de 360px valendo a 1920px.** O readout compacto existe porque a 360px sobravam 89px por valor. Ele nunca foi limitado por media query, então o vendedor no monitor grande lê a manchete de dinheiro no formato de aperto. O desenho tem que declarar as duas formas e onde cada uma vale.
- **Um `sticky` dentro de outro.** Quem gruda no desktop é a **coluna inteira**; o resumo dentro dela não gruda sozinho, senão a camada de dentro parece solta. Se o desenho pedir "total sempre visível" dentro de uma coluna que rola, isso é uma decisão nova — diga-a com todas as letras.
- **Valor grande estourando a coluna.** Um inteiro sem ponto de quebra empurra o cartão e depois a página inteira. Desenhe com `R$ 12.345,67` e mostre quem cede — o rótulo trunca, o número nunca.
- **Rótulo longo trancando o número.** "Preço atacado" (111px) já não coube; por isso os rótulos são "Varejo"/"Atacado".
- **Transbordo horizontal medido, não estimado.** A largura da coluna esquerda é `minmax(0, 1fr)` justamente porque um filho largo, sem isso, empurra a grade.
- **Texto ocluso passa em teste.** Um número escondido atrás da barra fixa ou cortado pela rolagem interna passa em toda asserção de texto — só a imagem pega.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro, ambos em pé de igualdade:
1. **1920px · repouso** — 3 peças recolhidas + ficha completa, com o cabeçalho ganhando as duas ações.
2. **1920px · peça expandida** — o editor dentro do cartão, ficha intacta.
3. **1280px · o caso apertado** — a mesma coisa no primeiro pixel do desktop.
4. **1920px · coluna direita rolando** — dois canais, ficha mais alta que a janela.
5. **1920px · vazio** e **1920px · sem preço ainda**.
6. **1920px · degradações** — peça inválida + peça degradada + premium pausado numa só prancheta.
7. **1279px** — a fronteira, com a barra fixa no rodapé.

Reutilize os primitivos existentes, sem criar nada novo: `tf-card` para peça, total, canais e salvar; `tf-brow` (com `tf-brow__sub`) para "Custo total" e para cada linha de canal; `tf-price` nas variantes `--accent --md/--lg --center` para Varejo e `tf-price --md` discreto para Atacado; `tf-badge--success` para o "Ao vivo"; `tf-inputwrap`/`tf-input` (com afixo `un`) para quantidade e nome; `tf-btn` nas variantes `--primary`, `--secondary`, `--ghost` e `--sm`/`--lg`; `tf-alert` (`--danger` para peça inválida, `--info` para pausado e catálogo desatualizado); `tf-field__hint` para as legendas honestas; `tf-empty` para o vazio; `tf-page-header` para o cabeçalho.

## Perguntas em aberto para o dono
1. **O selo "Ao vivo" fala do quê?** No canvas ele está colado no total. Ele significa "este número recalcula enquanto você digita" ou "as tarifas de marketplace estão atualizadas"? São duas promessas diferentes — a segunda pode ficar falsa quando o catálogo de tarifas não atualiza, e aí o selo precisaria de um estado alternativo.
2. **Ordem da coluna direita**: "Total do kit" primeiro (como o canvas) ou "Preços por canal" primeiro (como o código está)? Com o cartão de canais na frente, a manchete de dinheiro só aparece depois de ~300px de tabela.
3. **Com o "Adicionar peça" no cabeçalho, o botão do fim da lista continua existindo?** Numa lista de 12 peças o de baixo é o que está perto do trabalho; o de cima é o que está sempre visível.
4. **A grade de 4 métricas por peça (Gramas / Impressão / Custo unitário / Total da linha) do canvas é para valer?** Ela exige mostrar gramas e tempo no cartão recolhido, que hoje só existem dentro do editor.
5. **Quando a ficha não cabe na altura da janela, o que fica sempre visível?** Rolar a coluna inteira (hoje) esconde o total; fixar o total dentro da coluna cria uma segunda camada grudada. É uma decisão de produto, não de CSS.
