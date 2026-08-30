# Plano de correção — o que eu consigo consertar sozinho

**Data**: 2026-08-03 · **Estado**: PLANO. Nada foi implementado (R8 + §7 do mandato).
**Base**: achados de F01–F12. **A F13 ainda não rodou** — o desempenho pode acrescentar itens, e
este plano será reaberto, não refeito.

---

## Como eu classifiquei

| balde | critério | quantos |
| --- | --- | --- |
| **A — autônomo** | o conserto é determinado pelo próprio achado; não há escolha de produto a fazer | **7 lotes / 17 achados** |
| **B — uma palavra sua destrava** | eu sei o conserto e tenho recomendação, mas a forma é decisão sua | **5 achados** |
| **C — bloqueado em você** | exige decisão jurídica, de produto, de infra ou autorização | **7 achados** |

O agrupamento é **por causa raiz**, não por arquivo: consertar uma causa fecha vários achados de uma
vez, e essa é a única forma de agrupamento que não esconde trabalho.

---

# BALDE A — autônomo

## Lote A1 — o dinheiro na tela (2 Altos bloqueantes + 2 achados) — **primeiro**

| fecha | severidade |
| --- | --- |
| `[F11b-000]` causa raiz | — |
| `[F11a-002]` preço quebrado no meio do número | **Alto, BLOQUEIA** |
| `[F11b-001]` `R$` desgruda no registro congelado | **Alto, BLOQUEIA** |
| `[F11a-001]` campo com afixo dos dois lados a 360px | **Alto, BLOQUEIA** |

**Causa raiz**: o dinheiro é renderizado como texto quebrável, e o CSS que impede o transbordo
(`overflow-wrap: anywhere`) o impede **quebrando o número**. `formatBRL` ainda monta `R$ ` com
**espaço comum** — a correção de NBSP foi aplicada a três constantes de cópia e **não** à função com
19 chamadores.

**Conserto**:

1. `formatBRL` passa a usar NBSP entre símbolo e valor (uma linha, 19 chamadores herdam).
2. A quebra dentro dos dígitos é **proibida** (`word-break: keep-all` / `overflow-wrap: normal` no
   span dos dígitos), e o transbordo passa a ser resolvido por **encolhimento** (`clamp()` de
   `font-size`) — não por quebra. Se o valor ainda não couber no piso de fonte, a quebra permitida é
   **entre o `R$` e o número**, nunca dentro dele.
3. O campo numérico com afixo ganha piso de largura para os dígitos a 360px.

**Como fica provado** (o par é o que importa — cada um sozinho é satisfeito pelo defeito):
- a asserção existente de "sem transbordo horizontal", **agora rodando a 360**, e
- uma asserção nova de que o preço ocupa **uma única caixa** (`getClientRects().length === 1`).
Juntas, só podem ser satisfeitas encolhendo. Mais **imagem** a 360 e a 1440, nos dois temas.

**Risco**: mexer no herói e no cartão do histórico exige re-homologação visual (não só suíte verde).

---

## Lote A2 — `[F04b-001]`, o `None` que quer dizer duas coisas — **Bloqueante**

**Parte autônoma**: o `_get` do provedor MP devolve hoje `None` para "não achei" **e** para "não
consegui perguntar". A distinção é um tipo de três casos; o webhook deixa de tratar falha de
transporte como "assinatura inexistente" e passa a **não escrever nada** + emitir log estruturado.

**Parte que depende de você**: se respondemos 5xx (confiando no reenvio do MP) ou se dependemos só de
reconciliação própria. É a **P-009**. Eu consigo fechar isso **lendo a documentação oficial do MP**
se você autorizar a consulta externa — é leitura, não escrita.

**Segunda metade do achado, também autônoma**: `reconcile_subscriptions.py` está com **0% de
cobertura** (F10). Uma rede de segurança sem teste não é rede.

**Como fica provado**: vermelho primeiro, com controle positivo — um caso em que o MP responde e um
em que o MP cai, exigindo condutas **diferentes**. Mutação: transformar a falha de transporte em
"não achei" deve derrubar o teste.

---

## Lote A3 — `[F04a-001]`, o `expiresAt` que reporta a data errada — **Alto**

O campo devolve a validade do grant **mais recente**, não a **mais distante**. Um grant novo mais
curto encurta a data mostrada ao vendedor mesmo com um grant longo ainda vivo.

