# Quickstart — validação do 016

Guia de validação por fatia. Pré-requisitos: pnpm i na raiz; backend com uv; para fluxos com banco
no Windows, **sempre** `run_e2e_server.py` (uvicorn direto quebra o psycopg async — lição PR #42):

```bash
PORT=8000 P3D_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 uv run python scripts/run_e2e_server.py
```

Conferência antes de abrir o navegador: `/health` → 200 **e** `/api/v1/entitlement` → 200/401
(nunca 500). Portas dedicadas 4173/8100 para full-stack (colisão com outro projeto em 5173/8000).

## Gate universal (toda fatia)

```bash
pnpm gate:all        # o MESMO literal do lefthook e da CI
pnpm test:e2e        # Playwright
# fatias que tocam rotas backend: regen de contrato + idempotência (drift-guard)
```

## V0 — a medição que vem ANTES de tudo

1. Backend correto (acima) + conta logada SEM premium.
2. Abrir Catálogo · Kits · Orçamentos · Simulações · "Usar do catálogo".
3. Registrar screenshot + status HTTP observado por tela.
4. Teaser → V0 fecha sem código (nota no dod-evidence). Erro vermelho → vira a primeira fatia.

## PR-A — teasers + rótulos

- Grátis: as 5 telas mostram a MESMA árvore (teste estrutural dos 5 ids + screenshot das 5).
- `grep` de superfícies: zero "Histórico"/"Cenários" visíveis (incl. PDF/CSV export); rotas
  `/historico`/`/cenarios` intactas.
- O modal "Cenários fazem parte do Premium" não existe mais; "Usar do catálogo" tem botão
  desabilitado E visível.

## PR-B — layout

- 1440px: largura útil ≥ 60% (baseline 37%); total centralizado ao final.
- Cartões de preço com R$ 95.057: sem scroll interno, sem quebra, sem transbordo — geometria por
  caixas em 360/390/1440 (a guarda [F11a-002] continua no lugar).
- Tema claro E escuro (logo por variante).

## PR-C — campos (nada persistido muda)

- 11 campos: tooltip por hover, teclado E toque; conteúdo responde "por quê" + "como descubro".
- h+min: digitar 5h30 → motor recebe 5.5 → salvar/reabrir exibe 5h 30min; `5.33` exibe 5h 20min.
- Máquina: R$ 4.000 + payback 3 anos → ≈R$ 5,13/1,11/0,40 por hora (SC-906); doc salvo com horas
  fora dos ritmos reabre em "ajustar" com o número intacto.
- Prova de reorganização: igualdade numérica antes/depois no vetor canônico (R$ 28,65/42,98/37,25).

## PR-D — remoção do desperdício (a fatia que morde)

- Motor: `computeCalculator({ ...input, wasteGrams: 10 })` → ValidationError nomeando o campo;
  chave presente com `undefined` TAMBÉM recusa.
- Matriz de documentos: orçamento congelado pré-4.0.0 abre e exporta o que foi cotado; simulação
  pré-4.0.0 reabre recomputando COM declaração de descarte visível; documento novo abre limpo.
- Banco: migração `0003` aplica e reverte (schema); wire: POST com `wasteGrams` → 422 nomeado.
- Regen de contrato idempotente; drift-guard verde.

## PR-E — premium + campos dirigidos

- Grátis: switch de marketplace desabilitado E falso, assinar visível; nenhum número de canal por
  nenhum caminho (deep-link testado); premium: byte-idêntico ao de hoje (FR-919).
- Promessa da 1ª dobra nova; Clarifications datadas presentes nas specs 005 E 007 na MESMA fatia.
- Por marketplace (screenshot dos 3): Shopee sem seletor de categoria; Amazon lista plana de 38;
  ML idêntico ao de hoje (parte ML adiada).
- Picker: hierarquia navegável; contador diz N verdadeiro; lista não parece campo preenchido
  (asserção geométrica + screenshot — os dois defeitos do 014).

## PR-F — dado + regras Shopee/Amazon (4.1.0)

- **Pré-condição**: releitura VERBATIM do art. 26839 (a forma exata do < R$ 8 CNPJ) ANTES de gravar
  número — registrar o trecho literal no dod-evidence.
- Amazon Individual: preço de referência sobe exatamente R$ 2,00/item (antes do markup); selo
  mostra a procedência própria (`/precos`); Profissional intocado.
- Shopee CNPJ: varredura de limiar em R$ 8 (par anúncio/líquido contínuo, sem banda emprestada);
  ≥ R$ 8 byte-idêntico.
- Shopee CPF: perguntas aparecem SÓ no canal Shopee; sem resposta → byte-idêntico; CPF+volume →
  +R$ 3/item; < R$ 12 CPF → aviso com os DOIS pontos oficiais e sem fórmula aplicada.
- Volumoso: marcado → +R$ 50,00 com legenda "por pedido"; desmarcado/simulação antiga →
  byte-idêntico; PDF imprime a linha nomeada.
- `catalogVersion` bumpou UMA vez (nextCatalogVersion); mutação: alterar `pct`/`value` muda preço.

## Matriz de homologação transversal (medir, não consertar)

Offline (PWA) · erro de rede real (backend morto) · sessão expirada · `/conta` no grátis · tema
claro · 404/tela de erro · mobile real 360px. Regra da casa: layout se afere com CAIXAS; a
homologação visual sai com IMAGEM (screenshot); texto extraído não vale como prova de layout.
