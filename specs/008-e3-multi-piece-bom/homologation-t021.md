# Homologação T021 — indicador de linha degradada (produto referenciado deletado)

- **Feature:** 008-e3-multi-piece-bom · PR-C · T021 (ux §1.2-D, F1/K3)
- **Branch / HEAD:** `feature/008-e3-pr-c` @ `cc8d82a` (“feat(008): PR-C degraded-line caption — calm muted legenda (T021)”)
- **Data:** 2026-07-12
- **Ambiente:** stack real — Postgres compose (`precifica3d_homolog` @ :5433), backend uvicorn :8100,
  Firebase Auth emulator :9099, front `vite preview` :4173 (build em modo emulador). Chromium real via Playwright.
- **Método:** cadastro throwaway → grant premium (CLI operador real) → filamento + impressora + produto
  “Base do suporte” → kit vinculando o produto (qty 2) → **Salvar** → deletar o produto → **reabrir o kit**.
  Executado em 2 viewports (390px e desktop 1280px) e nos dois caminhos de reabertura (client-side sem reload,
  e reload completo).

## VEREDICTO: **FAIL** (fluxo honesto crítico quebrado na reabertura)

O **componente** do indicador degradado (T021, `bom-line-card.tsx`) está **correto**: quando o servidor
entrega `degraded:true`, a UI renderiza exatamente o previsto (legenda calma + “(avulsa)” + preço preservado +
zero copy de remoção). **Porém** o **fluxo de reabertura** quase sempre **não entrega** os dados degradados ao
composer: na jornada mais comum (deletar produto → reabrir o kit) a peça reabre mostrando o **produto deletado
como referência viva do catálogo** — com o nome “Base do suporte” e o preço — **sem** o estado degradado. Isso
viola a promessa honesta central do T021 (“reabrir calmo e honesto”).

### F1-guard (a linha mais importante)
As palavras **“removido / excluído / deletado”** (ou qualquer alegação de remoção) **NÃO aparecem em lugar
nenhum** — nem na linha degradada, nem no composer, em nenhum dos estados observados. **F1-guard: PASS.**
(A desonestidade aqui **não** é uma alegação falsa de remoção; é o oposto — a UI age como se **nada** tivesse
acontecido e apresenta um produto deletado como vivo.)

## Os 5 pontos do contrato de honestidade

| # | Contrato | Resultado | Observado |
|---|----------|-----------|-----------|
| 1 | Rótulo “Peça N · (avulsa)” (nunca nome de produto, nunca “— Manual —”) | ❌ no fluxo comum / ✅ quando os dados chegam degradados | Reabertura client-side (real) e 1ª reabertura por reload mostram **“Peça 1 · Base do suporte”** (produto deletado, vivo). O rótulo correto “Peça 1 · (avulsa)” só aparece quando o composer hidrata de dados já degradados (ver Recuperação). |
| 2 | Legenda “Os valores atuais foram mantidos e continuam editáveis.” | ❌ no fluxo comum / ✅ quando degradado | Ausente na reabertura comum; presente e correta quando degradado (390 e desktop). |
| 3 | **F1:** nenhuma copy “removido/excluído/deletado” | ✅ | Grep no innerText do body em todos os estados: **zero** ocorrências. |
| 4 | Linha ainda mostra preço real (custo/un · total), não zerada | ✅ (com ressalva) | “R$ 20,60 /un · Total da linha (2×) R$ 41,20” aparece. Ressalva: no estado bugado esse é o preço do **produto deletado** apresentado como vivo. |
| 5 | Kit re-salvável (re-materializa peça manual; sem 422/crash) | ✅ a partir do estado degradado | Do estado degradado, **PUT 200** + resumo “Peça 1 · Kit … — criado no catálogo” (re-materializou), sem alertas. Confirmado no banco (linha passa a referenciar o produto novo). **Risco:** re-salvar a partir do estado **stale-live** enviaria uma referência a produto deletado (provável 422 — ver Riscos). |

## Causa-raiz (dois defeitos que se somam — ambos fora do componente T021)

1. **`useDeleteProduct` invalida só a query de produtos, nunca a de kits.**
   `apps/web/src/entities/catalog/use-catalog.ts` (`useDeleteProduct`, ~L257-263) usa
   `useInvalidateCatalog("products")`. A invalidação de `boms` só existe nos hooks de escrita de kit
   (`useInvalidateAfterKitWrite`, `use-bom.ts` L104-111). Com `useBoms` em `staleTime: 5*60_000`
   (`use-bom.ts` L76), **deletar um produto não dispara refetch de kits** — o cache de kits continua
   resolvendo o produto deletado como vivo. Prova empírica: no repro client-side, **0** `GET /api/v1/boms`
   entre o delete e a reabertura (`bomsGetsSinceDelete: 0`).

