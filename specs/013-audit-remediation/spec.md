# Feature Specification: Remediação da Auditoria Adversarial 2026-07-23

**Feature Branch**: `013-audit-remediation`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Remediação da auditoria adversarial 2026-07-23 — corrigir os achados de AUDITORIA.md conforme as ondas 1/3/4/5/6 do PLANO-CORRECAO.md (Onda 2 pertence ao épico 012-e6; Onda 7 é backlog com gatilhos próprios)."

**Fontes normativas**: `AUDITORIA.md` (81 achados, evidência arquivo:linha) e `PLANO-CORRECAO.md` (issues C-01..C-23, gates D1–D6) na raiz do repo. Os IDs de achado (FA-01, F-02, FB-02, …) e de issue (C-nn) citados abaixo referem-se a esses documentos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nenhum preço silenciosamente errado por entrada numérica (Priority: P1)

Como vendedor, quando digito ou colo um valor numérico em QUALQUER campo do app (calculadora, cadastro de filamento/impressora/produto), ou o valor é interpretado exatamente como eu pretendia, ou recebo um erro de campo imediato — nunca um número diferente aceito em silêncio. Como vendedor que edita uma taxa de um canal Shopee pré-preenchido pelo catálogo, os custos estruturais do canal (faixas de comissão, voucher de frete) continuam valendo — editar um campo não apaga os demais por baixo dos panos.

**Why this priority**: cobre os achados FA-01/FB-01 (Alto — "0.12"→12 na calculadora; "1500.00"→150000 GRAVADO no catálogo, contaminando todo preço futuro) e E1-02 (Médio — override parcial derruba voucher/bands e superestima o recebido líquido). É a classe de defeito mais grave do relatório: dinheiro errado sem sinal.

**Independent Test**: digitar o conjunto adversarial da auditoria (`0.12`, `1500.00`, `1.500,00`, `1,234,56`, `10-5`, `5x3`, `R$ 1,50`) em campos da calculadora e do catálogo; editar 1 campo de um slot Shopee coberto e conferir que voucher/faixas seguem no cálculo.

**Acceptance Scenarios**:

1. **Given** o campo de potência (kW) da calculadora, **When** digito `0.12`, **Then** ou o valor é interpretado como 0,12 (caso não-ambíguo documentado) ou recebo erro de campo — nunca 12.
2. **Given** o cadastro de filamento, **When** colo `1500.00` no custo do rolo e salvo, **Then** nunca é persistido 150000; entrada ambígua produz erro inline antes do salvar.
3. **Given** valores malformados (`1,234,56`, `10-5`, `5x3`), **When** submetidos em qualquer campo numérico, **Then** produzem erro de campo — nunca um número parcial aceito (achado FA-02).
4. **Given** um slot Shopee pré-preenchido pelo catálogo, **When** edito apenas a comissão, **Then** o selo vira "ajustado por você" E as faixas de preço + voucher co-financiado continuam aplicados ao cálculo (achado E1-02).
5. **Given** um campo com erro de validação visível, **When** um pré-fill programático (catálogo/cenário) o substitui por valor válido, **Then** a mensagem de erro some junto (achado FA-03).

---

### User Story 2 - Todo link do app abre — refresh, favorito e link compartilhado nunca dão tela branca (Priority: P1)

Como vendedor, posso atualizar a página (F5), guardar um favorito ou compartilhar o link de um orçamento do histórico ou de um produto do catálogo, e a tela abre normalmente.

**Why this priority**: achado F-02 (Alto) — 3 rotas de produção quebram em acesso direto pela armadilha `base:'./'` medida pelo próprio projeto; hoje nenhum teste pega porque a navegação direta é deliberadamente evitada nos e2e.

**Independent Test**: navegação automatizada DIRETA (não client-side) a cada rota interna do app, incluindo as que hoje quebram.

**Acceptance Scenarios**:

1. **Given** um snapshot salvo no histórico, **When** abro sua URL diretamente (cold-load), **Then** a página de detalhe renderiza com o conteúdo.
2. **Given** um produto do catálogo, **When** dou F5 na tela de edição ou abro por favorito, **Then** a tela renderiza — nunca em branco.
3. **Given** URLs no formato antigo já compartilhadas, **When** acessadas após a mudança, **Then** o usuário chega ao destino (redirecionamento), não a um erro. (Decisão D1=A — ver Clarifications.)

