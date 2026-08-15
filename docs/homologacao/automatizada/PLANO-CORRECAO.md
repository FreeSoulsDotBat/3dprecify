# Plano de correção — homologação automatizada (35 achados) em um PR único

**Data:** 2026-08-13 · **Origem:** `docs/homologacao/automatizada/RELATORIO.md` (773 verificações,
35 defeitos: 11 altos · 18 médios · 6 baixos) · **Alvo:** o PR **#58** já aberto
(`018-abas-desktop` → `develop`), reaproveitado por decisão do dono.

Estrutura de cada ponto, conforme a regra do dono (`homologação/Instruções.txt`): **o que corrigir ·
complexidade · está de acordo com as decisões já tomadas?**

---

## 0. Duas ressalvas antes de começar

**(a) Um PR único mistura uma decisão de produto com correções mecânicas.** Nove dos onze achados
ALTA dependem de UMA decisão sua (§1: quando avisar, com que texto). Os outros 26 são mecânicos e
independentes. Se a decisão do §1 demorar, ela segura 26 correções prontas. Recomendo commits
isolados por bloco dentro do PR, na ordem abaixo, para que qualquer bloco possa ser retirado sem
desfazer os outros. A escolha de juntar tudo é sua e o plano está escrito para funcionar assim.

**(b) Onde pousa: no PR #58, que já existe.** Decisão sua. Duas consequências que precisam ficar
escritas, porque este repositório já foi mordido três vezes por registro que não acompanhou a
realidade (as três estão anotadas no `CLAUDE.md`):

1. **O escopo do #58 muda, e o título/corpo precisam mudar junto.** Ele entrou como "018 — Abas
   desktop"; passa a ser "018 + as correções da homologação automatizada". Um PR cujo título mente
   sobre o que ele carrega é exatamente a classe de defeito de registro que custou o replanejamento
   de 2026-08-01.
2. **A sua segunda passada no #58 fica maior.** Um único portão de homologação passa a cobrir o
   redesenho desktop **e** os 35 pontos. Não é impedimento — é o custo de juntar, e é bom saber
   antes de caminhar.

**O que o reaproveitamento GANHA, e é real:** o 018 já mexe em
`catalog-master-detail.css`, `filaments-panel.tsx`, `products-panel.tsx`, `bom-page.css`,
`conta-page.css`, `historico-page.css` e `app-shell.css` — exatamente as telas dos blocos §3 e §4.
Fazer as correções de layout e acessibilidade **no mesmo ramo elimina o conflito de CSS** que um ramo
paralelo teria garantido. Este era o motivo pelo qual eu recomendaria esperar; reusar o #58 o
dissolve.

**O que ele NÃO ganha:** os blocos **A** (plausibilidade), **B** (`1,000`), **F** (quantidade) e
**E2–E4** tocam `features/calculator/*`, `shared/lib/decimal-ptbr.ts` e
`features/scenarios/save-scenario-sheet.tsx` — **nenhum deles é arquivo do 018**. Eles não ganham
nada por estar no #58 e, como dependem das suas respostas (§1 e §5), seguram um PR que hoje está
pronto. Recomendação, e é só recomendação: **empurre C + D + E1 para o #58 agora** (11 achados, zero
decisão pendente, e são as telas que o 018 redesenhou) e deixe A/B/F/E2–E4 para um PR seguinte. Se
você quiser tudo no #58 mesmo, o plano abaixo funciona sem alteração — só começa a andar depois das
suas respostas.

**Nada aqui muda fórmula.** `PRICING_MODEL_VERSION` **não** é bumpado: nenhum dos 35 achados é erro
de cálculo (a fórmula da peça, o gross-up por canal, a soma do kit e a geometria do PDF passaram).
O que muda é o que o produto **diz** e como ele **desenha**.

---

## 1. BLOCO A — O aviso de plausibilidade (9 ALTA + 3 correlatos)

**O problema, em uma frase:** o vendedor digita um número plausível que significa outra coisa
(120 W num campo que pede kW; vida útil em anos num campo que pede horas; 150 no campo de horas
querendo dizer 150 minutos), e o produto devolve um preço com cara de preço, calado.

