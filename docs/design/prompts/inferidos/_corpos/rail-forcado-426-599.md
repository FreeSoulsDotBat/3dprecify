# Menu recolhido à força — a faixa de 426px a 599px

## O que desenhar
A navegação principal do app quando a janela tem entre **426px e 599px** de largura: larga demais para a barra inferior do celular (que só existe até 425px) e estreita demais para a barra lateral de 240px. Hoje, nessa faixa, o app monta a barra lateral **já recolhida** num rail de **76px** com cinco ícones sem rótulo e **sem nenhum botão para expandir**. Quem cai aqui: o vendedor que usa o Precifica3D numa janela encaixada em metade da tela do PC, num tablet em pé, ou num celular grande em paisagem. É a primeira coisa que ele vê ao abrir qualquer aba — Calcular, Catálogo, Kits, Orçamentos e Conta — e é por onde ele troca de seção o dia inteiro.

## Por que este prompt existe
O canvas do 018 (`Abas-Desktop.dc.html`) **desenhou o rail recolhido de verdade** — largura animada, rótulos que somem, ícones centralizados e até a dica por `title` em cada item vieram do desenho, não de invenção. O que ele nunca desenhou foi **este** caso: lá o rail é uma *escolha* do vendedor num artboard de 1920px, com o botão "Recolher" no rodapé do menu — exatamente o botão que aqui não existe. O protótipo §H só pede "mobile (~390px) e desktop"; §E3 só conhece BottomBar **ou** Sidebar. A faixa intermediária não foi desenhada por ninguém: o limiar de 600px nasceu de uma **medição** no review do PR #58 (2026-08-15), que acusou 131px de transbordo da página inteira a 426px. Ou seja: a resposta a "não cabe" foi escolhida por um review técnico, não por desenho.

## O que já existe hoje (não invente do zero — corrija)
A coluna do menu com `--sidebar-w: 76px`, colada no topo, altura da janela inteira (`100dvh`, rolagem própria), à esquerda de tudo — inclusive do cabeçalho. Dentro dela, cinco links empilhados, na ordem:

| Ordem | Rótulo literal (pt-BR) | Ícone | Rota |
|---|---|---|---|
| 1 | "Calcular" | calculadora | `/calcular` |
| 2 | "Catálogo" | pacote | `/catalogo` |
| 3 | "Kits" | caixas | `/kits` |
| 4 | "Orçamentos" | histórico | `/historico` |
| 5 | "Conta" | usuário em círculo | `/conta` |

- O menu se anuncia como "Navegação principal".
- Recolhido, **o rótulo continua existindo** para leitor de tela (escondido visualmente, nunca apagado) e o nome só aparece na tela como **dica de `title`** — → **problema central a resolver: `title` é dica de MOUSE, e essa faixa é tocada com o dedo.** O vendedor não tem como descobrir o nome de nenhuma das cinco seções.
- O botão "Recolher" / "Expandir" (ícone de painel à esquerda, no rodapé do menu) **existe apenas a partir de 1280px**. → Nesta faixa não há saída: o rail é imposto e não tem volta. Expandir devolveria o transbordo, então "só colocar o botão" não é a correção — é preciso desenhar como o nome chega ao dedo.
- À direita do rail fica a coluna de conteúdo (a **426px sobram ~350px**), e dentro dela o cabeçalho com o logotipo horizontal completo de 40px de altura + "Conectado como {e-mail}" + "Sair" + "Alternar tema". → **Suspeita forte de aperto:** esse cabeçalho foi desenhado para conviver com uma janela larga, não com 350px.
- Acima de tudo podem aparecer duas faixas: o aviso de offline e o aviso de sessão expirada ("Entrar de novo").

