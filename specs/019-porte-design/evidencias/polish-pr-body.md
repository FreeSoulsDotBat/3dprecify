## 019 Polish — o fechamento do incremento (Phase 10 · T100–T104 + T139/T140 + o fecho da PR-E)

**Estado: CORREÇÃO DECLARADA** — como as seis fatias; nada homologado até a Rodada 1 fechar (D5, registrado em `docs/homologacao/rodadas/019-correcao-declarada-2026-08-30.md`).

### O que muda (código — duas linhas, o resto é registro)

- **T139**: `tf-btn--full` e `tf-btn--half` não tinham consumidor de produto — ganharam **exatamente os que as pranchetas desenham**: o "Novo orçamento" da 18a (`width="full"`) e o "Tentar novamente" do erro frio de Simulações da 30a (`width="half"`). `tf-segmented--split` (T142) e `tf-badge--warning` (selo) já eram consumidos. Nada declarado morto.
- O commit de fechamento da PR-E (`T089` marcado) que ficou fora do squash da #65.

### O que prova (T100/T101/T140/T102)

- **T100**: vetor canônico + `band-dominance.artifact` **76/76** após as seis fatias — 27,55/41,33/35,82 intactos, `catalogVersion` intocado (SC-007).
- **T101**: zero medidor de foco; a exceção (o harness de homologação mede `outline` como ferramenta, fora do gate) declarada.
- **T140**: `dist/sw.js` precacheia logos + símbolos; as fatias não acrescentaram asset binário — a classe 009/T016-N5 não reabriu.
- **T102 · SC-1907**: geometria consolidada LENDO os `medidas-*.json` das seis fatias (tabela no dod-evidence §Polish): os 4 cortes (360/1280/1440/1920) cobertos pela união, **overflow 0 em todas as 120+ entradas**; 1024/1279 (a faixa `tf-table`) com guarda permanente. Ledger fechado: PR-D custou 2,4× a estimativa; **as três fatias seguintes, com as lições aplicadas, ficaram todas dentro ou abaixo**.

### T104 — as decisões do dono (2026-08-30, por escrito nesta conversa)

- **ADR-0032, 0033 e 0034 → Accepted**; **emendas ratificadas** (0031 §2026-08-26 + §Emenda 2; 0017 §2026-08-29 — `name_norm` no casamento de kit vira regra). Status aplicados nos arquivos e no índice.
- **ADR-0024 → Aceito (30/08), após revisão dedicada**: o dono não se recordava do aceite ("Accepted + live" no ground do 014 era erro de registro, a mesma classe dos ground lines falsos de 01/08 e 07/08) — em vez de flip cego, a revisão re-executou a prova de três pontos no motor (100→15,00 · 200→30,00 · 300→**40,00** progressivo vs 30,00 seleção; ausência de `bandMode` = comportamento antigo bit a bit) e o dono aceitou com a história registrada.
- Índice de ADRs: 0023 corrigido para Accepted (gate do E6 PR-A); 0024–0031 preenchidos com o status medido em cada arquivo.

### O que fica aberto do 019 (registrado, nada esquecido)

- **As pranchetas de correção da PR-C** (T059/T054/T144/T145/T146): dependem de o dono rodar `uploads/019-pr-c-correcoes.md` no Claude Design (T212 preço que acompanha e se mescla; diálogo de modo; marca da seção "{n} avisos"; linha de kit `tf-aviso`).
- **Follow-ups por fatia** (nos corpos dos PRs #60–#65 e no dod-evidence): o mais grave é o **ALTA da PR-E** — `app-shell.tsx` com dois `<Outlet/>`: redimensionar cruzando 425px zera estado local não salvo de qualquer página; também: `tightMargin*` sem limiar (18d·2), o mapeamento produto→`PriceInput` triplicado (arquiteto), rótulos do PDF duplicados em Python.
- **Homologação**: as seis fatias esperam a Rodada 1 (D5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DP6jGooCvL3M2dac3o34EW