---

### User Story 3 - Assinante com Premium pausado vê um catálogo honesto, somente-leitura, com caminho de volta (Priority: P1)

Como assinante cujo Premium lapsou, ao abrir o Catálogo vejo um aviso calmo de "Premium pausado", consigo LER tudo que é meu, os formulários aparecem em modo somente-leitura com um convite claro de reativação — e nunca preencho um formulário inteiro para só então descobrir, numa mensagem genérica de quem nunca assinou, que não posso salvar.

**Why this priority**: achado FB-02 (Alto) — a ux-spec do E2 (ux-catalog §3) exige esse comportamento, as strings já existem órfãs no i18n, e o mesmo padrão já está corretamente implementado em Cenários e Kits; só o Catálogo ficou sem.

**Independent Test**: com uma conta em estado lapsed, abrir Catálogo e cada formulário (filamento/impressora/produto) e verificar banner + campos desabilitados + linha de reativação; verificar que a leitura continua integral (FR-409 do E2 intacto).

**Acceptance Scenarios**:

1. **Given** conta lapsed, **When** abro o Catálogo, **Then** vejo o banner "Premium pausado" e minhas listas completas — nada some.
2. **Given** conta lapsed, **When** toco numa linha de filamento, **Then** o formulário abre com campos desabilitados e uma linha de reativação no rodapé — distinto visualmente do estado de quem nunca assinou.
3. **Given** conta lapsed, **When** o Premium é reativado, **Then** os formulários voltam a ser editáveis sem re-login.

---

### User Story 4 - Fronteiras de validação consistentes: entrada absurda sempre vira erro claro (Priority: P2)

Como vendedor (ou integrador chamando a API), qualquer valor fora dos limites — em qualquer campo de qualquer área do produto — devolve um erro de validação claro e específico, nunca uma falha genérica do sistema; e a mesma regra vale igual em todas as áreas (a regra de limite do catálogo é a mesma dos kits, do histórico e dos cenários).

**Why this priority**: achados E3-01 (500 alcançável por input em kits), E3-02, E4-01, Q-03/Q-04 (validadores financeiros copiados 5× já divergiram; comentário "verbatim" falso), FB-05/FB-03 (front sem os limites/validações que o servidor tem). É a correção estrutural do risco sistêmico nº 2 da auditoria.

**Independent Test**: submeter valores acima dos tetos em todos os campos numéricos de todas as APIs e formulários; nenhum produz falha genérica; a tabela de limites vive num único lugar por camada.

**Acceptance Scenarios**:

1. **Given** uma linha ad-hoc nova de kit, **When** envio tarifa de energia ≥ o teto, **Then** recebo o mesmo erro de validação específico que o cadastro de produto dá — nunca uma falha interna (achado E3-01).
2. **Given** qualquer quantidade/valor absurdo (ex.: quantity acima do limite do banco), **When** submetido, **Then** erro de validação claro (achado E3-02).
3. **Given** o formulário do catálogo, **When** digito valor acima do teto, **Then** erro inline específico no campo — não um erro genérico só depois do submit (achado FB-05).
4. **Given** o rename de um cenário, **When** a nota excede 500 caracteres, **Then** vejo a mesma mensagem específica que o fluxo de criação mostra (achado FB-03).
5. **Given** um kit sem nenhuma linha, **When** enviado direto à API, **Then** é rejeitado com erro de validação (default D4 — ver Assumptions).

---

### User Story 5 - Regressões nos controles de privacidade e de migração não passam despercebidas (Priority: P2)

Como dono do produto, confio que se alguém quebrar o isolamento entre contas no mesmo dispositivo, a reversibilidade das migrações de banco, ou criar migrações conflitantes, a esteira acusa antes do merge.

**Why this priority**: achados T-02 (o purge de privacidade está correto no código mas a suíte passaria verde com ele removido), T-01 (nenhum downgrade jamais exercitado), P-03 (heads múltiplos de migração passam por todos os gates), E5-04 e T-07. É o risco sistêmico nº 4: "o código implementa, o teste não verifica".

**Independent Test**: aplicar as mutações citadas na auditoria (remover as linhas de purge; inverter a condição de troca de usuário; inverter a ordem de drops de um downgrade; criar um segundo head) e confirmar que a esteira falha em cada uma.

