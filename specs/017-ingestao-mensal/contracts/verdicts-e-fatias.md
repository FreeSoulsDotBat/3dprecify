# Contrato: vereditos, fatias e composição (ADR-0028 Proposto)

O contrato interno do laço — o que um coletor PODE dizer e o que a composição PODE fazer.
Fonte de forma: `arquitetura-017.md` §A/§C; tipos concretos em `data-model.md` §1–§2.

## O que um coletor promete

1. Termina SEMPRE escrevendo `artifacts/<fonte>.verdict.json` (LIDO/ABORTADO/NAO_LIDO) e o sobe
   como artefato da run — inclusive quando falha (o diagnóstico de um mês quebrado não exige
   reexecutar contra a fonte).
2. `LIDO` carrega `slice` com APENAS as folhas que o coletor leu da fonte; `collectedAt` é a
   data da releitura REAL (fixture nunca carimba — FR-1011).
3. NUNCA escreve artefato, semente ou baseline de outro vigia; NUNCA chama `nextCatalogVersion`.
4. Falha de fonte (bot/CAPTCHA/layout/casca de SPA) ⇒ ABORTADO com status e motivo nomeado —
   NUNCA uma mudança de tarifa (fail-safe C6 / I2).

## O que a composição promete

1. Função total sobre `MARKETPLACE_COVERAGE`: nenhum marketplace calado — sem veredito no disco
   ⇒ `NAO_LIDO { reason: "o job não produziu veredito" }`.
2. `aplicarFatia` respeita a regra da folha lida: folha não declarada vem da BASE (anti-reversão
   do hotfix A2, provada por ponto fixo byte-idêntico — I9 estendido).
3. `decideRefresh` roda POR marketplace; fatia reprovada é descartada e o veredito vira
   ABORTADO (o PR parcial da clarify Q4, por tipo).
4. Após admitir tudo: UM `nextCatalogVersion` + UM `generatedAt` por execução. `RunOutcome` tem
   2 casos; não existe caminho de escrita fora deles.
5. A semente sai como `projetarSemente(artefato)` no MESMO PR (clarify Q3); idempotência provada
   com segunda passada + `git diff --exit-code` antes do `gh pr create`.

## Provas exigidas (portões de tarefa)

- Ponto fixo por fonte: entrada inalterada ⇒ saída byte-idêntica.
- Mutação: artefato envenenado (comissão fora de faixa · banda sobreposta · versão desalinhada
  de `generatedAt`) reprova em `gate:artifact` E em `gate:all`.
- Ausência: execução sem mudança ⇒ corpo sem seções de mudança (`not.toContain`).
