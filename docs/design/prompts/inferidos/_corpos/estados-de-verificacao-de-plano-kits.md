# Verificação de plano na aba Kits: "checando" e a parede de "não sei"

## O que desenhar
Os estados que a aba **Kits** (`/kits`) mostra ANTES de decidir se o vendedor vê o compositor de kits, o teaser
de Premium ou um aviso de plano pausado. São dois momentos curtos e decisivos: (a) enquanto o app pergunta ao
servidor qual é o plano da conta — hoje um spinner com "Verificando seu plano…" ocupando a página inteira; e
(b) quando essa pergunta não tem resposta nenhuma (offline no primeiro acesso, servidor fora, sessão sem cache)
— hoje uma parede com "Não foi possível verificar seu plano." e um botão "Tentar novamente". Some-se a isso a
faixa que aparece no topo do compositor quando a re-checagem falha mas a última resposta do servidor ainda diz
"ativo". Quem usa: o vendedor que abriu a aba Kits para montar um anúncio, muitas vezes na oficina, com Wi-Fi
ruim. É o que ele vê nos 300ms–8s em que o produto ainda não sabe quem ele é.

## Por que este prompt existe
Nada disso foi desenhado. O canvas do 018 (`Abas-Desktop.dc.html`) modela o plano como um enum de dois ramos
(`premium | free`) — não existe "checando" nem "falhou a checagem" em nenhum dos quatro artboards, e um grep por
"Verificando" e "Não foi possível" no arquivo não acha nada. O protótipo de 2026-07 tem um Splash "Verificando
sessão…", mas isso é SESSÃO e é a abertura do app, não uma parede de entitlement por aba; a §E9 cobre erro
global e 404, a §E8 é o upsell. A auditoria de 2026-07-02 listou "missing states" e citou skeletons e load-error
de Catálogo/Histórico — nunca verificação de plano. Ou seja: os dois estados que decidem se o vendedor acredita
que **perdeu o Premium** ou que **a rede falhou** nasceram inteiramente de código.

## O que já existe hoje (não invente do zero — corrija)
Todos os estados usam a mesma casca (`GateShell`): um `PageHeader` com o `<h1>` "Monte seus kits" e nada mais,
dentro de um container `tf-page-wide` — 460px no mobile, 1120px a partir de 1024px e **1720px a partir de
1280px** (o 018 alargou). O conteúdo empilha em coluna com espaçamento uniforme.

| Estado (código) | O que renderiza hoje | Texto literal |
|---|---|---|
| Sessão em bootstrap | Spinner centralizado + legenda, bloco com respiro vertical grande | "Verificando seu plano…" |
| Sem resposta do servidor (`isError && !data`) | `Alert tone="info"` de largura total **+ botão secundário SOLTO abaixo** | "Não foi possível verificar seu plano." · "Tentar novamente" |
| Resposta ainda não chegou (`!data`) | O mesmo bloco de spinner acima | "Verificando seu plano…" |
| Lapsed reabrindo kit, lista carregando | O **mesmo** bloco de spinner | "Verificando seu plano…" |
| Re-checagem falhou, último "ativo" vale | `Alert tone="info"` no topo do compositor, **sem título e sem ação** | "Não foi possível verificar seu plano." |
| Sem Premium (`status: none`) / deslogado | `tf-premium-teaser` (título, subtítulo, botão Assinar, legenda) | "Monte e precifique kits com várias peças" · "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro, por canal." · "A calculadora de peça única continua grátis." |
| Premium pausado, sem kit aberto | `Alert tone="info"` COM título + botão secundário abaixo | "Premium pausado" · "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar ou editar, reative o Premium." · "Ver meus kits" |
| Premium pausado, kit reaberto | Faixa no topo do compositor | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." |