**Acceptance Scenarios**:

1. **Given** a suíte estendida, **When** o purge de qualquer cache de conta é removido ou a condição de troca de usuário é invertida, **Then** a suíte falha (achado T-02).
2. **Given** o teste de round-trip de migrações, **When** um downgrade fica quebrado (ordem de remoção errada, objeto esquecido), **Then** o teste falha (achado T-01).
3. **Given** duas migrações com o mesmo antecessor, **When** o gate roda, **Then** acusa o conflito antes do merge (achado P-03).
4. **Given** o piso de cobertura do front, **When** um caminho novo sem teste é adicionado ao transporte HTTP ou ao mapa de erros, **Then** o piso o conta — esses módulos deixam de estar excluídos (achado T-07).

---

### User Story 6 - Lote de correções pontuais de honestidade e consistência (Priority: P3)

Como vendedor, pequenas mentiras e inconsistências catalogadas pela auditoria desaparecem: o "último valor conhecido" de um cenário baseado em kit é atualizado a cada salvamento (como o de produto já é); a cópia de um cenário com nome longo ganha reticências como decidido; um produto vinculado não pisca "Manual · Manual" no carregamento; o cache do catálogo de taxas nunca prefere uma versão mais antiga; e a superfície técnica desnecessária (CORS irrestrito, ícones mortos, strings fora do i18n, arquivo órfão) é limpa.

**Why this priority**: achados E5-01 (Médio — bomba-relógio para a criação KIT-basis futura), E5-02, FB-04, E1-03, E1-05, E1-06, E2-03, E4-02, E4-05, F-04 (Médio — CORS), FC-01, FC-02, P-02. São correções pequenas, independentes, agrupáveis em 2–3 lotes.

**Independent Test**: cada item tem o teste da auditoria como aceite (ex.: salvar cenário KIT-basis via API e conferir lastKnown atualizado; duplicar cenário com nome de 120+ caracteres e ver "…").

**Acceptance Scenarios**:

1. **Given** um cenário base-KIT existente, **When** salvo de novo com o kit vivo alterado, **Then** o "último conhecido" armazenado reflete o kit atual (achado E5-01) — e os comentários que atribuíam isso a outro mecanismo são corrigidos.
2. **Given** um cenário com nome de 118 caracteres, **When** duplico, **Then** o nome da cópia trunca a base com reticências e cabe no limite (achado E5-02).
3. **Given** o Catálogo carregando do zero, **When** a lista de produtos renderiza antes das referências, **Then** vejo um placeholder neutro — nunca "Manual · Manual" num produto vinculado (achado FB-04).
4. **Given** as origens permitidas do backend, **When** a API responde a CORS, **Then** apenas os métodos e cabeçalhos realmente usados são aceitos, e a decisão fica registrada (achado F-04).

---

### User Story 7 - Os documentos de fechamento dizem a verdade (Priority: P3)

Como dono do produto, quando leio um documento de fechamento (dod-evidence), a Constituição, o ground do CLAUDE.md ou uma spec viva, o que está escrito corresponde ao que o código faz — as 12 divergências documentais catalogadas são reconciliadas num único passe, cada uma com sua Clarification datada onde couber.

**Why this priority**: achados E2-02 (Médio — dod-evidence reivindica "RLS backstop" inexistente, violação do Truth Over Approval), FA-04 (spec 005 promete comportamento que o produto não tem), F-01, F-03, E1-07, E4-03/04, M-01, P-01, P-04, E2-04, E2-05 — o risco sistêmico nº 1. Nenhuma mudança de comportamento neste passe.

**Independent Test**: cada claim corrigida é verificável por inspeção (grep) contra o código; o PR é docs-only.

**Acceptance Scenarios**:

1. **Given** o dod-evidence do E2, **When** lido após o passe, **Then** não reivindica mais camadas de segurança que não existem (achado E2-02).
2. **Given** a spec 005, **When** lida após o passe, **Then** o comportamento do toggle de marketplaces tem Clarification datada apontando a decisão real (D2=A — ver Clarifications).
3. **Given** a Constituição, **When** lida, **Then** descreve o scrum-master como advisor, consistente com ADR-0001 e com o próprio agente (achado F-01).