**Conserto**: a data passa a ser `max(expires_at)` entre os grants ativos; a origem continua a do mais
recente. Duas linhas.

**Como fica provado**: caso com dois grants sobrepostos de validades invertidas — o teste atual não
tem esse caso porque as fixtures são **coerentes por construção**, que foi exatamente o que deixou
passar tanto este achado quanto o "ativo falso" do T027.

---

## Lote A4 — `[F09-001]`, fixar as ações de CI por SHA — **Alto, BLOQUEIA**

**0 de 33** usos de ação estão fixados; um deles é `trufflehog@main`, terceiro por branch mutável; e o
`deploy.yml`, que roda com credencial WIF de produção, está entre os não fixados. A remediação
`SEC-014-02` diz **"imediatamente"** e nunca foi feita.

**Conserto**: resolver o SHA de 40 caracteres de cada ação via `gh api` e substituir a tag,
começando pelo `trufflehog`. Mecânico, sem escolha a fazer.

**Fica com você**: ligar `sha_pinning_required: true` — é configuração do repositório, não código.

**Como fica provado**: uma varredura que **falha** se qualquer `uses:` não terminar em SHA de 40
caracteres, rodando no próprio CI. Sem essa varredura o conserto regride no próximo PR.

---

## Lote A5 — a cura que existe num módulo e não foi aplicada ao irmão

Este lote não é um achado; é **o padrão que esta auditoria mais mediu** (quatro instâncias).

| fecha | o quê | severidade |
| --- | --- | --- |
| `[F03a-001]` | `pricing-core` não carrega sob `node` puro — imports relativos sem extensão. **A mesma doença foi curada no `fee-ingest` e não no irmão.** | Baixo |
| `[F08-001]` | seis pré-carregamentos sem `.catch`, enquanto o `outbox.ts:121` faz `then(run, run)` | Baixo |
| `[F10-001]` | `MIN_ROWS = 28` mora no único arquivo isento de cobertura — três regras já migraram por esse exato motivo, e essa ficou | Baixo |
| `[F05-002]` | isolamento de `bom_lines` é **herdado** do pai, não imposto na consulta | Baixo |

**Como fica provado**: um teste que **executa o ponto de entrada** sob `node` puro (a lição do US4:
suíte verde não prova programa que roda), e uma consulta de `bom_lines` com dono cruzado.

---

## Lote A6 — `[F12-001]`, os três pontos cegos da cobertura de a11y

1. Baixar o viewport dos testes de a11y de **390 para 360** — os 30 pixels que separam "tudo verde"
   de dois Altos bloqueantes.
2. Estender a medição de contraste a texto corrente, `--text-muted`, botão fantasma e desabilitado.
3. Acrescentar ao teste de "valores gigantes" a asserção de **não-quebra** — sem ela o teste continua
   **cúmplice** do `[F11a-002]`, passando **por causa** do defeito.

O item 3 é pré-requisito do Lote A1: sem ele, o conserto do preço não tem como ser provado.

---

## Lote A7 — a documentação que descreve o que não é verdade

Este lote **cabe inteiro dentro da R8** (só escreve em `specs/` e `docs/`), então é o único que eu
poderia executar nesta mesma rodada sem tocar em código de produção.

| fecha | o quê |
| --- | --- |
| `[F02-000]` | specs antigas nunca emendadas quando uma decisão posterior as superou — a classe |
| `[F02A-007]` | `PRICING_MODEL_VERSION` é `3.1.0`; a spec diz `3.0.0` |
| `[F02C-001]` | `dod-evidence` §4 contradiz a si mesmo — placeholder ao lado do veredito cheio |
| `[F02B-004]` | contagens do dod-evidence da 007 são retrato de 2026-07-10 apresentado como vivo |
| `[F02B-012]` | dod-evidence da 010 nunca atualizado após a correção da 013 |
| `[F02B-003]`, `[F02B-005]`, `[F02B-002]`, `[F02B-006]` | quatro afirmações que o E6 tornou falsas ("sem CTA de compra pré-E6", "sem preço no teaser", "sem self-service") |

**Forma**: bloco de **Clarification datada** em cada spec, no padrão que o projeto já usa — a spec
original não é reescrita, ela é **emendada**. É a forma que preserva a história.

---

# BALDE B — eu sei o conserto; a forma é sua

Cada item abaixo destrava com **uma palavra**. Minha recomendação já está escrita.

