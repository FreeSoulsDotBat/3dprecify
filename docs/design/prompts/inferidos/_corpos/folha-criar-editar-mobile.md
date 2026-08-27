# Folha de criar/editar filamento e impressora (mobile)

## O que desenhar
A folha (sheet) modal que abre por cima do Catálogo quando o vendedor toca "Adicionar filamento" / "Adicionar impressora", ou toca uma linha da lista para editar. É a única porta de entrada dos dois cadastros que alimentam todo o cálculo de preço: o filamento (custo e peso do rolo) e a impressora (valor, vida útil, consumo, manutenção). Quem usa é o vendedor Premium, normalmente de pé perto da impressora, com o teclado numérico aberto, digitando quatro ou cinco números que ele acabou de ler numa etiqueta ou numa nota fiscal. Vive dentro da aba Catálogo (seções Filamentos / Impressoras); ao salvar com sucesso a folha fecha e um toast confirma. Produtos e Kits NÃO usam esta folha — eles navegam para um editor de página cheia.

## Por que este prompt existe
A peça inteira foi inferida por IA: `catalog-panel.tsx` (linhas 452-476) monta um `SheetContent side="right"` — gaveta lateral de altura cheia — e as ações "Voltar"/"Salvar" vêm de dentro do próprio formulário, alinhadas à direita no FIM do conteúdo, sem rodapé fixo. Nenhuma autoridade de desenho pediu isso: a §D.2 do documento de design (linhas 197-198) define o componente como "Sheet / bottom-sheet — painel radius xl (24px), `--surface-overlay` de fundo, ENTRA DE BAIXO (mobile) / centralizado (desktop)", e o protótipo de 2026-07-02 (`CatalogScreen.jsx`, linhas 70-74) implementa `Sheet placement="bottom"` com rodapé próprio de DOIS botões `full` lado a lado (Cancelar | Salvar). Ou seja: **o código contraria uma regra de desenho explícita**, e o único texto que justifica a gaveta lateral é um comentário citando uma spec textual. O canvas do 018 trocou a gaveta pela ficha lateral no DESKTOP (≥1280px) e não tocou no mobile — abaixo de 1280px a gaveta lateral continua sendo o que o vendedor vê.

## O que já existe hoje (não invente do zero — corrija)
Chrome da folha: painel ancorado à DIREITA, `top:0; bottom:0`, largura `min(92vw, 26rem)` (≈359px num viewport de 390px), cantos arredondados só à esquerda, `padding: --space-5`, `overflow:auto`, scrim `--surface-overlay` cobrindo o resto. Botão "X" de fechar (`aria-label` "Fechar") absoluto no canto superior direito, alvo ≥44×44px; o título já reserva espaço à direita para ele. Fecha por X, Esc e toque no scrim.

Ordem atual do conteúdo, de cima para baixo: título → campos → (Alert de erro de gravação, quando houver) → (Alert de Premium pausado, quando houver) → linha de botões `flex justify-end` ("Voltar" fantasma + "Salvar").

Títulos literais: "Novo filamento" · "Editar filamento" · "Nova impressora" · "Editar impressora".

**Filamento**

| Rótulo | Tipo | Obrigatório | Placeholder / afixo | Exemplo real |
|---|---|---|---|---|
| "Nome" | texto | sim | "Ex.: PLA Azul" | PLA Azul Fosco |
| "Material" | texto | não | "Ex.: PLA" | PLA |
| "Custo do rolo" | número, prefixo R$ | sim | — | R$ 110,50 |
| "Peso do rolo" | número, sufixo kg | sim, > 0 | — | 1 kg |

**Impressora**

| Rótulo | Tipo | Obrigatório | Afixo / dica | Exemplo real |
|---|---|---|---|---|
| "Nome" | texto | sim | "Ex.: Ender 3" | Ender 3 V2 |
| "Valor da máquina" | número, prefixo R$ | sim | — | R$ 1.899,00 |
| "Vida útil da máquina" | número | sim, > 0 | sufixo "h" | 3.600 h |
| "Consumo médio" | número | sim | sufixo "kW" + dica "Consumo médio real da impressora, não a potência de placa (~0,12 kW)." | 0,12 kW |
| "Reserva de manutenção" | número | não | prefixo R$ + sufixo "/h", tag "opcional" | R$ 0,50 /h |

