# Feature Specification: 019 — O porte do design (157 superfícies) + as features que o dono incluiu

**Feature Branch**: `019-porte-design`

**Created**: 2026-08-26

**Status**: Draft (pós-specify; aguarda `/speckit-clarify` — Q1–Q10 do brief)

**Input**: "Portar para o produto o design das 157 superfícies desenhadas pelo dono no Claude Design
(projeto `a90ed7d4`), aplicando os deltas do handoff versionado em `docs/design/handoff-019/`
(README + `tf-components.css`), + as duas features novas e a mudança de padrão do Premium que o
dono decidiu incluir."

**Autoridade de escopo**: [`docs/product/019-porte-design-scope-brief.md`](../../docs/product/019-porte-design-scope-brief.md)
(product-owner, 2026-08-26 — as 20 US abaixo derivam DELE; em divergência, o brief manda).
**Autoridade de design**: [`docs/design/handoff-019/`](../../docs/design/handoff-019/) (cópia
versionada 2026-08-26 do projeto Claude Design `a90ed7d4` — 33 pranchetas × 2 temas, 157/157
desenhadas) + as pranchetas remotas, transcritas por fatia.
**Regra de copy (inegociável)**: nenhuma frase visível é escrita por agente — toda copy é
**transcrita verbatim da prancheta**; divergência de um caractere é defeito.

## Decisões do dono (restrições — o clarify NÃO as reabre)

| # | decisão | data |
| --- | --- | --- |
| D1 | Escopo: TUDO — porte + recálculo do Catálogo + Montar-e-Enviar + Simulações desktop | 2026-08-25 |
| D2 | "canal" → "marketplace" no texto visível NESTA leva (símbolos/chaves/rotas intactos) | 2026-08-25 |
| D3 | Selo de procedência: dispensa vale ATÉ A FONTE MUDAR | 2026-08-26 |
| D4 | Copy dos 6 vazios didáticos (32c) aprovada como está | 2026-08-25 |
| D5 | Homologação do 019 ESPERA a Rodada 1; entregas ficam em CORREÇÃO DECLARADA | 2026-08-26 |
| D6 | "Montar e Enviar" ENTRA (era proposta marcada no índice do design) | 2026-08-25 |
| D7 | Premium sem parede: bloqueia SÓ no salvar; o servidor continua recusando toda escrita | 2026-08-25 |

## User Scenarios & Testing *(mandatory)*

> As 20 histórias do brief, agrupadas nas 6 fatias do plano aprovado. Cada GRUPO é independNte e
> testável após a PR-A; dentro de um grupo, cada US é verificável sozinha. Cenários de aceitação
> detalhados (AC numeradas) vivem no brief §4 — aqui ficam os cenários-chave no formato G/W/T.

### User Story 1 — A camada de baixo: os oito primitivos + o tom de ATENÇÃO (Priority: P1 · PR-A · US1+US2 do brief)

O produto ganha os primitivos que o desenho precisou inventar (`tf-aviso`, `tf-plist`, `tf-table`,
`tf-segmented--split`, `tf-btn--full/--half`, `tf-frozen`, `tf-alert--compact`+`__action`,
`tf-alert__close`) e a quinta categoria de mensagem (`--warning-text` + `tf-alert--warning`) —
classificados ANTES pela V0 (já existe? existe local e sobe? não existe?).

**Why this priority**: todas as outras cinco fatias dependem de pelo menos um primitivo desta.

**Independent Test**: cada primitivo renderizado nos dois temas com as medidas do handoff
(tf-frozen: dica ≥5,67:1, rótulo ≥18,23:1; tf-plist: ≥9 itens a 390px; tf-alert__close: alvo
44×44 sem alterar a altura do alerta); zero classe `tf-*` definida em dois arquivos.

**Acceptance Scenarios**:

