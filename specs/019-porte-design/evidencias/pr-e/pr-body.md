## 019 PR-E — Montar e Enviar (US6 · FR-1916/1917 · pricing-core 4.2.0 · migração 0009 · **escalação opus ×3**)

**Estado: CORREÇÃO DECLARADA** — nada homologado; a Rodada 1 fecha antes (D5). Evidência em `specs/019-porte-design/dod-evidence.md` §PR-E e `evidencias/pr-e/` ({{PNGS}} capturas 1:1 nos dois temas + medidas).

### A regra do tempo que a fatia acrescenta

Um orçamento **enviado** não pode se recalcular sozinho — o cliente tem uma cópia dele. "Enviar congela este preço" pela MESMA maquinaria imutável do E4 (ADR-0019): um snapshot `kind=QUOTE` com `headline_basis=PRECO_ORCAMENTO`, "Válido até" como TEXTO (Q7, coluna `quote_validity_days` — nunca payload), e "Voltar a acompanhar não vale para orçamentos enviados" (US17).

### O que muda

- **Motor (opus)** — `pricing-core` **4.2.0** (MINOR aditiva): `computeQuote` (linhas × quantidades pelo preço de VENDA DIRETA — Q6: `grossTotal === bom.precoVarejo`, sem marketplace no construtor; desconto % ou R$ **no total**; `netTotal`; `costFloor === custoTotal`; `belowCost` ESTRITO; recusa `channels` em RUNTIME; devolve NÚMEROS — a string decimal é do documento). **A varredura de igualdade**: fixture de 500+200 casos gerada com o motor **4.1.0 INTOCADO** (o gerador se recusa a rodar contra 4.2.0 — a prova não pode ser "reconciliada"), 415 rollups comparados, verde contra 4.2.0; não-vácuo por 2 mutações (uma não muda preço NENHUM e ainda é vista, via `channels[]`). Cobertura 100%.
- **Servidor (opus)** — migração `0009`: os TRÊS CHECKs de `snapshots` no MESMO ato (`kind` +QUOTE · `headline_basis` +PRECO_ORCAMENTO · `headline_matches_totals` com o ramo `precoOrcamento` — **a mutação vive dentro do teste**: sem o ramo o `CASE` dá NULL e o CHECK passa em silêncio); `downgrade()` irreversível na presença de QUOTE (declarado; o forbid-delete da 0006 impede apagar antes). O documento QUOTE validado no pydantic (nunca `IntegrityError` — 500 vira laço no outbox): todo dinheiro STRING decimal, folhas `unitPrice/subtotal/costFloor/amount/grossTotal` em `_MONEY_POSITION_KEYS` (nunca `lines`/`discount` — o KIT com `quantity` inteiro continua 201), `grossTotal − amount == precoOrcamento`. PDF itemiza por `subtotal`, bruto→desconto→total, `_basis_key` sem fallback, `<b>`/`&amp;` literais, 4+2 espelhos guardados. Contrato regenerado 2× byte-idêntico (diff: 4 linhas).
- **Cliente (opus + sonnet)** — envelope congelado alargado (`FrozenQuoteLine`/`FrozenQuoteDiscount`/`costFloor`/`precoOrcamento`; `buildQuotePayload` converte tudo para string; `schemaVersion` continua **1**, fixtures pré-019 idênticas); os **9 consumidores** decididos com teste (detalhe itemiza e diz "válido até"; **Recalcular/Comparar hoje NÃO aparecem para QUOTE**; record-sheet não grava QUOTE **por tipo**; export só com id do servidor; outbox sem ramo novo; context-bar nunca oferece simulação de um orçamento). **O construtor** (prancheta 18b→18d→18e): escolher do catálogo (produto E kit; PARADO apagado com o motivo; FIXADO entra pelo MOTOR — ADR-0033 §3; linha degradada de kit com "(avulsa)" — D6), quantidade, desconto %|R$, "Sobra sobre o custo" apagada, **"Abaixo do custo" AVISA com Enviar habilitado** (Q10), "Cliente" = rótulo do registro, o passo final é o cartão 18e (título + Total enviado + Válido até + o aviso de congelamento + Voltar | Enviar), **uma requisição por envio** (reentrância dupla), **offline: Enviar desabilitado com a razão e NADA no outbox** (DECISÃO 4). Entrada por `/historico?construir=1` (1 segmento — armadilha `base:'./'`), botão "Novo orçamento" só com gate ativo (o caminho sem parede da PR-B para os demais).

### Verificação

- {{GATE}}
- {{E2E}}
- Drift-guard 2× diff vazio; Schemathesis 45 passed em 54 s; migration-guard ok (1 head).
- A guarda T125 (ADR-0033) pegou de verdade durante a fatia: a 1ª versão do construtor vazava `observedPrice` para `pages/historico` — vermelho na hora, corrigido.

### Fronteira decidida (Princípio VIII, precedente T124)

`features/history` ↛ `features/calculator`: a PAGE monta `toLineInput` (`pages/historico/quote-line-input.ts`, reusa `bomLineToInput` + `productToForm`/`computeFromForm`; `directSale()` remove `channels`). **Follow-up ao arquiteto**: três telas já reimplementam esse mapeamento — descê-lo para `entities` eliminaria a triplicação.

### Pede ao dono

- **Flip do ADR-0034** (Proposed → Accepted).
- **Ratificar**: (1) `QuoteResult` é SUPERSET do esboço do ADR-0034 (+`lines[]` — o documento exige `unitPrice`/`subtotal` —, +`modelVersion`); (2) o 18e é o PASSO final do construtor (cartão), não um modal por cima; (3) **18d·2 ("aperta, mas passa") omitido** — não há limiar de % decidido em lugar nenhum (o "12%" da prancheta é exemplo); `tightMargin*` transcritas aguardam a regra; (4) no PDF, o opt-in "mostrar custos" imprime `Custo total = costFloor` (aditivo — sem isso o interruptor não faria nada num QUOTE); (5) os rótulos do PDF são a cópia da 18d duplicada em Python (servidor sem i18n) — par sem guarda automática; (6) `discount.value` gravado "10.00" e formatado "10%" na leitura; (7) ícones `percent/minus/user/folder` da prancheta não existem no bundle curado (o desconto usa sufixo textual; `lock` → `info`); (8) fora por decisão de escopo e REGISTRADO na transcrição: 18c inteira (US18 retirada), frete, os cinco estados da lista + "Marcar aceito/recusado", WhatsApp/Copiar/Compartilhar, prazo de produção — lacunas de produto para o PO; (9) `downgrade()` da 0009 irreversível com QUOTE (custo zero com o deploy adiado; reabre se o adiamento for revisto).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DP6jGooCvL3M2dac3o34EW
