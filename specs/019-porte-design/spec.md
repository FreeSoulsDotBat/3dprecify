# Feature Specification: 019 — O porte do design (157 superfícies) + as features que o dono incluiu

**Feature Branch**: `019-porte-design`

**Created**: 2026-08-26

**Status**: Draft — clarify 2026-08-26 concluído (5/5: Q3, Q4, Q5, Q6, Q8); Q1/Q2 (gosto) e Q7/Q9/Q10 (defaults do brief) deferidas ao plan

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

## Clarifications

### Session 2026-08-26

- Q: Onde mora o "preço anterior" e a marca de "última visita" do recálculo do Catálogo (Q3 do brief)? → A: **B — no servidor.** Nasce a primeira tabela com preço guardado (observação de preço por produto, com data); a frase "desde a sua última visita" vale em qualquer aparelho. Consequências assumidas pelo dono: migração de schema na PR-D, escalação opus (ADR-0022), e Clarification datada na spec 007 (FR-310/FR-313 passam a admitir preço OBSERVADO, nunca preço-fonte).
- Q: "Preço fixado por você" fixa o quê, e o que acontece quando o custo ultrapassa o fixado (Q4 do brief)? → A: **A — fixa o NÚMERO FINAL** (o preço do anúncio, literal, guardado no produto como leaf de dinheiro → revisão opus). Custo acima do fixado gera **aviso em tom ATENÇÃO** e NÃO mexe no preço nem desfixa sozinho — a decisão continua do vendedor; desfixar volta ao recomputado de hoje.
- Q: Unicidade de nome — escopo, sensibilidade e o conflito offline entre dois aparelhos (Q5 do brief)? → A: **A, sem aviso**: por conta + por tipo (filamento vs. produto podem coincidir), comparação IGNORANDO maiúsculas e acentos; conflito offline → o servidor **aceita e renomeia** a segunda ("Gancho (2)") **silenciosamente** — nada é descartado, a fila drena, e o nome renomeado simplesmente aparece na lista.
- Q: Desconto do construtor "Montar e Enviar" — forma, incidência e ordem em relação à comissão (Q6 do brief)? → A: **A — venda direta ao cliente**: o desconto (percentual OU valor em R$) incide **no total**, sobre o preço de venda direta (custo + markup); o marketplace fica FORA da conta do construtor (quem vende via marketplace usa Calculadora/Simulações); o piso de custo compara o total descontado com o custo somado dos itens × quantidades.
- Q: O que "Enviar" faz além de congelar o preço (Q8 do brief)? → A: **A — congela + gera o PDF**; o vendedor manda por fora (WhatsApp/e-mail), como já faz com os Orçamentos. Zero superfície pública nova (sem link/e-mail pelo app); reaproveita o export do E4 (ADR-0020) com o rodapé não-fiscal.
- Q (pós-arquiteto, 2026-08-27): a folha do design registra a decisão do dono de 25/08 de REMOVER todo indicador de foco, contradizendo a FR-1903 (anel 2px). Qual vale? → A: **Remover, como decidido em 25/08.** Nenhum controle mostra indicador de foco (campos mantêm só a borda de acento). Consequência aceita pelo dono e registrada aqui como EXCEÇÃO explícita de produto: WCAG 2.4.7 (nível A) deixa de ser atendido — quem navega por teclado perde a referência de posição. A asserção geométrica de foco do 018 é substituída por uma guarda do INVERSO (nenhum anel renderizado em :focus-visible).
- Q (pós-arquiteto, 2026-08-27): a Q6 (venda direta, marketplace fora) torna o total do construtor monotônico por construção — o aviso "10 un. sai mais barato que 9" (US18) nunca dispararia. → A: **Retirar a US18 do construtor.** Registrada como "não aplicável à venda direta"; a propriedade band-dominance continua provada no motor para o preço de anúncio (marketplace), onde ela vive.
- Q (Q1/D3, 2026-08-27): vazio de busca — Catálogo não cita o termo; Orçamentos/Simulações citam. → A: **Uniformizar: todas citam o termo.** O Catálogo passa a dizer o termo buscado, no molde já existente dos outros dois.
- Q (Q2/D4, 2026-08-27): ressalva "pode estar desatualizada" na leitura offline do Catálogo. → A: **Só a faixa no topo** — as linhas ficam limpas; a lista não mistura origens.
- Q (E-5, 2026-08-27): o visitante DESLOGADO no lote 32. → A: **o mesmo caminho sem parede, com "Assinar Premium" visível para todos** — logado ou não. A diferença é no CLIQUE: logado → vai pagar (checkout); deslogado → é **promptado a criar conta ou entrar**, e depois segue para pagar (a intenção é preservada). **Esse fluxo não está prototipado** → prompt gerado para o Claude Design (`docs/design/prompts/019-lote32h-deslogado.md`); a copy do prompt/tela de entrada-com-intenção é transcrita da prancheta quando ela existir.
- Q (contraste do tom ATENÇÃO, 2026-08-27): se o laranja profundo reprovar o AA como TEXTO no claro → A: **escurecer só o texto até passar**; ícone, badge e botões continuam no laranja da marca.
- Q (Q7/Q10, 2026-08-27): → A: **confirmadas** — "Válido até" é texto no documento (não vence); abaixo do custo AVISA, não bloqueia.
- Q (ordem das fatias após a PR-A, 2026-08-27): → A: **B → C → D → F → E**.

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
12→10px com 7px de respiro, **remoção de todo indicador de foco** (decisão do dono 25/08 — exceção ao WCAG 2.4.7, registrada), grafismos fora de
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

