# Oferta de assinatura aberta por quem JÁ é Premium

## O que desenhar

A gaveta "Assinar o Premium" quando quem a abre **já paga**. Ela vive na aba **Conta** (`/conta`), é
uma folha ancorada à direita sobre a página, e é o mesmo painel de oferta que vende o Premium — só
que aqui ele encontra um assinante. Isso acontece de verdade por três caminhos: um link de teaser
guardado ou compartilhado que carrega a intenção `?assinar=1` na URL e abre a gaveta já montada; o
botão "voltar" do navegador depois de pagar; e um atalho salvo pelo próprio vendedor. Quem chega
aqui não tem nada para comprar — precisa entender numa olhada que já está tudo certo e sair para
onde queria ir. Origem no código: `features/billing/offer-panel.tsx`, `features/billing/billing.css`,
`pages/conta/conta-page.tsx`.

## Por que este prompt existe

Este estado **nunca foi desenhado** — autoridade NENHUMA. O canvas de billing alterna "gratuito"
(oferta) e "premium" (botões de gestão) como ramos **exclusivos** na mesma linha do plano, e o ramo
premium simplesmente não contém o bloco da oferta; a §E8 assume sempre um usuário gratuito ("upsell
disparado ao tocar Salvar/Exportar/Adicionar", que só um free encontra); a matriz §G não tem linha
para isso. O protótipo `PremiumScreen.jsx` recebe só `open` e, aberto por um assinante, mostraria a
compra inteira — o que é um defeito, não um desenho deste estado. O que existe hoje no produto foi
inferido por IA: uma guarda que troca a oferta inteira por **um único parágrafo solto**.

## O que já existe hoje (não invente do zero — corrija)

A gaveta tem duas partes: a **moldura**, que é do chamador, e o **conteúdo**, que é do painel.

| Parte | O que mostra hoje | Origem |
| --- | --- | --- |
| Título da folha | "Assinar o Premium" — caixa alta, fonte de título | `SheetTitle`, na Conta |
| Fechar | X de ≥44×44px no canto superior direito, rótulo acessível "Fechar"; Esc e clique no scrim também fecham | primitivo `tf-dialog` |
| Corpo (assinante) | **um** parágrafo: "Você já é Premium." | `offer-panel.tsx` |
| Corpo (não assinante) | lead "A calculadora é grátis e continua grátis." · "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar." · dois cartões de plano com rádio · botão "Assinar Premium" · "Você paga no Mercado Pago (Pix ou cartão)." · "O cartão nunca passa pelo nosso app." | idem |

→ **O título contradiz o corpo**: a folha continua intitulada "Assinar o Premium" para alguém que
não pode assinar. O título é do chamador, então a correção precisa ser dita com todas as letras.
→ **Não há saída oferecida dentro do conteúdo** — só o X da moldura. Nem "Gerenciar assinatura",
nem "Fechar", nem "Voltar para a Conta".
→ **Uma frase sozinha numa folha de altura total**: a 390px sobram ~700px de vazio abaixo dela; a
1280px, uma coluna de 416px do topo ao rodapé com uma linha de texto. Lê como tela quebrada.
→ **A frase não diz de quando é a informação.** O app sabe se a resposta é fresca ou lembrada, e a
linha do plano na Conta já anexa "última informação do servidor" quando é lembrada. Aqui, não.
→ **Sem ícone, sem selo, sem número** — nada confirma visualmente o que a frase afirma.

## Conteúdo e dados reais

- Frase homologada, **use literal**: **"Você já é Premium."** (é boa: curta, verdadeira, sem festa).
- O plano vem do servidor com três valores possíveis: `none` (gratuito), `active` (premium) e
  `lapsed` (pausado). Só `active` cai neste estado.
- A resposta traz também a **data de fim do acesso** (ex.: `2026-09-23` → "23/09/2026") e a origem
  da concessão — **a origem nunca é exibida ao usuário**, decisão antiga. Hoje o painel **ignora a
  data**; ela existe e poderia ancorar a frase.
- Textos que já existem no app e podem ser reaproveitados aqui em vez de inventados: "Plano" ·
  "Premium" · "Gerenciar assinatura" · "Cancelar assinatura" · "última informação do servidor" ·
  "Seus itens salvos continuam disponíveis para leitura." · "Recarregar" · "Fechar" ·
  "Voltar para a Conta".
- **Preços não entram nesta prancheta.** R$ 155,88/ano, R$ 12,99/mês e R$ 15,99/mês pertencem ao
  ramo de venda; mostrá-los a quem já paga é vender duas vezes. (Em qualquer prancheta onde houver
  dinheiro, o espaço entre `R$` e o valor é inquebrável: já quebrou linha em homologação,
  terminando uma linha em "R$" e começando a outra em "12,99/mês".)

## Estados obrigatórios

1. **Premium confirmado (resposta fresca)** — "Você já é Premium." com confirmação visual (selo
   "Premium" em tom de sucesso, ícone de traço 2px) e **pelo menos uma saída nomeada** no corpo.
2. **Premium lembrado (offline / servidor não respondeu)** — a mesma afirmação **mais** a
   procedência: "última informação do servidor". Nunca apresentar a memória como se fosse fresca, e
   nunca transformar a falha de rede em outra coisa.
3. **Resposta em trânsito, sem nada lembrado** — hoje o painel renderiza a **venda inteira** nesse
   instante e só depois descobre que a pessoa é assinante: um pagante vê "Assinar Premium" piscar.
   Desenhe o que ocupa a folha durante a espera (esqueleto neutro ou linha de carregamento), para
   que a venda não apareça antes da resposta.
4. **Premium em carência** (assinatura ativa, cobrança falhou, prazo correndo) — o servidor ainda
   diz `active`, então esta mesma frase aparece hoje, sem nenhum sinal do problema. Ver "Perguntas
   em aberto".
5. **Repouso / foco / hover / pressionado / carregando** para cada ação que você acrescentar (um
   "Gerenciar" sai para o Mercado Pago: precisa de carregamento honesto, não de sucesso antecipado).
6. **Fora de escopo, mas marque a fronteira**: `lapsed` ("Premium pausado") e `none` veem a oferta
   normal; erro sem resposta nenhuma também. Nenhum deles é esta prancheta.

## Viewports

- **390px** — a folha ocupa ~359px de largura e a altura toda da tela. É o caminho principal: no
  desktop a oferta inline nem sequer é montada para um assinante, então este estado é sobretudo o
  da gaveta no celular.
- **1280px** — mesma folha ancorada à direita, 416px de largura, altura total, com a página Conta
  visível ao fundo. Desenhe também esta, porque o vazio é maior e mais gritante aqui.
- 1920px não acrescenta nada: a folha não cresce.

## Regras que o desenho não pode quebrar

- **Não vender duas vezes.** Nenhum preço, nenhum cartão de plano, nenhum botão "Assinar Premium"
  neste estado — nem desbotado, nem "para conhecer os planos".
- **Nada de padrão escuro ao contrário**: a saída é visível, nomeada e alcançável sem caçar o X.
- **Procedência do plano**: se a informação é a última conhecida, a folha diz isso, em elemento de
  largura total (nunca em placeholder, que corta a frase).
- **Falha de rede nunca vira "não é Premium"** e nunca vira silêncio.
- **Título e corpo não podem se contradizer** — o rótulo da folha faz parte deste desenho, mesmo
  vindo do chamador.
- Alvo de toque ≥44px em tudo que for clicável; contraste medido contra o fundo real do cartão da
  folha, nos dois temas.

## Armadilhas já pagas neste projeto

- **Transbordo medido nesta mesma tela**: na linha do plano da Conta, a 390px, as ações somavam
  453,5px contra 316px de conteúdo e o botão "Recarregar" nascia **inteiramente fora da viewport**
  (100,5px de transbordo). Duas ações lado a lado numa folha de 359px têm de quebrar de verdade.
- **Um controle solto dentro de uma coluna flex estica**: o rádio dos planos virou uma barra de
  292–350px de largura com 13px de altura, medido. Qualquer elemento novo desenhado aqui precisa de
  largura própria declarada.
- **Toast que nunca apareceu**: uma confirmação disparada por um diálogo que fecha não chega a
  renderizar. Não desenhe acknowledgement que dependa da folha continuar aberta.
- **Texto ocluso ou transbordado passa em teste automatizado.** O que valida esta prancheta é a
  imagem e a medida da caixa, não a presença da frase.

## Entregável

De 5 a 6 pranchetas, **tema escuro primeiro, tema claro como igual**:

1. 390px — premium confirmado (resposta fresca).
2. 390px — premium lembrado, com a legenda de procedência.
3. 390px — resposta em trânsito.
4. 1280px — premium confirmado, folha sobre a Conta.
5. 1280px — as duas saídas possíveis lado a lado ("só fechar" × "fechar + gerenciar"), para o dono
   escolher.

Componha com os primitivos existentes, sem criar novos: `tf-dialog--sheet-right` para a folha,
`tf-badge--success` para o selo "Premium", `tf-btn--primary` para a saída principal e `tf-btn--ghost`
para a secundária, `tf-alert--info` (ou legenda em `--text-muted`) para a procedência, `tf-icon` para
o ícone de confirmação, `tf-spinner` para o trânsito. Use **um** único grafismo curvo para quebrar o
vazio da folha alta — um só, nunca dois.

## Perguntas em aberto para o dono

1. **Esta folha deve oferecer gestão** ("Gerenciar assinatura" no Mercado Pago, "Cancelar
   assinatura") — duplicando o que já existe no cartão de plano da Conta — ou só uma saída neutra
   ("Fechar" / "Voltar para a Conta")?
2. **O título da folha muda?** Hoje é "Assinar o Premium" mesmo para quem já assina. Se muda, para
   qual frase?
3. **Carência**: quando a assinatura está ativa mas a cobrança falhou, esta tela deve continuar
   dizendo apenas "Você já é Premium." ou deve trazer o problema de pagamento à frente?
4. **A data entra?** O app conhece o fim do acesso (ex.: 23/09/2026). Mostrar "renova em 23/09/2026"
   aqui, ou manter a data só no cartão de plano da Conta?
