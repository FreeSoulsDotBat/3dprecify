# O reconhecimento do cancelamento da assinatura

## O que desenhar

A confirmação de que o cancelamento da assinatura Premium REALMENTE aconteceu. Ela vive na aba **Conta**,
logo depois do diálogo "Cancelar a assinatura?": o vendedor confirma, o diálogo fecha, e a única coisa que
lhe diz "pronto, aconteceu" é um toast efêmero de tom `success` com a frase "Assinatura cancelada. Premium
ativo até 12/09/2026." — que some sozinho em 5 segundos. Em paralelo, a linha "Plano" do painel se
reescreve para o estado cancelado. Quem usa: um MEI solo que acabou de tomar uma decisão de dinheiro
irreversível-na-prática e precisa saber (a) que ela foi registrada, (b) até quando ainda tem o que pagou,
(c) que nada dele foi apagado. Desenhe o **par**: o toast e o eco persistente na linha do plano.

## Por que este prompt existe

Nada disso foi desenhado. O toast é disparado do `onSuccess` do hook (`use-subscription.ts`), e mora ali
porque o diálogo DESMONTA no flip de estado — medido na homologação T028/B2: um `MutationObserver` sobre o
toaster, armado antes do clique e observado por 8s, registrou **zero inserções**. A copy existia no bundle
afirmando um reconhecimento que em runtime nunca acontecia. O primitivo `tf-toast` existe no DS
(`claude-design-prototype.md` §D.2), mas **nenhuma tela de cobrança do protótipo dispara toast** (§E8 termina
na tela de planos) e o canvas 018 não tem toast em artboard nenhum. O que falta não é o componente: é a
decisão de desenho sobre se um aviso que some sozinho BASTA como recibo de uma ação de cobrança.

## O que já existe hoje (não invente do zero — corrija)

**O toast** (`tf-toast--success`, dentro da região `tf-toaster`):

| Parte | Hoje |
| --- | --- |
| Ícone | Lucide `circle-check`, 18px, cor `--success-text` |
| Mensagem | "Assinatura cancelada. Premium ativo até {data}." — `--fs-body-sm`, `--lh-snug` |
| Sem data | "Assinatura cancelada. Premium ativo até o fim do período já pago." |
| Fechar | botão só-ícone `x` de 16px, alvo `--touch-min`, `aria-label` "Fechar", cor `--text-muted` |
| Caixa | `--surface-raised`, borda 1px `--border-subtle`, raio `md`, sombra `md` |
| Região | largura `min(92vw, 30rem)`; mobile centrado embaixo, acima da tab bar; ≥768px canto inferior direito |
| Duração | 5000ms com auto-dispensa; fila em coluna com 8px de intervalo; `role="status"`, `aria-live="polite"` |

→ **Problema 1:** o toast não tem título, hierarquia nem ação. É uma linha de texto corrida para um evento
de cobrança — visualmente idêntico a um "Filamento salvo".
→ **Problema 2:** a frase do toast ("Assinatura cancelada. Premium ativo até 12/09/2026.") é quase a mesma
do diálogo que acabou de fechar ("Seu Premium continua ativo até 12/09/2026."). Nada no desenho separa
*vai acontecer* de *aconteceu*.
→ **Problema 3:** some em 5s e não deixa rastro próprio. O único eco é a legenda da linha do plano — que
pode estar fora da tela se a Conta estiver rolada.
→ **Problema 4 (desktop):** a região do toaster foi desenhada para o mobile com tab bar. No layout 018
(rail lateral + ficha de 560px à direita) ninguém decidiu onde essa caixa cai — ela pode nascer por cima
da ficha.

**O eco na linha "Plano"** (Conta, linha em `tf-card`), depois do cancelamento:

- rótulo "Plano"; badge **verde** `tf-badge--success` com "Premium" — continua verde de propósito: o
  Premium SEGUE ativo até a data;
- legenda: "ativo até 12/09/2026 · não renova" (`--fs-caption`, `--text-muted`);
- nota: "Seus itens salvos continuam disponíveis; nada é apagado." — e, quando uma cortesia sobrevive ao
  fim do período pago, ganha ainda "Seu acesso de cortesia continua depois disso.";
- ação: botão `sm` "Assinar novamente";
- se a leitura veio do cache, a legenda ganha " · última informação do servidor".

## Conteúdo e dados reais

- **Data**: `dd/mm/aaaa` em pt-BR, vinda da resposta do servidor (`currentPeriodEnd`), nunca da que estava
  na tela. Exemplo real: **12/09/2026**. Pode ser nula — daí a variante sem data.
- **Preços que o vendedor deixa de pagar** (aparecem na oferta de reassinar, não no toast):
  **R$ 15,99/mês** e **R$ 155,88/ano** ("equivalente a R$ 12,99/mês").
- Texto mais longo possível do toast hoje: "Assinatura cancelada. Premium ativo até o fim do período já
  pago." — 63 caracteres, quebra em 2–3 linhas a 390px. Desenhe COM essa string, não com a curta.
- Nada aqui é opcional exceto a data; a nota de cortesia é derivada (só quando a cortesia ultrapassa a data).

## Estados obrigatórios

