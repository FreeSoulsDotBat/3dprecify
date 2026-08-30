# Congelamento de escrita em Simulações — "Premium pausado" e "Modo leitura offline"

## O que desenhar

O estado em que o vendedor **pode ler tudo e não pode escrever nada** dentro de "Minhas simulações" — a gaveta (Sheet) aberta pelo cabeçalho da tela Calcular, e a barra de contexto que aparece na Calcular quando uma simulação está carregada. Ele acontece por duas causas diferentes: (a) a assinatura Premium **lapsou** (`status: "lapsed"` — o vendedor já foi premium, os dados continuam dele) e (b) o aparelho está **offline**. Em ambas, abrir e recalcular continuam funcionando; renomear, duplicar, salvar alterações e excluir ficam bloqueados. É a hora mais delicada da jornada: o produto precisa dizer "isso é seu, está aqui, só não dá para mexer agora" sem virar um muro de avisos nem uma cobrança agressiva.

## Por que este prompt existe

O estado nunca foi desenhado — foi montado por acúmulo, direto no JSX. O protótipo de 2026-07-02 **não podia** tê-lo: a E8 era explicitamente "Upsell (sem checkout)", então existia grátis × premium e não existia assinatura que EXPIROU; a matriz §G tem coluna offline para Login/Calcular/Catálogo/Histórico/Exportar/Conta ("leitura mock ok, salvar off") e **nenhuma linha de simulações**.
Pior: o código **contraria** a única autoridade de desenho que existe. O canvas 018 tem `{{ writeBlocked }}` desabilitando o botão **primário** de cada aba, **sem nenhuma frase de justificativa repetida por item**; e o único alerta desenhado ali tem um CTA que AGE ("Sincronizar agora"). O que foi construído é o oposto: a mesma frase repetida embaixo de **cada** cartão, e nenhum caminho para reativar.

## O que já existe hoje (não invente do zero — corrija)

Gaveta "Minhas simulações" (`features/scenarios/scenarios-list-sheet.tsx`), de cima para baixo:

| Peça | Conteúdo literal hoje | Observação |
|---|---|---|
| Título da gaveta | "Minhas simulações" | |
| Subtítulo | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." | |
| Busca | placeholder "Buscar por nome…" | sem label visível |
| Alerta offline (`stale`) | título "Modo leitura offline" + "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + botão "Tentar novamente" | tom `info`; **tem** ação |
| Alerta lapso | título "Premium pausado" + "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." | tom `info`; **não tem** nenhuma ação → problema |
| Cartão (× N) | nome (1 linha, truncada) · nota (2 linhas, com "…") · "Atualizado há 2 dias" · 3 ícones: lápis / cópia / lixeira | os 3 ficam `disabled` |
| Linha embaixo de **cada** cartão | "Premium pausado — reative para renomear, duplicar, editar ou excluir." **ou** "Esta ação precisa de conexão." | → **o defeito central**: com 12 simulações, a mesma frase 12 vezes, alinhada à direita, em `text-muted`, tamanho xs |
| Rodapé | "Carregar mais" | |

→ O alerta de lapso **só aparece se `items.length > 0` e a lista não estiver `stale`** — ou seja, offline **e** lapsado ao mesmo tempo mostra só o offline, e o vendedor com zero simulações lapsado não recebe explicação nenhuma, só ícones mortos. Ninguém desenhou essa arbitragem.
→ Nenhum dos dois avisos leva a lugar nenhum. O CTA de reativação existe no produto ("Assinar novamente", em `/conta`) e não é oferecido aqui. O Catálogo já usa um alerta irmão — "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos." — igualmente sem botão.

Barra de contexto (`features/scenarios/scenario-context-bar.tsx`), quando uma simulação está carregada na Calcular:

- "Simulação: {nome}" (1 linha truncada) + legenda "Recalculado com os preços de hoje" + badge "Alterações não salvas" quando sujo;
- botões: "Abrir origem" (só quando a referência resolve) · "Renomear" · "Duplicar" · "Salvar alterações" · "Fechar simulação";
- congelado: os três primeiros ficam `disabled` e **a mesma frase de justificativa aparece de novo**, em largura total, abaixo da fileira de botões.

## Conteúdo e dados reais

- Nome da simulação: obrigatório, até **120 caracteres** ("Máximo de 120 caracteres."); nota opcional até **500** ("Máximo de 500 caracteres."). Desenhe com nome longo de verdade (ex.: "Caneca 350 ml — Shopee frete grátis + Mercado Livre clássico vs premium").
- "Atualizado {quando}" é **relativo, nunca data**: "agora mesmo", "há 7 min", "há 3 h", "há 2 dias", "há 5 semanas".
- Números de exemplo para a Calcular ao fundo da barra de contexto: preço sugerido **R$ 24,24**, custo **R$ 16,16**, um cenário maior **R$ 1.234,56** (teste a máscara de milhar).
- Estados de direito reais: `none` (nunca assinou → aparece o teaser, **não** este estado), `active`, `lapsed`. Offline é ortogonal e vem do navegador.
- Toasts de sucesso só existem em resposta real (201/200/204) — no estado congelado **nenhum** deles pode aparecer.

## Estados obrigatórios