### A correção proposta
Um módulo PURO novo — `apps/web/src/features/calculator/plausibilidade.ts` — que recebe a entrada
já validada e o resultado, e devolve `0..N` avisos `{campo, texto, tom: "info"}`. Ele **não recusa
nada** e **não altera nenhum número**: só produz frases. A tela renderiza os avisos como faixa
`info` ao lado do campo suspeito.

Duas famílias de regra, e as duas são de faixa, não de teto:

1. **Faixa por campo** — o número está fora do que existe no mundo para aquele campo:
   `avgPowerKw > 5` (nenhuma impressora doméstica puxa 5 kW) · `tariffPerKwh > 5` ·
   `machineLifetimeHours < 100` · `rollWeightKg > 50` · `laborRatePerHour > 500` ·
   `maintenanceReservePerHour > 50` · `printTimeHours > 100`.
2. **Resultado implausível** — custo total `== 0` com gramas ou tempo informados, ou preço de venda
   `== 0`, ou custo total acima de um teto de sanidade.

**Por que faixa por CAMPO e não só "o preço mudou muito":** a segunda sozinha não sabe DIZER o que
houve. A primeira permite a frase útil — *"5 kW é o consumo de um chuveiro. A etiqueta da impressora
costuma dizer W: 120 W = 0,12 kW."* — que é o que resolve o problema do leigo.

### Decisões que preciso de você (bloqueiam só este bloco)
1. **Os limiares acima** — proponho os números listados; qualquer um pode mudar.
2. **O texto.** Proponho a forma *"Confira: {motivo}. Nada foi recusado."* — descritiva, nunca
   corretiva, seguindo o precedente que você já fixou em `avisoAtacadoAcimaDoVarejo`.
3. **Onde aparece** — proponho junto ao campo (como o `hint` de hoje), não um modal.
4. **A comissão 0,12%** (CF-010): mesmo mecanismo, no slot do canal.

### Complexidade
**Média.** O módulo é puro e pequeno (~120 linhas + tabela de limiares). A renderização reusa
`Field`/`Alert` que já existem. O custo real é a redação das frases e a sua revisão delas.