## Conteúdo e dados reais
- Larguras reais: menu expandido **240px**, rail **76px**. A conta que decidiu o rail: 426 − 76 − 32 de goteira ≈ **318px** de conteúdo utilizável; com 240px de menu sobrariam ~150px, e nada do produto cabe nisso.
- A troca de largura é **animada em 0,18s** (suavização de saída) — o desenho precisa dizer o que acontece durante a mudança de faixa.
- Ícone: **22px**. Alvo de toque: **≥44×44px** em cada item (regra dura do projeto, não sugestão).
- Seção ativa: cor de destaque no texto **e** no ícone + peso mais forte + fundo suave de destaque. Na barra inferior do celular ela ganha ainda um traço de 28×3px no topo do item; no rail, hoje, **não ganha nada equivalente** — → decida se o rail precisa de um marcador de forma (não só de cor).
- Nada aqui mostra dinheiro. Os únicos números da peça são geometria.

## Estados obrigatórios
1. **Repouso** — cinco ícones em cor apagada, centralizados na coluna de 76px.
2. **Seção ativa** — cor de destaque + fundo suave; deve continuar legível para quem não distingue cor.
3. **Hover** (mouse, que existe nessa faixa em janela de PC) — e o que aparece junto: hoje é só a dica nativa do sistema.
4. **Foco de teclado** — anel **interno** que abraça o cantinho arredondado do item + fundo suave; ele precisa ser visivelmente diferente do estado ativo **mesmo quando o item já está ativo** (isso já reprovou uma vez: foco no item ativo não mudava nada). Em modo de alto contraste forçado, o anel vira contorno do sistema.
5. **Pressionado** (toque) — hoje não há nada desenhado; é a oportunidade natural de revelar o nome.
6. **Item de seção guardada sem sessão** — Catálogo, Kits, Orçamentos e Conta levam a áreas com login; o menu não desabilita nada, e a recusa acontece depois. Diga se isso muda algo visualmente (recomendação: **não** invente cadeado no menu).
7. **Offline** — a faixa de offline empurra tudo para baixo; o rail (colado no topo, altura da janela) precisa continuar coerente com a faixa em cima.
8. **Sessão expirada** — a mesma coisa, com a faixa fixa "Entrar de novo".
9. **Menu com rolagem própria** — a coluna tem `100dvh` e rola sozinha; em paisagem de celular (altura ~390px) os cinco itens + o cabeçalho podem não caber. Desenhe esse caso.
10. **Transição entre faixas** — 599px → 600px o menu se expande sozinho para 240px e o botão "Recolher" **ainda não** aparece (ele só nasce a 1280px). O desenho precisa assumir explicitamente essa descontinuidade ou propor outra.

## Viewports
- **426px** (obrigatório) — o pior caso: o primeiro pixel em que a barra lateral monta, com só ~350px de conteúdo. É onde a medição achou 131px de transbordo.
- **599px** (obrigatório) — o último pixel da faixa, o caso folgado, para mostrar que a mesma peça serve os dois extremos.
- **390px** (referência, não entrega) — a barra inferior de celular, **para comparar**: é a experiência que o vendedor perde ao ganhar 36px de largura. Desenhe-a lado a lado só para sustentar a decisão.
- **1280px** (referência) — o rail **por escolha**, com o botão "Recolher" no rodapé, já desenhado no canvas do 018. O desenho novo precisa ser irmão dele, não um segundo dialeto.
- Fora de escopo: 1920px (já desenhado).

## Regras que o desenho não pode quebrar
- **O nome da seção não pode depender de mouse.** Numa largura tocada, uma dica de passagem do cursor é uma ausência disfarçada de recurso.
- **O rótulo nunca é apagado da árvore de acessibilidade** — o que se vê pode sumir; o que se ouve continua sendo "Catálogo".
- **Expandir não é a saída.** Se o desenho propuser voltar para 240px nessa faixa, ele reintroduz o transbordo medido. A solução tem que caber em 76px (ou propor uma terceira forma — barra superior de ícones, gaveta temporária, etc.).
- **Alvo ≥44×44px** em todos os cinco itens, inclusive no rail estreito.
- **Contraste medido contra o fundo real** (a superfície de cartão do menu, não o fundo da página) — nos dois temas.
- **Zero rolagem horizontal** em 426px: nem na página, nem dentro do menu.
- Nada de vender falha de rede ou falta de sessão como bloqueio de plano: o menu não é lugar de teaser.