---

### Edge Cases

- Entrada numérica no limite da ambiguidade: `1.500` (milhar pt-BR válido) vs `1.50` (decimal en-US) vs `1.5` — a gramática aceita/rejeita cada um de forma documentada e testada (US1).
- URLs antigas de 2+ segmentos já salvas em favoritos de usuários após a migração de rotas (US2).
- Conta que transita lapsed→active com o formulário somente-leitura aberto (US3).
- Payload profundamente aninhado ou acima do limite de tamanho chegando à validação recursiva — rejeitado cedo, nunca falha interna (achado E4-02, US4).
- Troca direta de usuário A→B no mesmo dispositivo sem passar pelo estado deslogado — todos os caches de A varridos (branch `uidChanged`, US5).
- Cenário base-KIT criado via API antes desta correção (lastKnown congelado do primeiro save) — o próximo save o atualiza (US6).

---

### User Story 8 - Pré-preenchimento de taxas para Mercado Livre e Amazon (Priority: P2)

Como vendedor, ao escolher Mercado Livre ou Amazon num canal de venda, as taxas de referência vêm pré-preenchidas do catálogo (com selo de referência e data de vigência), como já acontece com a Shopee — em vez do estado "sem referência" e digitação manual.

**Why this priority**: decisão D3=B do dono (2026-07-23) — fecha o achado E1-01 e torna SC-101/SC-112 da spec 005 finalmente atingíveis pelo produto shipado. P2 porque depende de curadoria de fatos financeiros de terceiros com validação do dono, que não deve atrasar os P1.

**Independent Test**: selecionar ML e Amazon num slot de marketplace e conferir pré-fill com selo de referência; conferir fonte oficial e data de vigência registradas em cada entrada curada.

**Acceptance Scenarios**:

1. **Given** o catálogo curado, **When** seleciono Mercado Livre num canal, **Then** as taxas pré-preenchem com selo "referência" e data de vigência — não "sem referência".
2. **Given** Amazon selecionada, **When** o preço de anúncio é baixo, **Then** o piso de R$ 1 por item aplica vindo do catálogo (SC-112 da spec 005).
3. **Given** as entradas curadas, **Then** cada uma registra fonte oficial (sourceUrl) e data de vigência, e os VALORES foram validados explicitamente pelo dono antes do merge.

## Clarifications

### Sessão 2026-07-23 (gates D1–D6 do PLANO-CORRECAO.md §1, respondidos pelo dono)

