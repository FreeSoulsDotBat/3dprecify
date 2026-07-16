# Re-homologação VISUAL — E4 PR-A (PR #18)

**Data:** 2026-07-15 · **QA:** qa-produto · **Escopo:** as correções do review pré-merge
(`review-pr-a.md`) renderizadas no stack REAL. **Veredicto geral: PASS** (2 nits, nenhum blocker).

## Como foi verificado (o que corrige o falso-PASS do T016)

Stack real dirigido por Playwright: preview build em `:4600` + FastAPI `:8100` (DB e2e `precifica3d_e2e`
migrada até `0003`) + Firebase Auth emulator `:9099` + Postgres `:5433`. Premium concedido pelo CLI real
(`app.scripts.grant_premium grant/revoke`). Screenshots a **390px** e **desktop (1440px)**.

O erro do T016 foi emular offline só via `navigator.onLine`, que o `onlineManager` do TanStack **não**
observa. Aqui o offline usa `context.setOffline(true)` **E** `window.dispatchEvent(new Event("offline"))`
(cinto-e-suspensório). Prova de que alcança a camada de conectividade por evento: o registro gravado offline
**dreno sozinho ao voltar online** (badge some, `toHaveCount(0)`), o que só acontece se o `OutboxSyncer`
recebeu o evento `online` — e a lista final tem **exatamente 1 card** (exactly-once, sem duplicata).

## Veredicto por item da walk

| # | Item | Veredicto | Evidência (390 + desktop) |
|---|------|-----------|---------------------------|
| B1 | Gravar OFFLINE e o registro **não some** do Histórico; sobrevive reload; drena 1× ao voltar online; detalhe byte-idêntico | **PASS** (95%) | `A4-historico-pending-offline`, `A5-…-reload`, `A7-historico-synced`, `A8-detail-synced` |
| — | Sheet: rótulo · validade · **basis Varejo pré-selecionado** (Atacado ofertado) + toast honesto "pendente neste dispositivo" (nunca "salvo") | **PASS** | `A2-record-sheet`, `A3-toast-pending` |
| M8/F4 | Detalhe do pendente: Alert §1.2 ("Ainda não sincronizado") + **frase F4 de durabilidade** + explicador two-shelf + nota device-clock | **PASS** (95%) | `A6-detail-pending-F4` |
| B2 | Entrada **blocked** tem saída: **[Tentar novamente]** + **[Descartar]** no card e no Alert do detalhe; Descartar com confirm; remove só aquela | **PASS** (95%) | `B1-historico-blocked-actions`, `B2-detail-blocked`, `B3-discard-confirm`, `B4-historico-after-discard` |
| B3 | Sign-out com fila guardado: diálogo com a contagem ("1 registro…"), **[Sincronizar agora] desabilitado COM o motivo** offline, **[Sair e descartar]** com 2º confirm; depois anônimo em `/calcular` (paywall soft, sem bounce) | **PASS** (95%) | `C1-signout-dialog`, `C2-signout-discard-confirm`, `C3-calcular-anonymous` |
| C1 | **Kit no ATACADO itemiza no atacado** — manchete R$ 53,56 (atacado), peças R$ 26,78 ×2 = R$ 53,56; canal Varejo mostra R$ 61,80 (=2×30,90), provando que as peças NÃO estão em varejo | **PASS** (98%) | `D1-record-sheet-kit-atacado`, `D2-detail-kit-atacado` |
| M11 | **Preços por canal** no detalhe: Anúncio/Líquido Varejo/Atacado com valores reais grossed-up (comissão 12% + taxa R$ 5,00); nunca R$ 0,00 fabricado para canal | **PASS** (95%) | `E1-detail-channels` (+ canais também em `A6`, `D2`) |
| C5 | Free/offline sem resposta do plano → **estado calmo** (teaser/"não foi possível verificar seu plano" + retry), não parede fria | **PASS** (90%) | `F3-gate-offline-calm` |
| Teaser | Free + deslogado: **sem preço, sem data, sem entrada-fake**; deslogado ganha [Entrar], logado-free não | **PASS** (95%) | `F1-teaser-signedout`, `F2-teaser-free` |
| C6 | QueueBanner não esconde [Sincronizar agora] atrás de uma entrada problemática | **PASS por código + visual parcial** (80%) | ver limitações |