## Armadilhas já pagas neste projeto
- **Transbordo medido na página inteira, não num elemento** (131px a 426px): a culpa era da composição, e por isso a correção foi de largura de menu. Qualquer desenho aqui precisa declarar a conta de larguras que fecha em 426px.
- **Headless não enxerga barra de rolagem clássica** — o transbordo do item 9 do 016 só apareceu medindo o eixo **vertical** também. Desenhe prevendo os dois eixos.
- **Texto ocluso passa em teste**: `toBeVisible` aprova elemento coberto. O que decide layout aqui é caixa, não string.
- **Frase honesta em `placeholder` some** (016/PR-F): qualquer texto explicativo que este desenho introduzir vive em elemento próprio, com largura para caber.
- **O cabeçalho ao lado do rail é o suspeito seguinte**: logotipo horizontal de 40px + "Conectado como {e-mail}" + "Sair" + "Alternar tema" numa coluna de ~350px. Trate como parte da peça, não como vizinho.
- **`display:none` no rótulo** foi o que o arquivo de design original propunha, e teve que ser trocado no código por esconder-visualmente. Se o novo desenho remover o rótulo, remova-o **visualmente**.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro em pé de igualdade**, reutilizando os primitivos existentes em vez de criar novos:

1. **426px — repouso**, com a conta de larguras anotada (76 + goteira + conteúdo).
2. **426px — a solução para o nome**: a sua proposta de como o vendedor descobre "Orçamentos" sem mouse (rótulo micro sob o ícone dentro dos 76px? revelação ao toque? gaveta temporária sobre o conteúdo?). Anote o alvo de 44px sobre o desenho.
3. **426px — estados**: ativo, foco de teclado (anel interno), pressionado, hover — os quatro na mesma prancheta, comparáveis.
4. **599px** — o mesmo repouso no extremo folgado.
5. **426px com as duas faixas** (offline + sessão expirada) e com o menu rolando em altura curta.
6. **Tira comparativa**: 390px (barra inferior) · 426px (esta peça) · 1280px (rail por escolha, com "Recolher"), para provar continuidade.

Use `tf-nav--sidebar` + `tf-nav--rail` como a coluna, `tf-nav__item` como o alvo de cada seção (com o ícone do conjunto do DS em 22px e o rótulo escondido visualmente), `tf-topbar` para o cabeçalho apertado, e a variável de largura do menu (`--sidebar-w`) como a única alavanca de largura. Não crie um componente de menu novo: esta peça é um **estado** do menu que já existe.

## Perguntas em aberto para o dono
1. **A resposta certa a "não cabe" é o rail — ou é manter a barra inferior do celular até 599px?** Ninguém decidiu isso por desenho; o corte em 425px veio de uma decisão de 2026-07-03 e o rail forçado de uma medição de 2026-08-15. Trocar o limiar da barra inferior de 425px para 599px resolveria a peça inteira sem rail nenhum.
2. **Como o vendedor descobre o nome das cinco seções nessa faixa?** Rótulo miúdo sob o ícone (cabe em 76px, mas encolhe o alvo), revelação ao toque longo, ou uma gaveta temporária que abre sobre o conteúdo e fecha ao escolher? São produtos diferentes.
3. **O cabeçalho encolhe junto?** Abaixo de 600px, o logotipo vira só a marca (como no celular) e o "Conectado como {e-mail}" some, sobrando "Sair"? Ou o cabeçalho fica como está?
4. **A descontinuidade em 600px é aceitável?** Hoje, ao passar de 599 para 600, o menu abre sozinho para 240px e o vendedor segue sem botão para recolher até 1280px. Deveria haver botão já a partir de 600px?
