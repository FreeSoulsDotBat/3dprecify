# Linha do plano na Conta — o estado "Premium pausado"

## O que desenhar
A linha "Plano" do cartão da Conta quando o vendedor **já pagou e perdeu a escrita**: o grant caducou, a conta
virou somente-leitura (o catálogo, os kits, os orçamentos e as simulações continuam lá, abrem e recalculam, mas
não salvam). É a primeira tela em que ele descobre isso de forma explícita — nas outras abas ele encontra uma
faixa "Premium pausado", e é para a Conta que essas faixas o mandam. Quem chega aqui é um ex-pagante ansioso:
ou o cartão falhou depois da carência, ou houve estorno/chargeback, ou a cortesia acabou. Ele quer duas
respostas em segundos: **"perdi meus dados?"** e **"como volto?"**.

## Por que este prompt existe
Este estado nunca foi desenhado. Ele foi inferido a partir de requisito textual: o código reusa o **mesmo selo
neutro do "Gratuito"**, trocando apenas a palavra, e coloca a tranquilização sobre os dados numa legenda de
`--fs-caption` ao lado. Resultado medido pela auditoria: **quem perdeu um acesso pago fica visualmente idêntico
a quem nunca pagou**. Não há protótipo parcial a resgatar — o canvas de autoridade (`Abas-Desktop.dc.html`)
trata plano como enum binário `premium|free` e não tem terceiro ramo; o `AccountScreen` do protótipo faz
`isPremium ? 'Premium' : 'Grátis'`; o `PremiumScreen` só conhece a primeira compra, não a reassinatura. O
único "congelamento" desenhado em algum lugar é o empty-state de upsell do Histórico, que é o *nunca teve* — e
não o *perdeu*. Falta desenhar como o produto comunica perda de acesso pago **sem parecer punição e sem parecer
igual a nunca ter assinado**.

## O que já existe hoje (não invente do zero — corrija)
O cartão é uma linha flex (rótulo + conteúdo à esquerda, ações à direita), com quebra para a segunda linha.
Origem: `apps/web/src/features/billing/plan-panel.tsx`, `pages/conta/conta-page.tsx`.

| Elemento | Conteúdo hoje | Observação |
|---|---|---|
| Rótulo da linha | "Plano" | `--text-body`, acima do selo |
| Selo | "Premium pausado" | pílula **neutra**: fundo `--bg-muted`, texto `--text-body`, `--fs-caption`, semibold, altura mín. 24px, `white-space: nowrap` → **é o mesmo selo, pixel a pixel, do "Gratuito"** |
| Legenda | "Seus itens salvos continuam disponíveis para leitura." | `--fs-caption` em `--text-muted`, **na mesma linha do selo** → a única frase que responde "perdi meus dados?" tem o menor tamanho e o menor contraste do cartão |
| Segunda linha | *não existe neste estado* | o código só emite a segunda linha ("nota") em carência e cancelamento |
| Ação primária | "Assinar novamente" | botão `size="sm"`, variante padrão |
| Ação secundária | "Recarregar" | botão `size="sm"` fantasma, ao lado; entra em carregando ao refazer a consulta |

