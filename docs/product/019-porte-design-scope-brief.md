# 019 — Scope brief: o porte do design (157 superfícies) + as features que o dono decidiu incluir

**Status**: rascunho de escopo de produto (entrada do `/speckit-specify`) · **Autor**: product-owner · **Data**: 2026-08-26
**Branch prevista**: `019-porte-design` (cortada de `develop`, com o 018 já mergeado — PR #58, `6a1a55a`)
**Origem**: `docs/design/handoff-019/README.md` + `docs/design/handoff-019/tf-components.css` (cópia
versionada de 2026-08-26 do projeto Claude Design `a90ed7d4-04ac-486b-b859-51e15c434aae` — 33 pranchetas
× 2 temas, 157/157 superfícies desenhadas), com as decisões do dono de 2026-08-25/26.
**Antecedente**: a auditoria de 2026-08-20 confirmou 157 superfícies **construídas sem protótipo**; o dono
desenhou todas elas **contra o código**. Este incremento aplica os deltas que o desenho encontrou.

> **Este brief especifica COMPORTAMENTO, não arquitetura nem pixels.** A forma do schema do recálculo, o
> modelo de dados do construtor de orçamento, o mecanismo de detecção de mudança de preço e a composição
> desktop de Simulações são chamada do `arquiteto` / `designer-ux` / Claude Design na rodada seguinte
> (Princípio VIII).
> **Nenhuma decisão do dono é reaberta aqui.** Elas entram como restrições dadas (§2). Onde eu discordo,
> está na §8 "Ressalvas do PO" — sem alterar o escopo.
> **Nenhuma copy é inventada neste documento.** Toda frase visível ao usuário é **verbatim da prancheta**
> e vem transcrita da fonte na implementação; onde este brief cita um texto, ele está entre aspas e é
> citação, não redação minha. Onde eu não tenho o texto, digo "verbatim na prancheta X" e paro.
> **Toda medida citada foi medida.** As que eu medi carregam arquivo e linha; as que vêm do handoff
> carregam a atribuição ao handoff.

---

## 1. Visão

O produto foi construído por 18 incrementos com o desenho vindo depois — quando vinha. A auditoria de
2026-08-20 mediu o tamanho disso: **157 superfícies sem protótipo**. O dono fechou a lacuna do outro lado:
desenhou as 157 no Claude Design, **a partir do código**, tema claro e escuro. O resultado não é "implemente
estas telas" — nas palavras do próprio handoff, *"a maior parte já existe no produto e está correta — a
prancheta serve de espelho"*. O que o espelho devolveu foi uma lista curta de **deltas reais**: oito
primitivos que o produto não tem e o desenho precisou inventar, um tom de mensagem que falta (ATENÇÃO), um
punhado de correções mecânicas de texto, e **três coisas que não são porte**: o Premium deixa de bloquear
antes da lista e passa a bloquear só no salvar; o Catálogo passa a dizer o que mudou de preço desde a
última visita; e nasce o construtor "Montar e Enviar", a única prancheta que não recria código existente.

**Por que agora**: o 018 fechou o desktop das quatro abas e o 016 fechou a homologação humana da parte
grátis — o produto está estável o bastante para receber uma camada de baixo (os primitivos) sem que ela
brigue com uma reforma em voo. E o inverso: cada tela nova construída antes do porte nasce devendo os oito
primitivos. **Por que este é o momento mais barato**: não há usuário pagante nem dado em produção (deploy
adiado até v1) — o Catálogo ainda pode ganhar coluna de preço sem migração com cliente em cima.

---

## 2. Restrições dadas (decisões do dono — NÃO reabrir)

| # | decisão | data | consequência que o escopo carrega |
| --- | --- | --- | --- |
| D1 | **Escopo: TUDO** — porte fiel + recálculo do Catálogo + "Montar e Enviar" + Simulações desktop | 2026-08-25 | seis fatias, 20 stories; **duas features novas** dentro de um incremento cujo nome diz "porte" (§8 Ressalva 5) |
| D2 | **"canal" → "marketplace"** no texto visível **nesta leva** | 2026-08-25 | varre `messages.pt-br.ts` e o texto embutido; **símbolos, chaves, rotas e arquivos ficam intactos** |
| D3 | **Selo de procedência: a dispensa vale ATÉ A FONTE MUDAR** | 2026-08-26 | reaparece quando citação/data mudam — não é "dispensar para sempre" nem "por sessão" |
| D4 | **Copy dos 6 vazios didáticos (lote 32c) aprovada como está** | 2026-08-25 | a do Filamento é do dono **verbatim**; as outras 5 aprovadas — transcrever, não reescrever |
| D5 | **Homologação do 019 ESPERA a Rodada 1 fechar** | 2026-08-26 | implementação corre; toda entrega fica em **CORREÇÃO DECLARADA** até o dono abrir a segunda passada |
| D6 | **`Orcamentos - Montar e Enviar` ENTRA** (era proposta marcada no índice) | 2026-08-25 | vira a maior fatia do incremento e a única que **inventa produto** em vez de espelhar |
| D7 | **Premium sem parede** (lote 32): bloqueia **só no salvar** | 2026-08-25 | mudança de padrão em ~5 telas; **o servidor continua recusando toda escrita** (Constituição IV intacta) |

**As cercas do dono (§7 do handoff) entram como restrição, não como escolha**: Mercado Livre / canal
inteiro (a US15 do 016), pipeline de ingestão mensal (= 017), frete real (lacuna E3), perfil do vendedor
(lacuna E1) e homologação da parte premium ficam **fora** — detalhe na §6.

---

## 3. P0 — Verificação inicial (medição, NÃO conserto)

### V0. Medir quanto do "delta" é delta de verdade

O handoff diz, com todas as letras, que **a maior parte já está correta**. Um porte que não mede antes de
mexer gasta o orçamento do incremento reescrevendo o que já estava certo — e pior, **regride**: o projeto
já pagou por isso no 016/Polish (a correção da logo deixou os PNGs fora do precache).

**Eu já medi três itens da lista, e dois deles mudam o escopo** (2026-08-26, confiança 95%, por leitura direta):

| item do handoff | o que eu medi | consequência |
| --- | --- | --- |
| "wordmark = `logo-inteira-{white,black}.png`; `tf-lockup-color*.svg` banido" | `apps/web/src/shared/ui/logo.tsx:31` **já** resolve o PNG por tema; `tf-lockup` tem **zero** referência no código (só um comentário em `top-bar.test.tsx:52`) | delta ≈ **zero** no produto. A regra vale como **guarda contra regressão** ao portar a folha da prancheta, não como tarefa |
| "`tf-alert--compact` é primitivo NOVO" | **já existe**, local, em `apps/web/src/features/calculator/shopee-warnings.css:5,9,12`, usado em `shopee-warnings.tsx:45` | não é "criar": é **promover ao DS e apagar a local**. Criar uma segunda regra com o mesmo nome é divergência silenciosa |
| "acentos em `avisoAtacadoAcimaDoVarejo`" | `messages.pt-br.ts:179` confirmado (`"O preco…"`, `"so confira se e isso mesmo"`); varri o arquivo inteiro e é a **única string visível** com perda de acento (os comentários vizinhos também perderam, e comentário não é produto) | correção de **uma linha**, não de um arquivo |

**Aceitação da V0**: antes de abrir a PR-A, cada um dos **8 primitivos + 8 desfazimentos + itens de marca**
do §1/§3 do handoff é classificado em três baldes, com evidência (arquivo:linha ou screenshot):
**(a) já correto no produto** — vira guarda, não tarefa · **(b) existe local e precisa subir ao DS** ·
**(c) não existe**. A tabela resultante entra no `dod-evidence.md` e **é ela que dimensiona a PR-A**, não a
contagem de linhas do handoff.

> Consertar o que não está quebrado custa tanto quanto não consertar o que está. **Nenhuma tarefa de porte
> é planejada antes da classificação.**

### V0-b. Medir a varredura de vocabulário antes de prometê-la

O handoff diz **"374 ocorrências de texto visível trocadas"** — e diz corretamente que esse número é **das
pranchetas**, não do produto. Medido no repositório (2026-08-26, confiança 95%): `canal|canais|Canal|Canais`
aparece **153 vezes em 29 arquivos** sob `apps/`, das quais **31 em `messages.pt-br.ts`**, 8 em
`calculator-form.tsx` e **48 num único arquivo de teste cujo NOME carrega a palavra**
(`apps/web/tests/homologacao/cf-010-canais.spec.ts`). A varredura do produto é **menor** que 374 e **mais
perigosa** do que parece: boa parte das ocorrências está em teste que **asserta string**. Ver R3.

---

## 4. User stories

Priorização: **P1** = a camada de baixo e a mudança de padrão que o dono pediu · **P2** = o que o vendedor
usa todo dia (calculadora e catálogo) · **P3** = o produto novo e a tela larga que faltou. Cada story é
independente e testável.

### Grupo A — Fundação do design system (P1 · PR-A)

#### US1 — Os oito primitivos que faltam entram no DS, com a procedência de cada um (P1)
*Como qualquer tela do produto, quero ter uma camada de baixo que resolva lista densa, tabela, bandeja
dividida, botão de largura declarada e congelamento — para não inventar cada um de novo.*

Primitivos (do §1 do handoff): `tf-aviso` · `tf-plist` · `tf-table` · `tf-segmented--split` ·
`tf-btn--full`/`--half` · `tf-frozen` · `tf-alert--compact` + `tf-alert__action` · `tf-alert__close`.

**Aceitação**
1. Cada primitivo entra classificado pela V0 — o que já existe local **sobe** ao DS e a cópia local é
   **apagada** na mesma fatia (caso medido: `tf-alert--compact`); nenhum nome de classe passa a existir
   em dois lugares.
2. Cada primitivo nasce com a **medida que o justificou** registrada, não com justificativa de gosto:
   `tf-plist` porque a 390px é a diferença entre **4 e 9 itens**; `tf-table` porque comparar 12 produtos é
   leitura de coluna; `tf-frozen` porque `opacity` no contêiner arrastava a dica a **2,58:1** (reprova AA)
   e a regra correta mede **5,67:1** na dica e **18,23:1** no rótulo.
3. `tf-frozen` carrega `background: var(--bg-muted)` como parte **obrigatória** da regra (no tema claro é
   `#ededf1` sobre `#ffffff`) — sem ele o congelamento não se lê.
4. `tf-alert__close` entrega alvo de **44px por pseudo-elemento**, não por caixa: a caixa de 44px ditava a
   altura do alerta, e o selo é denso (12px, ação de 18px) por construção.
5. **`tf-phone-scroll` e `tf-price--rola` NÃO são portados** — são dispositivos de prancheta. Um teste ou
   um lint impede que voltem.
6. As **oito adaptações de prancheta** do §3 do handoff são **desfeitas** no porte (nome do token, `fixed`
   → `absolute`, URL de ícone → cópia local, componente React → classe, `text-decoration`, unidade do
   `clamp`, `flex` do `__amount`), e as **duas que não são adaptação** (015/A6 e 016/T018-A1 `line-height:
   1.2`) **não** são revertidas — reverter reintroduz bug já pago.
7. O DS continua sendo o `tf-*` cabeado em Radix (ADR-0007); nenhum primitivo entra como utilitário solto.

#### US2 — O produto ganha o tom de ATENÇÃO que nunca teve (P1)
*Como vendedor, quero distinguir "isto está errado" de "isto está válido e provavelmente não é o que você
quis" — porque 850 g numa peça só é as duas coisas ao mesmo tempo.*

**Aceitação**: entra o token `--warning-text` (valor = `--tf-warning-deep`, **que já existe** — não é cor
nova) e o tom `tf-alert--warning`, virando a **quinta** categoria ao lado de neutro/info/confirmado/erro;
onde a cor precisa ser **lida**, usa-se o par escuro (`*-text`) — ciano e laranja reprovam como texto sobre
branco (handoff, prancheta 23f); o novo tom é **descritivo, nunca corretivo** (o precedente da casa é
`avisoAtacadoAcimaDoVarejo`: quem lê um aviso escrito como erro conclui que o produto recusou, e o produto
não recusou); nenhum aviso existente muda de tom sem estar listado.

#### US3 — Marca, foco e grafismos ficam como o desenho (P1)
**Aceitação**: o wordmark é a arte real (`logo-inteira-{white,black}.png`, Peace Sans) e o
`tf-lockup-color*.svg` — que reconstrói o wordmark em fonte substituta — **não pode voltar** (medido: já
está fora, US3 é a guarda); o símbolo SVG fica só na top-bar; o rótulo da TabBar vai de **12→10px** com 7px
de respiro; o anel de foco é de **2px** e o anel do menu usa `--accent`; os grafismos **saem** das telas de
404 e de erro. Nenhuma regressão de foco visível, de leitura por leitor de tela ou de navegação por teclado
— e a asserção de foco é **geométrica** (o 018 já pagou por um medidor de foco que errava enquanto o anel
funcionava, commit `639e427`).

#### US4 — As correções de texto que não têm decisão dentro (P1)
**Aceitação**: `messages.pt-br.ts:179` recupera os acentos (única string visível afetada — medido);
`paybackYearsLabel` deixa de imprimir **"1 anos"** (hoje é `"{n} anos"` literal em `messages.pt-br.ts:486`)
e passa a concordar em número; nenhuma outra frase muda de sentido nesta story.

#### US5 — "canal" vira "marketplace" no que o usuário lê (P1)
*Decisão dada (D2).*

**Aceitação**
1. Todo **texto visível** troca: rótulos, títulos, avisos, vazios, toasts, tooltips, teasers **e os
   artefatos exportados** (PDF/CSV) — sem sobrar ocorrência do par antigo numa superfície que o usuário lê.
2. **Nada de símbolo troca**: `channel*`, chaves de API, payloads persistidos, rotas, nomes de arquivo e
   nomes de teste ficam. Um orçamento congelado com `"canal"` no payload continua abrindo idêntico.
3. A troca entra **pelas chaves de i18n** (D2 não autoriza hard-code novo).
4. O escopo real é **medido antes** (V0-b), não estimado a partir das 374 ocorrências da prancheta.
5. Os testes que assertam a string antiga são atualizados **na mesma fatia** e a atualização é revisada
   como mudança de asserção, não como ruído de busca-e-troca (R3).

### Grupo B — Premium sem parede (P1 · PR-B) — MUDANÇA DE COMPORTAMENTO

> *Decisão dada (D7), com a razão do dono registrada:* **"melhor que escrever um texto do que a pessoa
> poderia fazer é mostrar o que ela poderia fazer"**.

#### US6 — A parede antes da lista dá lugar a um vazio que ensina (P1)
**Aceitação**
1. **Sai**: a parede antes da lista, o botão de criar desabilitado, e o aviso de reativação exibido a quem
   **nunca** teve Premium (é mentira para esse usuário).
2. **Entra**: o vazio didático com as **6 frases aprovadas (D4)** — transcritas **verbatim** da prancheta
   (a do Filamento é do dono, palavra por palavra); nenhuma é reescrita, resumida ou "melhorada".
3. Em **Orçamentos e Simulações**, o botão do vazio leva à **calculadora** ("Fazer um cálculo") — não a uma
   tela de compra: o cálculo é o que o grátis pode fazer, e é o caminho honesto (32f).
4. Continua valendo o invariante do 016/US1: **um teaser, nunca dois**, e todo caminho de assinatura existe.
5. Nenhum vazio explica a mecânica do Premium — isso é da tela de compra.

#### US7 — O formulário fica inerte, e o bloqueio acontece no salvar (P1)
*Como visitante, quero ver o formulário que eu usaria — porque ver o campo me diz o que a feature faz melhor
do que um parágrafo sobre ela.*

**Aceitação**
1. O usuário grátis **alcança o formulário**: campos **vazios com placeholder**, congelados com `tf-frozen`
   (US1 AC2/AC3 — o esmaecimento é nos CONTROLES).
2. A frase **"Salvar faz parte do Premium."** aparece **acima da linha de botões**; "Assinar Premium" é
   secundário; **"Salvar" fica desabilitado e VISÍVEL** — nunca escondido (regra da casa desde o 016/US1 AC3).
3. **O servidor continua recusando toda escrita.** Isto é interface, não permissão: a Constituição IV e o
   gate de entitlement (ADR-0012) ficam **byte-idênticos** — provado por diff vazio no diretório de
   entitlement, no padrão do SC-709 do E6 PR-B (uma suíte verde prova que nada quebrou; um diff vazio prova
   que nada mudou, que é o que esta AC pede).
4. **Nenhuma escrita do grátis entra no outbox.** O app é offline-first e enfileira escritas; um formulário
   alcançável não pode criar uma fila que o servidor vai recusar depois e que o outbox vai exibir como
   "pendente" (a classe do A3 do hotfix). Ver **Q9**.
5. Nada de falso salvamento, nada de no-op silencioso (FR-312 continua valendo).

#### US8 — Quem TINHA Premium e deixou vencer vê os próprios itens, parados (P1)
**Aceitação**: para o usuário com histórico de Premium expirado, os campos aparecem **preenchidos e
inertes** (não vazios), e a mensagem é **"Reative o Premium… Seus itens estão salvos."** — verbatim na
prancheta 32e; o estado é decidido pelo **ledger** (houve grant), não por heurística de tela; a distinção
entre "nunca teve" (US6/US7) e "teve e venceu" (US8) é **estrutural**, não um `if` esquecível — o precedente
é o `PlanState` como união discriminada do E6 PR-B; nenhum item é exibido que o servidor não devolveria.

### Grupo C — Comportamentos da calculadora (P2 · PR-C)

#### US9 — O aviso de plausibilidade aparece na hora certa, é anunciado, e não vira ruído (P2)
**Aceitação**
1. O gatilho muda de `change` para **`blur`**: o aviso não pisca a cada tecla enquanto o número está pela
   metade.
2. O aviso é **anunciado a leitor de tela ao aparecer** (hoje ele aparece mudo).
3. **"Entendi" guarda o par campo+valor pela sessão**: dispensado para `850 g`, ele **volta** se o valor
   mudar para `2.400 g` — o que foi dispensado é aquele número, não o campo.
4. **O erro não come a lição**: se o campo passa a ter erro de validação, a explicação do aviso não some
   junto — erro e aviso são categorias diferentes (US2).
5. Dinheiro dentro do aviso usa o formato do produto (milhar pontuado, 2 casas), nunca `toString`.
6. O aviso **não bloqueia o cálculo** e não altera número nenhum.

#### US10 — O bloco da máquina mostra a conta que fez, e avisa antes de apagar o que você digitou (P2)
**Aceitação**
1. O custo por hora vira **readout** com a divisão escrita embaixo — **"de R$ 4.000,00 ÷ 3.600 h"** — para
   o vendedor conferir a conta sem sair da tela.
2. O readout **existe também no modo "ajustar"** (hoje só o modo estimar mostra o derivado).
3. Valor zero ganha **ressalva** ("falta o valor da máquina" — verbatim na prancheta), não um `R$ 0,00/h`
   que se lê como fato.
4. **A troca de modo pede confirmação** (3 frases verbatim na prancheta), porque ela **descarta** o que o
   usuário digitou no outro modo — descartar em silêncio é a classe que o 016/PR-D tratou como blocante.
5. Copy dos dois modos: **"Estimar"** / **"Ajustar"**.
6. **A FÓRMULA NÃO MUDA**: o motor continua recebendo `machineValue` + `machineLifetimeHours`; a derivação
   vive na tela. **Sem bump de `PRICING_MODEL_VERSION`, sem migração** (é a continuação do 016/D3).

#### US11 — O selo de procedência fica denso e dispensável até a fonte mudar (P2)
*Decisão dada (D3).*

**Aceitação**: o selo é remontado sobre `tf-alert--compact` + `tf-alert__action` (12px, ação de 18px), não
sobre o alerta de página (16px, ação 44px); ganha o "×" de dispensa (`tf-alert__close`, alvo de 44px por
pseudo-elemento); **a dispensa vale ATÉ A FONTE MUDAR** — quando a citação ou a data da tarifa mudam, o selo
**reaparece**, porque o que ele diz passou a ser outra coisa; a dispensa **persiste** entre sessões enquanto
a fonte for a mesma; dispensar o selo **nunca** esconde um número nem muda um cálculo.

#### US12 — O que o 016 deixou aberto e o desenho fecha, mais a T212 herdada do 018 (P2)
**Aceitação**
1. **T212 (transferida do 018, `specs/018-abas-desktop/tasks.md:210`)**: no **mobile**, o preço deixa de
   estar a ~4 telas de rolagem do topo a 390px — existe um resumo fixo com o custo/preço enquanto o
   formulário rola. A superfície é a que a prancheta desenha; o mobile só muda aqui, e muda **por desenho**,
   não por acidente (o 018 prometeu não tocá-lo e cumpriu).
2. **A máscara ao vivo para de cortar `R$/kWh` em 2 casas** (resíduo 016): a tarifa de energia tem 3+ casas
   no Brasil, e arredondá-la na digitação **muda o custo de energia de toda peça**.
3. **`"0"` reabre como `"0,00"`** (resíduo 016): um campo monetário salvo com zero volta formatado.
4. Nenhum dos três altera resultado de cálculo — exceto o (2), que **corrige** um resultado que hoje está
   errado por truncamento; a correção é provada por igualdade numérica com a tarifa não truncada.

### Grupo D — Recálculo do Catálogo (P2 · PR-D) — FEATURE NOVA

> **ESCALAÇÃO OPUS OBRIGATÓRIA (ADR-0022)** se qualquer AC desta fatia gravar preço, markup ou percentual —
> ver §7 R1 e as perguntas **Q3/Q4**.
> **Fato medido que a fatia precisa encarar** (2026-08-26, confiança 95%): hoje
> `backend/app/models/__init__.py:198-204` diz, com todas as letras, *"NO price column exists anywhere —
> prices are recomputed client-side"* (FR-310/FR-313). **"era R$ 38,90" exige um preço anterior guardado em
> algum lugar, e esse lugar hoje não existe.** Isto não é detalhe de implementação: é o invariante do E2.

#### US13 — O catálogo diz o que mudou de preço desde a sua última visita (P2)
*Como vendedor, quero abrir o catálogo e ver quais preços se mexeram — porque o custo do filamento mudou e
os 12 produtos que dependem dele mudaram junto, em silêncio.*

**Aceitação**
1. Ao abrir a lista, o topo informa quantos preços mudaram desde a última visita — **"3 preços mudaram
   desde a sua última visita"** (verbatim).
2. O item que mudou mostra o valor anterior — **"era R$ 38,90"** — e **"Salvo em 12/05"** dá a data da
   referência.
3. **O preço continuar sendo recomputado ao vivo não é negociável**: o valor exibido é sempre o de hoje; o
   anterior é **contexto**, nunca a fonte do preço.
4. O que conta como "última visita" e onde o preço anterior mora é **decidido no clarify (Q3)** — servidor
   (quebra o invariante acima, escalação opus) ou dispositivo (some ao trocar de aparelho, e a frase passa a
   ser verdadeira só naquele aparelho). **Nenhuma das duas é assumida aqui.**
5. **"O cálculo continua grátis"** (verbatim) aparece onde a prancheta a coloca — a feature não pode ser
   lida como se o cálculo tivesse virado pago.
6. Sem histórico (primeira visita, ou item novo), **nada é exibido** — nem "0 preços mudaram", nem um
   "era R$ 0,00".

#### US14 — Fixar um preço, e voltar a acompanhar o custo (P2)
*Como vendedor, eu já anunciei R$ 39,90 no marketplace e não quero que o app me mostre outro número toda vez
que o filamento oscila.*

**Aceitação**
1. Um item pode ser **fixado**, e passa a exibir **"Preço fixado por você"**; a ação inversa é **"Voltar a
   acompanhar o custo"** (verbatim).
2. Um item fixado **não deixa de saber o custo**: se o custo passar do preço fixado, o produto **diz isso**
   (é o caso em que o vendedor está vendendo no prejuízo sem saber — o pior desfecho possível para um app de
   precificação). O tom é ATENÇÃO (US2), nunca erro.
3. Fixar **não congela um orçamento** nem toca o `Histórico`: as duas prateleiras do E4 continuam sendo o
   que são.
4. **O que exatamente se fixa — o número final ou o markup — é Q4.** Se for o número, `products` ganha um
   leaf de dinheiro e a fatia **escala para opus**.
5. Desfixar volta ao valor recomputado de hoje, sem etapa intermediária e sem perder o item.

#### US15 — Duplicar um item, e não ter dois com o mesmo nome (P2)
**Aceitação**: duplicar produz **"Gancho (cópia)"** (verbatim) e o novo item é editável e independente do
original; tentar salvar um nome repetido devolve **"Este nome já está no catálogo"** (verbatim), no campo,
antes de gravar; **hoje não existe unicidade de nome no schema** (medido: nenhuma `UniqueConstraint` sobre
nome em `products`/`filaments` — `backend/app/models/__init__.py`), então esta AC **cria uma regra nova** —
e o escopo dela (por dono? por seção? sensível a maiúscula e acento?) **e o comportamento offline** ficam na
**Q5**; a duplicação de um item **degradado** (referência de catálogo perdida, D6 do E3) continua degradada
na cópia, sem inventar a referência que não existe mais.

### Grupo E — Montar e Enviar (P3 · PR-E) — FEATURE NOVA, a maior

> **ESCALAÇÃO OPUS OBRIGATÓRIA (ADR-0022)** — desconto, piso de custo e quantidade **entram na conta**;
> qualquer um deles é mudança no domínio de pricing (`packages/pricing-core` ou o payload congelado).
> **Esta é a única prancheta que não espelha código existente.** Ela **propõe produto**, e por isso é a
> fatia com mais pergunta aberta (Q6–Q10) e a que eu recomendo fatiar por último (§5).

#### US16 — O construtor monta um orçamento com vários itens e quantidades (P3)
*Como vendedor, o cliente me pede 3 ganchos, 2 suportes e 10 chaveiros — hoje eu calculo um por vez e somo
na mão.*

**Aceitação**
1. O construtor aceita **N itens** do catálogo (produtos e kits), cada um com **quantidade**, e apresenta o
   total do orçamento.
2. Cada linha mostra o preço unitário e o subtotal; a origem de cada item (catálogo vs. avulso) é dita, no
   padrão que o E3/E4 já usa.
3. O total é composto pelo motor de preço, **não** por aritmética de tela — nenhuma soma paralela.
4. Um item **degradado** (referência perdida) entra pelo caminho de degradação de leitura já existente
   (D6/E3), com a legenda "(avulsa)" que o produto já tem; ele **não** vira erro do construtor.
5. O construtor **não** é o congelamento: enquanto não for enviado, tudo nele acompanha o preço de hoje.

#### US17 — Desconto, piso de custo, validade — e o momento em que o preço congela (P3)
**Aceitação**
1. Existe **desconto** aplicável ao orçamento; **forma, incidência e ordem em relação à comissão do
   marketplace são Q6** — e não podem ser inferidas, porque cada resposta dá um número diferente.
2. Existe **piso de custo**: o construtor conhece o custo e **avisa** quando o desconto empurra o preço
   abaixo dele — **"Abaixo do custo"** (verbatim). Se o piso **bloqueia** ou apenas avisa é **Q10**.
3. Existe **"Válido até"** (verbatim). Se isso é texto no documento ou **estado real** (o orçamento vence,
   muda de estado, sai da lista) é **Q7**.
4. **"Enviar congela este preço"** (verbatim): enviar produz um documento **imutável**, pela mesma
   maquinaria do E4 (ADR-0019, snapshot imutável com trigger) — nada de um segundo mecanismo de
   congelamento. O que "enviar" faz **além** de congelar é **Q8**.
5. **"Voltar a acompanhar não vale para orçamentos enviados"** (verbatim): a US14 e o documento enviado são
   coisas diferentes, e o produto diz isso onde a confusão aconteceria.
6. O documento enviado continua carregando o rodapé de **não é documento fiscal** que o PDF do E4 já tem.

#### US18 — Os avisos que só um construtor multi-item consegue dar (P3)
**Aceitação**: quando uma quantidade maior sai **mais barata** que a menor, o produto avisa — **"10 un. sai
mais barato que 9"** (verbatim); **de onde vem essa não-monotonicidade é Q9** (faixas progressivas do
marketplace, ADR-0024, ou desconto do próprio vendedor) e a resposta decide se o aviso é derivado do
catálogo ou da entrada; o aviso é **descritivo** (tom ATENÇÃO, US2), **não recusa** o orçamento e não
altera número nenhum; o projeto **já tem a propriedade correspondente provada** para o preço anunciado
(`packages/pricing-core/tests/band-dominance.test.ts` — "o anúncio publicado é o mais barato que entrega a
base"), e este aviso é a **superfície visível** dessa mesma propriedade, não uma segunda regra.

### Grupo F — Simulações em tela larga e as divergências D1–D4 (P3 · PR-F)

#### US19 — Simulações ganha a composição desktop que as outras quatro abas já têm (P3)
**Aceitação**: acima de **1280px** (o mesmo corte medido do 018 — a 1024px uma ficha de 560px deixaria ~140px
de lista) Simulações passa a usar a composição da prancheta 20g; **abaixo do corte, o mobile é o mesmo
código, intocado** — a propriedade estrutural do 018 (`useIsWide()` devolve `false` sem `matchMedia`, então
a suíte inteira continua exercitando o ramo mobile) vale aqui sem adaptação; a largura útil ocupada é
**medida** e a asserção de layout é **geométrica nos dois eixos** (o 016 pagou por isso: headless não vê
barra de rolagem clássica — mede-se também o eixo Y); zero transbordo a 360px, 1280px, 1440px e 1920px.

> **Nota de arquitetura (não é escopo, é aviso ao `arquiteto`)**: o **ADR-0031** ("gate de composição
> desktop", `docs/adr/0031-desktop-composition-gate.md`, **Proposed**) foi escrito para **quatro** abas.
> Simulações é a quinta. Ou o ADR ganha emenda datada, ou o 019 está inferindo arquitetura — o que o
> Princípio VIII proíbe. Isto precisa ser decidido no `plan`, não na implementação.

#### US20 — As divergências viram decisão ou viram guarda, e nenhuma vira "a gente sabe" (P3)
**Aceitação**
1. **D1** — os três textos de "Premium pausado" (Simulações / Kits / Orçamentos) **NÃO são unificados**:
   eles dizem coisas diferentes de propósito. Entra um **teste que força os três a mudarem juntos** — quem
   editar um sem olhar os outros vê vermelho. O teste é provado **não-vacuoso por mutação**.
2. **D2** — as duas folhas de "Renomear simulação" **permanecem** (são telas que não coexistem), mas
   passam a ler da **mesma chave** de i18n, e um teste vigia a chave única.
3. **D3** (vazio de busca cita ou não o termo) e **D4** (ressalva "pode estar desatualizada" por linha vs.
   faixa no topo) são **decisões de gosto do dono** — entram como **Q1** e **Q2** e **não são implementadas
   antes da resposta**.
4. **A11-r (resíduo 016 — densidade do desktop no Catálogo)** fecha aqui ou na PR-D, aplicando o `tf-table`
   da US1: comparar 12 produtos passa a ser leitura de coluna. A densidade resultante é **medida** (itens
   visíveis sem rolar, a 1280px e 1920px), não avaliada por impressão.

---

## 5. Fatiamento em PRs

Seis fatias, autorizadas uma a uma pelo dono, squash-merge em `develop` (ADR-0006). A ordem é a do plano
aprovado; onde eu tenho ressalva, ela está dita.

| # | fatia | conteúdo | por quê nessa posição |
| --- | --- | --- | --- |
| **V0** | *(medição, não vira PR)* | §3 | dimensiona a PR-A; já devolveu 2 correções de escopo antes de escrever uma linha |
| **PR-A** | fundação DS | US1–US5 | **todo o resto depende dela** (`tf-frozen` é a PR-B; `tf-alert--compact` é a PR-C; `tf-table` é a PR-D; `tf-aviso` é a PR-E). Nenhuma outra fatia pode começar antes |
| **PR-B** | Premium sem parede | US6, US7, US8 | mudança de padrão que o dono pediu, alto valor percebido, **zero mudança de dado**; usa `tf-frozen` e nada mais da PR-A |
| **PR-C** | calculadora | US9–US12 | melhora a tela mais usada **sem tocar a fórmula** e sem migração; entrega grande com risco baixo |
| **PR-D** | recálculo do Catálogo | US13, US14, US15 | **primeira fatia com dado novo** — preço anterior, marca de visita, fixação, unicidade. Isolada porque é a primeira que pode exigir migração |
| **PR-E** | Montar e Enviar | US16, US17, US18 | **sozinha**: é a única que inventa produto, a única com 5 perguntas abertas e a única que pode encostar em `pricing-core`. Um rollback dela não pode arrastar a PR-D junto |
| **PR-F** | Simulações desktop + divergências | US19, US20 | fecha a cobertura desktop e converte D1–D4 em decisão/guarda; depende só da PR-A |

**Por que PR-A é bloqueante e as outras cinco não são**: as cinco seguintes são independentes entre si
(medido pelas dependências de primitivo acima), então **B, C, D, F podem sair em qualquer ordem** depois de
A — e o dono pode parar depois de qualquer uma delas sem deixar meio-produto no ar. **A PR-E é a única cuja
saída deixaria um buraco conceitual** (um construtor pela metade é pior que nenhum), e por isso ela é
tudo-ou-nada. Confiança ~85%.

**Por que PR-B antes de PR-C**: a PR-B é a que o **usuário grátis** vê primeiro e a que muda a percepção do
produto (é o que ele encontra ao abrir Catálogo/Kits/Orçamentos/Simulações sem assinar). A PR-C melhora uma
tela que ele só alcança depois de decidir usar o app. Valor por custo é maior em B. Confiança ~75%.

### Alternativas consideradas

**Opção 2 — PR-E ("Montar e Enviar") sai do 019 e vira o incremento 020.**
*Prós*: o 019 volta a ser o que o nome diz — um **porte** — e fecha em 4–5 semanas de fatias previsíveis;
a feature nova ganha o seu próprio ciclo spec-kit completo (specify → clarify → plan → tasks) em vez de
entrar como um sexto grupo de um brief de porte; as 5 perguntas abertas dela deixam de segurar as outras
cinco fatias. *Contras*: contraria a D1 ("escopo: TUDO"); o dono decidiu incluí-la sabendo do tamanho.
*Escalabilidade*: melhor — feature nova em incremento próprio é o padrão que E3/E4/E5 seguiram e fecharam.
**Confiança de que é a melhor opção técnica: ~70%** — e ainda assim **não recomendo reabrir**, porque a
decisão é do dono e o fatiamento acima já isola o risco (§8 Ressalva 5).

**Opção 3 — três fatias grandes (A+B / C+D / E+F), no formato do E4/E5.**
*Prós*: menos cerimônia de autorização; menos rodadas de review. *Contras*: junta a fatia sem mudança de
dado (B) com a fundação (A), e junta a calculadora (risco baixo) com o recálculo (risco de migração); um
problema no preço anterior segura os quatro comportamentos da calculadora. *Escalabilidade*: pior.
**Confiança de que é inferior: ~80%.**

**Opção 4 — porte fiel primeiro (A+C+F), features novas depois (B+D+E).**
*Prós*: separa limpo "espelho" de "produto novo"; toda a parte de risco zero sai junta e cedo.
*Contras*: adia a PR-B, que é a de maior valor percebido e **não tem risco de dado**; agrupar por "tipo de
mudança" em vez de por dependência é organização para quem escreve, não para quem usa.
**Confiança de que é inferior: ~65%.**

---

## 6. Fora de escopo (explícito)

1. **Mercado Livre / o canal inteiro** — a **US15 do 016** (custo fixo ML como logística × faixa × peso)
   continua fora; volta **com o token da casa**, e a coleta segue gateada pelas **8 condições do parecer do
   `seguranca` E por autorização separada do dono**. **Não iniciar num "continue".**
2. **Pipeline de ingestão mensal de tarifas** — é o **017**, em andamento em `017-pr-b-precos`. Nada dele
   entra aqui, e o 019 **não** mexe em `packages/fee-ingest`.
3. **Frete real (lacuna E3)** — peso, dimensões, cubagem, distância, reputação. As tabelas medidas
   continuam esperando a vez; **não é a vez**.
4. **Perfil do vendedor (lacuna E1)** — Amazon Profissional R$ 19/mês, campanhas de Destaque da Shopee,
   perfil como bloco próprio.
5. **Homologação da parte premium** — o dono declarou que homologa o premium depois. Vale a **D5** por
   cima: **nenhuma homologação do 019 abre enquanto a Rodada 1 não fechar**; as entregas ficam em
   **CORREÇÃO DECLARADA** (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`).
6. **`tf-phone-scroll` e `tf-price--rola`** — dispositivos de prancheta, explicitamente **não portados**
   (US1 AC5).
7. **Reverter os dois "consertos que a folha copiou de volta"** (015/A6 e 016/T018-A1) — reverter
   reintroduz bug já pago (US1 AC6).
8. **Renomear símbolos, chaves, rotas ou arquivos** por causa de "marketplace" (US5 AC2). A troca é de
   texto visível; o arquivo `cf-010-canais.spec.ts` **mantém o nome**.
9. **Redesenho mobile** além do que a prancheta desenha explicitamente (a T212 é a exceção autorizada,
   US12 AC1). O 018 provou que "o mobile não se mexe" pode ser **estrutural**; essa garantia não é gastada
   aqui.
10. **Mudança de fórmula na calculadora** — a US10 muda a **pergunta e o readout**, não o motor (o
    precedente é o 016/D3). Sem bump de `PRICING_MODEL_VERSION` na PR-C.
11. **Os 605 pontos de revisão de conteúdo** dos prompts inferidos
    (`docs/design/prompts/inferidos/PERGUNTAS-AO-DONO.md`) — são do dono e correm em paralelo; o 019 só
    consome o que já virou prancheta.

---

## 7. Riscos de produto

| # | risco | por quê importa | mitigação proposta |
| --- | --- | --- | --- |
| **R1** | **O recálculo do Catálogo pode quebrar o invariante "produto não tem coluna de preço"** | está escrito no modelo (`backend/app/models/__init__.py:198-204`, FR-310/FR-313) e é o que garante que o preço exibido é sempre o de hoje. "era R$ 38,90" e "Preço fixado por você" empurram na direção oposta | **Q3/Q4 antes de qualquer código**; se a resposta gravar dinheiro, a PR-D **escala para opus (ADR-0022)** e ganha Clarification datada na spec 007 |
| **R2** | **"Montar e Enviar" toca o domínio de pricing** | desconto + piso + quantidade entram na conta; um desconto aplicado no lugar errado em relação à comissão dá um número **plausível e errado** | **escalação opus obrigatória**; a regra do desconto entra em `packages/pricing-core` com teste de propriedade, nunca na tela; Q6 responde antes |
| **R3** | **A troca "canal"→"marketplace" varre testes que assertam string** | 153 ocorrências medidas sob `apps/`, das quais **48 num único spec de homologação**; uma busca-e-troca cega transforma asserção em tautologia e ninguém vê | US5 AC5: a mudança de asserção é **revisada como mudança**, não como ruído; e o diff de teste é lido separado do diff de produto |
| **R4** | **A PR-A é bloqueante de cinco fatias** | se a fundação atrasa ou volta atrás, o incremento inteiro para | V0 dimensiona A **antes** de abri-la; A não contém feature nova; se A escorregar, PR-B (que só depende de `tf-frozen`) pode sair com um subconjunto |
| **R5** | **A homologação não pode acontecer** (D5) | seis fatias podem empilhar como CORREÇÃO DECLARADA sem nunca serem homologadas — e o projeto já provou três vezes que teste automatizado não homologa layout | cada fatia sai com **evidência visual completa** (screenshots 1:1 + geometria nos dois eixos) **pronta para a segunda passada**, para que a homologação, quando abrir, seja re-verificação e não descoberta |
| **R6** | **Unicidade de nome num app offline-first** | dois aparelhos criam "Gancho" sem rede; a regra só é descoberta na sincronização, e o outbox hoje sabe enfileirar mas não sabe resolver conflito de nome | **Q5**; e a resposta **não pode** ser "o outbox descarta" — descartar escrita do usuário em silêncio é a classe que o A3 do hotfix tratou como grave |
| **R7** | **20 stories, 2 features novas, num incremento chamado "porte"** | é o maior escopo do projeto (o 016, com 17, já era o maior desde o E2) | fatias autorizadas uma a uma; A–D e F entregam valor sozinhas; a PR-E é a única tudo-ou-nada, e é a última (§5, Opção 2) |
| **R8** | **ADR-0031 cobre 4 abas e a US19 traz a quinta** | implementar sem emenda é inferir arquitetura (Princípio VIII) | a US19 aponta isso ao `arquiteto`; o ADR ganha emenda datada no `plan` ou vira ADR novo — o dono flipa Proposed→Accepted no gate |
| **R9** | **O Premium "sem parede" pode ser lido como Premium de graça** | o formulário fica alcançável; um usuário pode achar que salvou | US7 AC2 (Salvar desabilitado e visível) + AC3 (servidor recusa, diff vazio) + AC4 (nada entra no outbox) + FR-312 (nada de no-op silencioso) |

---

## 8. Ressalvas do PO (registro — **não** alteram o escopo)

1. **O handoff é a autoridade da copy, e este brief não a substitui.** Toda frase entre aspas aqui é
   **citação** do handoff. As 6 frases dos vazios didáticos, as 3 da confirmação de troca de modo, as 5
   palavras de estado do construtor e as 2 da exclusão **não estão neste documento** — elas vivem nas
   pranchetas e são transcritas de lá. Um agente que "reconstruir" essas frases a partir deste brief está
   inventando copy que o dono aprovou verbatim. **Confiança de que isso aconteceria sem o aviso: ~60%.**
2. **A prancheta "Montar e Enviar" está marcada como PROPOSTA no índice do design, e o dono decidiu
   incluí-la.** Registro a diferença de natureza: as outras 32 pranchetas foram desenhadas **a partir do
   código** e por isso são verificáveis contra ele; esta desenha algo que **não existe**, então não há
   espelho — há especificação. Ela merece o rigor de uma feature nova (specify próprio, clarify próprio),
   e é por isso que a §5/Opção 2 existe. **Confiança de que ela sozinha é maior que as outras cinco fatias
   somadas: ~65%** (inferência a partir do número de perguntas abertas — 5 de 10 —, não medida).
3. **A V0 já mudou o escopo duas vezes antes de começar**, e as duas na direção de "menos trabalho do que
   o handoff sugere" (`tf-alert--compact` já existe; o wordmark já está certo). Isso é evidência a favor da
   frase do próprio handoff ("a maior parte já existe e está correta") — e é um argumento para **não**
   dimensionar a PR-A pela contagem de `NOVO` na folha (29 marcadores). **Confiança: 90%.**
4. **A US14 (fixar preço) introduz uma segunda noção de "preço parado" num produto que já tem duas.**
   Hoje há o **congelado** (Orçamentos, imutável, ADR-0019) e o **recalculado** (Simulações, ADR-0021), e o
   E4/E5 gastaram duas fatias tornando a diferença legível ("a regra das duas prateleiras"). Um terceiro
   estado — "fixado, mas vivo" — pode desfazer esse trabalho. A AC5 da US17 ("voltar a acompanhar não vale
   para orçamentos enviados") mostra que o desenho **já sentiu** o atrito. **Confiança de que a confusão é
   real se as três noções não forem nomeadas juntas numa tela: ~70%.**
5. **Tamanho.** 20 stories, 6 fatias, 2 features novas. O 016 tinha 17 e eu registrei que era o maior desde
   o E2; este é maior. Aceito como um só incremento **porque as fatias são independentes depois da PR-A** —
   mas registro que, se alguma fatia escorregar, a candidata natural a virar 020 é a PR-E, e essa saída deve
   continuar disponível até ela começar.
6. **A D5 (homologação espera) é certa e cara.** Implementar seis fatias sem a segunda passada do dono
   acumula risco: o projeto tem três precedentes de defeito que **só** apareceu quando alguém executou o
   produto (E5, E6 PR-B, 014). Não peço para reabrir — peço que a evidência visual de cada fatia seja
   produzida **como se** a homologação fosse no dia seguinte, para que a fila não vire arqueologia.

---

## 9. Critérios de sucesso mensuráveis por fatia

Padrão da casa, herdado do 014/016/018 e pago três vezes: **um screenshot acha o que uma asserção
geométrica não acha, e uma asserção geométrica acha o que extração de texto não acha.**
`toBeVisible`/`toContainText` passam num elemento totalmente ocluído — oclusão não é propriedade do texto.

**Vale para todas as fatias**
- `pnpm gate:all` verde (o mesmo comando literal do lefthook e da CI) + e2e + drift-guard de contrato.
- **Vermelho antes do verde**: todo teste novo é provado **não-vacuoso** (falha na ausência do conserto).
- **Geometria nos DOIS eixos**: a asserção de layout lê caixas do DOM, e mede também o eixo **Y** —
  headless não vê barra de rolagem clássica (016/PR-B).
- **Screenshots 1:1** (sem escala) nos dois temas, a **360px** e no corte relevante.
- Nenhuma regressão no ramo mobile: a suíte existente continua exercitando-o sem `matchMedia` (018).
- Linha no `docs/token-ledger.md` para cada operação multi-agente.

| fatia | critérios específicos |
| --- | --- |
| **V0** | tabela de classificação (a/b/c) dos 8 primitivos + 8 desfazimentos + itens de marca, com **arquivo:linha ou screenshot** por item, no `dod-evidence.md`. Contagem real de "canal" no produto, medida, substituindo o número da prancheta |
| **PR-A** | **contraste medido**, não estimado: `tf-frozen` entrega ≥ **5,67:1** na dica e ≥ **18,23:1** no rótulo, nos dois temas (a régua é AA) · `tf-plist` entrega **≥9 itens visíveis a 390px** (hoje 4) — contados na imagem, não inferidos · `tf-alert__close` mede **44×44px de alvo** sem alterar a altura do alerta (as duas medidas juntas, senão a caixa volta) · **zero** ocorrência de `tf-phone-scroll`/`tf-price--rola` no bundle · **zero** classe `tf-*` definida em dois arquivos |
| **PR-B** | **diff vazio** em `app/entitlement/` e no gate de escrita (prova de que nada de permissão mudou — SC-709 do E6) · uma tentativa de escrita do grátis contra o backend real devolve **recusa**, e a fila do outbox fica com **0 itens** · o vazio didático exibe as 6 frases **byte-idênticas** à prancheta · o par "nunca teve" × "teve e venceu" é exercitado nos **dois** caminhos, com ledger correspondente |
| **PR-C** | o aviso de plausibilidade **não aparece** durante a digitação e **aparece** no blur (medido por eventos, não por espera) · "Entendi" dispensa `850` e **volta** em `2.400` · o readout imprime a divisão com os dois operandos formatados · a troca de modo **não descarta sem confirmar** · a tarifa `R$/kWh` com 3+ casas **chega íntegra ao motor** (igualdade numérica com o valor não truncado) · T212: o preço fica visível durante a rolagem a **390px**, provado por caixa |
| **PR-D** | um filamento tem o custo alterado e a lista do Catálogo passa a dizer **quantos** preços mudaram, com o **valor anterior correto** · o item fixado **não muda** quando o custo muda, e **avisa** quando o custo o ultrapassa · desfixar restaura o valor de hoje · nome repetido é recusado **antes** de gravar, e o caminho **offline** do conflito é exercitado (Q5) · o preço exibido continua **recomputado** (nenhum caminho lê preço gravado como fonte) |
| **PR-E** | um orçamento de **3 itens × quantidades diferentes** soma pelo motor, e a soma é comparada com o cálculo item a item (**igualdade**, não aproximação) · desconto no limite do piso dispara **"Abaixo do custo"** · enviar produz snapshot **imutável** pela trigger existente (a tentativa de UPDATE **falha**) · o aviso de quantidade dispara num caso construído e **não** dispara num caso monótono · **PDF com dado adversarial de TAMANHO**: nome longo não colide com a coluna de preço — asserção de **geometria na página**, porque extração de texto é cega a colisão (lição do E4/T034) |
| **PR-F** | largura útil ocupada por Simulações **medida** a 1280/1440/1920px, com o número antes e depois · **zero** transbordo em qualquer um dos quatro cortes, nos **dois** eixos · o teste do D1 falha quando **um só** dos três textos muda (mutação) · o teste do D2 falha quando as duas folhas divergem de chave · densidade do Catálogo (A11-r) contada em **itens visíveis sem rolar**, antes e depois |

---

## 10. Perguntas para o `/speckit-clarify` (10 — nenhuma reabre decisão do dono)

As seis grandes já estão decididas (§2). Estas são o que sobrou de **genuinamente ambíguo** — e cinco delas
são da fatia que inventa produto.

| # | pergunta | o que muda | bloqueia? |
| --- | --- | --- | --- |
| **Q1** | **D3 — vazio de busca**: o Catálogo **não** cita o termo buscado; Orçamentos e Simulações **citam**. Uniformizar em qual dos dois, ou manter a diferença de propósito? | copy de 3 vazios (US20 AC3) | não (gosto) |
| **Q2** | **D4 — ressalva "pode estar desatualizada"**: fica **por linha** (repete, mas nunca some do campo de visão) ou vira **faixa no topo** (uma vez, mas some ao rolar)? | densidade e ruído das listas em leitura offline (US20 AC3) | não (gosto) |
| **Q3** | **Onde mora o "preço anterior" e o marcador de "última visita"?** Hoje **não existe coluna de preço em lugar nenhum** (medido, FR-310/FR-313). Servidor (a frase vale em qualquer aparelho, **quebra o invariante**, escalação opus) ou dispositivo (não sincroniza, e "sua última visita" passa a significar "neste aparelho")? | forma da US13 inteira; decide se a PR-D tem migração | **SIM — PR-D** |
| **Q4** | **"Preço fixado por você" fixa o quê**: o **número final** (então `products` ganha leaf de dinheiro → opus) ou o **markup** (o preço ainda acompanha o custo, só que com margem travada)? E quando o custo ultrapassa o fixado, o produto **avisa** (é a US14 AC2) ou **desfixa sozinho**? | forma da US14; risco financeiro da fatia | **SIM — PR-D** |
| **Q5** | **Unicidade de nome**: escopo (por dono? por seção — filamento vs. produto?), sensível a maiúscula e acento? E **offline**: dois aparelhos criam "Gancho" sem rede — a sincronização **recusa e devolve ao usuário**, **renomeia sozinha** ("Gancho (2)"), ou aceita as duas? | US15; comportamento do outbox sob conflito (R6) | **SIM — PR-D** |
| **Q6** | **Desconto do construtor**: percentual ou valor? por item ou no total? e **incide antes ou depois** da comissão do marketplace? As três combinações dão números diferentes e todas parecem certas na tela | US17 AC1; é a AC que põe a PR-E dentro de `pricing-core` | **SIM — PR-E** |
| **Q7** | **"Válido até" é texto ou estado?** Só uma linha impressa no documento, ou o orçamento **vence de verdade** (muda de estado, sai da lista ativa, avisa o vendedor)? Existe prazo padrão? | US17 AC3; se for estado, entra ciclo de vida novo | **SIM — PR-E** |
| **Q8** | **O que "Enviar" faz além de congelar?** Gera PDF/link e o vendedor manda por fora (é o que o produto sabe fazer hoje), ou o app **entrega** (e-mail/WhatsApp/link público)? Um link público é superfície nova com implicação de segurança e precisa do `seguranca` | US17 AC4; pode dobrar o tamanho da PR-E | **SIM — PR-E** |
| **Q9** | **"10 un. sai mais barato que 9" vem de onde?** Das **faixas progressivas do marketplace** (ADR-0024, que o produto já modela) ou de **desconto por quantidade do vendedor** (que não existe hoje)? A resposta decide se o aviso é derivado ou inventado | US18; se for a segunda, é regra de preço nova | **SIM — PR-E** |
| **Q10** | **Piso de custo: avisa ou bloqueia?** Um orçamento abaixo do custo é um erro do vendedor ou uma decisão dele (promoção, cliente antigo, desovar estoque)? | US17 AC2; bloquear uma decisão legítima é a classe "o produto recusou o que não devia" | **SIM — PR-E** |

**Pergunta que NÃO vai ao dono e sim ao `arquiteto`** (registro para não se perder): o **ADR-0031** cobre
quatro abas e a US19 traz a quinta — emenda datada ou ADR novo? Ver R8.

---

## 11. Definição de pronto do incremento

- **V0 medida e registrada** antes de abrir a PR-A; a tabela (a/b/c) está no `dod-evidence.md` e é o que
  dimensionou a fatia.
- `pnpm gate:all` verde + e2e + drift-guard de contrato em **todas** as fatias.
- Toda fatia com mudança visual entrega **imagem 1:1 nos dois temas** e **asserção geométrica nos dois
  eixos** (§9).
- Nenhuma copy visível escrita por agente: toda frase é **transcrita verbatim** da prancheta, e a
  divergência de um caractere é defeito.
- **Constituição IV intacta**: diff vazio no gate de entitlement após a PR-B; o servidor recusa toda escrita
  do grátis, e isso é **exercitado**, não afirmado.
- `PRICING_MODEL_VERSION` bumpado **se e somente se** a entrada do motor mudar (a PR-C **não** muda; a PR-E
  pode mudar — decidido pela Q6); `catalogVersion` intocado (o 019 não mexe em tarifa).
- Clarification datada nas specs afetadas onde um comportamento registrado mudar — **incluindo a 007** se a
  Q3/Q4 gravar preço (FR-310/FR-313 dizem hoje que não existe preço gravado).
- **Escalação opus registrada** (ADR-0022) em toda tarefa que tocar leaf de dinheiro/percentual ou o payload
  de orçamento/simulação — PR-D condicional (Q3/Q4), PR-E provável (Q6).
- Cada fatia entra em **CORREÇÃO DECLARADA** com a evidência pronta para a segunda passada do dono, e
  **nenhuma fecha** antes de a Rodada 1 fechar e a homologação do 019 abrir (D5,
  `docs/homologacao/PROCESSO-HOMOLOGACAO.md`).
- `docs/token-ledger.md` com a linha de cada operação multi-agente.