| achado | severidade | a pergunta | minha recomendação |
| --- | --- | --- | --- |
| `[F11b-002]` na carência, a ação que **salva** a assinatura é a única sem botão | **Alto, BLOQUEIA** | "Atualizar forma de pagamento" vira botão primário? | **Sim.** Numa tela de carência, a ação que evita a perda tem de ser a mais visível |
| `[F11b-004]` no diálogo de cancelar, a ação **irreversível** é a única que parece botão | Médio | inverter a hierarquia? | **Sim** — destrutivo não é a ação padrão |
| `[F11a-007]` Amazon sem categoria: campo "Comissão" vazio ao lado de preço com 15% já descontado | Baixo | mostrar o valor padrão aplicado, ou um aviso? | **Mostrar o valor aplicado** — vazio ao lado de um preço descontado é a única leitura errada possível |
| `[F03a-003]` `markupVarejo` / `markupAtacado` sem teto nem ordem imposta | Baixo | varejo ≥ atacado é regra do produto? | é **regra de negócio**, não aritmética — não invento |
| `[F11a-003]` a promessa "a calculadora é grátis" fecha a página em vez de liderar | Médio | subir a promessa? | **Sim**, mas é decisão de posicionamento |

`[F03a-002]` (`failurePct` sem teto) eu trato como **autônomo com premissa declarada**: acima de 100%
a aritmética deixa de ter sentido, então o teto é aritmética, não produto. Se você discordar, ele
desce para este balde.

---

# BALDE C — bloqueado em você

| achado | por quê |
| --- | --- |
| `[F05-001]` não existe exclusão de conta (**Alto**) | decisão jurídica/produto — **P-010**. É o único achado que pode virar bloqueante por lei, não por código |
| `[F07-001]` o gatilho protege `UPDATE` e não `DELETE` | é **pré-requisito** do anterior; sozinho não faz sentido |
| `[F06-001]` o selo de frescor começa a avisar em **2026-08-21** | **P-011** — disparar o laço, esticar a janela ou aceitar o aviso são três decisões diferentes |
| `[F11a-006]` o marketplace padrão é o único sem tabela de referência | consequência da fatia ML (US6) — precisa das 8 condições do parecer **e** de autorização sua |
| `[F10-002]` linha na Definição de Pronto ("todo teste novo foi visto FALHAR pelo motivo pretendido") | **P-015** — é mudança de processo |
| `[F02A-003]` FR-010, deploy público não existe | **é o próprio provisionamento** |
| `sha_pinning_required: true` | configuração do repositório |

---

# Ordem que eu proporia

1. **A6** (a asserção de não-quebra) — sem ela o A1 não tem como ser provado.
2. **A1** (dinheiro na tela) — 3 Altos bloqueantes, uma causa raiz.
3. **A2** (o `None` do MP) — o único **Bloqueante**, e o que custa dinheiro de verdade.
4. **A4** (SHA pinning) — tem de estar pronto **antes** de ligar o deploy, não depois.
5. **A3** (`expiresAt`).
6. **A7** (documentação) — barato, e cabe na R8.
7. **A5** (os quatro pequenos).

O A4 antes do provisionamento não é preferência: **provisionar é exatamente o ato de ligar a guarda
que hoje mantém a exposição baixa.**

---

# O que este plano NÃO faz, e eu digo em vez de deixar implícito

- **Não cobre a F13.** Desempenho ainda não foi medido. Se ela achar algo, este plano ganha lotes.
- **Não fecha as 15 pendências restantes** — só a P-013 caiu (medida hoje: o Sentry **captura**
  rejeição não tratada; `@sentry/core/.../integration.js:27-28` + `.../globalhandlers.js:12`).
- **Não homologa nada.** Cada lote entrega código; a homologação visual dos lotes A1 e do balde B
  é sua, com imagem, como todas as outras desta auditoria foram.

---

# ADENDO 2026-08-03 — as 5 medicoes do bloco A, e o que elas MUDARAM

Rodadas a pedido do dono. Todas leitura pura; nenhum arquivo do repositorio criado ou alterado
(o `dist/` foi reconstruido com sourcemap, e ele e gitignored). **Duas correcoes mudaram de forma.**

## M1 — P-009 RESOLVIDA: o Mercado Pago REENVIA

Documentacao oficial de webhooks, citada literalmente:

