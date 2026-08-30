# Duplicar-para-ajustar: a troca de contexto que hoje só um toast anuncia

## O que desenhar
O movimento central das **Simulações** (Premium): o vendedor tem uma estratégia salva que funciona, quer testar uma variação ("e se eu subir a margem?") sem estragar a original, e toca em **Duplicar**. A partir daí a tela inteira passa a editar **outro objeto** — uma cópia nova, com nome escolhido pelo servidor. Desenhe esse instante e o que vem depois dele, nos **dois pontos de entrada que existem hoje**: (a) o ícone de copiar no cartão da folha "Minhas simulações", que fecha a folha e repovoa a calculadora com a cópia; (b) o botão "Duplicar" na **barra de contexto** da simulação carregada, que troca a simulação por baixo do vendedor, no lugar, sem sair da tela. Origem no código: `features/scenarios/scenarios-list-sheet.tsx`, `features/scenarios/scenario-context-bar.tsx`, `backend/app/api/scenarios.py`.

## Por que este prompt existe
O fluxo inteiro só existe como **comportamento** — nunca foi desenhado. A auditoria achou "Duplicar" desenhado três vezes (o sheet de detalhe do Histórico, onde o botão é ilustrativo e nem tem handler; a ficha do Catálogo no canvas 018; nada em Kits/Orçamentos) e **nenhuma delas é este fluxo**: nenhuma mostra o que acontece DEPOIS de duplicar. O item 7 do §10.1 da ux pede exatamente "o protótipo de Duplicate + a interação de nome de 120 caracteres" e ele nunca foi feito. Resultado: o movimento que a spec chama de *headline* acontece sem aviso visual, com um nome que o vendedor não escolheu e não confirma.

## O que já existe hoje (não invente do zero — corrija)

**Entrada A — cartão na folha "Minhas simulações"** (`tf-card`, padding sm): nome em uma linha truncada · nota opcional em 2 linhas com reticências explícitas · "Atualizado há 2 dias" · e, à direita, uma fileira de três ícones fantasma de 18px: lápis (Renomear), **copiar (Duplicar)**, lixeira (Excluir). Rótulos acessíveis: `"Duplicar {nome da simulação}"`.

**Entrada B — barra de contexto** (`tf-card` acima da calculadora, quando há simulação carregada):

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título | `"Simulação: Caneca 350ml — Shopee"` | uma linha, truncada |
| Legenda viva | `"Recalculado com os preços de hoje"` | **nunca** uma data |
| Selo de sujeira | `"Alterações não salvas"` (`tf-badge`, tom neutro) | só quando há edições pendentes |
| Ações | `"Abrir origem"` (fantasma, só quando a referência resolve) · `"Renomear"` (fantasma) · **`"Duplicar"` (secundário, sm)** · `"Salvar alterações"` (primário, sm) | envolvem linha em telas estreitas |
| Fechar | `"Fechar simulação"` (fantasma) | |

**O que acontece ao tocar em Duplicar (hoje):** o servidor cria a cópia e nomeia sozinho `"Cópia de " + nome`; se passar de 120 caracteres, ele corta a **base** e cola reticências (`"Cópia de Caneca 350ml — Shopee com frete grá…"`), preservando sempre o prefixo. Volta um toast verde **`"Simulação duplicada."`** que some sozinho em 5 segundos, e a calculadora inteira é repovoada com a cópia.

→ **Não há confirmação nem campo de nome no ato.** O vendedor nunca vê nem edita o nome antes de ele existir.
→ **O toast é o único aviso de que o objeto editado mudou.** Ele é `aria-live="polite"`, dura 5s, e some. Quem olhou para o lado continua editando achando que é a original.
→ **Pela entrada A, a folha fecha e a página vira outra simulação sem nenhuma transição** — nada liga o cartão tocado ao novo estado da tela.
→ **Duplicar com "Alterações não salvas" descarta as alterações sem perguntar.** A cópia sai do que está **salvo no servidor**, não do que está na tela; e diferente de "Fechar simulação" (que abre o diálogo `"Descartar as alterações não salvas desta simulação?"`), Duplicar não confirma nada.
→ **Duplicar duas vezes produz dois nomes idênticos** — não há numeração. Duplicar uma cópia produz `"Cópia de Cópia de …"`.
→ **O ícone de copiar do cartão não tem estado de carregando** (o botão da barra de contexto tem). Entre o toque e a troca de tela, nada acontece visivelmente.

