# ADR-0030 — OCR admissível para dinheiro: motor fixado, endereço por bytes, guardas conjuntivas e o portão humano

- **Status**: Proposto (2026-08-07 — flip no gate do dono da PR-C do 017, a fatia Shopee)
- **Data**: 2026-08-07
- **Contexto**: 017-ingestao-mensal (US5 · FR-1009 · clarify Q8) — implementa a decisão D11 do
  dono (2026-08-05: OCR NO LOOP, com guardas de falha-alta registradas) com a quantificação
  honesta do brief: as guardas pegam ~85% de deslocamento de coluna, ~60% de dígito aleatório e
  **~35% de erro plausível de célula única** — o portão real é o HUMANO, e este ADR existe para
  torná-lo possível. Desenho em `arquitetura-017.md` §F.
- **Decide**: sob que condições um número lido por OCR pode entrar num PR de dinheiro.
- **Relaciona**: ADR-0010 §A11 (0 tokens LLM — tesseract conta como 0) · SC-811 · Constituição II.

## Decisão

1. **Motor fixado por lockfile**: `tesseract.js` 7.0.0 (WASM) como devDependency — NUNCA
   `apt-get` (a versão viraria função da imagem semanal do runner, e as guardas não
   distinguiriam "a Shopee mudou o PNG" de "o runner mudou o OCR"). O traineddata `por` é
   insumo FIXADO conferido por SHA-256 antes do uso (local se `langPath` aceitar; senão URL
   fixada + hash — a propriedade é a invariância entre execuções, verificada na tarefa).
2. **Endereço por BYTES**: identidade do PNG = `sha256(bytes)`; URL é procedência. Hashes
   inalterados ⇒ 0 OCR (caminho comum); URL nova + bytes iguais ⇒ re-upload declarado, OCR não
   roda; bytes novos ⇒ tabela nova, OCR roda.
3. **Guardas CONJUNTIVAS** (`avaliarOcr`, pura, ratchet 100%): forma (nº de faixas; célula
   parseável em formato BR) · sanidade (comissão ∈ [5,25]%) · não-contradição com as âncoras
   verbatim do baseline (fonte: T057 — nunca `OBTENCAO §8`, que está desatualizado) · cobertura
   de bandas. Qualquer reprovada ⇒ ABORT, artefato intocado, sem PR.
   **Não-vacuidade por MUTAÇÃO** é portão da fatia: um dígito trocado plausível é pego por ≥1
   guarda em 100% das rodadas.
4. **O portão humano é inegociável**: folha vinda de OCR NUNCA recebe dispensa de revisão, e o
   corpo do PR SEMPRE imprime lido × anterior × link da imagem (AC5). Acima do limiar declarado
   `OCR_DIVERGENCE_BANNER` (proposta: >30% relativo ou >R$ 5,00 absoluto — o dono ratifica no
   gate): banner no topo mandando conferir a imagem — nunca abort silencioso (clarify Q8:
   abortar suprimiria também a mudança real grande, a que o dono mais precisa ver).
5. **Escopo fechado**: OCR só para os PNGs do art. 26839 da Shopee. Medição desconfortável
   registrada: o teto de mudança em bloco é INERTE na Shopee (`CEILING_MIN_ENTRIES=10` × 2
   entradas) — as guardas + o banner são a defesa inteira antes do humano (RA3).

## Rejeitadas

- `apt-get install tesseract-ocr` (determinismo refém da imagem do runner).
- Container/action de terceiro com o binário (mais um terceiro no caminho do dinheiro).
- Abort em divergência grande com guardas verdes (suprime o sinal que mais importa).