1. **Given** a V0 classificou `tf-alert--compact` como "existe local" (medido:
   `shopee-warnings.css:5`), **When** a PR-A entrega, **Then** a regra vive no DS e a cópia local
   foi APAGADA na mesma fatia.
2. **Given** um formulário congelado com `tf-frozen`, **When** o contraste é MEDIDO nos dois temas,
   **Then** dica ≥5,67:1 e rótulo ≥18,23:1 — e o `background: var(--bg-muted)` está presente
   (no claro, #ededf1 sobre #ffffff).
3. **Given** o bundle final, **When** se procura `tf-phone-scroll` ou `tf-price--rola`, **Then**
   zero ocorrência (dispositivos de prancheta), e os consertos 015/A6 + 016/T018-A1 NÃO foram
   revertidos.

---

### User Story 2 — Marca, foco, texto e vocabulário (Priority: P1 · PR-A · US3+US4+US5 do brief)

Guardas de marca (wordmark PNG real — já correto, medido; `tf-lockup` não pode voltar), TabBar
12→10px com 7px de respiro, anel de foco 2px + anel do menu em `--accent`, grafismos fora de
404/erro; acentos em `messages.pt-br.ts:179`; "1 anos"→"1 ano" (`:486`); e a troca
"canal"→"marketplace" em TODO texto visível (medido: 153 ocorrências sob `apps/`, 31 em messages —
não as 374 da prancheta), com os testes que assertam a string revisados como mudança de asserção.

**Why this priority**: mecânica, ampla, e o vocabulário precisa entrar antes das fatias que
escrevem telas novas (senão nasce tela nova com a palavra velha).

**Independent Test**: varredura pós-fatia: zero "canal/canais" em superfície legível (UI + PDF/CSV
exportados); todos os símbolos `channel*` intactos; um orçamento congelado antigo com "canal" no
payload continua abrindo idêntico.

**Acceptance Scenarios**:

1. **Given** um export PDF gerado após a fatia, **When** lido, **Then** diz "marketplace" onde
   dizia "canal" — e o payload congelado de um orçamento ANTIGO não foi tocado.
2. **Given** o molde do payback com `n=1`, **When** renderiza, **Then** "1 ano" (nunca "1 anos").

---

### User Story 3 — Premium sem parede (Priority: P1 · PR-B · US6+US7+US8 do brief · decisão D7)

A parede antes da lista, o botão de criar desabilitado e o aviso de reativação para quem nunca
teve Premium SAEM. ENTRAM: o vazio didático (6 frases verbatim, D4) e o formulário inerte
(`tf-frozen`, campos VAZIOS com placeholder, "Salvar faz parte do Premium." acima da linha de
botões, "Assinar Premium" secundário, "Salvar" desabilitado e VISÍVEL). Exceção (quem TINHA e
deixou vencer): campos PREENCHIDOS inertes + "Reative o Premium… Seus itens estão salvos." —
distinção estrutural pelo ledger, não heurística. Em Orçamentos/Simulações o botão do vazio leva
à calculadora ("Fazer um cálculo").

**Why this priority**: a mudança de padrão que o dono pediu, alto valor percebido, zero mudança
de dado.

**Independent Test**: diff VAZIO em `app/entitlement/` e no gate de escrita (SC-709 do E6);
tentativa de escrita do grátis contra o backend real devolve recusa E a fila do outbox fica com
0 itens; as 6 frases byte-idênticas à prancheta.

**Acceptance Scenarios**:

1. **Given** um visitante grátis no Catálogo vazio, **When** toca "Adicionar filamento", **Then**
   o formulário abre INTEIRO, inerte, com a dica do consumo médio LEGÍVEL (≥5,67:1) — e "Salvar"
   está desabilitado e visível.
2. **Given** o mesmo visitante, **When** o app está offline e ele tenta salvar, **Then** NADA
   entra no outbox (um formulário alcançável não pode criar fila que o servidor recusará).
3. **Given** um usuário com grant expirado no ledger e 3 filamentos salvos, **When** abre a lista,
   **Then** vê os 3 itens e o formulário PREENCHIDO inerte com "Reative o Premium…" — nunca o
   vazio didático.

---

### User Story 4 — Comportamentos da calculadora (Priority: P2 · PR-C · US9+US10+US11+US12 do brief)

Plausibilidade: gatilho no blur, anunciado a leitor de tela, "Entendi" guarda o par campo+valor
pela sessão, erro não come a lição, dinheiro formatado. Bloco da máquina: custo/hora vira readout
com a divisão escrita ("de R$ 4.000,00 ÷ 3.600 h"), existe no modo ajustar, zero ganha ressalva,
troca de modo pede confirmação (3 frases verbatim) — A FÓRMULA NÃO MUDA (sem bump de
`PRICING_MODEL_VERSION`). Selo de procedência: remontado denso (`tf-alert--compact`) com dispensa
até a fonte mudar (D3), persistente entre sessões. E os resíduos: T212 (resumo fixo do preço no
mobile a 390px — a exceção mobile autorizada), a máscara ao vivo para de cortar R$/kWh a 2 casas
(corrige custo de energia truncado), "0" reabre "0,00".

**Why this priority**: a tela mais usada, sem tocar a fórmula, sem migração.

**Independent Test**: aviso não aparece durante digitação e aparece no blur (medido por eventos);
"Entendi" dispensa 850 e VOLTA em 2.400; tarifa de 3+ casas chega íntegra ao motor (igualdade
numérica); selo dispensado REAPARECE quando citação/data da tarifa mudam.

**Acceptance Scenarios**:

1. **Given** o vendedor digitando "85" a caminho de "850", **When** cada tecla entra, **Then**
   nenhum aviso pisca; **When** o campo perde o foco com 850, **Then** o aviso aparece E é
   anunciado.
2. **Given** o modo estimar com ritmo/payback preenchidos, **When** o vendedor toca "Ajustar",
   **Then** uma confirmação (verbatim) pergunta antes de descartar o que ele digitou.
3. **Given** o selo do Mercado Livre dispensado ontem, **When** o catálogo de tarifas muda a data
   de revisão, **Then** o selo REAPARECE.

---

### User Story 5 — Recálculo do Catálogo (Priority: P2 · PR-D · US13+US14+US15 do brief · FEATURE NOVA)

O catálogo diz o que mudou de preço desde a última visita ("3 preços mudaram…", "era R$ 38,90",
"Salvo em 12/05" — verbatim), permite FIXAR um preço ("Preço fixado por você" / "Voltar a
acompanhar o custo"), avisa em tom ATENÇÃO quando o custo ultrapassa o fixado, duplica itens
("Gancho (cópia)") e recusa nome repetido ("Este nome já está no catálogo") antes de gravar.
O preço exibido continua SEMPRE recomputado ao vivo — o anterior é contexto, nunca fonte.

**Why this priority**: primeira fatia com dado novo; isolada porque é a primeira que pode exigir
migração. **ESCALAÇÃO OPUS (ADR-0022)** se qualquer AC gravar preço — fato medido: hoje "NO price
column exists anywhere" (`backend/app/models/__init__.py:198-204`, FR-310/FR-313); se a resposta
da Q3/Q4 gravar dinheiro, a spec 007 ganha Clarification datada.

**Independent Test**: alterar o custo de um filamento → a lista diz QUANTOS preços mudaram com o
valor anterior correto; item fixado não muda e avisa quando o custo o ultrapassa; nome repetido
recusado antes de gravar, incluindo o caminho offline.

**Acceptance Scenarios**:

1. **Given** 12 produtos dependentes de um filamento, **When** o custo do rolo muda, **Then** o
   topo da lista informa a contagem e cada item mostra "era R$ X" — e o valor GRANDE continua
   sendo o recomputado de hoje.
2. **Given** primeira visita ou item novo, **When** a lista abre, **Then** NADA de "0 preços
   mudaram" nem "era R$ 0,00".
3. **Given** um item fixado, **When** o custo passa do preço fixado, **Then** aviso em tom
   ATENÇÃO (nunca erro) — vender no prejuízo sem saber é o pior desfecho de um app de precificação.

**[NEEDS CLARIFICATION: Q3 — onde mora o preço anterior e o marcador de "última visita"?
Servidor (a frase vale em qualquer aparelho; QUEBRA o invariante "sem coluna de preço"; escalação
opus + Clarification na 007) ou dispositivo (não sincroniza; "sua última visita" = "neste
aparelho")? Decide se a PR-D tem migração.]**

**[NEEDS CLARIFICATION: Q4 — "fixar" fixa o quê? O número final (products ganha leaf de dinheiro
→ opus) ou o markup (o preço segue o custo com margem travada)? E ao ser ultrapassado pelo custo:
só avisa, ou desfixa sozinho?]**

*(Q5 — escopo/sensibilidade da unicidade de nome e o conflito offline entre dois aparelhos — vai
ao clarify junto; registrada no brief §10 e no R6: a resposta NÃO pode ser "o outbox descarta".)*

---

### User Story 6 — Montar e Enviar (Priority: P3 · PR-E · US16+US17+US18 do brief · FEATURE NOVA, a maior)

O construtor de orçamento multi-item: N itens do catálogo com quantidade, subtotais e total
compostos PELO MOTOR (nenhuma soma paralela); desconto com piso de custo ("Abaixo do custo");
"Válido até"; "Enviar congela este preço" — pela MESMA maquinaria imutável do E4 (ADR-0019),
nunca um segundo mecanismo; "Voltar a acompanhar não vale para orçamentos enviados"; e o aviso
que só um construtor consegue dar: "10 un. sai mais barato que 9" (superfície visível da
propriedade band-dominance já provada). **ESCALAÇÃO OPUS obrigatória** — desconto/piso/quantidade
entram na conta (pricing-core ou payload congelado).

**Why this priority**: a única fatia que INVENTA produto (sem espelho no código); a única
tudo-ou-nada; sai por último para um rollback dela não arrastar as outras.

**Independent Test**: orçamento de 3 itens × quantidades diferentes soma pelo motor (igualdade
item a item, não aproximação); enviar produz snapshot cuja tentativa de UPDATE FALHA na trigger;
PDF com nome adversarialmente longo não colide com a coluna de preço (geometria na página).

**Acceptance Scenarios**:

1. **Given** um orçamento com desconto no limite do piso, **When** o desconto empurra abaixo do
   custo, **Then** "Abaixo do custo" aparece (tom ATENÇÃO, descritivo).
2. **Given** um orçamento enviado, **When** qualquer edição é tentada, **Then** o documento é
   imutável — e um item fixado (US5) NÃO pode ser "desfixado" retroativamente nele.
3. **Given** um item degradado (referência de catálogo perdida), **When** entra no construtor,
   **Then** segue o caminho de degradação de leitura do E3 com "(avulsa)" — não vira erro.

**[NEEDS CLARIFICATION: Q6 — o desconto é percentual ou valor? por item ou no total? e incide
ANTES ou DEPOIS da comissão do marketplace? Cada combinação dá um número diferente e todas parecem
certas na tela — é a AC que põe a PR-E dentro do pricing-core.]**

*(Q7 validade texto-ou-estado · Q8 o que "Enviar" faz além de congelar — link público exige
`seguranca` · Q9 origem da não-monotonicidade · Q10 piso avisa-ou-bloqueia: todas registradas no
brief §10, todas bloqueantes da PR-E, todas vão ao clarify.)*

---

### User Story 7 — Simulações desktop + as divergências viram decisão ou guarda (Priority: P3 · PR-F · US19+US20 do brief)

Simulações ganha a composição ≥1280px da prancheta 20g (o mobile é o mesmo código, intocado — a
propriedade estrutural do 018). D1: teste que força os 3 textos de "Premium pausado" a mudarem
juntos (provado não-vacuoso por mutação). D2: as duas folhas de renomear passam a ler da MESMA
chave, com guarda. D3/D4: decisões de gosto — Q1/Q2 no clarify, não implementadas antes da
resposta. A11-r (densidade do Catálogo desktop) fecha aqui ou na PR-D com o `tf-table`, densidade
MEDIDA em itens visíveis sem rolar.

**Why this priority**: fecha a cobertura desktop; depende só da PR-A.

**Independent Test**: largura útil de Simulações medida a 1280/1440/1920 (antes/depois); zero
transbordo nos DOIS eixos nos 4 cortes; o teste do D1 fica vermelho quando UM só dos três textos
muda.

**Acceptance Scenarios**:

1. **Given** a tela de Simulações a 1920px, **When** medida, **Then** a composição é a da
   prancheta 20g e a largura útil ocupada supera a atual (número antes/depois registrado).
2. **Given** um agente futuro editando o texto de "Premium pausado" de Kits, **When** a suíte
   roda, **Then** o teste D1 fica vermelho apontando os outros dois textos.

> **Aviso ao plan (R8, não é escopo)**: o ADR-0031 cobre QUATRO abas; Simulações é a quinta.
> Emenda datada ou ADR novo — decisão do `arquiteto` no plan, nunca inferência na implementação.

---

### Edge Cases

- Formulário inerte + offline: nenhuma escrita do grátis pode entrar no outbox (classe A3 do
  hotfix — fila que o servidor recusaria depois).
- Dois aparelhos criam "Gancho" offline: o conflito de unicidade é resolvido SEM descartar escrita
  em silêncio (Q5/R6).
- Item degradado duplicado: a cópia continua degradada, sem inventar referência.
- Orçamento congelado ANTIGO com "canal" no payload: abre idêntico após a troca de vocabulário.
- Preço fixado ultrapassado pelo custo: aviso ATENÇÃO, nunca erro, nunca desfixa em silêncio
  (salvo resposta da Q4).
- Selo dispensado + fonte de tarifa mudou: reaparece (D3) — uma tabela que mudou não passa
  despercebida.
- Primeira visita ao Catálogo: sem "0 preços mudaram", sem "era R$ 0,00".
- Quantidade não-monótona ("10 un. sai mais barato que 9"): aviso descritivo, não recusa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-1901**: O DS DEVE ganhar os 8 primitivos do handoff §1, cada um com a medida que o
  justificou, classificados pela V0 (existe/local/não-existe); promoção apaga a cópia local na
  mesma fatia; `tf-phone-scroll`/`tf-price--rola` NÃO entram (US1).
- **FR-1902**: O produto DEVE ganhar o tom ATENÇÃO (`--warning-text` = `--tf-warning-deep` +
  `tf-alert--warning`), descritivo e nunca corretivo; nenhum aviso existente muda de tom sem
  estar listado (US2).
- **FR-1903**: Marca/foco: wordmark PNG real como guarda anti-regressão; TabBar 10px c/ respiro;
  anel 2px; anel do menu `--accent`; grafismos fora de 404/erro; asserção de foco GEOMÉTRICA (US3).
- **FR-1904**: Texto: acentos em `avisoAtacadoAcimaDoVarejo`; "1 ano" singular; nada mais muda de
  sentido (US4).
- **FR-1905**: "canal"→"marketplace" em todo texto visível incluindo PDF/CSV, pelas chaves de
  i18n; símbolos/chaves/rotas/arquivos intactos; payloads congelados intocados; testes de string
  atualizados como mudança revisada (US5, D2).
- **FR-1906**: Premium bloqueia SÓ no salvar: vazio didático (6 frases verbatim, D4) + formulário
  inerte (`tf-frozen`, campos vazios, "Salvar" desabilitado e visível, "Assinar Premium"
  secundário); vazios de Orçamentos/Simulações levam à calculadora; invariante um-teaser mantido
  (US6/US7, D7).
- **FR-1907**: O servidor CONTINUA recusando toda escrita do grátis (Constituição IV, ADR-0012
  byte-idêntico — diff vazio); nenhuma escrita do grátis entra no outbox; nada de no-op silencioso
  (FR-312) (US7).
- **FR-1908**: Lapsed-com-itens vê campos PREENCHIDOS inertes + "Reative o Premium… Seus itens
  estão salvos."; a distinção nunca-teve × teve-e-venceu é ESTRUTURAL, decidida pelo ledger (US8).
- **FR-1909**: Plausibilidade: blur, anunciada, "Entendi" por par campo+valor na sessão, erro não
  come a lição, dinheiro formatado, nunca bloqueia nem altera número (US9).
- **FR-1910**: Máquina: custo/hora readout com a divisão escrita, presente nos DOIS modos; zero
  ganha ressalva; troca de modo confirma antes de descartar; "Estimar"/"Ajustar"; FÓRMULA INTACTA
  (sem bump) (US10).
- **FR-1911**: Selo de procedência: denso (compact), dispensável, dispensa persiste e expira
  QUANDO a citação/data da fonte mudam (D3); nunca esconde número nem muda cálculo (US11).
- **FR-1912**: T212: resumo fixo com custo/preço visível durante a rolagem a 390px (exceção
  mobile autorizada); R$/kWh com 3+ casas chega íntegra ao motor; "0" reabre "0,00" (US12).
- **FR-1913**: Recálculo: contagem de preços mudados desde a última visita + "era R$ X" +
  "Salvo em DD/MM" (verbatim); preço exibido SEMPRE recomputado; sem histórico, nada é exibido
  (US13; Q3 decide onde o anterior mora).
- **FR-1914**: Fixar preço: "Preço fixado por você"/"Voltar a acompanhar o custo"; custo acima do
  fixado gera aviso ATENÇÃO; fixar não toca Orçamentos; desfixar volta ao recomputado (US14; Q4
  decide o que se fixa).
- **FR-1915**: Duplicar: "Gancho (cópia)", independente; nome repetido recusado ANTES de gravar
  ("Este nome já está no catálogo"); regra de unicidade é NOVA (não existe no schema — medido);
  cópia de degradado continua degradada (US15; Q5 decide escopo+offline).
- **FR-1916**: Construtor: N itens × quantidade, total pelo motor, degradado entra por D6/E3,
  nada congela antes de enviar (US16).
- **FR-1917**: Desconto (forma/incidência = Q6) com piso de custo ("Abaixo do custo"; bloqueia ou
  avisa = Q10); "Válido até" (texto ou estado = Q7); "Enviar congela este preço" via ADR-0019;
  "Voltar a acompanhar não vale para orçamentos enviados"; rodapé não-fiscal mantido (US17).
- **FR-1918**: Aviso de não-monotonicidade ("10 un. sai mais barato que 9"), descritivo, derivado
  da propriedade band-dominance já provada (origem = Q9) (US18).
- **FR-1919**: Simulações ≥1280px pela prancheta 20g; mobile intocado estruturalmente; geometria
  nos dois eixos (US19; ADR-0031 emendado ou novo — plan/R8).
- **FR-1920**: D1 teste de mudança conjunta (não-vacuoso por mutação); D2 chave única vigiada;
  D3/D4 só após Q1/Q2; A11-r fecha com `tf-table` e densidade medida (US20).

### Key Entities

- **Preço anterior / marca de última visita** (NOVA — forma decidida pela Q3): o contexto que
  permite "era R$ 38,90"; NUNCA fonte do preço exibido.
- **Fixação de preço** (NOVA — natureza decidida pela Q4): estado por item do catálogo; convive
  nomeadamente com as duas prateleiras existentes (congelado ADR-0019 / recalculado ADR-0021) —
  a Ressalva 4 do PO exige as três noções legíveis juntas.
- **Orçamento em montagem** (NOVA): N itens × quantidade + desconto + validade; vira snapshot
  imutável AO ENVIAR (mesma maquinaria E4); antes disso acompanha o preço de hoje.
- **Regra de unicidade de nome** (NOVA — escopo pela Q5): inclui resolução de conflito offline
  sem descarte silencioso.
- **Dispensa de selo** (NOVA): par (fonte da tarifa: citação+data) → dispensado; invalidada pela
  mudança da fonte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-1901**: A V0 classifica 100% dos itens do handoff §1/§3 em (a)/(b)/(c) com arquivo:linha ou
  screenshot, ANTES da PR-A — e é ela que dimensiona a fatia.
- **SC-1902**: Contrastes do `tf-frozen` medidos ≥5,67:1 (dica) e ≥18,23:1 (rótulo) nos dois
  temas; `tf-plist` mostra ≥9 itens a 390px (hoje 4), contados na imagem.
- **SC-1903**: Após a PR-B, diff em `app/entitlement/` = VAZIO; escrita do grátis recusada pelo
  backend real; outbox com 0 itens; as 6 frases byte-idênticas à prancheta.
- **SC-1904**: Zero ocorrência de "canal/canais" em superfície legível pós-PR-A (UI + exports);
  100% dos símbolos `channel*` preservados; orçamentos congelados antigos abrem idênticos.
- **SC-1905**: Tarifa R$/kWh de 3+ casas produz custo de energia numericamente igual ao valor não
  truncado (a correção é de RESULTADO, provada por igualdade).
- **SC-1906**: Um orçamento multi-item soma pelo motor com igualdade exata item a item; o enviado
  resiste a UPDATE (trigger); o PDF com nome adversarial não colide colunas (geometria na página).
- **SC-1907**: Zero transbordo nos dois eixos em 360/1280/1440/1920px em toda tela tocada;
  screenshots 1:1 nos dois temas; suíte mobile existente verde sem alteração (fora T212).
- **SC-1908**: Testes-guarda D1 e D2 ficam vermelhos sob mutação de um único texto/chave.
- **SC-1909**: Cada fatia entra em CORREÇÃO DECLARADA com evidência visual completa pronta para a
  segunda passada (D5) — nenhuma fecha antes de a Rodada 1 fechar.

## Assumptions

- Sem usuário pagante nem dado em produção (deploy adiado até v1): migrações de schema, se a Q3/Q4
  as trouxerem, não precisam de plano de migração com cliente em cima.
- As pranchetas remotas (projeto `a90ed7d4`) permanecem acessíveis via DesignSync para transcrição
  de copy por fatia; o handoff versionado é o contrato quando divergirem.
- O 017 segue em paralelo em `017-pr-b-precos`; o 019 não toca `packages/fee-ingest` nem tarifas
  (`catalogVersion` intocado).
- A PR-E pode sair do 019 e virar 020 se escorregar (Ressalva 5 do PO — a saída fica disponível
  até ela começar); isso não é decisão tomada, é rota de fuga registrada.
- Escalações opus (ADR-0022): PR-D condicional a Q3/Q4; PR-E provável (Q6). Registradas no ledger
  por operação.

## Fora de escopo

Ver brief §6 (11 itens) — em especial: ML/canal inteiro (US15 do 016, "não iniciar num
'continue'"), ingestão mensal (=017), frete real, perfil do vendedor, homologação premium,
renomear símbolos por causa do vocabulário, redesenho mobile além da T212, mudança de fórmula na
PR-C, e os 605 pontos de revisão de conteúdo (correm em paralelo, do dono).