> *"e necessario retornar um status `HTTP STATUS 200 (OK)` ou `201 (CREATED)`"* — e, se essa
> confirmacao nao for enviada, *"realizara novas tentativas de envio a cada 15 minutos, ate receber
> uma resposta. Apos a terceira tentativa, o prazo sera prorrogado, mas os envios continuarao
> acontecendo."* Tempo de espera da resposta: **22 segundos**.

**O conserto do `[F04b-001]` e o SIMPLES**: quando nao der para perguntar ao MP, **nao escrever nada,
registrar log e devolver um codigo != 2xx**. O MP insiste sozinho a cada 15 minutos. Nao precisamos de
registro pendente nem de maquinaria propria de reconciliacao para o caminho principal.

**E o achado fica PIOR do que eu o descrevi**: hoje o codigo devolve **200** para um evento que jogou
fora. Ou seja, ele nao apenas perde o grant — ele **avisa ao MP que recebeu**, desarmando o unico
mecanismo que consertaria o problema sozinho. A rede de seguranca existia e o codigo a desliga.

## M2 — os 15,6ms por tecla NAO sao calculo nem validacao

| componente | custo | % do orcamento de 15,6ms |
| --- | --- | --- |
| `computeCalculator` (3 canais) | 0,113ms | 0,7% |
| `calculatorResolver` (Zod, form inteiro) | **0,007ms** | 0,04% |
| **render + commit do React** | **~15,5ms** | **~99,3%** |

O `useForm` usa `mode: "onChange"` + resolver Zod (`calcular-page.tsx:98`) — eu suspeitei que a
revalidacao a cada tecla fosse cara. **Medi: nao e.** 0,007ms.

E o custo **nao esta concentrado nos canais**: subir a arvore de 404 para 653 nos no DOM (+62%) sobe a
mediana de 15,0 para 20,6ms (+37%) — ha um **piso fixo de ~15ms ja com a arvore minima**, mais
~23us por no.

**Consequencia para o conserto**: nao adianta enxugar conteudo nem mudar o `mode`. O que precisa
mudar e o **escopo da assinatura** — `watch()` sem argumentos re-renderiza a pagina inteira a cada
tecla. Ruido medido: +-3ms entre execucoes a 4x, entao o alvo tem de ser folgado.

## M3 — dividir por rota compra 11,7%, nao mais

Lido do **sourcemap do bundle real do Vite** (903 KB):

| origem | % |
| --- | --- |
| `react-dom` | 19,4% (174 KB) |
| `@firebase/auth` | 9,4% (84 KB) |
| Sentry (core+browser) | 8,5% (76 KB) |
| `zod` | 7,5% (67 KB) |
| TanStack (router+query) | 11,5% (102 KB) |
| **codigo do produto** | **24,9%** |
| **dependencias** | **75,1%** |

**Codigo de rota que `/calcular` nao precisa: 105,4 KB = 11,7%.**

**Portanto o conserto que eu tinha proposto (dividir por rota) e o de menor retorno.** Os que movem
o numero de verdade sao: **(a)** uma casca estatica no `index.html` — ataca os 7 segundos de tela
BRANCA, que e o problema percebido; **(b)** adiar o Sentry (76 KB) para depois da primeira pintura;
**(c)** a divisao por rota, como bonus.

**Correcao de um numero meu**: primeiro medi com esbuild e obtive *"zod = 27,2%, sendo 193,9 KB de
locales de 53 idiomas"*. **Falso.** Conferi no bundle real: **zero** hebraico, tailandes, chines ou
russo — o Rollup removeu tudo. O numero era artefato do meu instrumento.

## M4 — baixar o viewport para 360 sozinho nao pega NADA

| medicao | 390px | 360px |
| --- | --- | --- |
| alvos < 44x44 (formulario vazio) | 0 | 0 |
| transbordo horizontal | 0 | 0 |
| preco quebrado | 0 | 0 |

Zeros identicos nos dois — porque **o formulario vazio nao tem preco para quebrar**. Com dado
adversario o quadro muda:

- **`[F11a-001]` reproduz e SO a 360**: `tariffPerKwh` fica com **33px uteis para 36px de conteudo**.
  Exatamente o que a F11a mediu.
- **`[F11a-002]` reproduz a 390 TAMBEM**, nao so a 360.

**Portanto a recomendacao da `[F12-001]` estava incompleta**: trocar 390 por 360 e barato mas
**inutil sozinho**. O que faltava nao era largura — era **largura + dado adversario**.