1. **Repouso premium ativo e online** — referência: os três ícones/botões vivos, nenhum aviso.
2. **Premium pausado (lapsado), online** — lista legível, ações mortas, explicação dita **uma vez**: "Premium pausado" + "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."
3. **Offline, premium ativo** — "Modo leitura offline" + "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente".
4. **Lapsado E offline ao mesmo tempo** — hoje o código escolhe lapso e some com o offline. Desenhe explicitamente qual vence, ou como as duas causas convivem em um bloco só.
5. **Lapsado com a lista vazia** (nenhuma simulação salva) — hoje o vendedor vê só o EmptyState "Nenhuma simulação salva ainda" e nenhuma menção ao lapso.
6. **Desabilitado** — o alvo dos ícones lápis/cópia/lixeira congelados: continue com ≥44px de área, contraste legível (desabilitado não é invisível), e cursor/foco que não mintam clicabilidade.
7. **Foco por teclado sobre um controle desabilitado** — mostre como a justificativa chega a quem navega por teclado/leitor de tela sem que ela precise estar impressa N vezes na tela.
8. **Carregando** (spinner central) e **erro frio** (alerta `danger` "Não foi possível carregar suas simulações." + "Tentar novamente") — nunca um muro de erro por cima de dados já em mãos.
9. **Falha de escrita ao tentar mesmo assim** — "Esta ação precisa de conexão." (só quando a causa foi medida) e a mensagem genérica quando não foi.
10. **Barra de contexto congelada** — com "Alterações não salvas" ligado: o vendedor mexeu, não pode salvar. É o pior momento do estado e precisa de desenho próprio.

## Viewports

- **390px (mobile)** — obrigatório: é onde a gaveta ocupa a tela inteira e onde a repetição por cartão dói mais (a frase quebra em 2 linhas × N cartões).
- **1280px (desktop)** — o corte do 018; a gaveta e a barra de contexto existem lá com a barra lateral presente, e o `{{ writeBlocked }}` do canvas 018 já governa os botões primários das outras abas: o desenho precisa ser coerente com ele.
- 1920px opcional, só se a solução mudar de forma com mais largura (ex.: aviso fixo lateral em vez de topo).

## Regras que o desenho não pode quebrar

- **Freemium binário**: `none` vê o teaser; `lapsed` **não é** grátis — os dados são dele, a linguagem é "pausado", nunca "expirado", "bloqueado" ou "perdido". Tom calmo, não punitivo.
- **Falha de rede nunca é vendida como falta de Premium**, e vice-versa. As duas causas têm frases distintas e não podem se confundir visualmente.
- **Degradação dita, não escondida**: não basta desabilitar; o motivo tem de estar legível — mas **uma vez**, num lugar previsível, não colado a cada item.
- Frase honesta **fora de placeholder** e fora de elemento com largura apertada — ela precisa caber inteira.
- Alvos ≥44px, inclusive desabilitados. Contraste medido contra o fundo real do cartão, nos dois temas.
- Nenhum toast de sucesso pode existir neste estado.

## Armadilhas já pagas neste projeto

- **Aviso repetido N vezes** é o defeito que originou este prompt: `text-right text-xs` embaixo de cada cartão, idêntico, até 12×.
- **Overflow horizontal medido**: nome de 120 caracteres + fileira de 3 ícones na mesma linha já empurrou botões para fora da viewport em outra tela (100,5px medidos, botão nascido fora). Desenhe com o nome longo, não com "Caneca".
- **Texto ocluso passa em teste**: `toBeVisible` aprova o que está sobreposto. Se o aviso ficar fixo (sticky), diga o que ele cobre e o que empurra.
- **Placeholder que corta a frase honesta** — já aconteceu: frases de honestidade vivem em elementos de largura total, placeholders só carregam números.
- **Um alerta sem ação vira ruído**: o único alerta desenhado no canvas 018 tem "Sincronizar agora". Este tem zero.

## Entregável

Pranchetas, tema **escuro (padrão)** e **claro (first-class)**, reusando os primitivos existentes — não crie componentes novos:

1. 390px — gaveta "Minhas simulações", 4 cartões, **premium pausado**: `Alert` tom `info` no topo (título "Premium pausado") com a justificativa dita **uma vez** e um caminho de reativação (`Button` secundário; a copy do produto para isso é "Assinar novamente"), `Card padding="sm"` por simulação, os 3 `Button variant="ghost" size="sm"` desabilitados **sem** a linha repetida embaixo.
2. 390px — mesma lista **offline**, com "Modo leitura offline" e "Tentar novamente".
3. 390px — o caso conflitante: **lapsado + offline**.
4. 390px — **lapsado com lista vazia** (`EmptyState` ícone `boxes`).
5. 390px — barra de contexto congelada na Calcular (`Card padding="sm"`), com badge `neutral` "Alterações não salvas" e "Salvar alterações" desabilitado.
6. 1280px — a mesma gaveta com a barra lateral do 018 ao lado, mostrando a coerência com o `{{ writeBlocked }}` das outras abas.
7. Um detalhe ampliado (zoom) do **cartão congelado**: os três ícones desabilitados, com a marcação de como o motivo é comunicado a quem foca por teclado.

Marque nas pranchetas o que é `Alert`, `Card`, `Button`, `Badge`, `EmptyState`, `Field`/`tf-input` e `Icon`, e anote tamanho de alvo nos ícones.

## Perguntas em aberto para o dono

1. **Lapsado + offline ao mesmo tempo**: mostrar as duas causas juntas, ou eleger uma? Qual, e por quê? (Hoje o código escolhe o lapso e silencia o offline — sem decisão registrada.)
2. **O aviso de "Premium pausado" deve levar direto ao checkout/`/conta`?** Ele não leva a lugar nenhum hoje, e o Catálogo tem o mesmo alerta igualmente mudo. Se sim, o botão é "Assinar novamente" (a copy do painel de plano) ou uma frase nova?
3. **Lista vazia + lapsado**: o vendedor sem nenhuma simulação salva deve ver o aviso de lapso, ou o EmptyState puro basta?
4. **O aviso deve grudar no topo** (sticky) enquanto rola uma lista longa, ou pode sair de vista depois de lido?