→ **A mesma frase serve a dois significados opostos.** "Não foi possível verificar seu plano." é ao mesmo tempo
a parede ("não sabemos nada, você não passa daqui") e a faixa calma ("seu Premium está ativo, só não conseguimos
reconfirmar agora"). São mensagens diferentes; a copy é uma só.
→ **`tone="info"` carrega três significados na mesma cor**: falha de verificação, plano pausado e taxas
desatualizadas. Um vendedor com Wi-Fi ruim pode ver as três faixas azuis empilhadas no topo, sem hierarquia.
→ **O botão "Tentar novamente" fica FORA do alerta**, colado à esquerda, enquanto no mesmo arquivo o alerta de
taxas ("Não foi possível atualizar as taxas") põe o botão DENTRO do bloco. Duas gramáticas na mesma tela.
→ **O botão de retry não mostra que está tentando.** Ele dispara a re-consulta e nada muda visualmente: o
vendedor clica de novo, e de novo.
→ **Nada limita o tempo do spinner.** Ele pode ficar sozinho numa página vazia indefinidamente.
→ **A 1280–1920px o problema explode**: um spinner de ~24px e uma linha de 12px flutuando no meio de um
container de 1720px, com um `<h1>` no topo e vazio absoluto abaixo.

## Conteúdo e dados reais
- O servidor responde exatamente três status: `none`, `active`, `lapsed`, mais os campos opcionais `source` e
  `expiresAt` (ISO). **Nenhum deles é mostrado nestes estados** — nem data de expiração, nem origem.
- A última resposta do servidor é lembrada no dispositivo (por conta). Só existe parede quando não há resposta
  **nem fresca nem lembrada** — primeiro acesso offline, cache limpo, ou troca de conta.
- Offline não pausa a consulta: ela **roda e falha**, de propósito, para que o produto saiba dizer "isto é do
  último acesso" em vez de passar por atual.
- Nenhum número de dinheiro aparece nesta peça. O primeiro `R$` só surge no compositor (ex.: "Total do kit"
  R$ 1.234,56) e no teaser de assinatura (R$ 15,99/mês ou R$ 155,88/ano) — não invente preço aqui.
- Nada é editável nestes estados: são leitura + no máximo um botão.

## Estados obrigatórios
1. **Checando (primeira montagem)** — spinner + "Verificando seu plano…". Precisa de uma forma que não seja
   "página quebrada": desenhe a alternativa ao spinner nu (esqueleto do compositor, por exemplo) e diga qual
   você recomenda.
2. **Checando prolongado (>3s)** — hoje idêntico ao anterior. Desenhe o que muda quando demora (não existe copy
   para isso; veja Perguntas em aberto).
3. **Parede "não sei" (repouso)** — "Não foi possível verificar seu plano." + "Tentar novamente". Precisa deixar
   claro, sem ler o texto duas vezes, que **isto não é falta de Premium**.
4. **Parede — botão em foco visível, hover, pressionado e carregando** (o carregando não existe hoje: desenhe).
5. **Parede após retry falhado** — o que muda na segunda tentativa sem virar acusação nem repetir o mesmo bloco.
6. **Re-checagem falhou com Premium ativo (faixa)** — o compositor inteiro visível, funcionando, com o aviso no
   topo. É o estado que separa "sua rede falhou" de "você perdeu o plano".
7. **Premium pausado, sem kit aberto** — "Premium pausado" + o corpo calmo + "Ver meus kits".
8. **Premium pausado, kit reaberto (faixa)** — o banner conviverá com o compositor cheio.
9. **Sem Premium** — o teaser `tf-premium-teaser` com a copy KITS acima. Este estado é a referência de contraste:
   a parede do item 3 **não pode parecer com ele**.
10. **Empilhamento** — faixa de re-checagem + faixa de plano pausado + "Não foi possível atualizar as taxas"
    (com seu próprio botão dentro) no topo da mesma tela. Mostre a hierarquia que resolve isso.

## Viewports
- **390px** — a aba existe no mobile e é onde o vendedor está quando a rede cai. A parede e o spinner precisam
  caber sem rolagem.
- **1280px** — o corte do 018: a partir daqui a página passa a usar a largura da tela.
- **1920px** — obrigatório para os estados 1, 2 e 3, porque é exatamente onde o conteúdo mínimo (um spinner, um
  alerta de uma linha) fica boiando num container de até 1720px. Se a resposta for limitar a largura do bloco de
  estado independentemente da página, mostre esse limite medido.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium.** A parede não pode ter botão de assinar, preço, ou
  qualquer elemento visual emprestado do teaser.
- **Nada de assumir premium por otimismo**: o compositor só aparece com uma resposta do servidor. "Checando" não
  pode mostrar campos que sugiram que já passou.
- **Vocabulário não punitivo**: "expirou", "bloqueado", "suspenso" são proibidos. O plano pausado é calmo, e os
  kits salvos continuam sendo dados do vendedor.
- **A frase honesta vive em elemento de largura total**, nunca em placeholder ou legenda que possa cortar.
- **Alvo de toque ≥44px** para "Tentar novamente" e "Ver meus kits", inclusive quando o botão for secundário.
- **Contraste medido contra o fundo real do alerta**, não contra o fundo da página.
- **O aviso de re-checagem não pode derrubar o trabalho**: o compositor permanece inteiro atrás dele.

## Armadilhas já pagas neste projeto
- **Botão nascido fora da viewport**: a homologação do E6 mediu 100,5px de overflow horizontal num painel de
  plano. Meça a caixa, não confie na aparência.
- **Texto ocluso passa em teste**: um elemento pode estar "visível" para o código e coberto na tela. Layout se
  homologa por geometria.
- **Rolagem no eixo Y invisível em headless**: o 016 perdeu um scroll vertical porque o headless não desenha a
  barra clássica. Se o bloco de estado tiver altura fixa, declare-a.
- **Toast não é lugar de aviso de estado**: no E6 um toast simplesmente nunca renderizou porque o container
  desmontava antes. Um estado de plano precisa estar na página, persistente.
- **Frase cortada por placeholder** (016/PR-F): honestidade não mora em texto auxiliar de campo.
- **Flash de estado errado**: já aconteceu de o painel de "Premium pausado" piscar por cima de uma reabertura
  válida enquanto a lista carregava. O desenho precisa de um estado de espera que não pareça uma resposta.

## Entregável
Pranchetas, no tema escuro (padrão) **e** no tema claro (first-class), reutilizando os primitivos existentes —
nomeadamente `tf-page-header` para o título, `tf-spinner` para a checagem, `tf-alert` (com seus tons) para os
avisos, `tf-btn--secondary` para as ações de retorno, `tf-card`/`tf-empty` para a moldura do bloco de estado e
`tf-premium-teaser` intocado para o ramo free. Não crie primitivo novo; se algum estado exigir uma variação,
descreva-a como variação do primitivo existente.

1. **390px**: checando · checando prolongado · parede (repouso) · parede (botão carregando) · faixa de
   re-checagem sobre o compositor · plano pausado sem kit.
2. **1280px** e **1920px**: os mesmos seis, com atenção ao vazio do container largo.
3. Uma prancheta de **contraste lado a lado**: parede "não sei" × teaser "sem Premium" × faixa "pausado" — a
   distinção que o produto trata como inegociável, provada visualmente.
4. Uma prancheta de **empilhamento** com as três faixas simultâneas e a hierarquia proposta.
5. Onde você mudar a copy, entregue a frase pt-BR proposta ao lado da atual, com a razão em uma linha.

## Perguntas em aberto para o dono
1. Depois de quantos segundos "Verificando seu plano…" deixa de ser aceitável, e o que aparece então? Não existe
   copy de espera longa nem de tempo esgotado no produto hoje.
2. A parede de "não sei" é **tela cheia** (substitui o compositor, como hoje) ou **bloco** dentro de um esqueleto
   do compositor desabilitado? A escolha muda o quanto o vendedor sente que perdeu acesso.
3. "Não foi possível verificar seu plano." deve virar **duas frases distintas** — uma para a parede (sem resposta
   nenhuma) e outra para a faixa (Premium ativo, só não reconfirmado)? Se sim, o dono aprova a copy de cada uma.
4. A parede deve oferecer uma **saída alternativa** além de "Tentar novamente" — por exemplo, um caminho para a
   calculadora de peça única, que é grátis e funciona offline — ou isso confunde com upsell?
5. O tom da parede continua `info` (azul, o mesmo de plano pausado e taxas desatualizadas) ou ganha um tom
   próprio de "atenção"? Hoje três significados diferentes dividem uma cor.