## M5 — o limiar do dinheiro

`.tf-price__int` medido por `Range.getClientRects()` (uma caixa por linha):

| valor | linhas @390 | linhas @360 |
| --- | --- | --- |
| ate R$ 7.376 | 1 | 1 |
| R$ 246.862,00 | **2** | **2** |

O limiar fica em **5 digitos (>= R$ 10 mil)**, coerente com o `18.130` que a F11a fotografou.
Alcance do `formatBRL`: **19 chamadores em 8 arquivos** (maior concentracao em
`features/bom/channel-rollup.tsx`, 5).

**Criterio de aceite do lote A1, agora medivel**: `.tf-price__int` renderiza em **exatamente 1 caixa
de linha** para valores ate R$ 999.999,99 a 360px, **e** o documento nao transborda. O par e o que
importa — cada assercao sozinha e satisfeita pelo defeito.

## A licao que eu levo destas 5 medicoes

**Tres dos meus proprios instrumentos produziram numero falso hoje**: o piso de dois
`requestAnimationFrame` (33,3ms identicos a 1x e 6x), a contagem de locales do esbuild (27% que nao
existem no bundle real), e o `getClientRects()` num elemento de BLOCO (que devolve 1 caixa mesmo com
o texto em duas linhas). **Os tres foram pegos por controle** — variar a variavel e exigir que o
numero mude, ou conferir contra a fonte real.

E o mesmo criterio que esta auditoria aplicou ao produto o tempo todo. Ele vale para quem mede.

---

# BALDE B — DECIDIDO PELO DONO em 2026-08-03

As seis perguntas foram respondidas. **O balde B deixa de existir**: tudo abaixo migra para o balde A
(autonomo) com a forma ja definida, e vira o **Lote A8**.

| achado | decisao do dono | severidade que fecha |
| --- | --- | --- |
| `[F11b-002]` | **"Atualizar forma de pagamento" vira primario (roxo preenchido)**, igual ao "Assinar Premium" dos outros estados. Selo de carencia continua com tom `info`; **badge continua VERDE** — o Premium esta ativo, degradar seria a mentira oposta. | **Alto, BLOQUEIA** |
| `[F11b-004]` | **Inverter**: "Voltar" vira o preenchido; "Cancelar assinatura" vira fantasma com texto vermelho. | Medio |
| `[F11a-003]` | **Subir a promessa "a calculadora e gratis" para a primeira dobra.** | Medio |
| `[F03a-003]` | Markup de atacado > varejo e **entrada VALIDA**; o motor calcula e a **UI avisa** (nao-bloqueante). Nada e recusado. | Baixo |
| `[F11a-007]` | O campo "Comissao" passa a **mostrar a aliquota aplicada**, marcada como valor de **referencia** (nao digitado). | Baixo |
| `[F03a-002]` | `failurePct` fica **SEM TETO** — comportamento intencional, achado fechado. | Baixo |

## O que essas decisoes implicam, e que eu registro antes de codificar

**`[F11b-002]` e o unico que muda estado ja homologado.** O PR-B foi homologado com o painel como
esta, e o dono ratificou tres chamadas naquele portao (a linha §4.3 da ux-billing, o "Recarregar", e
o tom `info` do selo). Esta decisao **nao revoga nenhuma das tres** — muda a variante de UM botao. O
badge verde e o tom `info` do selo **permanecem**, porque a razao original continua valendo: na
carencia o Premium ESTA ativo, e degradar o badge seria a mentira oposta.

**`[F11a-003]` e o unico que precisa de desenho, nao de patch.** Subir a promessa muda a primeira
dobra da superficie de aquisicao — e a primeira dobra hoje carrega "Salvar faz parte do Premium",
que e a outra metade da mensagem. Vou subir a promessa **sem remover** a mencao a Premium, e a
homologacao visual disso e sua, com imagem, a 360 e a 1440.

**`[F03a-003]` cria um aviso que nao existe hoje.** "Valido mas avisa" exige um caminho de aviso
nao-bloqueante no formulario — e ele precisa ser distinguivel de um ERRO de validacao, senao o
vendedor le "esta errado" onde a decisao foi "esta permitido". Vou usar o tom de aviso ja existente
no design system, nao inventar um.