**Q3 decidida (B, servidor)**: o preço anterior e a marca de última visita moram no servidor, como OBSERVAÇÃO de preço (valor + data) por produto e por conta — nunca como fonte do preço exibido. A PR-D carrega migração e escalação opus.

**Q4 decidida (A)**: fixa o NÚMERO FINAL (preço do anúncio), guardado no produto; ultrapassado pelo custo, só AVISA (ATENÇÃO) — nunca desfixa sozinho.

**Q5 decidida (A, sem aviso)**: unicidade por conta + tipo, insensível a maiúscula/acento; conflito offline → aceita e renomeia "Gancho (2)" sem aviso — nada descartado (R6 respeitado).

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

**Q6 decidida (A)**: desconto % ou R$, no TOTAL, sobre o preço de venda direta; marketplace fora do construtor; piso = custo somado (itens × quantidades). Entra no pricing-core como regra de total com desconto e piso (escalação opus mantida).

**Q8 decidida (A)**: "Enviar" = congelar (ADR-0019) + gerar o PDF (export do E4, rodapé
não-fiscal); a entrega é por fora — sem link público nem e-mail pelo app (zero superfície nova).

*(Q7 validade texto-ou-estado · Q9 origem da não-monotonicidade · Q10 piso avisa-ou-bloqueia:
DEFERIDAS ao plan com os defaults do brief — Q7 = texto no documento; Q9 = derivado das faixas
progressivas (band-dominance já provada); Q10 = avisa, não bloqueia — salvo objeção do dono.)*

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
- Dois aparelhos criam "Gancho" offline: o segundo vira "Gancho (2)" na sincronização — sem descarte, sem aviso (Q5).
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
- **FR-1903**: Marca/foco: wordmark PNG real como guarda anti-regressão; TabBar 10px c/ respiro; **SEM indicador de foco em nenhum controle** (decisão do dono 25/08, reafirmada 27/08 — exceção explícita ao WCAG 2.4.7; campos mantêm só a borda de acento); grafismos fora de 404/erro; guarda geométrica do INVERSO (zero anel em :focus-visible) (US3).
- **FR-1904**: Texto: acentos em `avisoAtacadoAcimaDoVarejo`; "1 ano" singular; nada mais muda de
  sentido (US4).
- **FR-1905**: "canal"→"marketplace" em todo texto visível incluindo PDF/CSV, pelas chaves de
  i18n; símbolos/chaves/rotas/arquivos intactos; payloads congelados intocados; testes de string
  atualizados como mudança revisada (US5, D2).
- **FR-1906**: Premium bloqueia SÓ no salvar — **para logado sem Premium E para deslogado** (E-5): o mesmo vazio didático + formulário inerte; "Assinar Premium" visível nos dois casos; no clique, logado → checkout, deslogado → criar conta/entrar com intenção preservada → checkout: vazio didático (6 frases verbatim, D4) + formulário
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
  (US13; **Q3 = servidor**: observação de preço por produto/conta, com data — migração + opus + Clarification na 007).