2. **O composer hidrata as linhas UMA vez por id de kit e “trava” na primeira cópia que chegar.**
   `apps/web/src/pages/bom/bom-page.tsx` L187-192: o efeito de hidratação guarda em
   `hydratedId.current === openedKit.id` e só roda uma vez por id. `useBoms` serve o cache do device
   (`loadCachedBoms`, assíncrono) **antes** do fetch do servidor, então em reload o `openedKit` que chega
   primeiro é o **cache stale (vivo)** → o composer trava nas linhas vivas e **não re-hidrata** quando a
   verdade degradada do servidor chega depois (mesmo id → efeito sai cedo).

O servidor está **correto** (confirmado no banco: `products.deleted_at` setado no delete; a linha degrada com
`product_id` nulo no read path). O problema é 100% de frescor/hidratação no cliente, na costura PR-B (delete
invalidation + re-hidratação do composer), não na renderização T021.

## Reprodução

**Caminho realista (client-side, sem reload) — SEMPRE falha dentro de ~5 min:**
1. Kit vinculado a “Base do suporte”, salvo.
2. Catálogo → Produtos → excluir “Base do suporte” (DELETE 204).
3. Kits → abrir o kit. → **“Peça 1 · Base do suporte”, sem legenda, preço R$ 20,60/un** (produto deletado como vivo).
   `homolog-t021-reopen-shows-live-bug.png`.

**Caminho reload completo:**
- 1ª reabertura (reload): stale-live (bug) — não estabiliza em degradado nem após 15 s (`settled:false`).
- 2ª reabertura (reload): aí sim degradado, pois o cache do device já foi reescrito para degradado pela
  1ª reabertura. (Recuperação frágil e dependente de ordem.)

## Recuperação (quando o degradado APARECE)
- Um **segundo** reload completo (t021d: `reopen#1 settledDegraded=false`, `reopen#2 settledDegraded=true`,
  rótulo “Peça 1 · (avulsa)”), OU
- Qualquer escrita de kit (invalida `boms`), OU
- Após `staleTime` (5 min) + novo mount.
Ou seja: o estado honesto existe e renderiza perfeitamente — só não é entregue de forma confiável na reabertura.

## Evidências (screenshots em `specs/008-e3-multi-piece-bom/`)
- `homolog-t021-degraded-390.png` — **degradado correto @390** (“Peça 1 · (avulsa)” + legenda + R$ 20,60/un · R$ 41,20).
- `homolog-t021-degraded-desktop.png` — **degradado correto @desktop** (2ª reabertura).
- `homolog-t021-reopen-shows-live-bug.png` — **o bug @390**: reabertura client-side mostra o produto deletado como vivo.
- `homolog-t021-resave-390.png` — re-save re-materializando (contrato 5).

## Console / rede
- Sem erros de console relevantes (apenas 403s esperados de gate/asset e aborts de favicon/logo em navegação).
- `DELETE /api/v1/products/{id}` → **204**. `PUT /api/v1/boms/{id}` (re-save) → **200**.
- **0** `GET /api/v1/boms` entre delete e reabertura no fluxo client-side (prova do defeito 1).

## Riscos / nits
- **Risco (compõe o FAIL):** re-salvar a partir do estado stale-live envia `product_id` de produto deletado
  como referência viva → o write path (`_resolve_product`, filtro `deleted_at IS NULL`) provavelmente **422**.
  Exatamente o modo de falha que os comentários em `boms.py` dizem ter sido corrigido pelo read path — mas o
  read path é **contornado** pelo cache stale na reabertura.
- **Nit:** o rótulo do card usa `span.text-sm.font-medium`; sem `data-testid` estável dificulta homologação
  automatizada (usei heurística de seletor). Sugestão: `data-testid` na linha e/ou na legenda degradada.

## Correção mínima sugerida (para o dono decidir)
- **(a)** Fazer `useDeleteProduct` invalidar também a query de kits (mesmo espelho de chave já usado em
  `use-bom.ts`: `["bom", uid]`), já que deletar um produto muda a resolução de qualquer kit que o referencie; **e/ou**