**`[F11a-007]` toca o selo de referencia (US5).** Mostrar uma aliquota que o vendedor NAO digitou
exige que ela seja visivelmente de **referencia** — e o produto ja tem esse vocabulario, e o proprio
014 pagou caro para que "referencia" nao mentisse. Reuso o mesmo mecanismo; nao crio um segundo.

**`[F03a-002]` fecha sem codigo.** Registro no achado que a ausencia de teto e **intencional**: 300%
pode representar legitimamente uma peca que falha tres vezes antes de sair, e um teto arbitrario
recusaria um caso real. Isso vira uma linha no `pricing-core`, como comentario que impede o proximo
leitor de "consertar" o que foi decidido.

---

# BALDE C — DECIDIDO PELO DONO em 2026-08-03

Seis das sete travas cairam. **Sobram duas coisas na sua mao, e nenhuma e uma pergunta**:
ligar `sha_pinning_required` (config de repositorio) e o proprio provisionamento (`[F02A-003]`).

| achado | decisao | vira |
| --- | --- | --- |
| `[F05-001]` exclusao de conta | **CLI de operador + procedimento escrito**, antes de comecar a cobrar. Sem rota publica, sem UI. | **Lote A9** |
| `[F07-001]` gatilho | **Ampliar AGORA, antes de provisionar**: permitir anonimizar campos de identificacao mantendo o registro contabil, e passar a barrar `DELETE`. | **Lote A9** (mesma migracao) |
| `[F06-001]` selo de frescor | **Recurar a Shopee de verdade antes de 21/08.** Eu levanto a fonte e monto o diff; **`lastReviewed` so se move depois do OK do dono**. | **Lote A10** |
| `[F11a-006]` marketplace padrao | **Trocar o padrao para AMAZON.** Uma linha, reversivel. ML continua na lista com a mensagem honesta. | **Lote A11** |
| `[F10-002]` Definicao de Pronto | **Entra**: "todo teste novo foi visto FALHAR pelo motivo pretendido". | **Lote A7** (documentacao) |
| `sha_pinning_required` | continua com o dono — config de repositorio | — |
| `[F02A-003]` FR-010 | **e o proprio provisionamento** | — |

## O que registro antes de codificar

**O `[F07-001]` e o unico com prazo IRREVERSIVEL, e a decisao foi a certa.** Enquanto nao existe
snapshot em producao, ampliar o gatilho e uma migracao vazia. Depois do provisionamento, e uma
migracao sobre dado **imutavel de gente que pagou**. A janela fecha no dia do deploy.

**A migracao tem DUAS metades e as duas importam**: (a) permitir `UPDATE` nos campos de
identificacao para anonimizar — hoje o gatilho barra; (b) **passar a barrar `DELETE`** — hoje ele
nao barra, e essa e a metade que a `[F07-001]` chama de "o caminho legal disponivel e o menos
auditavel". Fazer so (a) deixaria o buraco aberto.

**O `[F05-001]` NAO fecha com codigo sozinho.** A escolha foi "CLI + procedimento escrito", e o
procedimento e metade da entrega: o que se anonimiza, o que se retem por obrigacao fiscal, em quanto
tempo se atende. Vou escrever o procedimento junto com o CLI, nao depois — e ele fica em
`docs/`, no alcance da R8.

**O `[F06-001]` tem uma armadilha que a propria decisao evita.** Mover `lastReviewed` sem conferir a
fonte seria **exatamente** a classe de mentira que esta auditoria passou 16 fases medindo — um selo
que afirma frescor que ninguem verificou. A decisao ("eu levanto, o dono ratifica") mantem o
significado da data: **um humano conferiu**. Vou tratar a ratificacao como pre-requisito do commit,
nao como revisao posterior.

**O `[F11a-006]` e mitigacao, nao conserto.** Trocar o padrao para Amazon melhora a primeira
impressao e **nao da ao ML uma tabela** — o vendedor que escolher ML continua vendo "sem referencia".
O conserto de verdade e a fatia US6, que segue precisando das 8 condicoes do parecer **e** de uma
autorizacao sua separada. Registro isso para que a troca de padrao nao seja lida depois como
"o problema do ML foi resolvido".

**O `[F10-002]` entra na Definicao de Pronto na forma simples** (ver o vermelho), nao na forma dupla
(vermelho + mutacao). A mutacao continua sendo o que se usa nos guardas criticos — mas como pratica
escolhida caso a caso, nao como imposicao em todo teste novo.