→ **Problema 1 — a ancoragem.** Gaveta lateral no celular, contra a §D.2 e contra o protótipo. Desenhe a folha ENTRANDO DE BAIXO, radius xl nos cantos superiores, altura máxima 85vh (o skin `tf-dialog--sheet-bottom` já existe no DS e não é usado aqui).
→ **Problema 2 — as ações rolam com o conteúdo.** Com 5 campos e o teclado aberto, "Salvar" some abaixo da dobra. O protótipo tinha rodapé fixo com dois botões de largura cheia lado a lado.
→ **Problema 3 — o erro empurra o botão.** O Alert de erro de gravação é injetado ENTRE os campos e os botões: no instante em que a gravação falha, "Salvar" desce ~64px, exatamente onde o dedo já estava indo. Resolva ancorando as ações e colocando o erro onde ele não desloque o alvo.
→ **Problema 4 — "Material" parece obrigatório.** Ele é opcional mas não recebe a marca "opcional" que "Reserva de manutenção" recebe. Dois campos opcionais, duas aparências.
→ **Problema 5 — "Voltar" para descartar.** O rótulo é herdado de uma proibição de copy (a palavra "cancelar" é banida do módulo de mensagens por causa da política de cobrança), mas num formulário "Voltar" lê como navegação, não como descartar o que foi digitado.

## Conteúdo e dados reais
Todos os números são strings pt-BR (vírgula decimal, ponto de milhar) com afixo desenhado dentro do campo, não digitado. Faixas plausíveis: custo do rolo R$ 80,00–R$ 250,00; peso do rolo 1 kg (o rolo comum); valor da máquina R$ 900,00–R$ 15.000,00; vida útil 3.600 h; consumo 0,12 kW; reserva R$ 0,20–R$ 2,00 por hora. Tetos reais que disparam "Valor muito alto.": R$ 10.000.000.000 para dinheiro, 1.000.000 para horas e kg, 100.000 para kW. Mensagens de validação literais: "Campo obrigatório." · "Informe um número válido." · "Não pode ser negativo." · "Valor muito alto." · "O peso do rolo deve ser maior que zero." · "A vida útil deve ser maior que zero." Nada aqui é derivado nem calculado — a folha só coleta; o preço é recalculado depois, em outra tela. Contagem: um filamento tem 4 campos, uma impressora tem 5 — a folha nunca é longa, e mesmo assim hoje ela rola.

## Estados obrigatórios
- **Repouso — criar**: campos vazios com placeholders, "Salvar".
- **Repouso — editar**: campos preenchidos com os valores salvos, botão "Salvar alterações".
- **Foco**: anel de foco visível no campo, incluindo com o teclado aberto (o campo focado não pode ficar debaixo do teclado).
- **Pressionado / hover** nos dois botões e no X.
- **Erro de validação por campo**: moldura de erro no campo + a frase pt-BR abaixo dele; acontece ao sair do campo (onTouched), não a cada tecla.
- **Salvando**: "Salvar" com spinner; os campos continuam legíveis (hoje não são bloqueados) — decida e mostre se ficam inertes.
- **Erro de gravação (offline)**: alerta de perigo com "Criar e editar precisam de conexão." — a folha NÃO fecha e nada é dado como salvo.
- **Erro de gravação (sem Premium ativo)**: alerta de perigo com "Salvar faz parte do Premium."
- **Erro de gravação (sessão expirada)**: "Sua sessão expirou. Entre novamente."
- **Erro de gravação (genérico)**: "Algo deu errado. Tente novamente."
- **Premium pausado (somente leitura)**: todos os campos inertes, o botão "Salvar" DESAPARECE (só resta "Voltar") e entra um alerta informativo — nunca de perigo — com título "Reative o Premium" e corpo "Reative o Premium para voltar a criar e editar. Seus itens estão salvos."
- **Sucesso**: a folha fecha e um toast de sucesso diz "Filamento salvo." ou "Impressora salva." — só depois de a gravação ter realmente acontecido no servidor.
- **Teclado aberto**: desenhe explicitamente esta prancheta. É o estado normal desta peça, não uma exceção.

## Viewports
Desenhe em **390px** — é onde a peça vive e onde ela está errada. Desenhe também **768px** (tablet retrato): a folha lateral continua sendo o que aparece em qualquer largura abaixo de 1280px, e a bottom-sheet precisa de uma regra de largura máxima aí (o protótipo não cobria essa faixa). **Não** desenhe 1280px ou 1920px: a partir de 1280px o Catálogo mostra mestre-detalhe e o formulário passa a viver na ficha à direita, fora do escopo desta peça.

