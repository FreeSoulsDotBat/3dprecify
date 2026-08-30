# Campo de texto — a moldura que 21 telas remontam à mão

## O que desenhar

O campo onde o vendedor **digita texto** no Precifica3D: o nome do filamento ("Ex.: PLA Azul"), o nome da impressora ("Ex.: Ender 3"), o rótulo do orçamento ("Cliente, pedido…"), o nome e a nota da simulação salva, e as três buscas do app (Catálogo, Orçamentos, Simulações). É a peça mais repetida do produto e a única do sistema de campos que nunca foi desenhada como peça: existe o campo numérico (`NumberField`, com R$ e unidade), existe o seletor (`Select`), existe a moldura de rótulo/dica/erro (`Field`) — não existe `Input` nem `Textarea`. Desenhe a peça inteira: campo de uma linha, campo de várias linhas, campo de busca, e todos os estados que hoje só existem por acidente.

## Por que este prompt existe

O canvas do dono (2026-07-02 e o 1920 do 018) desenhou o campo **parado e preenchido** em cinco lugares — a busca do Catálogo com lupa e "Buscar no catálogo…", os campos da ficha com prefixo/sufixo, a quantidade da peça do kit com o afixo "un", "Nome do kit" e a busca dos Orçamentos com "Cliente, pedido…". O que nunca foi desenhado: **erro, foco, desabilitado, com ação de limpar, multilinha, e a busca como peça própria**. O readme do import nomeia `Input`/`Textarea`, mas nenhum código deles chegou em `.design-import/components/` — não havia o que copiar, e cada tela remontou a moldura à mão (`<div class="tf-inputwrap"><input class="tf-input">`) em **21 lugares**. A consequência dura: o estado de erro é montado por concatenação manual de classe em **um** desses lugares (`catalog-controls.tsx:43`); nos outros 20, um campo inválido **não fica vermelho**. O erro aparece por sorte, não por decisão.

## O que já existe hoje (não invente do zero — corrija)

A moldura (`shared/ui/field.css`) é real e boa; herde-a em vez de reinventar:

| Parte | Como está hoje |
|---|---|
| Altura da moldura | 48px padrão (`--control-h`), 36px `sm`, 56px `lg` — o alvo de 44px já está garantido no padrão |
| Borda | 1.5px `--border-default`; hover → `--border-strong`; foco → borda + anel na cor `--focus-ring` lidos como **um traço só** |
| Erro | borda `--danger`; com foco, **continua vermelha** e o halo vira vermelho (regra já paga: o roxo do foco apagava o erro) |
| Desabilitado | fundo `--bg-muted`, opacidade 0.6, cursor `not-allowed` |
| Rótulo | `--fs-sm` semibold, reserva **duas linhas** para alinhar campos lado a lado; variante "tight" reserva uma |
| Obrigatório / opcional | asterisco na cor `--energy` à direita do rótulo; a tag "opcional" em texto fraco, empurrada para a direita |
| Dica e erro | dica em `--text-muted`; erro em `--danger-text`, e o erro **substitui** a dica |
| Aviso de plausibilidade | linha extra dentro da dica, tom `info` (`--info-text`) — deliberadamente **não** vermelha: o número não foi recusado |

O que está montado à mão e precisa virar decisão de desenho — marcado com →:

- → **A busca tem quatro formas diferentes.** Catálogo (desktop): moldura com lupa à esquerda, placeholder "Buscar no catálogo…" e o rótulo "Buscar no catálogo" escondido para leitor de tela. Orçamentos: rótulo **visível** "Buscar por rótulo" + placeholder "Cliente, pedido…", **sem lupa**. Simulações: **sem rótulo nenhum**, só placeholder "Buscar por nome…". E o seletor de categoria usa a mesma moldura para algo que não é campo. Uma peça, uma anatomia.
- → **Não há botão de limpar dentro do campo.** Limpar a busca só é possível pelo botão "Limpar busca" que aparece no estado vazio — ou seja, quem buscou e achou **três** resultados não tem como voltar a ver tudo sem apagar o texto letra por letra.
- → **A nota da simulação é um `<textarea rows=3>` dentro de uma moldura de altura fixa de 48px.** Três linhas pedidas, uma linha de altura entregue. O campo multilinha não existe como peça.
- → **Não há contador de caracteres**, embora os limites sejam reais: 120 no nome do orçamento e no nome da simulação, 500 na nota. O vendedor só descobre o limite quando o erro "Máximo de 120 caracteres." aparece — depois de já ter digitado demais.
- → **O rótulo da nota carrega o "(opcional)" dentro do texto** ("Nota (opcional)") enquanto a moldura já tem uma tag "opcional" própria — duas gramáticas para a mesma informação.