- **FR-1914**: Fixar preço: "Preço fixado por você"/"Voltar a acompanhar o custo"; custo acima do
  fixado gera aviso ATENÇÃO; fixar não toca Orçamentos; desfixar volta ao recomputado (US14; **Q4 = número final**, leaf de dinheiro em products → opus; nunca desfixa sozinho). **Regra do arquiteto (27/08)**: o preço fixado NÃO entra em kit, orçamento congelado nem simulação — ele embute uma decisão de venda direta que a comissão do marketplace não reconhece; essas superfícies continuam lendo o recomputado.
- **FR-1915**: Duplicar: "Gancho (cópia)", independente; nome repetido recusado ANTES de gravar
  ("Este nome já está no catálogo"); regra de unicidade é NOVA (não existe no schema — medido);
  cópia de degradado continua degradada (US15; **Q5**: por conta+tipo, case/acento-insensível; conflito → aceita e renomeia "(2)" sem aviso). **Achado do arquiteto (27/08)**: o Catálogo é online-only (sem outbox), então o "conflito offline entre dois aparelhos" não é alcançável — a regra vira um teste de CORRIDA no servidor (duas criações simultâneas do mesmo nome), com o mesmo desfecho: a segunda vira "(2)".
- **FR-1916**: Construtor: N itens × quantidade, total pelo motor, degradado entra por D6/E3,
  nada congela antes de enviar (US16).
- **FR-1917**: Desconto (**Q6 = % ou R$, no total, sobre venda direta; sem comissão de marketplace no construtor**) com piso de custo ("Abaixo do custo"; bloqueia ou
  avisa = Q10); "Válido até" (texto ou estado = Q7); "Enviar congela este preço" via ADR-0019 **e gera o PDF (Q8 = A; sem link/e-mail pelo app)**;
  "Voltar a acompanhar não vale para orçamentos enviados"; rodapé não-fiscal mantido (US17).
- **FR-1918**: ~~Aviso de não-monotonicidade ("10 un. sai mais barato que 9")~~ — **RETIRADA (2026-08-27)**: não aplicável à venda direta (Q6 torna o total monotônico); a propriedade band-dominance segue provada no motor para o preço de anúncio. A copy da prancheta fica como registro, não como requisito (US18).
- **FR-1919**: Simulações ≥1280px pela prancheta 20g; mobile intocado estruturalmente; geometria
  nos dois eixos (US19; ADR-0031 emendado ou novo — plan/R8).
- **FR-1920**: D1 teste de mudança conjunta (não-vacuoso por mutação); D2 chave única vigiada;
  **D3 = todas as buscas citam o termo (Q1)**; **D4 = só a faixa no topo, sem ressalva por linha (Q2)**; A11-r fecha com `tf-table` e densidade medida (US20).

### Key Entities

- **Observação de preço** (NOVA — Q3 = servidor): por produto e por conta, o último valor recomputado que o vendedor VIU e a data ("Salvo em 12/05"); permite "era R$ 38,90" e a contagem de mudados; NUNCA fonte do preço exibido — o preço continua recomputado ao vivo, e uma observação ausente significa "nada a dizer", não "R$ 0,00".
- **Fixação de preço** (NOVA — Q4 = número final): o preço do anúncio guardado no produto como valor monetário + o estado "fixado"; o custo continua recomputado ao lado para o aviso de prejuízo; convive
  nomeadamente com as duas prateleiras existentes (congelado ADR-0019 / recalculado ADR-0021) —
  a Ressalva 4 do PO exige as três noções legíveis juntas.
- **Orçamento em montagem** (NOVA): N itens × quantidade (preço de VENDA DIRETA por item) + desconto no total (% ou R$) + validade; custo somado como piso; vira snapshot
  imutável AO ENVIAR (mesma maquinaria E4); antes disso acompanha o preço de hoje.
- **Regra de unicidade de nome** (NOVA — Q5): por conta + tipo, comparação normalizada (sem maiúscula/acento); no formulário online recusa antes de gravar; no conflito de sincronização o servidor renomeia com sufixo "(2)", "(3)"… sem descartar e sem avisar.
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

- Sem usuário pagante nem dado em produção (deploy adiado até v1): a migração da PR-D (observação de preço, Q3=B) não precisa de plano de migração com cliente em cima.
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
