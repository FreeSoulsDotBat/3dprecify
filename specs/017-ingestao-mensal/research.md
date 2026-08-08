# Research 017 — verificações e resoluções (Phase 0)

Tudo aqui foi **verificado** (Constituição II) — na sessão de 2026-08-07, sobre a árvore que já
contém o hotfix A2/A3 — ou está declarado como pendência com a propriedade exigida escrita.
Nenhum NEEDS CLARIFICATION resta: a clarify fechou 8/8 e a `arquitetura-017.md` decidiu a forma.

## R1 — Runner hospedado e as fontes (G1/G2/G3)

- **Decisão**: runner GitHub hospedado (`ubuntu-latest`), navegador headless pinado para
  Amazon/Shopee, fetch simples para `/precos` e vigias ML.
- **Rationale**: gates MEDIDOS no ADR-0010 §A13 — G1: ML sem geo-gate; G2: página da Amazon
  idêntica de runner não-BR mas JS-renderizada (PASS 2×: 2026-07-28 e 08-05); `/precos`
  respondeu 200 com 647 KB sem navegador. Runner self-hosted REJEITADO pelo dono.
- **Alternatives considered**: self-hosted (rejeitado — decisão do dono, superfície de segurança);
  runner BR de terceiro (rejeitado — G1/G2 provaram desnecessário).

## R2 — Motor de OCR: `tesseract.js` 7.0.0 WASM sob lockfile

- **Decisão**: `tesseract.js@7.0.0` como devDependency de `packages/fee-ingest`; traineddata
  `por` como **insumo fixado conferido por SHA-256** antes do uso (aborta se divergir).
- **Rationale (verificado 2026-08-07)**: 7.0.0 é WASM puro, exige Node ≥ 16 (temos 24), roda sem
  passo privilegiado; `tesseract-ocr` NÃO consta dos pré-instalados documentados do runner — um
  `apt-get` faria a versão do motor variar com a imagem semanal, e as guardas não distinguiriam
  "a Shopee mudou o PNG" de "o runner mudou o OCR".
- **PENDÊNCIA DECLARADA (resolver na tarefa, não assumir)**: a doc do `tesseract.js` não afirma
  que `langPath` aceite caminho local. A PROPRIEDADE exigida: o traineddata não varia entre
  execuções. Se `langPath` local funcionar → versionado em `packages/fee-ingest/data/`; senão →
  URL fixada + SHA-256 conferido. Qualquer um satisfaz; a tarefa prova qual.
- **Alternatives**: `apt-get` (25% — rejeitado acima); container de terceiro (45% — mais um
  terceiro no caminho do dinheiro, contra §A6 do parecer).

## R3 — Onde mora a decisão: TS testado, nunca YAML

- **Decisão**: shell de YAML só chama `.mjs`, sobe artefato e (no `publicar`) chama `gh`; um
  `if:` escolhe SE um job roda, nunca O QUE ele afirma.
- **Rationale**: shell em YAML é o único código do repo que nenhum gate executa — e a lição
  014/US4 é que suíte verde não prova programa que roda. Todo `.mjs` novo é bootado sob `node`
  puro no próprio job (os 3 imports sem extensão do 014 eram invisíveis ao vitest).

## R4 — Idempotência do gerador (o padrão que o repo já paga para conhecer)

- **Decisão**: `pnpm fee:build` roda DUAS vezes no job; a 2ª passada exige
  `git diff --exit-code` vazio antes do `gh pr create`.
- **Rationale**: é o mecanismo do `contract-drift` (o drift-guard já pegou docstrings — a classe
  é conhecida). Gerador sem ponto fixo abriria PR novo todo mês sobre a mesma tabela e o revisor
  aprenderia a não olhar.

## R5 — PR idempotente e execução dupla no dia

- **Decisão**: branch determinística `bot/fee-refresh-<data>` + `gh pr list --head … --state
  open` antes de criar (padrão que `auto-pr.yml` já exerce, medido).
- **Rationale**: dispatch manual + schedule futuro no mesmo dia ⇒ mesmo artefato ⇒ mesmo diff ⇒
  nenhum PR duplicado.

## R6 — P0-c: o que JÁ está fechado e o que resta (correção de registro)

- **Medido**: `sha_pinning_required` já existe e roda (`action-pins` +
  `scripts/check-action-pins.sh`); `trufflehog` já pinado por SHA (`ci.yml:153`). O brief/spec
  tratavam o T069b como aberto por inteiro — não está.
- **Resta de fato**: `allowed_actions` (configuração de repositório — DONO) e §A6.5(iii) "CI
  independente sobre o PR mensal" — atendido pelo desenho D (`gate:artifact` DENTRO do job) +
  `workflow_dispatch` manual do CI sobre a branch do PR quando o dono quiser o `gate:all` cheio.
- **Nota**: `check-action-pins.sh` imprime "os 5 workflows parseiam" com número CRAVADO — com o
  `fee-refresh.yml` vira mentira; corrigir para contagem calculada na MESMA fatia (J.6).

## R7 — Âncoras Shopee: a fonte é o T057, nunca o §8 do OBTENCAO

- **Decisão**: as âncoras verbatim do baseline (`shopee-art26839.baseline.json`) são pinadas do
  T057 (016 dod-evidence): a frase do CNPJ < R$ 8 ("o adicional por item é a metade do preço do
  produto") · a do +R$ 3 (CPF > 450 pedidos/90 dias) · os dois pontos regressivos (R$ 10 →
  R$ 6,50 · R$ 8 → R$ 6,00) · `absentAnchors: ["mínimo","piso"]` (0 ocorrências hoje).
- **Rationale**: `OBTENCAO-DINAMICA-DADOS.md §8` está DESATUALIZADO ("<R$ 8 = 50% sem fixo") —
  a releitura verbatim provou que os 20% continuam incidindo abaixo de R$ 8 e o catálogo servido
  já reflete (`fixedFeeRule: PCT_OF_PRICE 50`). O §8 ganha nota datada apontando o T057.

## Riscos abertos com confiança (herdados do desenho, não escondidos)

RA1 laço manual até o corte (declarado em 3 lugares; §G avisa aos 35 dias) · RA2 OCR plausível
errado (~35% de pega em célula única — o portão é o humano; AC5 obrigatória) · RA3 teto de bloco
INERTE na Shopee (10×2 — a defesa é F.3+F.4) · RA4 verbatims migram de `seed.ts` para âncoras
executáveis NA MESMA FATIA (senão a decisão C reverte) · RA5 bloqueio de bot (parada, nunca
corrupção) · RA6 falso positivo de copyedit (re-pinar é editar dado) · RA7 subconjunto divergir
do todo (meta-guarda + mutação).
