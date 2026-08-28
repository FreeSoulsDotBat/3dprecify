# Sair da conta com orçamentos ainda não sincronizados

## O que desenhar
O diálogo bloqueante que aparece quando o vendedor toca em **Sair** e ainda existem orçamentos gravados só
neste aparelho (a fila de envio, o *outbox*). Ele intercepta o logout em qualquer ponto do app — hoje há
dois "Sair": o do rodapé do rail de navegação no desktop e o da aba **Conta** — e segura a saída até o
vendedor decidir. São **três telas do mesmo diálogo**: (1) a decisão, com a contagem do que está em risco;
(2) a confirmação destrutiva, que substitui todo o conteúdo do mesmo quadro; (3) a etapa 1 de novo, agora
com um aviso de que a sincronização foi PARCIAL. É o único ponto do produto onde sair da conta pode
destruir trabalho do vendedor para sempre: sair apaga a fila deste aparelho, e a fila é a única cópia de
um orçamento que nunca chegou à conta.

## Por que este prompt existe
Nenhuma das quatro autoridades de desenho desenhou esta peça. O protótipo de 2026-07-02 (`claude-design-prototype.md`)
descreve a Conta como "email · plano · toggle de tema · Sair · Sobre/versão" e a matriz de estados registra
"Conta | offline: logout ok, sync off" — o logout é tratado como trivial, **porque no protótipo a fila
nem existia**. No canvas de desktop do dono há dois "Sair" e nenhum guarda, nenhum diálogo, nenhuma contagem.
A fonte real é `ux-history.md` §5 (um ASCII das duas etapas) e o próprio §9.1 item 4, que classifica
"Sign-out-with-queue dialog — High" como **explicitamente pendente de protótipo em pixel**. O terceiro
estado (falha parcial) não está nem na spec textual: nasceu de um review de código. Foram inferidos sem
desenho: o empilhamento vertical dos três botões, a posição do aviso de falha parcial e — o mais grave —
a **ausência de qualquer lista dos registros em risco**: hoje o vendedor decide descartar sem ver o que
vai perder.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/history/sign-out-outbox-guard.tsx` + `shared/i18n/messages.pt-br.ts`.
O quadro é um diálogo central (largura `min(92vw, 32rem)`, altura máx. 85vh, rolagem interna) e
**não tem botão X** — sair é decisão explícita; Esc / clique fora equivalem a "Voltar" (continua logado).

**Etapa 1 — a decisão**

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título | "{n} registro(s) ainda não foram sincronizados" | `{n}` = itens na fila; ex.: "3 registro(s) ainda não foram sincronizados" |
| Corpo | "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta." | frase honesta, manter verbatim |
| Aviso de falha parcial (condicional) | "{n} registro(s) não puderam ser enviados. Eles continuam neste aparelho." | bloco de alerta em tom perigo, hoje logo abaixo do corpo |
| Botão 1 (primário) | "Sincronizar agora" | desabilitado sem conexão **e** enquanto sincroniza |
| Legenda offline | "Precisa de conexão para enviar." | centralizada, entre o botão 1 e o botão 2, só quando offline |
| Botão 2 (perigo) | "Sair e descartar" | leva à etapa 2 |
| Botão 3 (secundário) | "Voltar" | fecha, permanece logado |

Os três botões estão **empilhados verticalmente**, largura total, nesta ordem — o destrutivo fica ACIMA do
"Voltar".

**Etapa 2 — a confirmação destrutiva** (substitui todo o conteúdo do mesmo quadro)

| Elemento | Texto literal hoje |
|---|---|
| Título | "Descartar {n} registro(s) e sair?" |
| Corpo | "Eles não foram enviados para a sua conta e não poderão ser recuperados." |
| Botões | linha alinhada à direita: "Voltar" (secundário) + "Descartar e sair" (perigo) |

→ **Problemas a resolver no desenho:**
→ 1. **Não existe lista do que está em risco.** O vendedor lê "3 registro(s)" e escolhe apagar às cegas.
→ 2. **Não existe estado de carregando visível.** Ao sincronizar, o botão só fica desabilitado — mesmo
     rótulo, nenhum indicador; uma fila de 20 itens parece um botão morto.
→ 3. **O aviso de falha parcial não diz a CAUSA.** O app tem vocabulário honesto por causa em outros
     lugares ("Envio pausado · precisa de Premium", "Envio pausado · sessão expirada", "Não foi possível
     registrar") e aqui joga tudo num "não puderam ser enviados" genérico — e "Sincronizar agora"
     continua oferecido mesmo quando nenhuma dessas causas pode ser resolvida por uma nova tentativa.
→ 4. **A ordem dos botões coloca a ação destrutiva antes da saída segura**, sem separação visual entre elas.
→ 5. Contagem em "registro(s)" — a forma de plural mais preguiçosa do produto, e ela aparece no TÍTULO.

## Conteúdo e dados reais
Cada registro da fila já tem, hoje, todo o conteúdo necessário para ser mostrado (é o mesmo material do
card da lista de Orçamentos):

- **Título**: o rótulo dado pelo vendedor ("Cliente João", "Feira do maker"), ou o nome do produto/kit de
  origem, ou o texto "Cálculo avulso" quando não há nem um nem outro.
- **Data**: "Cotado em 03/07/2026".
- **Tipo**: "Peça única" ou "Kit · 4 peças".
- **Dinheiro**: rótulo "Valor cotado" + o valor, ex.: **R$ 1.234,56** (valores reais do produto vão de
  ~R$ 16,16 a alguns milhares; a máscara de milhar é obrigatória).
- **Base**: legenda "preço de varejo" ou "preço de atacado".
- **Selo de estado**: "Pendente neste dispositivo" (informativo) · "Envio pausado · precisa de Premium" ·
  "Envio pausado · sessão expirada" · "Não foi possível registrar" (perigo).

A contagem `{n}` é derivada: é o tamanho real da fila no momento, e **é reescrita** depois de uma
sincronização parcial (de 5 pode virar 2, com o mesmo diálogo aberto). Faixa plausível: 1 a algumas
dezenas — desenhe o quadro para 1, para 3 e para 12+.

## Estados obrigatórios
1. **Repouso, online** — etapa 1 com os três botões, "Sincronizar agora" ativo.
2. **Offline** — "Sincronizar agora" desabilitado + a legenda "Precisa de conexão para enviar." visível
   entre ele e "Sair e descartar". A legenda é a explicação de um botão morto: não pode sumir nem virar
   tooltip.
3. **Sincronizando** — o primário ocupado; mostre o progresso de forma honesta (o app sabe quantos faltam).
4. **Falha parcial** — volta à etapa 1 com o alerta em tom perigo "{n} registro(s) não puderam ser
   enviados. Eles continuam neste aparelho." e o título já com a contagem NOVA. O vendedor **não** foi
   deslogado: essa é a regra.
5. **Confirmação destrutiva** (etapa 2) — o quadro inteiro trocado, foco inicial no caminho seguro.
6. **Foco / hover / pressionado / desabilitado** de cada botão, incluindo o anel de foco sobre o fundo do
   diálogo (não sobre o fundo da página).
7. **Sucesso total** — o diálogo simplesmente fecha e o logout acontece; nada a desenhar além da ausência.
8. **Envio pausado por Premium ou por sessão expirada** entre os itens da fila — precisa aparecer no
   desenho (é a causa mais comum de falha parcial e a que "tentar de novo" nunca resolve).

## Viewports
- **Mobile 390px** — obrigatório: é onde o vendedor mais usa o app e onde o quadro chega a ~359px de
  largura útil; a pilha vertical de botões nasceu daqui.
- **Desktop 1280px** — obrigatório: o incremento 018 pôs um "Sair" no rodapé do rail de navegação e outro
  na aba Conta; o quadro fica travado em 512px de largura sobre a área de trabalho, e a pilha vertical de
  três botões largura-total fica visivelmente estranha nessa largura. Se o desenho separar os layouts,
  diga qual é o corte.
- **Desktop 1920px** — só se o quadro mudar de tamanho ou de ancoragem; caso contrário, declare
  explicitamente que é idêntico ao de 1280px.

## Regras que o desenho não pode quebrar
- **Nunca vender falha de rede como problema de plano nem o contrário.** Cada causa tem a sua frase, e
  "conexão" não pode aparecer quando o motivo é sessão expirada ou Premium pausado.
- **A frase honesta vive em elemento de largura total**, nunca em placeholder e nunca cortada por
  reticências — já custou uma homologação neste projeto.
- **Não existe caminho silencioso.** Nenhum toast depois do fato, nenhum descarte sem a etapa 2, nenhum
  logout automático depois de falha parcial.
- **A saída segura precisa ser visualmente inconfundível** em relação ao descarte; um vendedor com pressa
  tocando no lugar errado perde trabalho para sempre.
- **Alvo mínimo 44×44px** em todos os botões, inclusive na linha da etapa 2.
- **Contraste medido contra o fundo real do diálogo** (que já é uma superfície elevada), não contra o
  fundo da página, nos dois temas.
- O quadro rola internamente (85vh máx.): se o desenho introduzir uma lista, ela precisa de um limite de
  altura próprio e os botões precisam continuar alcançáveis sem rolar até o fim.

## Armadilhas já pagas neste projeto
- **Estouro medido nos DOIS eixos.** O headless não enxerga barra de rolagem clássica; o item 9 da
  homologação de 016 era rolagem no eixo VERTICAL. Um diálogo com lista é candidato natural a estourar.
- **Nome longo estoura a coluna do dinheiro.** "Cliente João da Silva Comércio de Peças" ao lado de
  R$ 1.234,56 já quebrou layout de PDF neste produto porque o teste lia texto, não geometria. Desenhe
  com o rótulo mais longo plausível, não com "Cliente A".
- **Texto ocluso passa em teste.** Se algo ficar atrás do rodapé de botões ou fora do quadro, nenhum
  teste de texto acusa — só o desenho e a medida de caixa.
- **Máscara de milhar sumindo** em reabertura programática já foi achado real (R5): mostre R$ 1.234,56,
  nunca R$ 1234.56.
- **Botão nascido fora da viewport**: em 012/PR-B um botão de um diálogo nasceu 100px fora da tela em
  390px. A pilha vertical de três botões + alerta + lista é exatamente a receita para repetir isso.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como cidadão de primeira classe**, em 390px e 1280px:
1. Etapa 1 online, fila com 3 registros.
2. Etapa 1 offline (legenda "Precisa de conexão para enviar." no lugar).
3. Etapa 1 sincronizando.
4. Etapa 1 após falha parcial, com o alerta em tom perigo e a contagem reescrita.
5. Etapa 2, a confirmação destrutiva.
6. Uma prancheta de estresse: 12+ registros, rótulo longo, valor na casa dos milhares.

Reutilize os primitivos existentes, sem criar novos: o **quadro do diálogo** (variante central, sem X),
**título e descrição do diálogo** para as duas etapas, o **bloco de alerta em tom perigo** para a falha
parcial, os **botões** nas variantes primário / perigo / secundário, o **selo** nos tons informativo e
perigo para o estado de cada registro, e o **card com padding pequeno** caso a lista de registros entre.
O dinheiro usa o estilo de preço já existente, com a máscara pt-BR.

## Perguntas em aberto para o dono
1. **A lista dos registros em risco entra?** É a correção mais importante possível aqui, mas muda o
   tamanho da peça. Se entra: entra na etapa 1, na etapa 2, ou nas duas? Mostra tudo com rolagem, ou os
   primeiros N com um "e mais X"? E o vendedor pode escolher o que descartar, ou continua sendo tudo-ou-nada?
2. **O aviso de falha parcial deve nomear a causa por registro** (Premium pausado / sessão expirada /
   recusado pelo servidor), como o resto do app já faz? E quando **nenhum** dos que sobraram pode ser
   resolvido por nova tentativa, "Sincronizar agora" continua sendo o botão primário?
3. **A ordem dos botões na etapa 1 muda?** Hoje o destrutivo fica acima de "Voltar". O senhor quer o
   destrutivo por último, separado, ou até rebaixado a link discreto?
4. **A contagem "registro(s)"** fica assim ou vira forma singular/plural de verdade ("1 orçamento" /
   "3 orçamentos")? Nota: o resto do produto já chama esses documentos de **Orçamentos**, mas este
   diálogo diz "registro" — pode ser incoerência de vocabulário a resolver.
5. **No desktop com o rail de 018**, o diálogo cobre a tela inteira ou fica ancorado à área de conteúdo?
   Nada no canvas responde isso.