## Conteúdo e dados reais

Use estes textos **literais**, já homologados, nas pranchetas:

- Catálogo — filamento: rótulo "Nome" (obrigatório), placeholder "Ex.: PLA Azul"; rótulo "Material", placeholder "Ex.: PLA".
- Catálogo — impressora: rótulo "Nome" (obrigatório), placeholder "Ex.: Ender 3".
- Orçamentos — salvar: rótulo "Rótulo (opcional)", dica "Cliente, pedido…", máx. 120 caracteres. Ao lado dele vive um campo numérico "Validade da proposta" com afixo "dias" (1 a 3650) — desenhe os dois juntos uma vez, para provar o alinhamento de rótulo de duas linhas.
- Orçamentos — busca: rótulo "Buscar por rótulo", placeholder "Cliente, pedido…".
- Simulações — salvar: rótulo "Nome" (obrigatório), erro "Dê um nome à simulação." e "Máximo de 120 caracteres."; rótulo "Nota (opcional)", erro "Máximo de 500 caracteres."
- Catálogo — busca (desktop): placeholder "Buscar no catálogo…", rótulo acessível "Buscar no catálogo"; vazio de busca: título "Nada encontrado para essa busca", corpo "Tente outro termo, ou limpe a busca para ver tudo de novo.", ação "Limpar busca".
- Seletor de categoria (mesma moldura, comportamento de busca): rótulo "Categoria do anúncio (opcional)", dica "A comissão muda conforme a categoria.", placeholder "Busque pelo produto…", e a contagem **visível** "8 categorias encontradas" / "Mostrando 8 de 23 — refine a busca para ver as demais."
- Exemplo de vizinhança monetária, para provar contraste e alinhamento na mesma ficha: "Custo do rolo" com R$ 1.234,56 e o preço sugerido R$ 24,24.

## Estados obrigatórios

1. **Repouso vazio** — placeholder em `--text-faint`, e o placeholder carrega **só exemplo**, nunca uma frase honesta.
2. **Repouso preenchido** — "PLA Azul" em `--text-strong`.
3. **Hover** — borda `--border-strong`; a moldura inteira é área de clique (cursor de texto).
4. **Foco** — borda + anel na mesma cor, lidos como um traço único.
5. **Erro** — borda vermelha e a mensagem substituindo a dica: "Dê um nome à simulação."
6. **Erro com foco** — vermelho **mantido**, halo vermelho. É um estado próprio, não um acidente.
7. **Desabilitado** — fundo `--bg-muted`, 0.6 de opacidade. Acontece de verdade: a ficha do catálogo inteira vira somente-leitura via `fieldset disabled`, então desenhe **um formulário inteiro desabilitado**, não um campo solto.
8. **Perto do limite / no limite** — o que aparece aos 110/120 e aos 120/120 (hoje: nada até estourar).
9. **Multilinha em repouso e crescido** — a nota com 3 linhas e a nota com 500 caracteres.
10. **Busca vazia**, **busca com termo** (com a ação de limpar visível) e **busca sem resultado** — este último devolvendo "Nada encontrado para essa busca" + "Limpar busca", nunca "nenhum item salvo": existem itens, o filtro é que não achou.
11. **Aviso de plausibilidade** — linha extra em tom `info` sob o campo, junto com o valor **aceito**. Aviso nunca vira validação.

Não desenhe estados de carregamento, offline, premium pausado ou sem permissão **para esta peça**: quem carrega, degrada ou bloqueia no app é a lista, o cartão ou o painel ao redor — o campo de texto não tem esses estados hoje, e inventá-los criaria uma segunda gramática para eles.

## Viewports

- **390px (obrigatório)** — é onde o vendedor usa o produto. Prove: campo com rótulo de duas linhas, campo com erro, busca com ação de limpar, e a nota multilinha dentro de uma folha (sheet).
- **1280px (obrigatório)** — o corte do 018: a busca vive na barra de ferramentas da lista mestre, ao lado da contagem e do botão de adicionar, dividindo a largura com a ficha à direita.
- **1920px** — a mesma ficha em duas colunas, para provar que dois campos lado a lado ficam com as molduras alinhadas quando um rótulo quebra em duas linhas e o outro não.

