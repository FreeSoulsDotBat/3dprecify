# Quickstart — validar o 014 de ponta a ponta

Cenários executáveis que provam a feature. Não contém implementação — ela vive em `tasks.md`.

## Pré-requisitos

- `pnpm install` · Docker Desktop **no ar** (sem ele ~300 testes `requires_db` são pulados, a cobertura despenca e
  o gate reprova por um motivo que não é o seu código)
- Para os passos de ML: `.env.probe.local` com `ML_APP_ID` / `ML_APP_SECRET` / `ML_REFRESH_TOKEN`.
  **Nunca** comitar; `.env.*` já é ignorado.

---

## V1 — O SC-801 é estrutural, não uma torcida

A propriedade mais importante do incremento é que a resolução **não depende da ordem do arquivo**.

```bash
pnpm --filter web test fee-catalog
```

**Esperado**: existe um teste que embaralha `entries` e afirma que **toda** resolução permanece idêntica. Se esse
teste não existir, o SC-801 não está verificado — a implementação pode estar certa por acidente.

---

## V2 — O guard de 0% pega o caso dentro da banda

```bash
pnpm --filter web test fee-catalog
```

**Esperado**: uma entrada com `commissionPct: null` cujas **bandas** também têm comissão nula é **rejeitada no
parse**, com mensagem legível. Antes do 014 ela passava e pré-preenchia 0% sob selo de "referência" (R7).

---

## V3 — Resolução por ancestral, com números reais medidos

```bash
pnpm --filter web test fee-prefill
```

**Esperado**, usando os valores que a API devolveu em 2026-07-28:

| categoria | alíquota esperada | por quê |
|---|---|---|
| Celulares e Telefones (MLB1051) | 18% | entrada própria |
| Celulares e Smartphones | **16%** | entrada própria — **diverge do pai** |
| um neto de Celulares e Telefones sem entrada | 18% | herda pelo ancestral mais próximo |
| categoria inexistente | `null` + "sem referência" | nunca inventa |

---

## V4 — O parser da Amazon sobrevive ao U+00A0

```bash
node <local-de-D1>/amazon.mjs --dry-run
```

**Esperado**: 38 linhas com percentual, catch-all "Outros 15%" presente, mínimo "BRL 1,00" reconhecido. O mínimo só
é reconhecido se o parser normalizar o **non-breaking space** — foi o que reprovou o gate G2 na terceira rodada, com
a string visivelmente presente na página.

---

## V5 — O laço mensal falha em silêncio? Não.

```bash
node <local-de-D1>/refresh.mjs --dry-run --simulate-failure=fetch
```

**Esperado**: **nenhum** PR aberto · artefato **byte a byte** inalterado · alerta emitido · `lastReviewed` **não**
avança para valor nenhum. Um parse vazio deve produzir o mesmo desfecho de um erro de rede — "0 categorias" nunca é
lido como "as taxas mudaram".

---

## V6 — O seletor, no navegador (homologação visual — Constituição III)

1. `pnpm --filter web dev` (porta dedicada 4173/8100 — as 5173/8000 são disputadas por outro projeto)
2. Abrir a calculadora, adicionar um canal ML
3. Digitar parte de um nome de categoria → a lista filtra
4. Escolher a categoria → o selo **nomeia a categoria**, não só o marketplace
5. Editar a comissão à mão → o selo passa a ler **"ajustado por você"**
6. Adicionar um segundo canal (Amazon) → a categoria do ML **não** vazou para ele
7. **Offline** (DevTools → Network → Offline), recarregar → o seletor ainda funciona

O passo 7 é o que a US1 AS5 exige e o que a opção (a) de **D2 contradiz na primeira execução** — se D2 for decidido
como (a), este passo precisa ser reescrito para refletir o comportamento real, e não silenciosamente aprovado.

---

## V7 — Nenhuma regressão em E1–E6

```bash
pnpm gate:all
pnpm --filter web test:e2e
```

**Esperado**: verde, e em particular objetos salvos **antes** do 014 (cenário, kit, snapshot) abrem inalterados e
sem categoria (SC-809). Snapshot continua imutável.