### Está de acordo com as decisões já tomadas?
**Sim, e com uma cautela que precisa ficar escrita.** O `failurePct` **não tem teto de propósito**
(decisão sua, 2026-08-03, registrada no próprio `PriceInput`: *"300% representa legitimamente uma
peça que falha três vezes antes de sair"*). Este bloco **não recusa nada** — por isso não conflita.
Mas ele encosta na mesma fronteira, então a implementação carrega a regra explícita: **aviso nunca
vira validação**; um campo com aviso continua calculando e continua salvando. Se em algum momento
alguém transformar um destes avisos em erro, terá revogado aquela decisão sem perceber.

---

## 2. BLOCO B — `1,000` lido como 1 (1 ALTA)

**O problema:** o vendedor copia um preço de um site em inglês (`1,000` = mil) e o produto lê 1. É o
único achado da lista em que o erro é do PRODUTO, não do usuário: ele digitou mil.

### A correção proposta
Ampliar a gramática em `apps/web/src/shared/lib/decimal-ptbr.ts` para reconhecer o milhar en-US
(`1,000` / `1,234,567`) quando a forma for **inequívoca** — grupos de exatamente 3 dígitos após a
primeira vírgula e nenhum ponto presente. `1,5` continua sendo um e meio (pt-BR); `1,000` passa a
ser mil. Onde a forma for ambígua, **avisar em vez de adivinhar** (reusa o Bloco A).

**Fato verificado, e é o que torna isto seguro:** `ptBrToWireDecimal` é o espelho de gravação e é
ele que escreve no documento (`features/calculator/product-mapping.ts`). Os payloads salvos carregam
decimal canônico (`"1000.00"`), **não** a digitação crua. Logo, mudar a gramática **não repreça
nenhum cenário nem snapshot já gravado** — afeta apenas digitação nova.

### Complexidade
**Média-alta**, e a razão não é a regra: é que `parseDecimal` e `ptBrToWireDecimal` **compartilham
`acceptedCore`** e precisam mudar juntos. Uma gramática que diverge entre ler e gravar é a classe de
defeito que este repositório já nomeia ("dois lugares que precisam concordar viram um que fica para
trás"). A guarda: um teste de propriedade `parseDecimal(x) === Number(ptBrToWireDecimal(x))` sobre
todo o corpus de formatos.

### Está de acordo com as decisões já tomadas?
**Sim, e conserta uma regressão de significado.** O comentário do `013/FA-05` já estabelece que a
tira de afixos é ancorada justamente para não concatenar lixo. Aceitar milhar en-US é a mesma
disciplina: ler o que o vendedor quis dizer quando a forma é inequívoca, e recusar/avisar quando não
é. **Se você preferir NÃO adivinhar**, a alternativa é só avisar ("li isto como um, não como mil") —
resolve o achado sem tocar na gramática. Sua escolha.

---

## 3. BLOCO C — Layout: texto longo e a faixa de 426px (4 médios)

| Achado | Correção | Arquivo |
|---|---|---|
| Nome de sub-custo com 300 caracteres → **2.100px** de rolagem | `overflow-wrap: anywhere` no rótulo da linha | `shared/ui/breakdown-row.css` (`.tf-brow__label`) |
| Nome de filamento com 500 caracteres → **4.948px** no catálogo | idem no título do cartão | CSS do painel de catálogo |
| Teaser premium estoura **131px** a 426px | largura mínima do teaser cede na faixa 426–600px | `shared/billing/premium-teaser.css` |

### Complexidade
**Baixa.** Três regras de CSS. O que dá trabalho não é o conserto — é a **guarda**, e ela é
obrigatória: o culpado dos 2.100px é um **nó de texto** que pinta fora da caixa sem alargá-la, e
nenhum `getBoundingClientRect()` de elemento o vê. A guarda precisa medir `Range` de nós de texto
(já implementado em `culpadosDoOverflow`, no harness desta homologação) e varrer as larguras 390 ·
**426** · 1024 · 1279 · 1440 — o 426 entra na lista porque é o primeiro pixel do layout desktop e é
exatamente onde quebrou.

### Está de acordo com as decisões já tomadas?
**Sim.** A regra "nenhuma rolagem horizontal em nenhuma largura suportada" já é invariante do
projeto (016/US3, `a11y-overflow.spec.ts`), e a lição do 016/PR-B — medir os **dois eixos**, porque
headless não desenha barra clássica — já está no repositório. Isto é a mesma regra, aplicada a um
caso que ela ainda não cobria.

---

## 4. BLOCO D — Acessibilidade (7 achados: 3 médios + 4 baixos)

| Achado | Correção |
|---|---|
| **Foco invisível no item de navegação ATIVO** | `.tf-nav__item:focus-visible` usa `background: var(--accent-soft)`, o **mesmo** realce de `[aria-current="page"]`. O item ativo não muda nada ao receber foco. Trocar por um indicador que não colida (contorno interno ou barra lateral). |
| Contraste < 4,5:1 em 3 telas (Conta premium, oferta a 390px e a 1440px) | Ajustar o token de cor do texto envolvido |
| Link "Como tratamos seus dados" 181×20 na tela de entrada | Altura de alvo ≥ 24px (WCAG 2.2 AA 2.5.8) |
| Gatilhos ⓘ com 28×28 (4 ocorrências) | Área de toque de 44px sem mudar o desenho (pseudo-elemento) — `shared/ui/info-tip.css` |

### Complexidade
**Baixa**, exceto o foco, que é **baixa-média**: é uma linha de CSS, mas exige escolher um indicador
que não repinte a "caixa roxa" que o comentário do `app-nav.css` diz ter sido removida de propósito.
Ou seja: há uma decisão de desenho ali, não só um valor.

### Está de acordo com as decisões já tomadas?
**Sim, e o achado do foco é a colisão de duas decisões boas.** O `app-nav.css` documenta que a
navegação NÃO usa o contorno global (para não repintar a caixa roxa reclamada) e que o ativo se lê
por cor + fundo suave. As duas decisões estão certas isoladamente; juntas, anulam o foco no item
ativo. A correção precisa preservar as duas intenções — por isso é decisão de desenho, e se você não
gostar da minha proposta, é caso de Claude Design.

**Nota honesta sobre os 28×28:** eles **passam** na WCAG 2.2 AA (mínimo 24px). Ficam abaixo do
conforto de 44px (AAA/HIG). Está na lista como **baixa** justamente por isso — não é violação.

---

## 5. BLOCO E — Feedback que não existe (4 médios)

| Achado | Correção proposta | Decisão sua? |
|---|---|---|
| **Salvar simulação com nome vazio não faz NADA** — botão habilitado, clique acontece, nenhuma mensagem | Disparar a validação no submit e mostrar `s.nameRequired`, que **já existe escrita** | Não — é conserto puro |
| Recarregar a página apaga tudo que foi digitado, sem aviso | (a) persistir rascunho local, ou (b) avisar antes de perder | **Sim**: (a) ou (b) |
| A 390px o custo total só aparece após **3,9 telas** de rolagem | Resumo fixo (barra inferior) com o preço | **Sim**: vale a barra fixa? |
| `2:30` e `2h30` no campo de horas: nem aceitos nem explicados | (a) aceitar os dois formatos, ou (b) dizer "use horas e minutos separados" | **Sim**: (a) ou (b) |

### Complexidade
Primeiro item: **baixa** (uma linha no `save-scenario-sheet.tsx`). Rascunho persistido: **média**
(chave por uid, expiração, e a pergunta de o que fazer quando o vendedor volta). Barra fixa:
**média** e mexe no desenho — território do 018. Formato de tempo: **baixa** se for (b), **média**
se for (a).

### Está de acordo com as decisões já tomadas?
- Nome vazio: **sim, sem ressalva** — a mensagem já foi escrita e aprovada; ela simplesmente não
  está sendo mostrada.
- Rascunho e barra fixa: **decisão nova**, sem precedente no repositório. Não são conserto de bug —
  são produto.
- Tempo: o `016/US7` decidiu h+min separados justamente para tirar o decimal do caminho do leigo.
  Aceitar `2:30` **não contradiz** isso (continua sendo h+min); só amplia a entrada.

---

## 6. BLOCO F — Quantidade do kit (1 ALTA + 1 médio)

Quantidades `2147483648` e `999999999999999` são aceitas **enquanto se digita** sem qualquer aviso.
Ao **salvar**, o produto se comporta bem (não finge sucesso e não vaza linguagem técnica) — medido.

**Correção:** o mesmo mecanismo do Bloco A, aplicado ao campo de quantidade, com o teto real da
coluna (`CEIL_QUANTITY = 2 147 483 647`, já constante em `backend/app/validation.py`) como limiar.

**Complexidade:** baixa, uma vez que o Bloco A exista. **De acordo com as decisões:** sim — o teto
não é arbitrário, é o `int4` da coluna, e o backend já o trata.

---

## 7. Ordem de execução dentro do PR #58

Cada item é um commit isolado **em cima dos dois commits que o #58 já tem** (`e8e5f6e` + `93eaa53`),
e a ordem é por **independência**, não por severidade — para que qualquer bloco possa cair sem
desfazer os outros:

1. **C** (layout) + **D** (a11y) — mecânicos, sem decisão pendente, sem risco de regressão de número
2. **E1** (nome vazio da simulação) — conserto puro
3. **B** (gramática `1,000`) + seu teste de propriedade espelho
4. **A** (plausibilidade) + **F** (quantidade) — dependem das suas respostas do §1
5. **E2/E3/E4** (rascunho, barra fixa, formato de tempo) — dependem das suas respostas do §5

## 8. Guardas obrigatórias (sem elas, o conserto não fica consertado)

Cada uma existe porque um defeito desta homologação passou por baixo da asserção óbvia:

| Guarda | Por que exatamente |
|---|---|
| Overflow medindo **nós de texto por `Range`**, nos dois eixos, em 390/426/1024/1279/1440 | O culpado dos 2.100px não tem caixa; `getBoundingClientRect` de elementos não o vê |
| Foco medido **comparando o elemento focado com ele mesmo sem foco** | Um indicador idêntico ao estado "ativo" passa em qualquer teste que só verifique se a regra CSS existe |
| Contraste com **composição de alpha** | Um realce translúcido lido como opaco inventa a razão |
| Plausibilidade: teste unitário por limiar + um e2e que digita 120 em "Consumo médio" | Sem o e2e, a frase pode existir no bundle e nunca ser renderizada — a classe do defeito do 012/PR-B |
| Espelho `parseDecimal` ↔ `ptBrToWireDecimal` sobre o corpus inteiro | As duas dividem `acceptedCore`; divergir é gravar diferente do que se lê |
| Mutação em cada guarda nova | Uma guarda que passa com o defeito reintroduzido não é guarda |

## 9. Definition of Done do PR

- `pnpm gate:all` verde (mesmo comando literal do pre-push e da CI)
- `pnpm e2e` verde — **incluindo a suíte existente**, que é o que prova que nada regrediu
- A suíte desta homologação (`playwright.homolog.config.ts`) rodada de novo: os achados corrigidos
  **desaparecem**, e os 773 pontos de verificação continuam passando
- **Sem** regeneração de contrato/OpenAPI: nenhuma rota de backend muda neste PR
- `PRICING_MODEL_VERSION` **inalterado**, e isso dito no corpo do PR (não é esquecimento — é que
  nenhuma fórmula mudou)
- Nada fechado sem a **sua segunda passada** (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`): um
  "corrigido" meu é CORREÇÃO DECLARADA, não homologação
- **Específico do reaproveitamento do #58:**
  - título e corpo do PR atualizados para declarar o escopo novo (`gh pr edit 58`)
  - `specs/018-abas-desktop/dod-evidence.md` ganha a seção das correções — o incremento passa a
    carregá-las, e a evidência é onde isso fica registrado
  - `specs/018-abas-desktop/tasks.md` ganha as tarefas novas, para o registro não ficar menor que o
    que foi feito
  - a suíte do 018 (`pages-desktop-width.spec.ts`, `catalog-master-detail.test.tsx`,
    `conta-desktop.test.tsx`) roda junto: os blocos C e D mexem nas MESMAS telas que ela guarda

## 10. O que este PR NÃO faz

- Não mexe em fórmula, contrato, schema ou migração
- Não toca no `failurePct` sem teto, nem em nenhuma outra decisão sua registrada
- Não resolve a injeção de fórmula no CSV — é **risco conscientemente aceito** no E4/PR-C, com
  gatilhos de reabertura; se você quiser reabrir, é outra conversa e outro PR
- Não cobre o que ainda não foi homologado: bandas `PROGRESSIVE`, rollup de canais do kit, produtos
  com referência viva, cenário sobre base apagada, recalcular-hoje e throttling 3G

---

## Resumo para decisão

| Bloco | Achados | Complexidade | Precisa de decisão sua? |
|---|---|---|---|
| A — plausibilidade | 12 | Média | **Sim** — limiares, texto, onde aparece |
| B — `1,000` | 1 | Média-alta | **Sim** — interpretar ou só avisar |
| C — layout | 4 | Baixa | Não |
| D — acessibilidade | 7 | Baixa (foco: média) | Só o desenho do foco |
| E — feedback | 4 | Baixa a média | **Sim** — 3 dos 4 |
| F — quantidade | 2 | Baixa | Não (herda A) |

**Caminho mais curto para valor:** aprovar **C + D + E1** hoje (11 achados, zero decisão pendente,
zero risco de número) e decidir A/B/E com calma. Se preferir mesmo tudo junto num PR, o plano
funciona — só começa a andar depois das suas respostas do §1.