- **D1 (deep-links)** → **A**: as 3 rotas migram para 1 segmento + query param (padrão `/kits?id=` já existente), com redirect das URLs antigas por ≥1 release; `base:'./'` permanece — qualquer mudança de base futura é ADR próprio, fora deste escopo.
- **D2 (SC-105/toggle)** → **A**: o show/hide atual fica oficializado por Clarification datada na spec 005 (docs-only, entra no passe FR-014); nada de mudança de UI.
- **D3 (ML/Amazon)** → **B**: as entradas de Mercado Livre e Amazon são CURADAS nesta feature (não deferidas) — vira a User Story 8 e o FR-015.
- **D4/D5/D6**: defaults recomendados pela auditoria adotados sem objeção (kit vazio rejeitado no servidor; autoUpdate silencioso registrado como decisão; premissa single-tab declarada) — ver Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (C-01): O parser numérico pt-BR compartilhado MUST validar o formato antes de converter — aceitando dígitos puros, pt-BR estrito (milhar com ponto + decimal com vírgula) e o caso decimal não-ambíguo documentado — e MUST rejeitar com erro de campo qualquer resíduo ou ambiguidade, em TODAS as superfícies que o consomem (calculadora e catálogo). Cobre FA-01/FB-01/FA-02/FA-06.
- **FR-002** (C-01): As conversões wire↔exibição hoje triplicadas MUST convergir para o módulo único, com teste que trava a premissa de formato do wire. Cobre FA-05/Q-02; a unificação do display (Q-01) é desejável no mesmo passe.
- **FR-003** (C-02, decisão D1=A): Nenhuma URL interna do app MAY quebrar em acesso direto (cold-load/refresh/bookmark); as 3 rotas afetadas MUST migrar para 1 segmento + query param (padrão `/kits` já existente), com redirecionamento das URLs antigas por pelo menos 1 release. O `base` relativo permanece intocado.
- **FR-004** (C-03): O Catálogo MUST apresentar, para conta lapsed: banner "Premium pausado", formulários somente-leitura e convite de reativação — reaproveitando as strings já existentes, adicionando a cópia de reativação faltante, e mantendo a leitura integral. Cobre FB-02.
- **FR-005** (C-06): As regras de limite/finitude dos campos financeiros do backend MUST viver numa única fonte (um módulo, uma tabela de tetos), consumida por todos os routers; nenhuma entrada fora de limites MAY produzir falha genérica (a classe "422 nunca 500" da auditoria). Cobre Q-03/Q-04/E3-01/E3-02/E4-01; o comentário "verbatim" falso MUST ser corrigido.
- **FR-006** (C-07): O front MUST espelhar os limites do servidor com erro inline específico (catálogo) e a validação de nota no rename de cenário MUST igualar a do fluxo de criação. Cobre FB-05/FB-03.
- **FR-007** (C-08): A suíte MUST falhar se qualquer purge de dados de conta na troca/saída de usuário for removido ou se a condição de troca direta de usuário for invertida — as mutações nomeadas na auditoria são o critério. Cobre T-02.
- **FR-008** (C-09): A esteira MUST exercitar o round-trip completo de migrações (aplicar → reverter tudo → reaplicar) e MUST acusar migrações com antecessor duplicado (heads múltiplos) antes do merge. Cobre T-01/P-03.
- **FR-009** (C-10): O piso de cobertura MUST contar os módulos hand-written hoje excluídos por engano, e o caminho "linha degradada dentro de kit vivo" MUST ganhar teste fim-a-fim pela API de cenários. Cobre T-07/E5-04; o truncate autouse (T-06) é desejável, não obrigatório.
- **FR-010** (C-14): Editar um campo de um slot de marketplace coberto pelo catálogo MUST preservar as estruturas não editadas (faixas de preço, voucher) no cálculo, com teste no seam. Cobre E1-02.
- **FR-011** (C-11): Lote backend: o re-snapshot do "último conhecido" MUST cobrir base KIT em todo save (e os 2 comentários enganosos corrigidos); a duplicata de cenário MUST truncar com reticências conforme a decisão F5 do dono; a leitura auxiliar de referências MUST filtrar por dono; a validação recursiva de payload MUST aplicar o limite de tamanho antes da varredura; filtros de data MUST exigir timezone explícito. Cobre E5-01/E5-02/E2-03/E4-02/E4-05.
- **FR-012** (C-12): Lote front: pré-fills programáticos MUST revalidar os campos que preenchem; a lista de produtos MUST mostrar placeholder neutro durante o carregamento das referências; a seleção de versão do catálogo de taxas MUST comparar por data+número (não texto); o seed embarcado MUST passar pela mesma validação do catálogo servido; os 10 ícones sem uso e as 3 strings fora do i18n MUST ser removidos/movidos. Cobre FA-03 (implementado em US1)/FB-04/E1-03/E1-06/FC-01/FC-02 (+E1-05 desejável).
- **FR-013** (C-13): O CORS do backend MUST restringir métodos e cabeçalhos ao conjunto usado pelo app, com a decisão registrada; o arquivo órfão `.config/rtk/filters.toml` MUST ser removido ou ignorado. Cobre F-04/P-02.
- **FR-014** (C-15): O passe documental MUST reconciliar as 12 divergências catalogadas (dod-evidence 007 e 011, spec 005, Constituição, docstring de auth, SC-109, data-model 009, ground do CLAUDE.md, decisions-backlog §9, comentário de rota, nota do ADR-0012), cada uma verificável por inspeção, sem nenhuma mudança de comportamento. Cobre E2-02/FA-04/F-01/F-03/E1-07/E4-03/E4-04/M-01/P-01/P-04/E2-04/E2-05. Inclui as Clarifications de deferimento decididas em D2/D3.
- **FR-015** (decisão D3=B, dono 2026-07-23): O catálogo de taxas MUST ganhar entradas curadas para Mercado Livre e Amazon — cada uma com fonte oficial (sourceUrl) e data de vigência (effectiveDate), incluindo o piso por item da Amazon (R$ 1) que o motor já suporta; o seed embarcado MUST espelhar o catálogo servido (a paridade seed==catálogo permanece guardada); os VALORES são fatos financeiros de terceiros e MUST passar por validação explícita do dono antes do merge. Cobre E1-01; SC-101/SC-112 da spec 005 tornam-se atingíveis pelo produto shipado. (User Story 8.)
- **FR-016** (decisão D2=A, dono 2026-07-23): O comportamento atual do toggle de marketplaces (show/hide) fica oficializado — a spec 005 MUST receber Clarification datada em FR-113/SC-105 apontando a decisão real; item do passe documental FR-014, sem mudança de comportamento. Cobre FA-04.
- **FR-017**: Toda correção deste escopo MUST manter as regressões existentes verdes (o gate completo da casa) e MUST usar a entrada adversarial/mutação citada no achado correspondente como teste de aceite.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% do conjunto de entradas adversariais da auditoria (`0.12`, `1500.00`, `1.500,00`, `1,234,56`, `10-5`, `5x3`, `R$ 1,50`) resulta em valor correto ou erro visível de campo — zero valores errados aceitos em silêncio, nas duas superfícies.
- **SC-002**: 100% das rotas internas do app renderizam em navegação direta automatizada (a classe de teste hoje evitada passa a existir e a passar); URLs antigas redirecionam.
- **SC-003**: Uma conta lapsed não consegue, em nenhuma superfície do Catálogo, preencher um formulário editável — e encontra o convite de reativação em todas; a leitura permanece 100% disponível.
- **SC-004**: Zero falhas genéricas (erro interno) alcançáveis por entrada de usuário fora de limites em qualquer endpoint auditado — toda entrada inválida produz erro de validação específico.
- **SC-005**: As 4 mutações-guarda nomeadas na auditoria (remover purges; inverter troca de usuário; quebrar um downgrade; criar segundo head de migração) fazem a esteira falhar — demonstrado uma a uma.
- **SC-006**: As 12 claims documentais catalogadas conferem com o código por inspeção após o passe — zero claims falsas remanescentes da lista da auditoria.
- **SC-007**: Suíte completa da casa permanece verde ao final de cada lote (zero regressões introduzidas pela remediação).
- **SC-008**: Selecionar Mercado Livre ou Amazon num slot de marketplace pré-preenche as taxas do catálogo com selo de referência (fonte e vigência registradas) — fim do estado "sem referência" para os 3 marketplaces suportados.