## Regras que o desenho não pode quebrar

- **Frase honesta nunca mora em placeholder** — placeholder some quando o vendedor digita, e some para quem usa leitor de tela. Exemplo, sim; explicação, na dica.
- **Todo campo de busca tem rótulo** — visível ou acessível, mas existente e sempre com a mesma palavra da tela.
- **O erro é um estado da peça, não uma decoração opcional**: se o campo é inválido, ele fica vermelho — sem depender de quem montou a tela lembrar de pintá-lo.
- **Alvo de toque ≥44px** em qualquer botão dentro do campo (limpar, mostrar/ocultar), sem estourar a moldura de 48px.
- **Contraste medido contra o fundo real da moldura** (`--surface-card`), não contra o fundo da página — inclusive o placeholder e o texto desabilitado a 60% de opacidade.
- **Tema claro é de primeira classe**: o vermelho do erro é o mesmo vermelho medido nos dois temas.

## Armadilhas já pagas neste projeto

- **Um campo invisível passa em teste.** A busca das Simulações já foi entregue com 1×1px: escondeu-se o controle inteiro querendo esconder só o rótulo. Desenhe explicitamente a diferença entre "rótulo oculto" e "campo oculto".
- **Overflow horizontal medido, não presumido.** A moldura carrega um piso de 8rem e o texto interno pode encolher a zero — foi assim que uma grade de duas colunas com prefixo R$ e sufixo "/kWh" estourou o viewport de 360px. Um nome de produto de 120 caracteres **sem espaços** tem que quebrar dentro do campo, não empurrar a folha.
- **O rótulo não pode engolir o botão vizinho.** A dica em forma de ícone fica **ao lado** do rótulo, nunca dentro dele — dentro, o nome acessível vira "Vida útil da máquina Sobre a vida útil da máquina".
- **Uma contagem que mente é pior que nenhuma.** "8 categorias encontradas" com 23 existindo fez o vendedor parar de refinar. Se a lista corta, o texto diz que cortou.
- **Um campo que deixa de parecer campo quando é preenchido é um defeito** — já aconteceu com a categoria escolhida, que virou texto solto entre dois rótulos.

## Entregável

Pranchetas em **tema escuro (padrão) e tema claro**, ambas com o mesmo conteúdo:

1. **Anatomia** — rótulo, asterisco de obrigatório, tag "opcional", moldura, texto, afixo, dica e erro, com as medidas (48/36/56px, borda 1.5px, raio do campo).
2. **Grade de estados** — os 11 estados acima, um ao lado do outro, em 390px.
3. **Campo de busca como peça** — as três ocorrências reais reduzidas a **uma** anatomia: lupa, texto, ação de limpar, contagem; nos estados vazio / com termo / sem resultado.
4. **Multilinha** — a nota da simulação em repouso, crescida e no limite de 500.
5. **Em contexto** — a ficha do filamento a 390px e a barra de ferramentas da lista mestre a 1280px.

Reutilize os primitivos existentes: a moldura de rótulo/dica/erro é `Field` (com `required`, `optional`, `tightLabel`, `labelAddon`), a lupa e o "x" são `Icon`, a ação de limpar é `Button` `ghost`/`sm`, o vazio de busca é `EmptyState` com `Button` `secondary`, o afixo de unidade segue o mesmo desenho de `NumberField`, e a dica em ícone é `InfoTip`. **Não crie um novo tom, um novo raio ou um novo tamanho de controle** — o que falta é a peça, não a linguagem.

## Perguntas em aberto para o dono

1. **Contador de caracteres**: aparece sempre ("12/120"), só ao chegar perto do limite, ou nunca — e nos três campos com limite (rótulo do orçamento, nome e nota da simulação) ou só na nota?
2. **Ação de limpar dentro do campo de busca**: entra como "x" permanente enquanto há texto, ou o "Limpar busca" continua existindo só no estado sem resultado?
3. **Rótulo da busca**: qual é a forma canônica — rótulo visível (como em Orçamentos hoje) ou lupa + placeholder com rótulo só para leitor de tela (como no Catálogo)? As duas estão em produção e são visualmente diferentes.
4. **A nota da simulação cresce sozinha** conforme se digita, ou tem altura fixa de três linhas com rolagem interna?
5. **"Nota (opcional)" no texto do rótulo vs. a tag "opcional" da moldura** — qual das duas fica, para valer em todo o app?
