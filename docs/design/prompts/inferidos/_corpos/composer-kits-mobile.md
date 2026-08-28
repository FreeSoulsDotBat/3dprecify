# Compositor de kits em mobile — a tela /kits inteira a 390px

## O que desenhar

A tela **Kits** como o vendedor a vê no celular: uma pilha única e vertical onde ele monta um anúncio de
kit peça por peça, com cada peça num card que abre para virar a calculadora completa, e o **Total do kit**
grudado no rodapé enquanto ele trabalha. É a superfície onde o vendedor Premium passa MAIS tempo: entra por
"Kits" na TabBar (5 abas, 64px de altura, fixa), monta 2 a 6 peças, confere o preço por canal, e sai por
"Salvar kit" (guarda o kit vivo, que recalcula) ou por "Salvar em Orçamentos" (congela o que ele cotou hoje).
Este prompt é da **composição da tela**: ordem, hierarquia, densidade, dobra e convivência com a TabBar.
O interior de cada bloco já tem prompt próprio (card da peça recolhido, editor expandido, cartão "Preços por
canal (kit)", estado vazio, recibo de materialização, Premium pausado) — aqui interessa como eles se **empilham**.

## Por que este prompt existe

Nada disso foi desenhado. O protótipo do Claude Design de 2026-07-02 tinha **quatro abas** — Calcular ·
Catálogo · Histórico · Conta — e nenhuma tela de kits; a auditoria do protótipo não cita kit/BOM em nenhum
dos 16 achados; o canvas `Abas-Desktop.dc.html` é um artboard de 1920px sem uma única media query e o bloco
Kits dele não diz nada sobre largura menor. O documento de UX do incremento (`ux-bom.md` §6.1, item 1) pediu
EXATAMENTE este protótipo — "valida densidade a 390px", prioridade *High* — e ele nunca foi feito.
Resultado: a hierarquia de hoje veio de **correções reativas de homologação**, não de decisão de desenho —
a barra do total cortada pela TabBar (014/T118, os dígitos do total ficaram cortados a composição inteira) e
o par varejo/atacado que não cabia em duas colunas a 360px (A5-b). O desktop ≥1280px é outro prompt
(`kits-desktop-duas-colunas`); abaixo de 1280px os invólucros da grade são `display: contents`, ou seja
**não existem** — tudo é filho direto da seção, nesta ordem.

## O que já existe hoje (não invente do zero — corrija)

A pilha, de cima para baixo, com `gap` de 16px entre TODOS os blocos (não há hierarquia de espaçamento hoje):

| # | Bloco | Conteúdo literal | Quando aparece |
|---|---|---|---|
| 1 | Título da página | h1 "Monte seus kits" + linha de apoio "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas" | sempre |
| 2 | Alerta info | "Não foi possível verificar seu plano." | recheque de plano falhou, mas a última resposta dizia ativo |
| 3 | Alerta info | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." | kit salvo reaberto com Premium pausado |
| 4 | Alerta info c/ título | "Não foi possível atualizar as taxas" + "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." + botão secundário pequeno "Tentar novamente" | falha de refresh do catálogo de tarifas |
| 5 | Cards de peça | "Peça 1 · Suporte de headset" ou "Peça 1 · (avulsa)", campo de quantidade (unidade "un", ~96px de largura), botão fantasma com X ("Remover peça") | ≥1 peça |
| 6 | Botão secundário | ícone `plus` + "Adicionar peça" | ≥1 peça |
| 7 | Cartão | "Preços por canal (kit)", um bloco por marketplace | quando alguma peça tem canal |
| 8 | **Barra fixa** | "Total do kit" · "Custo total" · "Varejo" · "Atacado" | ≥1 peça válida |
| 9 | Botão secundário centralizado | ícone `save` + "Salvar em Orçamentos" | só com Premium **ativo** (some no pausado) |
| 10 | Caixa com borda | campo "Nome do kit" (obrigatório, placeholder "Kit suporte + base") + botão primário "Salvar kit" / "Salvando…" + recibo pós-salvamento | sempre que houver peças |

→ **A subida da dobra.** Com os três alertas na tela (acontece de verdade: reabrir um kit offline com o
plano pausado), a primeira peça começa depois de ~380px de avisos — mais da metade dos 844px do iPhone 14.
O desenho tem que decidir o que colapsa: alertas empilhados viram uma faixa única? o subtítulo some depois
da primeira visita? o cabeçalho encolhe ao rolar?

→ **A barra fixa cobre o que vem DEPOIS dela.** Os itens 9 e 10 estão abaixo da barra no fluxo, então ao
rolar até o fim o vendedor lê "Salvar em Orçamentos" e "Salvar kit" **por baixo** de uma barra opaca de
~140px. Ninguém decidiu isso: a barra ganhou `sticky` para o total ficar sempre visível, e as duas ações de
guardar ficaram debaixo dela. Desenhe a saída (a barra libera o rodapé no fim do scroll? as ações sobem
para dentro da barra? a barra vira um resumo de uma linha quando o fim chega?).

→ **Duas ações de "salvar" coladas, com significados opostos.** "Salvar em Orçamentos" congela o preço de
hoje; "Salvar kit" guarda o kit vivo, que recalcula. Hoje são dois botões vizinhos com o mesmo peso visual
e nenhuma frase que diga a diferença.

## Conteúdo e dados reais

- **Dinheiro** sempre `R$ 1.234,56`. Números de exemplo verdadeiros (a semente do app): peça de custo
  **R$ 16,16**, varejo **R$ 24,24**, atacado **R$ 21,01**. Kit de 3 unidades: custo total **R$ 48,48**,
  varejo **R$ 72,72**, atacado **R$ 63,03**. Use também um caso de **5 dígitos — R$ 1.234,56** — em pelo
  menos uma prancheta: foi um valor curto que deixou o aperto da barra dormir até a homologação.
- **Linha de resumo do card recolhido**: "R$ 16,16 /un · Total da linha (3×) R$ 48,48".
- **Quantidade**: inteiro ≥ 0, placeholder "1", sufixo "un". Teto real do banco 2.147.483.647 — acima
  disso aparece um aviso amarelo (nunca recusa): "Confira a quantidade: 3.000.000.000. O máximo por peça é
  2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."
- **Rótulos da barra fixa são curtos DE PROPÓSITO**: "Varejo" e "Atacado", não "Preço varejo"/"Preço
  atacado" — o rótulo longo mede 111px e o orçamento da linha é ~101px, então ele truncaria no caso normal
  de 5 dígitos. O contexto ("Total do kit" acima, o R$ na mesma linha) é o que nomeia o número.
- **Nome da peça no catálogo**: campo que só aparece na peça que vai virar produto ao salvar, com o
  placeholder pré-preenchido no padrão "Peça 1 · Kit suporte + base".
- **Recibo pós-salvamento**: "O que este kit fez no seu catálogo" + lista "{nome} — criado no catálogo" /
  "{nome} — já existia no catálogo, referenciado" + botão "Ver meus kits".

## Estados obrigatórios

1. **Vazio** — nenhuma peça: estado vazio com ícone `package`, "Monte seu kit peça por peça", "Some peças
   avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro.", botão primário
   "Adicionar peça" e, abaixo, botão fantasma pequeno "Ver meus kits". **Não há barra fixa neste estado.**
2. **Sem preço ainda** — há peças, nenhuma válida: a barra mostra "Total do kit" / "Sem preço ainda" /
   "O preço do kit aparece assim que ao menos uma peça estiver completa e válida." — nunca três zeros.
3. **Parcial** — alguma peça fora da soma: a barra ganha a legenda "2 peça(s) fora do total — confira os
   avisos nas peças acima." e a peça culpada mostra "Confira os campos desta peça — ela não entra no total
   até ser corrigida."
4. **Composição normal** — 2 a 6 peças recolhidas, barra com números.
5. **Uma peça aberta** — o card expandido vira o formulário inteiro da calculadora (centenas de pixels de
   altura). Mostre o que sobra visível ao redor: quantos cards vizinhos ainda cabem, e onde fica a barra.
6. **Densidade máxima** — 6 peças, o cartão de canais aberto, os três alertas presentes: a pior tela real.
7. **Salvando** — botão em "Salvando…", desabilitado.
8. **Erro de salvamento** — alerta `danger` acima do botão; **com Premium pausado o MESMO erro é `info`**,
   porque ali a recusa é a resposta esperada, não uma falha.
9. **Premium pausado (kit reaberto)** — faixa info do item 3, "Salvar em Orçamentos" **inexistente** (não
   é botão cinza), "Salvar kit" continua visível e responde honestamente ao toque.
10. **Offline / catálogo de tarifas defasado** — o alerta do item 4; tudo continua calculando.
11. **Peça degradada** — o produto referenciado foi apagado depois do salvamento: legenda calma "Os valores
    atuais foram mantidos e continuam editáveis." (jamais "removido"/"excluído").
12. **Foco / hover / pressionado** — o cabeçalho do card da peça é um botão de linha inteira (≥44px) com
    chevron, rótulo acessível "Peça 1 · Suporte de headset — Editar esta peça" / "— Recolher". Anel de
    3px visível em todos, inclusive quando o elemento está sob a barra fixa.

## Viewports

Só **mobile**: **390px** (a referência), mais **360px** para a densidade apertada — foi a 360px que o par
varejo/atacado deixou 89px por valor e nenhum tratamento tipográfico salvou "R$ 1.234,56". Vale uma
prancheta a **744px** (tablet retrato) porque a faixa 426–1279px usa exatamente esta mesma pilha, agora com
uma barra lateral de menu ao lado — a pilha mobile estica sem nenhuma regra própria, e ninguém olhou para
isso. Desktop ≥1280px **não** entra aqui: lá a tela vira duas colunas e a barra do rodapé desaparece
(prompt `kits-desktop-duas-colunas`).

## Regras que o desenho não pode quebrar

- A barra fixa **nunca** pode encostar na TabBar de 64px: ela para acima dela (mais a área segura do
  aparelho). Foi exatamente esse o defeito de 014/T118 — os dígitos do total, o número pelo qual o vendedor
  abriu a tela, ficaram cortados durante a composição inteira.
- **Falha de rede nunca é upsell**: "Não foi possível verificar seu plano" e "Não foi possível atualizar as
  taxas" são `info`, com retentativa, e o trabalho na tela continua. Nunca virar teaser de Premium.
- **Premium pausado é calmo**: nada de "expirou", "bloqueado" ou "suspenso"; os kits são dados do vendedor.
- **Nada de zero falso**: sem peça válida não existe "R$ 0,00" — existe "Sem preço ainda".
- **Toda frase honesta em elemento de largura total**, nunca dentro de placeholder (o placeholder só carrega
  número/exemplo, como "Kit suporte + base" e "1").
- **Alvo ≥44px** em cabeçalho de card, campo de quantidade, botão de remover e retentativa — todos
  convivendo na mesma linha estreita.
- **Contraste medido contra o fundo real da barra fixa**, que fica sobre conteúdo rolando: a barra precisa
  ser opaca o bastante para o número não competir com o texto que passa por trás.

## Armadilhas já pagas neste projeto

- **A barra do total já foi cortada pela TabBar** (014/T118) — 8px medidos do chão do viewport eram 56px
  DENTRO da navegação; `padding-bottom` de página não protege elemento fixo.
- **Duas colunas na barra a 360px** (A5-b) — 89px por valor não comportam "R$ 1.234,56" em nenhuma
  tipografia; uma coluna com rótulo à esquerda e valor à direita devolveu ~216px ao número **e** deixou a
  barra mais baixa. Quem cede é sempre o rótulo (reticências), nunca o número.
- **Rótulo comprido trunca no caso normal** (A5-c/A5-d) — "Preço atacado" a 12px mede 111px num orçamento
  de ~101px.
- **Texto ocluso passa em teste**: oclusão não é propriedade de texto — a barra flutuante por cima das
  ações de salvar passaria em qualquer asserção de conteúdo. Este projeto já pagou isso três vezes; layout
  se homologa com caixa e captura, não com string.
- **Transbordo horizontal a 360/390px** já apareceu como transbordo da PÁGINA, não de um elemento: a
  pilha não pode ter nenhum bloco mais largo que a goteira.

## Entregável

Pranchetas a 390px, **tema escuro primeiro e tema claro completo** (o claro é first-class, e a barra
fixa translúcida é onde ele costuma quebrar): (1) estado vazio; (2) composição normal com 3 peças
recolhidas + cartão de canais + barra do total; (3) uma peça aberta, mostrando o entorno; (4) densidade
máxima com os três alertas e 6 peças, provando a dobra; (5) o fim do scroll — as duas ações de guardar e
a caixa "Nome do kit" convivendo com a barra fixa; (6) "Sem preço ainda" + parcial com a legenda de peças
fora do total; (7) Premium pausado. Mais uma prancheta a **360px** só da barra com **R$ 1.234,56** nos três
números, e uma a **744px** da pilha esticada.

Componha com os primitivos existentes, sem criar nada novo: `tf-card --pad-md` para peça, cartão de canais
e caixa de salvar · `tf-alert --info` / `--danger` para a pilha de avisos · `tf-empty` (+ **um** grafismo
orgânico, só ali) no estado vazio · `tf-price --md` para "Varejo" e "Atacado" na barra · `tf-brow --total`
para "Custo total" · `tf-field` + `tf-inputwrap` + `tf-input --num` para quantidade e "Nome do kit" ·
`tf-btn --primary` em "Salvar kit", `--secondary` em "Adicionar peça", "Salvar em Orçamentos" e "Tentar
novamente", `--ghost` em "Remover peça" e "Ver meus kits" · `tf-icon` (Lucide: `plus`, `save`, `x`,
`chevron-down`/`chevron-up`, `package`) · `tf-tnum` em todo número.

## Perguntas em aberto para o dono

1. **A barra fixa e as ações de guardar**: quando o vendedor chega ao fim da lista, a barra do total deve
   liberar o rodapé (voltar ao fluxo), encolher, ou as duas ações ("Salvar em Orçamentos" e "Salvar kit")
   sobem para dentro dela? Hoje elas ficam por baixo e ninguém decidiu.
2. **Precedência entre os três alertas de topo**: se os três coexistem, eles empilham (até ~380px antes da
   primeira peça), colapsam em uma faixa com contagem, ou algum deles some por ser menos urgente?
3. **Uma peça aberta por vez continua sendo a regra?** Hoje abrir uma peça recolhe a anterior. Isso é
   decisão de produto — e muda o desenho da lista inteira.
4. **A diferença entre "Salvar kit" e "Salvar em Orçamentos" ganha uma frase na tela?** Se sim, qual — é
   copy nova e precisa da sua palavra.
