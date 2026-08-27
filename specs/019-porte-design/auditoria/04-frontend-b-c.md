# Auditoria de implementabilidade 019 — parecer 04: frontend PR-B / PR-C

> Agente `dev-frontend` (sonnet), 2026-08-27, só leitura. Entrada bruta da síntese.

## Achados por task

| task | achado (fato, arquivo:linha) | sev. | task reescrita |
| --- | --- | --- | --- |
| T044 | `catalogo-page.tsx:105-113` é UM bloco `if (signedOut \|\| status === "none") return <PremiumTeaser…>`. O texto "para o logado" contradiz research §E-5 (RESOLVIDO 27/08: o deslogado vê o MESMO caminho). | BLOQUEIA | Remover o bloco inteiro para AMBOS os casos; `catalog-panel.tsx:228-231` passa a ser o único lugar que decide o vazio didático via `premiumGate`. O `?produto=` early-return (`:96-103`) ocorre ANTES — ver T045. |
| T044 | `catalog-panel.tsx:228-231` confere byte a byte. | OK | — |
| T045 | `CatalogPanel.handleSubmit` (`:157-167`) sempre chama `create?.()/update?.()`; a única barreira hoje é o `<fieldset disabled>`. E-2 (research) exige que `create`/`update` NÃO sejam passados fora de `active` (`CatalogPanelProps:79-80` já são opcionais) — nenhuma task manda tocar `filaments-panel.tsx`/`printers-panel.tsx`. | RETRABALHO | `create={gate === "active" ? (b) => create.mutateAsync(b) : undefined}` (idem `update`). |
| T045 | `filament-form.tsx:88-92` / `printer-form.tsx:96-100`: com `readOnly` o "Salvar" é REMOVIDO do DOM (`{!readOnly && <Button type="submit">}`), contra `ui-porte.md` §C2 ("desabilitado e visível"). A task não menciona o rodapé (frase antes da linha; Salvar visível+disabled; secundário Assinar/Reativar). | BLOQUEIA | Rodapé novo: `<p>{salvarFazParteDoPremium}</p>` (não-active, antes da `div.flex.justify-end`) + Salvar SEMPRE renderizado `disabled={!isActive}` + `Button variant="secondary"` Assinar/Reativar quando não-active. |
| T045 | `catalogo-page.tsx:100` → `produto-page.tsx` com `readOnly={status === "lapsed"}` — NÃO cobre `none`; como o `?produto=` retorna ANTES da parede, um logado `none` em `/catalogo?produto=novo` tem formulário VIVO com `onSubmit` de rede (só o 403 freia). Brecha pré-existente. | BLOQUEIA | `readOnly={premiumGate(...) !== "active"}`; `produto-page.tsx:298,366,386` os 3 fieldsets viram `<Frozen>`; mesmo rodapé (confirmar arquivo:linha do footer do produto). |
| T037 | O ramo `ENTITLEMENT_REQUIRED` renderiza `EmptyState` sem `action` (compare `:240-248` que passa `action={addButton(true)}`). | RETRABALHO | T044: `<EmptyState icon="package" title={copy.emptyTitle} description={copy.emptyBody} action={addButton(true)}/>` unificando com o vazio comum. |
| T036/T043 | Forma de `premiumGate(entitlement, session)` não definida; `use-entitlement.ts` expõe `data?.status` + `isLoading/isError`; `useSessionStore` expõe `"loading"\|"authenticated"\|…`. As 4 telas têm `GateChecking`/`GateError` PRÓPRIOS. "lapsed-com-itens" não é derivável da função pura (itens são da lista). | PRECISÃO | Assinatura explícita; 4º membro = `"lapsed"` puro (a tela compõe "com itens"); decidir se `GateChecking`/`GateError` viram `unknown` padronizado. |
| T039 | As paredes reais: `historico-page.tsx:80` (`if (status === "none") return <TeaserShell signedOut={false}/>`) e `scenarios-list-sheet.tsx:462,475-476` (`showTeaser`). Sem citá-las, confunde-se com o vazio de lista zerada do `active` (`historico-page.tsx:117`). | BLOQUEIA | Trocar `:80` e `:462,475-476` pelo vazio didático com "Fazer um cálculo" → `/calcular`, 1 `TeaserUpgrade`. `signedOut` nessas duas telas: research §E-5 só fala de Catálogo — **confirmar com o dono**. |
| T046 | **Não existe "Montar kit" nem botão disabled por plano** em `bom-page.tsx`. O mecanismo real é a parede `bom-page.tsx:136` `if (status === "none") return <BomGatePanel signedOut={false}/>` (comentário `:132-135`: "PR-A parked this split for PR-B"). O composer compõe localmente sem rede (diferente do Catálogo); "Salvar" está em `:632`. | BLOQUEIA | Remover a parede `:136`; composer em `<Frozen>`?; `save` `:632` `disabled={!isActive \|\| saving}` + secundário. "Montar sem salvar" no grátis é decisão de produto não coberta (N1). |
| geral | `shared/billing/` só tem `premium-teaser.tsx/.css` e `teaser-upgrade.tsx`; sem barrel `index.ts`. | PRECISÃO | T043: "sem barrel; import direto". |
| T049 | `<Aviso role="status">` não compila: `AvisoProps` (`aviso.tsx:7-13`) = `children`, `action?`, `className?`; `role` já é fixo (`:23`). | PRECISÃO | `<Aviso action={<Button variant="ghost" size="sm">Entendi</Button>}>{texto}</Aviso>`. |
| T049/T056 | `avisoDeCampo` (`shared/lib/plausibilidade.ts:218`) é chamado em 3 pontos de `calculator-form.tsx`, todos a cada render, como texto no `hint` do `Field` (`<span className="tf-field__aviso">`): `ControlledField` (`:179`, reaproveitado por `widgets/bom-line-editor` — `:169-172`), `printTimeHours` (`:302`), `machineLifetimeHours` (`:455-464`). T056 fala como se fosse um ponto. | BLOQUEIA | T056: hook `useAvisoDeCampo(nome, valorBruto)` (valor comprometido no blur via ref; dispensa por store) aplicado nos 3 pontos; `<Aviso>` como IRMÃO do `Field`, não dentro do `hint`; conferir `bom-line-editor`. |
| T049 | O comentário `calculator-form.tsx:174-178` documenta o OPOSTO ("hint vira error, aviso some — comportamento certo"); research §H reverte. | RETRABALHO | Apagar/reescrever o comentário `:169-178`. |
| T050 | Sem precedente de store Zustand SEM `persist` (`nav-rail-store`/`theme-store` usam persist). | PRECISÃO | Só `create`, sem `persist`. |
| T051/T057 | `costPerHour` devolve 0 para `lifetimeHours<=0`, e `calculator-form.tsx:416-418` imprime "≈ R$ 0,00 por hora" — o que T051 proíbe. O modo `adjustMode` (`:431-490`) NÃO tem readout nenhum. | BLOQUEIA | Componente `<MachineCostReadout>` nos DOIS ramos (`:384-430`, `:431-490`): `perHour>0` → "de {valor} ÷ {horas} h"; `machineValueNum===0 \|\| currentHours<=0` → ressalva; `derivedCaption` vira obsoleta. |
| T051/T057 | Só "Usar estimativa por ritmo" (`:482-485`) perde dado (sobrescreve `machineLifetimeHours`); "Ajustar" (`:425`) não perde nada. | RETRABALHO | Diálogo (`shared/ui/dialog`, `variant='center'`) SÓ no retorno ao ritmo quando `detectRitmoMode(currentHours) === null`. |
| T052/T058 | `FeeSeal` é `<Badge>` (`fee-seal.tsx:100-107`), sem prop `marketplace`; `FeeSealState` tem variantes `reference`/`catchAll` (com `source`+`reviewedOn`) e `adjusted`/`estimate`/`none` (sem fonte → sem dispensa). A chave `(marketplace, source, effectiveDate)` bate com `FixedFeeSourceBadge` (`:117-128`, `effectiveDate`), não com `FeeSeal` (`reviewedOn`). | BLOQUEIA | `FeeSeal` ganha `marketplace`; só `reference`/`catchAll` recebem `onDismiss`; decidir se `FixedFeeSourceBadge` também vira Alert compact dispensável; chave `${marketplace}::${source}::${effectiveDate ?? reviewedOn}`, 50 mais recentes. |
| T053/T060 | `number-field.tsx:64-76` hardcoda `formatDecimal(n, 2)`; sem prop `precision`. | PRECISÃO | `precision?: number` (default 2); `precision={4}` só no campo de tarifa (nome exato a confirmar em `calculator-schema.ts`). |
| T059 | `pages/calcular/calcular-page.css` **não existe** (criação). O token é `--tabbar-h` (`styles/tokens/spacing.css:41`; usado em `toast.css:6`), não `--tf-tabbar-h`. | PRECISÃO | — |
| geral | Sem `data-testid` para o form Frozen, o botão Assinar/Reativar, o diálogo de modo. | RETRABALHO | Ver lista. |

