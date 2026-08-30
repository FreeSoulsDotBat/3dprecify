# Diálogo de saída com orçamentos ainda não sincronizados

## O que desenhar
O diálogo modal bloqueante que aparece quando o vendedor toca em **"Sair"** e ainda existem orçamentos na fila offline deste aparelho — registros que ele calculou, salvou e que **nunca chegaram à conta dele**. Ele é disparado de dois lugares (o botão "Sair" da aba **Conta** e o "Sair" da top-bar), interrompe o logout no meio e só deixa a sessão terminar depois que o vendedor decide entre enviar ou destruir. É a **única superfície do app capaz de apagar trabalho de forma irreversível**: a fila é a única cópia daquele orçamento. Quem usa: o vendedor comum, frequentemente com pressa, frequentemente sem sinal (é justamente o offline que enche a fila), muitas vezes num aparelho compartilhado — porque a varredura de privacidade no logout é o que torna o descarte obrigatório.

## Por que este prompt existe
Não existe autoridade de desenho nenhuma para esta peça. O protótipo de 2026-07-02 trata "Sair" como uma linha simples da Conta (§E7) e, na matriz §G, diz literalmente **"logout ok, sync off"** — ou seja, a decisão OPOSTA: sair sempre pode. O único "Sair" desenhado em JSX (`.design-import/ui_kits/precifica3d/AccountScreen.jsx`) é um `ListItem` com ícone `log-out` em `var(--danger)` chamando `onLogout` **direto, sem confirmação**. A fila offline (outbox, ADR-0018) nasceu no E4, em 2026-07, depois do protótipo — não havia o que desenhar. No canvas 018 "Sair" aparece 4 vezes, sempre como botão simples; a busca por "fila"/"sincroniz" no artboard de Conta não retorna nada. Portanto: **a escada de dois passos, a hierarquia entre sincronizar e descartar, o botão desabilitado com legenda, o alerta vermelho no meio do diálogo e a ordem da pilha de ações foram todos arbitrados por quem escreveu o código.** Este é o desenho que faltou.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/history/sign-out-outbox-guard.tsx` + `shared/i18n/messages.pt-br.ts` (bloco `historico`).

**Passo 1 — o diálogo de decisão** (`DialogContent showClose={false}`, sem X; Esc e clique no scrim cancelam o logout):

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título | "{n} registro(s) ainda não foram sincronizados" | `{n}` = contagem real da fila |
| Corpo | "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta." | boa copy, manter |
| Alerta (condicional) | "{n} registro(s) não puderam ser enviados. Eles continuam neste aparelho." | `Alert tone="danger"`, só aparece DEPOIS de uma tentativa que sobrou item |
| Ação 1 | "Sincronizar agora" | `Button` primário; desabilitado offline e enquanto sincroniza |
| Legenda (condicional) | "Precisa de conexão para enviar." | parágrafo centrado, `--text-muted`, `fs-sm`, só offline |
| Ação 2 | "Sair e descartar" | `Button variant="danger"` |
| Ação 3 | "Voltar" | `Button variant="secondary"` — cancela o logout |

As três ações estão hoje numa **coluna vertical, largura total, nesta ordem**, com `gap` de um passo.

**Passo 2 — a confirmação destrutiva** (mesmo diálogo, conteúdo trocado):

| Elemento | Texto literal hoje |
|---|---|
| Título | "Descartar {n} registro(s) e sair?" |
| Corpo | "Eles não foram enviados para a sua conta e não poderão ser recuperados." |
| Ações | "Voltar" (`secondary`) + "Descartar e sair" (`danger`), **em linha, alinhadas à direita** |

Problemas a resolver no desenho:

- → **O vendedor destrói trabalho identificado só por um número.** Nenhum dos dois passos mostra QUAIS registros estão em jogo — nem rótulo ("Cliente, pedido…"), nem data, nem preço. A tela de Orçamentos tem esses dados; o diálogo que os apaga, não.
- → **O alerta vermelho não diz a causa.** "Sincronizar agora" só reenvia entradas `pending`; entradas em `blocked` (Premium não ativo), `unauthenticated` (sessão expirada) e `failed` (servidor recusou) são **puladas de propósito** — o botão parece funcionar, nada acontece com elas, e o alerta diz apenas "não puderam ser enviados". O app já tem a copy honesta para cada causa e ela não aparece aqui: "Envio pausado · precisa de Premium", "Envio pausado · sessão expirada", "Não foi possível registrar". Sem isso o vendedor tenta de novo para sempre ou descarta sem entender.
- → **Sincronizar não tem estado de progresso visível.** O botão só fica desabilitado com o mesmo rótulo; o primitivo `tf-btn` tem `loading` com spinner e não é usado. Com fila grande e rede ruim a tela fica parada por segundos.
- → **Ordem e peso das ações são invenção.** "Sair e descartar" em vermelho, do mesmo tamanho e largura do primário, imediatamente acima de "Voltar" — o destrutivo está no caminho do polegar, no meio da pilha.
- → **Contradição interna de formato:** passo 1 usa coluna de botões de largura total; passo 2 usa linha alinhada à direita. É o mesmo diálogo, dois idiomas.
- → **Título com recuo fantasma:** o título reserva espaço à direita para o X mesmo com `showClose={false}` — sobra um vão sem nada.
- → **O primeiro botão desabilitado é a chave do drama offline.** Quem está sem sinal vê a única ação segura apagada e a única ação viva em vermelho.

## Conteúdo e dados reais
- **Contagem `{n}`**: inteiro ≥ 1 (o diálogo nem abre com fila vazia). Faixa realista 1–8; desenhe também **"12 registro(s)"** para provar o layout com dois dígitos, e considere o texto "1 registro(s)" — o plural entre parênteses é feio e o dono ainda não decidiu.
- **O que cada registro é**: um orçamento congelado, com rótulo opcional ("Cliente, pedido…"), data de cotação ("Cotado em 14/08/2026") e um preço, ex. **R$ 1.234,56** ou **R$ 24,24**. Se o desenho listar os registros, é isso que a linha mostra.
- **Estados de sincronização que uma entrada pode ter** (vocabulário já homologado): `pendente` · `envio pausado · precisa de Premium` · `envio pausado · sessão expirada` · `não foi possível registrar`.
- Nada aqui é dinheiro editável e nada é campo de formulário: o diálogo é 100% decisão.
- Container atual: modal centrado, `width: min(92vw, 32rem)`, `max-height: 85vh` com rolagem interna.

## Estados obrigatórios
1. **Repouso, online** — três ações vivas, sem legenda, sem alerta.
2. **Repouso, offline** — "Sincronizar agora" desabilitado + "Precisa de conexão para enviar." Precisa ser óbvio que **nada foi perdido** e que voltar (cancelar o logout) é seguro.
3. **Volta da conexão** — a ação primária reativa sozinha enquanto o diálogo está aberto; desenhe como isso é percebido (nada pode reativar em silêncio absoluto).
4. **Sincronizando** — spinner no primário, rótulo legível, demais ações não podem virar armadilha; diga se "Sair e descartar" fica bloqueado durante o envio (hoje **não fica**).
5. **Sincronização parcial** — alerta vermelho + contagem atualizada; aqui entra a causa por registro.
6. **Sincronização total** — o diálogo some e o logout continua; não há tela, mas diga o que o vendedor vê.
7. **Passo 2, confirmação destrutiva** — foco inicial, qual botão é o padrão, e o que impede o toque acidental.
8. **Foco de teclado** e **pressionado/hover** em cada ação, com o foco visível contra o card sobre o scrim.
9. **Desabilitado** — o primário offline precisa parecer *indisponível*, não *quebrado*.

## Viewports
- **Mobile 390px** — obrigatório e é o caso principal: fila cheia é sintoma de campo/rua/feira. A 92vw dá ~359px; três botões de largura total, alvo ≥44px, e o teclado não entra em cena (não há campo).
- **Desktop 1280px** — o diálogo trava em 32rem (512px) num scrim sobre a aba Conta ou a top-bar; a proporção muda completamente e a pilha vertical de botões largos fica estranha. Desenhe.
- 1920px não precisa de prancheta própria (a caixa não cresce), mas mostre o scrim numa tela larga se a leitura mudar.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca vira falha do vendedor nem oferta de plano.** Offline é um fato temporário e dito assim.
- **Cada causa de bloqueio é dita com o nome verdadeiro.** "Premium não está ativo" e "sessão expirou" são coisas diferentes de "sem conexão" e o app já as separa — nenhuma delas pode ser vendida como a outra.
- **Nenhuma frase honesta em placeholder ou em elemento cortável.** A legenda "Precisa de conexão para enviar." vive num bloco de largura total.
- **Destruição irreversível exige dois passos e nunca é a ação de menor esforço.** O botão vermelho não pode ser o mais fácil de acertar com o polegar.
- **Cancelar existe e se chama "Voltar"** — nunca "Cancelar" (FR-014).
- **Nenhuma promessa de recuperação.** Não há lixeira, não há desfazer: o texto "não poderão ser recuperados" é literal.
- Alvos ≥44×44px; contraste do vermelho medido contra `--surface-card` sobre o scrim, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Overflow medido nos DOIS eixos.** Um diálogo com alerta + legenda + três botões a 390px já é alto; `max-height: 85vh` cria rolagem interna e o headless não enxerga barra clássica — desenhe o que acontece quando o conteúdo passa da altura, e onde a rolagem começa e termina.
- **Texto que passa em teste e some na tela.** `toBeVisible` passa em elemento ocluído; o alerta vermelho que aparece só depois da tentativa pode nascer fora da área visível se o diálogo já estiver rolado.
- **Número grande estoura a coluna** — "12 registro(s) não puderam ser enviados." dentro do `Alert` com ícone precisa de quebra desenhada.
- **Botão que existe e nunca aparece** já aconteceu aqui (016): se o desenho criar um estado condicional, ele precisa de gatilho descrito.
- **Confirmação que promete algo que não acontece** já aconteceu no billing (toast que nunca renderizou): não desenhe recibo de sucesso que o produto não emite.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como first-class** (o app tem controle de tema segmentado no desktop):
1. Mobile 390px — passo 1 online, repouso.
2. Mobile 390px — passo 1 offline (primário desabilitado + legenda).
3. Mobile 390px — passo 1 sincronizando.
4. Mobile 390px — passo 1 com sincronização parcial (alerta + causas por registro).
5. Mobile 390px — passo 2, confirmação destrutiva.
6. Desktop 1280px — passo 1 online e passo 2, com o scrim sobre a aba Conta.
7. Uma prancheta de variação com **12 registros** e um rótulo longo, provando a quebra.
8. Ambos os passos em tema claro (mínimo: passo 1 offline e passo 2).

Reutilize os primitivos existentes, sem criar novos: `tf-dialog` centrado (`showClose={false}`, sem X) para o container; `tf-dialog__title` e `tf-dialog__desc` para título e corpo — e resolva o recuo à direita do título que hoje reserva o X inexistente; `tf-alert--danger` para a sincronização parcial e `tf-alert--info`/`--neutral` se o desenho separar as causas; `tf-btn--primary` com `loading` para "Sincronizar agora"; `tf-btn--danger` para o destrutivo; `tf-btn--secondary` para "Voltar"; `tf-btn--danger-ghost` está disponível caso o desenho decida rebaixar o peso do descarte no passo 1. Se listar os registros, use o mesmo vocabulário de badge de sincronização já existente em Orçamentos.

## Perguntas em aberto para o dono
1. **O diálogo deve mostrar QUAIS registros estão em jogo** (rótulo, data, preço, estado), ou continua sendo só uma contagem? Isso muda a peça de caixa de confirmação para lista com decisão.
2. **Descarte deve ser tudo-ou-nada?** Hoje "Sair e descartar" apaga a fila inteira. Um registro `failed` que nunca vai passar e três `pending` que passariam recebem o mesmo destino.
3. **Qual é a ação primária de verdade quando o vendedor está offline?** Hoje sobra só o vermelho. "Voltar" (ficar logado e sincronizar depois) deve virar o primário nesse estado?
4. **"Sair e descartar" no passo 1 deve ter o mesmo peso visual do "Sincronizar agora"?** É a decisão que define se a peça protege ou apenas informa.
5. **Plural**: "1 registro(s)" é aceitável ou a copy passa a flexionar ("1 orçamento" / "12 orçamentos")? Note que o produto renomeou Histórico → **Orçamentos** (016/PR-A) e estes textos ainda dizem "registro".
6. **Entradas `blocked` por Premium**: o diálogo deve oferecer reativar o Premium ali, ou isso é upsell no pior momento possível e fica fora?