1. **Sucesso com data** — toast `success`: "Assinatura cancelada. Premium ativo até 12/09/2026."
2. **Sucesso sem data** — "Assinatura cancelada. Premium ativo até o fim do período já pago." (2–3 linhas).
3. **Entrada e saída** — como aparece e como some (130/190ms, ease-out) e o que acontece com
   `prefers-reduced-motion`. Desenhe também a **fila**: dois toasts empilhados.
4. **Foco / hover / pressionado do "Fechar"** — anel roxo de 3px em `:focus-visible`, `--text-muted` →
   `--text-strong` no hover. O alvo é ≥44px mesmo com o ícone de 16px.
5. **Carregando (antes)** — o botão "Cancelar assinatura" dentro do diálogo em estado de carregamento; o
   diálogo ainda está montado. É o único "processando" honesto deste fluxo.
6. **Erro** — NÃO é toast: o diálogo continua montado e mostra um `tf-alert--danger` com "Não foi possível
   cancelar agora. Nada mudou — tente de novo em instantes." Desenhe esse quadro junto, porque é o par do
   sucesso e é onde a falha de rede aparece.
7. **Eco persistente pós-flip** — a linha "Plano" no estado cancelado (badge verde "Premium" + "ativo até
   12/09/2026 · não renova" + a nota + "Assinar novamente").
8. **Degradado / leitura offline** — a mesma linha com " · última informação do servidor" na legenda.
9. **Cortesia sobrevive** — a linha com as DUAS frases da nota, que é o caso em que o texto fica mais alto.

## Viewports

- **390px** — obrigatório: é onde o vendedor cancela, onde o toast concorre com a tab bar (ele nasce acima
  dela) e onde a frase longa quebra.
- **1280px** — obrigatório: o layout 018 tem rail lateral e ficha de 560px à direita, exatamente onde o
  toaster ancora acima de 768px. Mostre onde a caixa cai sem cobrir a ficha nem o botão que a disparou.
- **1920px** — opcional, só se a ancoragem mudar; se não mudar, diga que 1280 vale.

## Regras que o desenho não pode quebrar

- **O badge não pode degradar.** Enquanto a data não chegou, o Premium está ativo; pintá-lo de cinza mentiria
  na direção mais cara — faria o vendedor parar de usar o que já pagou.
- **A data é fato do servidor.** Ela nunca aparece sem o que significa ("ativo até", "não renova"). Não
  invente "expira em" nem contagem regressiva.
- **Falha nunca vira upsell.** O caminho de erro diz "Nada mudou" e não oferece nada.
- **Sem padrão escuro na volta.** "Assinar novamente" é um botão comum; nada de escassez, urgência ou
  destaque punitivo por ter cancelado.
- **A frase honesta ("nada é apagado") mora em elemento de largura total**, nunca cortada por reticências.
- Alvo ≥44px no "Fechar"; contraste medido do `--text-muted` sobre `--surface-raised` (é o pior par da peça).

## Armadilhas já pagas neste projeto

- **T028/B2**: um toast que existia na copy e nunca renderizava — 0 inserções em 8s. Portanto: se o desenho
  depender de o toast aparecer, ele precisa dizer por quanto tempo e o que fica quando ele some.
- **T028/A3**: dois estados de cobrança com temperatura visual idêntica (carência lia como saudável). Aqui
  o risco gêmeo é "cancelado" ler igual a "ativo".
- **Homologação 016**: quebra de linha entre `R$` e o valor numa linha de preço — o separador é NBSP.
- **Overflow medido**: 100,5px de transbordo horizontal e um botão nascido fora da viewport nesta mesma
  tela de cobrança. Um toast de 30rem numa viewport de 390px precisa ser medido, não estimado.
- **Texto ocluso passa em teste**: uma asserção de visibilidade não vê uma caixa coberta pela ficha do desktop.

## Entregável

Pranchetas, em **escuro** (padrão) e **claro** (first-class), reutilizando os primitivos:

1. **Toast — sucesso com data**, 390px, escuro e claro (`tf-toast--success`, `tf-icon` com `circle-check` e `x`).
2. **Toast — sucesso sem data + fila de dois**, 390px, mostrando a quebra da frase longa.
3. **Movimento**: entrada, repouso e saída, mais a variante de movimento reduzido.
4. **O eco na Conta**: a linha "Plano" cancelada, mobile e 1280px (`tf-card`, `tf-badge--success`, `tf-btn--sm`).
5. **O par de erro**: diálogo montado com `tf-alert--danger` e o botão de confirmação carregando.
6. **Desktop 1280px**: ancoragem do toaster junto do rail e da ficha, com as medidas de folga.

Se você concluir que o toast sozinho não basta para uma ação de cobrança, **proponha a alternativa como
prancheta extra** (ex.: toast + destaque temporário na linha do plano), rotulada como proposta — não
substitua a existente sem dizer.

## Perguntas em aberto para o dono

1. Um aviso que some em 5s basta como recibo de cancelamento, ou uma ação de cobrança exige um toast que só
   sai por dispensa manual e/ou um destaque temporário na linha do plano?
2. O toast deve carregar uma ação ("Ver plano" / "Assinar novamente") ou permanece só texto + fechar?
3. Existe recibo fora do app (e-mail do Mercado Pago) que o toast possa citar? Se existe, a frase muda.
4. No desktop 018, o toast ancora no canto inferior direito (por cima da área da ficha) ou passa a nascer
   dentro da coluna de conteúdo, ao lado do painel que o originou?
