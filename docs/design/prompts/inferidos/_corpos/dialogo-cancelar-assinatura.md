# Diálogo "Cancelar a assinatura?" — a única ação destrutiva paga do produto

## O que desenhar
A caixa de confirmação que aparece quando o assinante Premium clica em "Cancelar assinatura" na linha do
plano, dentro da aba **Conta**. É um diálogo centrado, modal, com foco preso: ele diz o que a pessoa
MANTÉM e até quando, o que acontece depois (congelamento em leitura, nada é apagado), e oferece duas
saídas — voltar atrás ou confirmar o cancelamento. Quem a usa é o vendedor que já paga (R$ 15,99/mês ou
R$ 155,88/ano) e está decidindo parar. É o único lugar do produto onde um clique tira algo que foi pago,
e é o único botão do módulo de cobrança que carrega a palavra "Cancelar" como AÇÃO — em todo o resto ela
está proibida como rótulo de dispensa.

## Por que este prompt existe
A caixa inteira foi inferida a partir de um texto de spec (`specs/012-e6-billing/ux-billing.md` §5, que
traz só um esboço em ASCII), sem nenhum artboard. O protótipo de 2026-07-02 desenha apenas o **gatilho** —
um botão fantasma "Cancelar assinatura" na tela da conta — e nenhum artboard tem diálogo, overlay ou
confirmação; a rodada 1 da homologação inclusive PROIBIU o assunto no protótipo ("Cancele quando quiser"
foi removido por ser decisão em aberto). Existe um padrão de caixa reutilizável (foco, Escape, alvos
≥44px, tudo verificado), mas ninguém compôs **título + corpo + aviso + erro + duas saídas de peso
desigual** para uma ação destrutiva de cobrança. E o desenho inferido contradizia a própria cópia: a
mensagem dizia "dá para voltar" enquanto o botão destrutivo era 2,2× mais largo (187,6×48px contra
85,6×48px) e o ÚNICO com preenchimento. Isso foi remendado às pressas trocando o preenchimento de lado —
o próprio comentário no código registra que "a largura continua desigual".

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/billing/plan-panel.tsx` (`CancelDialog`) e
`apps/web/src/shared/i18n/messages.pt-br.ts` (namespace `billing`). Ordem vertical atual, de cima para
baixo, tudo empilhado com espaçamento igual (gap de 12px), dentro de uma caixa com um "✕" de fechar no
canto superior direito:

| # | Elemento | Texto literal hoje | Tratamento atual |
|---|---|---|---|
| 1 | Título | "Cancelar a assinatura?" | título do diálogo |
| 2 | Corpo | "Seu Premium continua ativo até 31/12/2026." (sem data no servidor: "Seu Premium continua ativo até o fim do período já pago.") | descrição do diálogo, corpo normal |
| 3 | Aviso de congelamento | "Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser." | → **problema**: é o parágrafo que mais tranquiliza e está no MENOR tamanho (legenda) e no MENOR contraste (cinza apagado) da caixa |
| 4 | Erro (só após falha) | "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes." | alerta vermelho, aparece DENTRO da caixa, entre o aviso e os botões — → **problema**: empurra os botões para baixo e nunca foi desenhado nessa posição |
| 5 | Saídas | "Voltar" · "Cancelar assinatura" | linha alinhada à direita, gap de 8px; "Voltar" preenchido (secundário), "Cancelar assinatura" contornado em vermelho — → **problema**: larguras desiguais herdadas do comprimento do rótulo, nunca desenhadas |

Fora da caixa, e que o desenho precisa considerar como contexto:

- **Gatilho** — na linha "Plano" da Conta: selo verde "Premium", legenda "Plano mensal · renova em
  31/12/2026" e, à direita, dois botões pequenos e do mesmo peso: "Gerenciar assinatura" (leva ao
  Mercado Pago, fora do app) e "Cancelar assinatura".
- **Sucesso** — a caixa DESMONTA no instante do sucesso; o reconhecimento vive num toast verde:
  "Assinatura cancelada. Premium ativo até 31/12/2026." A linha do plano então passa a mostrar selo verde
  "Premium", legenda "ativo até 31/12/2026 · não renova", a nota "Seus itens salvos continuam disponíveis;
  nada é apagado." e o botão "Assinar novamente".

## Conteúdo e dados reais
- **A data** é sempre a do servidor (fim do período já pago), formatada pt-BR: `31/12/2026`. Nunca é
  calculada no aparelho, e pode faltar — nesse caso entra a frase sem data, que já existe. Desenhe as duas.
- **Não há campos de entrada.** Nada é digitado; não há caixa de "motivo do cancelamento" hoje.
- **Valores do plano** (aparecem na oferta, não nesta caixa, mas dão a escala do que está em jogo):
  R$ 15,99/mês, R$ 155,88/ano ("equivalente a 12,99/mês").
- **A caixa só existe para a assinatura ATIVA.** Em carência, pausado, gratuito ou já cancelado, o botão
  que a abre nem é renderizado — não desenhe variantes para esses casos, desenhe o gatilho ausente.

## Estados obrigatórios
1. **Repouso** — os cinco blocos acima, sem erro. Diga com o desenho qual das duas saídas é a segura.
2. **Sem data do servidor** — mesma caixa com "Seu Premium continua ativo até o fim do período já pago."
   (frase mais longa: mostre que ela quebra em duas linhas sem empurrar nada para fora).
3. **Foco** — o foco entra na caixa ao abrir e não escapa dela; Escape fecha e devolve o foco ao botão
   "Cancelar assinatura" da linha do plano. Desenhe o anel de foco visível nos dois botões e no "✕".
4. **Hover e pressionado** nas duas saídas e no "✕" — inclusive o hover do destrutivo, que hoje ganha
   fundo vermelho suave e borda mais escura.
5. **Confirmando (carregando)** — o botão destrutivo entra em carga; ele não pode ser clicado duas vezes,
   e "Voltar" precisa de uma posição definida nesse instante (continua clicável? fica desabilitado?).
   Nada na caixa pode sugerir que o cancelamento já aconteceu enquanto o servidor não respondeu.
6. **Erro** — alerta vermelho com "Não foi possível cancelar agora. Nada mudou — tente de novo em
   instantes.", a caixa segue aberta e as duas saídas continuam disponíveis. Ao fechar, o erro some.
7. **Falha por falta de rede** — hoje cai no MESMO alerta acima. Ele diz a verdade literal (nada foi
   espelhado no servidor), mas não diz "você está sem conexão". Desenhe como esse alerta se lê para quem
   está offline sem que a caixa acuse o produto de ter falhado ou insinue que o Premium acabou.
8. **Depois do sucesso** — a caixa não existe mais: desenhe o toast e a linha do plano no estado
   "ativo até 31/12/2026 · não renova", porque é a única prova que o vendedor recebe.

## Viewports
- **390px (mobile)** — obrigatório: é onde o transbordo já foi medido, e onde as duas saídas lado a lado
  com larguras desiguais ficam mais apertadas. Mostre também a linha do plano ATRÁS do overlay.
- **1280px (desktop)** — obrigatório: a Conta tem layout próprio de desktop, e a caixa não pode simplesmente
  esticar. Defina a largura máxima da caixa e o que acontece com o espaço restante.
- **1920px** — não precisa de prancheta nova, mas declare no desenho que a caixa mantém a mesma largura
  máxima de 1280px e permanece centrada.

## Regras que o desenho não pode quebrar
- **"Cancelar" só na ação, nunca na dispensa.** A saída segura chama-se "Voltar" e essa é uma regra dura
  do produto (FR-014). Não renomeie nenhum dos dois rótulos.
- **A saída segura precisa ser visivelmente a mais fácil.** A cópia promete reversibilidade; o desenho
  precisa concordar com ela — hierarquia, peso e largura são parte da promessa.
- **Sem culpa, sem escassez, sem padrão escuro**: nada de "tem certeza que quer perder tudo?", contagem
  regressiva, benefício riscado ou botão destrutivo escondido.
- **Frase honesta nunca em elemento estreito ou cortado.** O aviso de congelamento é a frase mais cara da
  caixa e precisa caber inteira, nos dois viewports, sem reticências.
- **A data é fato do servidor**, não estimativa: nunca escreva "aproximadamente" ou "em cerca de 30 dias".
- **Alvos ≥44×44px** para as duas saídas e para o "✕", medidos, não estimados.
- **Contraste do texto vermelho** medido contra o fundo REAL da caixa (não contra o fundo da página), nos
  dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo medido de 100,5px** na linha do plano a 390px: o botão de ação nascia inteiramente fora da
  viewport (x=396,3) e, com o modal aberto, o overlay cobria só 390px — sobrava uma faixa clara à direita
  com o botão solto à mostra por baixo. O desenho precisa mostrar o overlay cobrindo a página inteira.
- **Um toast que nunca apareceu**: a cópia de sucesso existia, mas a caixa desmontava antes de ela ser
  disparada — um observador armado por 8 segundos registrou zero inserções. Por isso o reconhecimento é
  desenhado FORA da caixa, e a prancheta do sucesso é obrigatória.
- **Hierarquia invertida medida em pixels** (187,6 contra 85,6, e só o destrutivo com fundo). Qualquer
  proposta aqui precisa vir com as duas larguras declaradas.
- Texto ocluso ou transbordado passa em teste de conteúdo: layout se prova com caixas medidas.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**, reaproveitando os primitivos existentes —
não crie componentes novos:

1. Repouso, 390px — caixa centrada (`tf-dialog` variante centrada, com o overlay), título `tf-dialog__title`,
   corpo `tf-dialog__desc`, aviso de congelamento (proponha o tratamento; hoje é legenda apagada), e as
   duas saídas em `tf-btn` — declare qual variante cada uma usa e as larguras resultantes.
2. Repouso, 1280px, com a linha do plano visível atrás do overlay.
3. Confirmando — botão destrutivo em carga.
4. Erro — `tf-alert` de tom perigo dentro da caixa, 390px, mostrando o empurrão vertical que ele causa.
5. Sem data do servidor — a frase longa quebrando.
6. Sucesso — `tf-toast` de tom sucesso + a linha do plano no estado "não renova" com `tf-badge` verde e
   o botão "Assinar novamente".
7. Uma folha de estados dos dois botões e do "✕": repouso, hover, foco, pressionado, desabilitado,
   carregando — com os alvos medidos anotados.

## Perguntas em aberto para o dono
1. **As duas saídas devem ter a mesma largura?** Igualá-las foi explicitamente considerada e não escolhida
   quando a hierarquia foi remendada; a decisão nunca foi desenhada. Se sim, largura igual em 50/50 ou
   ambas em largura total, empilhadas?
2. **Ordem e posição**: "Voltar" fica à esquerda do destrutivo, como hoje, ou o destrutivo desce/afasta-se
   para não ser o alvo mais próximo do polegar no mobile?
3. **O "✕" no canto continua?** Ele é o padrão da caixa e duplica a função de "Voltar" — a spec original o
   desenhava, mas com duas saídas explícitas ele pode virar ruído.
4. **Perguntar o motivo do cancelamento?** Não existe hoje e não está escrito em lugar nenhum; incluir
   muda a caixa inteira (e arrisca virar atrito, que a §5 proíbe).
5. **Quando a pessoa tem cortesia que sobrevive ao fim do período pago**, o painel avisa isso DEPOIS
   ("Seu acesso de cortesia continua depois disso."). A caixa deve avisar ANTES de confirmar, para não
   assustar com um corte que não vai acontecer?