## Tasks NOVAS

- N1 [US3] `bom-page.tsx` — decisão do dono: "montar kit sem salvar" no grátis/lapsed é permitido (composição local sem rede)? research §A/§E nunca analisa Kits.
- N2 [P] [US3] `premium-gate.ts` — nome do 2º membro (`"lapsed"` vs `"lapsed-com-itens"`).
- N3 [US3] `filaments-panel.tsx` / `printers-panel.tsx` / `produto-page.tsx` (via `catalogo-page.tsx`): `create`/`update` = `undefined` fora de `active`.
- N4 [US3] `filament-form.tsx` / `printer-form.tsx` / footer do produto: rodapé novo (Salvar visível+disabled; secundário Assinar/Reativar).
- N5 [P] [US4] `calculator-form.tsx` — hook `useAvisoDeCampo` nos 3 pontos + `bom-line-editor`.
- N6 [US4] `fee-seal.tsx` — `FixedFeeSourceBadge` também dispensável?
- N7 [US4] Nome exato do campo de tarifa antes de `precision={4}`.

## data-testid / i18n / exports que precisam nascer

- testids: `catalog-form-frozen`, `catalogo-assinar-premium`/`catalogo-reativar-premium`, `aviso-${meta.name}` (já existe dentro do hint — sobrevive ao novo local), `price-summary-sticky`, `fee-seal` (conferir após Badge→Alert), diálogo de modo.
- i18n (slots a nascer, copy nas T042/T055): `catalogo.emptyFilamentsFree*` (ou reaproveitar `emptyTitle/emptyBody`), `premiumTeaser.salvarFazParteDoPremium`, `catalogo.reactivateSalvo`, `historico.vazioGratisTitle/Cta`, `scenarios.vazioGratisTitle/Cta`, `machineCost.readoutDivisao`, `machineCost.ressalvaZero`, `machineCost.confirmacaoTitle/Body1-3`, `calculator.seals.verFonte`.
- exports: `Plist` (grafia, `shared/ui/index.ts:91`), `Frozen/Aviso/Table` (`:88-98`); `shared/billing` sem barrel.

## jsdom → e2e

- Contraste no Frozen (T016 já). T040 outbox IDB (e2e). T051 geometria do readout a 360/390 (`overflow-geometria`). T054 sticky (e2e). T052/T058 alvo 44×44 (`a11y-targets-contrast`).