## Guardas de honestidade (F1/FR-507)

- **"removido/excluído/deletado" em superfície de snapshot:** ausente nos detalhes e no confirm de descarte
  ("Ele não foi enviado para a sua conta e **não poderá ser recuperado**"). Assert automatizado no detalhe
  synced (`/removid|exclu[ií]|deletad/`) passou. **Ver Nit 1** sobre a palavra "excluir" no banner de lapse.
- **Pendente é "pendente", nunca "salvo":** toast `A3` = "Pendente neste dispositivo…", badges "Pendente neste
  dispositivo"; o assert `getByText("Registro salvo") == 0` offline passou.
- **Sem R$ 0,00 fabricado:** linhas de canal ausentes = ausentes (não zero); os R$ 0,00 no Detalhamento
  (Falha/Acabamento/Mão de obra) são **zeros reais gravados** (inputs opcionais = 0), idênticos ao que a
  própria calculadora exibe — fiéis, não fabricados. **Ver Nit 2.**

## Nits / observações (não-bloqueadores)

1. **"excluir" no banner de lapse** (`historico-page.tsx` `lapsedBanner` → `messages.pt-br` `historico.lapsedBanner`):
   "Para salvar, renomear, **excluir** ou exportar, reative o Premium." A palavra aparece numa superfície de
   histórico, mas como **capacidade Premium** (excluir um snapshot é feature real do E4), não como afirmação de
   que um registro foi removido. Não viola a intenção do F1, mas fica anotado por estar no limite literal da guarda.
2. **Detalhamento sempre imprime as 6 linhas fixas, inclusive as zeradas** (`snapshot-detail-page.tsx` `Breakdown`):
   `freezeBreakdown` sempre grava material/energia/máquina/falha/acabamento/mão-de-obra, então o filtro
   `!!r[1]` de "linha ausente não renderiza" é efetivamente **morto** para snapshots SINGLE — Falha/Acabamento/
   Mão de obra aparecem como "R$ 0,00" quando o input foi 0. É **fiel** (a calculadora mostra igual), então não
   é violação de FR-507; o mecanismo de chave-opcional protege mesmo é campos de fórmula FUTUROS e linhas de
   kit/canal genuinamente ausentes. Observação, não defeito.

## Limitações / não-verificado

- **C6 (estado misto pendente+problemático simultâneo, online):** não encenável de forma determinística pela UI
  — para ter um `pending` é preciso `active`; com `active` online o `OutboxSyncer` drena o pending antes de dar
  para fotografar; um `blocked` exige lapse, e um lapsed **não** pode criar novos pendings (botão ausente). O
  desacoplamento está **confirmado por código** (`historico-page.tsx`: `canDrain = pending>0 && online`,
  independente de `hasProblem`) e visualmente confirmei o `[Ver]` para problemas + o gating correto do
  `[Sincronizar agora]` (some offline, some quando não há pending saudável). Sem screenshot do estado misto.
- **Export (PDF/CSV) e "Recalcular hoje":** fora do PR-A (são PR-B, conforme `plan.md`). Não homologados aqui.

## Nota de método (o falso-PASS do T016, fechado)

A primeira passagem deste run teve 3 "falhas" que eram do MEU harness, não do produto, e foram corrigidas e
re-rodadas verde: (B) strict-mode em `getByText("Envio pausado")` — o texto casa badge **e** título do Alert,
o que na verdade **prova** que o Alert blocked renderiza; (D) `page.goto` (navegação dura) antes do enqueue no
IndexedDB completar — abortava a escrita; corrigido esperando o toast antes de navegar; (E) regex de R$ 0,00
ampla demais — pegava zeros legítimos do Detalhamento, não fabricação de canal. Produto correto nos três.

**Cobertura e2e que ainda falta (recomendação):** os caminhos **gravar snapshot de KIT** (aceite no backend +
render itemizado no atacado, C1) e **render de canal no detalhe** (M11) **não** têm spec e2e do time — os specs
adicionados (`history-offline`, `history-signout-queue`) só gravam SINGLE do calculador. Foram cobertos aqui
manualmente; valeria promover a e2e permanente.