→ Selo indistinguível do Gratuito é o defeito central.
→ A frase que acalma vive em tamanho de legenda, disputando a mesma linha com o selo.
→ Nada diz **o que trava** — só o que continua. As outras abas já dizem as duas metades ("Para criar ou editar,
reative o Premium"); esta, que é a tela do assunto, diz menos que elas.
→ **Offline/dado velho**: quando a resposta vem do cache, o app concatena o sufixo à mesma legenda e produz
literalmente `Seus itens salvos continuam disponíveis para leitura. · última informação do servidor` — ponto
final seguido de " · ". É feio e é obrigatório manter a informação; precisa de forma própria no desenho.

## Conteúdo e dados reais
- Textos literais de hoje (homologados, **não reescreva sem marcar que está propondo**): "Plano",
  "Premium pausado", "Seus itens salvos continuam disponíveis para leitura.", "Assinar novamente",
  "Recarregar", "última informação do servidor".
- O rótulo "Premium pausado" é **decisão fechada e cara**: era "Premium expirado" e foi trocado em homologação
  porque *expirar afirma uma causa* — num estorno o período foi cortado, não terminou. "Pausado" não afirma
  causa nenhuma e é a mesma palavra que Catálogo, Kits, Orçamentos e Simulações já usam.
- **Não há data e não há causa disponíveis neste estado.** O servidor manda apenas `none | active | lapsed`;
  a causa não trafega. Qualquer desenho que peça "pausado desde 12/08/2026" ou "por falta de pagamento" está
  pedindo contrato novo — se você achar que a peça precisa disso, escreva como pergunta ao dono, não desenhe
  como se existisse.
- Vizinhança do mesmo cartão (para o contraste que a prancheta precisa mostrar): "Gratuito" (selo neutro, sem
  legenda) · "Premium" (selo verde) + "Plano mensal · renova em 01/09/2026" · carência: selo **verde** +
  "pagamento pendente — regularize" e segunda linha "até 22/08/2026, senão o Premium pausa." em tom `info` ·
  cancelada: "ativo até 31/12/2026 · não renova" + "Seus itens salvos continuam disponíveis; nada é apagado." ·
  cortesia: "cortesia · expira em 30/09/2026" · falha: "Não foi possível confirmar seu plano." (selo neutro).
- A oferta que o botão leva: plano anual **R$ 155,88/ano**, "equivalente a R$ 12,99/mês", "~19% de economia
  frente ao mensal"; plano mensal **R$ 15,99/mês**, "cobrança todo mês, cancele quando quiser"; rodapé
  "Você paga no Mercado Pago (Pix ou cartão)." e "O cartão nunca passa pelo nosso app.".
- No desktop a oferta abre **inline, logo abaixo do cartão do plano**, sob o título "Assinar o Premium", e
  "Assinar novamente" apenas rola até ela. No mobile a mesma oferta abre numa gaveta.

## Estados obrigatórios
1. **Repouso (pausado)** — selo + frase de tranquilização + as duas ações.
2. **Pausado com dado velho (offline)** — a mesma linha, mais a marca de que aquilo é a última resposta
   guardada do servidor: "última informação do servidor". Resolva a colisão com o ponto final.
3. **"Recarregar" carregando** — o botão em estado ocupado enquanto reconsulta; o selo **não pode piscar para
   outro estado** nem virar esqueleto: o que está na tela continua sendo verdade até chegar outra.
4. **Foco de teclado** nos dois botões (anel visível sobre o fundo real do cartão) e **hover** e **pressionado**.
5. **Vizinhos para comparação na mesma prancheta**: "Gratuito" e "Premium" ativo — a prova visual de que os três
   não se confundem.
6. **Falha de leitura ("Não foi possível confirmar seu plano.")** — precisa ler como *não sabemos*, nunca como
   *você perdeu*; hoje ele também é um selo neutro.

## Viewports
- **390px (obrigatória)** — é onde o vendedor usa o app e onde esta linha já estourou a viewport uma vez.
- **1280px (obrigatória)** — é o corte em que a Conta vira três colunas (identidade+plano · tema · privacidade)
  e onde a oferta passa a abrir inline embaixo do cartão do plano; a coluna do plano é a mais larga das três.
- 1920px é bem-vinda só para mostrar que a coluna larga não estica o selo nem a frase até virar uma linha vazia.

## Regras que o desenho não pode quebrar
- **Freemium é binário no acesso, não no respeito**: pausado não é um castigo. Nada de vermelho de erro, de
  cadeado grande, de escurecer o conteúdo do vendedor. Os dados são dele; nada foi apagado.
- **Não afirmar causa.** Nenhuma palavra que diga por que pausou (expirou, venceu, falhou, inadimplente).
- **Dizer as duas metades**: o que continua funcionando e o que exige reativar. Meia verdade calma ainda é meia.
- **Falha de rede nunca vira "não é premium"**: o estado de erro de leitura tem forma própria.
- A frase honesta **nunca dentro de placeholder** e nunca em elemento que possa cortar — ela mora em bloco de
  largura total.
- Alvo de toque **≥44px** nas duas ações, mesmo em tamanho pequeno; contraste medido contra o fundo real do
  cartão, nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo medido nesta linha exata**: com dois botões `nowrap` ao lado do selo, a 390px a linha mediu
  453,5px contra 316px de conteúdo útil, a página foi a 491px (100,5px de transbordo) e o segundo botão nasceu
  **inteiramente fora da viewport** (x=396,3). O paliativo foi deixar as ações quebrarem para uma segunda linha.
  Desenhe a quebra de propósito — não conte com sorte de rótulo curto.
- **O selo é `nowrap`**: qualquer rótulo mais longo empurra a legenda, não quebra.
- Texto ocluso ou transbordado **passa em teste automatizado**: só a imagem no 1:1 mostra. Entregue as
  pranchetas na escala real.
- A carência já foi pega lendo **igual** à assinatura saudável (mesmos pixels, mesmo cinza). O mesmo erro de
  "temperatura visual idêntica" é o que está aqui entre pausado e gratuito.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos tratados como primários:
1. 390px — a linha do plano pausada, em repouso.
2. 390px — as três linhas empilhadas para comparação: Gratuito · Premium · Premium pausado.
3. 390px — variantes: dado velho (offline), "Recarregar" carregando, foco/hover/pressionado, falha de leitura.
4. 1280px — a coluna do plano pausada com a oferta inline aberta abaixo ("Assinar o Premium" + os dois planos).

Reaproveite os primitivos existentes, sem criar novos: o **cartão** da Conta como recipiente, o **selo** de
status (se ele precisar de outro tom, use um dos tons semânticos que já existem — neutro, informativo, sucesso,
perigo — não um quinto), os **botões** nas variantes já disponíveis (preenchido, secundário, fantasma) com o
estado de carregando que o botão já tem, o **ícone** e o **indicador de carregamento** do DS, e a **faixa de
aviso** já existente se a proposta for promover a tranquilização a bloco próprio. Marque com clareza o que é
proposta sua e o que é o estado atual.

## Perguntas em aberto para o dono
1. O selo do pausado deve **ganhar tom próprio** ou permanecer neutro? Deixá-lo neutro é o defeito relatado;
   torná-lo de perigo pode ler como punição a quem só quer voltar; informativo pode ler como aviso passageiro.
   A escolha é de produto, não de desenho.
2. A tranquilização deve **sair da legenda** e virar um bloco próprio (faixa/aviso) com as duas metades — o que
   continua e o que trava —, no mesmo formato longo que Catálogo/Kits/Orçamentos já usam?
3. "Assinar novamente" deve ser a **ação primária preenchida** desta linha (como a carência já fez com
   "Atualizar forma de pagamento"), ou continuar do mesmo peso que "Recarregar"?
4. No desktop, a oferta inline já abre **automaticamente** para quem está pausado. Isso é desejado para um
   ex-pagante, ou a oferta deve ficar fechada até ele pedir?
5. O painel pode mostrar **quando** o Premium pausou ou por quanto tempo a leitura continua? Hoje o servidor não
   manda nem data nem causa — responder "sim" a esta pergunta é uma mudança de contrato, não de layout.