## Assumptions

- **D4 (adotado, sem objeção do dono na sessão de clarificação)**: kit com 0 linhas passa a ser rejeitado pelo servidor (espelha o que a UI já promete).
- **D5 (adotado)**: o auto-update silencioso do PWA é mantido e registrado como decisão; virar "prompt de atualização" só com relato real de problema.
- **D6 (adotado)**: uso single-tab é declarado como premissa documentada do outbox; suporte multi-aba (lock) vai ao backlog com gatilho de telemetria.
- **Sourcing da curadoria ML/Amazon (US8/FR-015)**: segue a preferência registrada do dono para obtenção de taxas (fonte determinística/oficial preferida; pesquisa web como fallback — a via de API direta esteve bloqueada por 403); os valores obtidos passam por validação explícita do dono antes do merge, tratados como dado financeiro de terceiro, nunca inferidos.
- **Escopo excluído**: Onda 2 (C-04/C-05 — vetor known-good do MP, cross-check de preço, log de startup) pertence ao épico 012-e6 como condição do gate MP-live; Onda 7 (C-16..C-23 — N+1, factories, split de models, audits de dependência) é backlog com gatilhos próprios. Nada disso é requisito desta feature.
- **Achados [INFERIDO] não confirmados** (ex.: E6-02) não geram requisito aqui — são confirmados no contexto que os possui (E6) antes de virar correção.
- A ordem de entrega recomendada é a das ondas do PLANO-CORRECAO.md (Altos primeiro; cada issue = 1 PR revisável; o passe documental pode entrar cedo), mas as user stories são independentes entre si.
- O trabalho NÃO deve interromper o épico E6 em andamento: os lotes desta feature partem de `develop` em branch própria; itens que tocam arquivos quentes do E6 (ex.: nada nesta feature toca `billing/`) não conflitam por construção.