- **(b)** Permitir que o composer **re-hidrate** quando a versão servidor de `openedKit` chegar mais fresca que a
  cacheada (ex.: comparar por conteúdo/`updatedAt` em vez de travar só por `id`), preservando edições em curso.
  A opção (a) sozinha já cobre o fluxo comum; (b) endurece o caso reload/deep-link.

Reverificar após a correção: deletar produto → reabrir kit (client-side E reload, 390 E desktop) deve mostrar
**imediatamente** “Peça 1 · (avulsa)” + legenda, e re-salvar deve re-materializar (200), sem 422.

---

## Addendum — correção aplicada e reverificada (2026-07-12)

Ambas as correções sugeridas foram aplicadas (a costura era os dois defeitos somados, então os dois foram fechados):

- **(a) Invalidação — `apps/web/src/entities/catalog/use-catalog.ts`.** Novo `useInvalidateProductsAndKits()`:
  `useUpdateProduct` **e** `useDeleteProduct` agora invalidam a query de produtos **e** a de kits (`["boms", uid]`,
  espelho literal deliberado de `bomQueryKey`, comentado e fixado por teste). Uma edição de produto passa a
  refletir ao vivo no kit (D3); um delete passa a degradar a linha (D6) — sem esperar os 5 min de `staleTime`.
- **(b) Re-hidratação por conteúdo — `apps/web/src/pages/bom/bom-page.tsx`.** O efeito de hidratação deixou de
  travar por `id` do kit. Agora compara uma **assinatura de conteúdo** (`kitSignature` = `id|modo|nome|JSON(lines)`)
  e re-hidrata quando o servidor entrega linhas diferentes das mostradas, **preservando edições em curso** (ref
  `dirty`). A dependência do efeito é a *string* `openedSig`, não o objeto `openedKit` — o structural sharing do
  React Query pode preservar a referência do objeto num refetch live→degradado, e uma dependência por referência
  perderia justamente a re-hidratação que o D6 exige.

### Verdicto reverificado: **PASS**

- **Backend** (`test_boms.py`, +3): D3 reflete ao vivo na reabertura; soft-delete deixa o `product_id` pendurado
  e a degradação é **read-time**; hard-purge nula a FK (ON DELETE SET NULL) e a linha ainda degrada. **40 passed.**
- **Front unit** — `use-catalog.test.tsx` (+2): update/delete de produto invalidam **produtos E `["boms","uidA"]`**
  (fixado contra o mesmo literal, o espelho não pode derivar). `bom-page.test.tsx` (+2): um kit live→degradado
  **re-hidrata** na refetch; uma edição em curso **não é sobrescrita**.
- **e2e** (`kits-save.spec.ts`, novo teste D6/SC-405): deletar o produto referenciado → reabrir o kit pela URL
  exata mostra a legenda valores-mantidos + “(avulsa)” + preço, **sem** nome do produto vivo e **sem** copy de
  remoção (F1-guard). Reverificado em **build limpo**, sem instrumentação: o teste passou **10/10** repetições
  (5× por projeto, chromium + mobile, ~5s cada). Suíte completa: registrada na dod-evidence.

O modo de falha original (produto deletado apresentado como referência viva na reabertura) está fechado e coberto
por teste em três camadas. O componente T021 nunca foi o problema; a costura de frescor PR-B agora o alimenta com
a verdade do servidor de forma confiável.

### Nota de diagnóstico — o “flaky de chromium” era um servidor preview órfão (lição de ambiente)

Durante a reverificação, o e2e parecia falhar de forma intermitente **só no chromium** (mobile passava), o que
consumiu tempo perseguindo um falso bug de render. Causa real: um **`vite preview` órfão na porta 4173** (de uma
execução anterior interrompida) continuou no ar, e o Playwright, com `reuseExistingServer: !CI`, **reusou aquele
bundle congelado** em vez de reconstruir. O front servido estava travado numa versão **anterior à correção fix(b)**
— então cada “falha” media código velho, não o atual (inclusive a conclusão pré-resumo de que “o fix do openedSig
não funcionou” foi tirada contra esse bundle). Prova: a resposta do `GET /api/v1/boms` na reabertura vinha
`degraded:true` (servidor perfeito), mas a hidratação do composer no bundle velho não refletia. Após **matar o
processo órfão** (PID 37024, build das 14:55) e reconstruir, o teste passou de forma determinística (10/10). Lição
registrada em token-ledger e memória: antes de diagnosticar “flaky” de e2e, **confirmar que a porta 4173/8100 não
tem um servidor órfão servindo build velho** (o backend :8100 era recriado a cada run; só o front :4173 congelava).