## Conteúdo e dados reais
- **Nome**: obrigatório, ≤ 120 caracteres. Erros já existentes: `"Dê um nome à simulação."` · `"Máximo de 120 caracteres."`
- **Nota**: opcional, ≤ 500 caracteres. Erro: `"Máximo de 500 caracteres."` A cópia **herda a nota** da original.
- **Prefixo do servidor**: `"Cópia de "` (9 caracteres, sobra 110 para a base + 1 para o `…`).
- **Carimbo de tempo**: `"Atualizado {quando}"` com `agora mesmo` · `há 7 min` · `há 3 h` · `há 2 dias` · `há 5 semanas`. Nunca uma data absoluta.
- **Preço na calculadora por trás** (use números verdadeiros da seed): preço sugerido **R$ 24,24**, custo **R$ 16,16**, um segundo canal em **R$ 21,01**.
- **Derivado, não digitado**: tudo na calculadora recalcula com os preços de hoje ao abrir a cópia — a cópia guarda a *estratégia* (canais, taxas ajustadas, base de custo), não o preço congelado.

## Estados obrigatórios
1. **Repouso** — ícone/botão Duplicar disponível.
2. **Foco visível** e **hover** — o alvo do cartão tem 18px de ícone; a área tocável precisa de ≥ 44px.
3. **Pressionado / carregando** — o botão da barra de contexto tem giro de carregando; **desenhe também o do cartão**, que hoje não tem.
4. **Desabilitado — offline**: botão apagado + linha de razão `"Esta ação precisa de conexão."`, e no topo da lista o alerta info `"Modo leitura offline"` / `"Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."`
5. **Desabilitado — Premium pausado**: `"Premium pausado — reative para renomear, duplicar, editar ou excluir."`, com o alerta info `"Premium pausado"` / `"Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."`
6. **Erro de escrita** — `tf-alert` tom perigo acima da lista (entrada A) ou dentro da barra (entrada B), com a frase específica; nunca um erro genérico e nunca um sucesso falso.
7. **Sucesso** — toast verde `"Simulação duplicada."` **e** o estado permanente que este desenho precisa inventar: como a tela declara "você agora edita a cópia".
8. **Cópia com nome truncado** — desenhe o caso real de 120 caracteres, com o `…` visível.
9. **Base de custo degradada** — o alerta info reaproveitado do catálogo, que **nunca** diz "removido/excluído"; a cópia herda essa condição.
10. **Alterações não salvas + Duplicar** — o estado que hoje não existe: o que a tela pergunta (ou declara) antes de descartar.
11. **Sem permissão** — grátis/deslogado nem chega aqui: a folha inteira vira o teaser Premium. Não desenhe um Duplicar apagado para o grátis.

## Viewports
- **Mobile 390px — obrigatório e primário.** É onde o vendedor vive; a barra de contexto já quebra suas 4 ações em duas linhas nessa largura.
- **Desktop 1280px** — a página Calcular **não tem ramo largo** (não entrou no redesenho 018): a folha vira um painel lateral sobre a mesma coluna. Desenhe, porque a troca de contexto sem transição fica ainda mais invisível numa tela grande, onde a barra de contexto pode estar longe do olhar.