## Regras que o desenho não pode quebrar
- Falha de rede nunca é vendida como falta de Premium, e falta de Premium nunca é vendida como erro técnico: são dois alertas com tons e frases diferentes, ambos literais.
- O toast de sucesso só existe depois de um salvamento real. Não desenhe confirmação otimista.
- Premium pausado é calmo, não punitivo: tom informativo, e os dados do vendedor continuam visíveis e legíveis.
- Frases honestas ("Criar e editar precisam de conexão.", a linha de reativação) moram em elementos de largura cheia, nunca dentro de um placeholder ou de um campo que corte o texto.
- Todo alvo de toque ≥44×44px — X de fechar, botões do rodapé, campos.
- Contraste medido contra o fundo real do painel sobre o scrim, não contra o fundo da página.
- Nenhum campo desta folha aceita ser inventado ou reordenado: são exatamente os 4 do filamento e os 5 da impressora, com esses rótulos.

## Armadilhas já pagas neste projeto
- **O alerta que empurra o botão** — é o defeito central desta ficha. Qualquer coisa que apareça acima das ações desloca o alvo no pior momento possível.
- **Overflow horizontal medido** (016/PR-B): num painel de ≈359px, "Vida útil da máquina" com sufixo "h" e "Reserva de manutenção" com "R$ … /h" são os candidatos naturais a estourar. Verifique com valores longos: R$ 15.000,00 e 3.600 h.
- **Rolagem no eixo vertical não aparece em teste headless**: a folha rolar é invisível para o automatizado e óbvia para o dedo. Mostre onde o conteúdo corta.
- **Texto ocluso passa em teste**: o botão X sobrepõe o canto do título — desenhe a reserva de espaço, não confie no acaso.
- **Frase honesta cortada em placeholder** (016/PR-F): placeholders carregam só exemplos curtos ("Ex.: PLA Azul"); nenhuma regra ou aviso vive dentro de um campo.

## Entregável
Pranchetas, tema **escuro** como padrão e **claro** como equivalente de primeira classe (repita ao menos as pranchetas 1, 3 e 5 no claro):
1. "Novo filamento" em repouso, 390px, bottom-sheet com rodapé fixo.
2. "Editar impressora" com os 5 campos preenchidos, 390px, mostrando a rolagem do corpo e o rodapé parado.
3. Erro de gravação offline, com o rodapé no mesmo lugar de antes do erro.
4. Premium pausado (somente leitura), sem "Salvar".
5. Teclado numérico aberto sobre a folha, com o campo "Consumo médio" focado e sua dica visível.
6. Erro de validação em dois campos ao mesmo tempo + "Salvar" com spinner.
7. A mesma folha em 768px.

Reutilize os primitivos existentes, não crie novos: o skin de folha inferior do `Dialog`/`Sheet` (`tf-dialog--sheet-bottom`, já no DS), o `X` de fechar do próprio Dialog, `Field` para rótulo/dica/erro/tag "opcional", `tf-input`/`tf-inputwrap` para texto, `NumberField` para os numéricos com afixo, `Alert` tom perigo para erro de gravação e tom informativo para a reativação, `Button` fantasma para a ação de sair e `Button` primário com estado de carregamento para salvar, `toast` de sucesso. Indique no desenho qual primitivo é cada parte.

## Perguntas em aberto para o dono
1. **Ancoragem**: confirmamos a volta para a folha inferior (§D.2 + protótipo de 2026-07-02), ou a gaveta lateral fica por alguma razão que só a spec textual registra? O desenho muda inteiro conforme a resposta.
2. **Rodapé**: dois botões de largura cheia lado a lado como no protótipo (Voltar | Salvar), ou "Salvar" de largura cheia com a saída secundária acima? E o erro de gravação: fixo acima do rodapé, ou no topo do corpo, junto ao título?
3. **A palavra de saída**: "Voltar" continua, ou trocamos por algo que diga que o digitado será descartado (a palavra "cancelar" segue proibida no produto)?
4. **Descartar com alterações**: hoje X, Esc e toque no scrim fecham a folha sem perguntar nada, perdendo o que foi digitado. Deve haver confirmação quando houver alteração pendente?
5. **Avisos de plausibilidade**: o Calcular avisa quando "Consumo médio", "Vida útil", "Peso do rolo" e "Reserva de manutenção" recebem valores implausíveis (ex.: "Confira o consumo: 120 kW…"). Esta folha, que grava exatamente os mesmos campos, não avisa nada. Os avisos devem passar a existir aqui?