## Regras que o desenho não pode quebrar
- **Nenhuma data.** A promessa é `"Recalculado com os preços de hoje"`; carimbo só relativo.
- **Toast só em 201 real.** Nada de otimismo: o sucesso é dito depois do servidor confirmar.
- **Falha de rede nunca vendida como falta de Premium** — e vice-versa. As duas frases são distintas e ambas já existem.
- **Freemium binário**: ou é Premium e a lista aparece, ou é o teaser honesto. Sem meio-termo desabilitado.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega exemplo, não explicação (`"Buscar por nome…"` é placeholder legítimo).
- **"Voltar", nunca "Cancelar"** em diálogos.
- **Degradação é dita, não escondida.**
- Alvos ≥ 44px; contraste medido contra o fundo real do cartão, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **O toast que nunca renderizou**: numa entrega anterior o diálogo desmontava antes do callback disparar e a mensagem de confirmação ficou no código sem nunca aparecer na tela. Aqui a folha **fecha no mesmo movimento** em que o toast é disparado — se a confirmação depender da folha, ela morre com ela. O aviso precisa viver fora do que fecha.
- **Nome de 120 caracteres estourando a coluna**: o nome já é uma linha truncada justamente porque empurrava [Duplicar]/[Salvar alterações] para fora da tela. Desenhe com o nome longo, não com "Teste 1".
- **Texto ocluso passa em teste**: um elemento coberto ou transbordado continua "visível" para asserções de texto. Layout se prova com caixas — deixe folga explícita.
- **Overflow horizontal medido**: nenhum elemento pode nascer fora dos 390px.
- **Campo que some**: uma busca já foi entregue com 1×1px, invisível e "presente". Todo controle precisa de área desenhada.

## Entregável
Pranchetas, tema **escuro como padrão** e **claro em pé de igualdade** (as duas para as pranchetas 1, 3 e 5):
1. **390px — cartão da lista**, com os três ícones de ação, incluindo repouso/foco/carregando no ícone de copiar.
2. **390px — o instante da duplicação pela entrada A**: o que o vendedor vê entre o toque e a calculadora repovoada.
3. **390px — barra de contexto da cópia recém-criada**, com o nome `"Simulação: Cópia de Caneca 350ml — Shopee"` e o aviso permanente de que este objeto é uma cópia.
4. **390px — Duplicar com "Alterações não salvas"**: sua proposta de confirmação (ou de declaração), reusando a linguagem do diálogo de descarte que já existe.
5. **390px — estados travados**: offline e Premium pausado, com as frases literais.
6. **390px — nome truncado em 120 caracteres** e **erro de escrita**.
7. **1280px** — a mesma troca de contexto na tela larga.

Reuse os primitivos existentes, sem criar novos: `tf-card` (cartão e barra de contexto), `tf-btn--ghost tf-btn--sm` (ícones de ação e "Renomear"), `tf-btn--secondary tf-btn--sm` ("Duplicar"), `tf-btn` primário ("Salvar alterações"), `tf-badge` neutro ("Alterações não salvas"), `tf-alert` tom info (offline / Premium pausado / degradado) e tom perigo (erro de escrita), o toast padrão, o diálogo centrado para confirmação e a folha para renomear.

## Perguntas em aberto para o dono
1. **Nome da cópia**: duplicar duas vezes gera dois `"Cópia de X"` idênticos. Numerar (`"Cópia 2 de X"`), pedir o nome no ato (um campo antes de criar), ou aceitar a colisão?
2. **Duplicar com alterações não salvas**: a cópia deve sair do que está **salvo** (comportamento de hoje, descartando o que está na tela) ou do que está **na tela**? A mensagem `"Salvar como novo"` existe no dicionário do app e **nunca foi usada em lugar nenhum** — ela era este movimento?
3. **Entrada A**: depois de duplicar pelo cartão, a folha deve mesmo fechar e virar a cópia na calculadora, ou deve continuar aberta mostrando a cópia recém-criada na lista, deixando o vendedor decidir quando abrir?
4. **Aviso de troca de contexto**: basta o toast de 5 segundos, ou a barra de contexto deve carregar uma marca permanente ("cópia de …") enquanto a cópia estiver aberta?
