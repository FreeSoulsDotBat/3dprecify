# ADR-0029 — A semente como PROJEÇÃO GERADA do artefato servido

- **Status**: Proposto (2026-08-07 — flip no gate do dono da PR-A do 017)
- **Data**: 2026-08-07
- **Contexto**: 017-ingestao-mensal (P0-a · US7 · FR-1012 · clarify Q3) — desenho em
  `arquitetura-017.md` §B/§C. O defeito é MEDIDO: `fee-catalog.test.ts` crava `catalogVersion`
  em literal e a literal foi reeditada à mão DUAS vezes em dois dias (PR-F e hotfix A2/A3);
  o primeiro PR mensal nasceria vermelho por construção com o dado correto (SC-1008).
- **Decide**: a relação formal entre a semente offline (`apps/web/.../seed`) e o artefato
  servido (`backend/app/data/catalog.json`), e quem tem permissão de escrevê-la.
- **Relaciona**: ADR-0010 (semente empacotada, SC-810 orçamento de boot) · 014/U5-b (ramo de
  cache de adoção, acorda com teste) · ADR-0019 (rótulo imutável em snapshot).

## Decisão

1. **A semente deixa de ser documento e vira SAÍDA**: `projetarSemente(servido)` →
   `seed.data.json` (JSON gerado, nunca editado à mão); `seed.ts` encolhe para política + parse
   + export. A poda medida (Amazon: 78 entradas servidas, 0 na semente — orçamento SC-810) vira
   **política declarada e testável** em `seed-projection.ts`, em vez de acidente curatorial.
2. **A paridade P0-a vira RELACIONAL — quatro relações, nenhum valor cravado**:
   (i) `semente == projetarSemente(servido)`; (ii) `catalogVersion` casa
   `/^\d{4}-\d{2}-\d{2}\.\d+$/` E sua data é a de `generatedAt`; (iii) `schemaVersion` igual nos
   dois; (iv) o rótulo é o que `nextCatalogVersion` produziria — provado no ponto de geração.
3. **Idempotência é portão de publicação**: `pnpm fee:build` roda DUAS vezes no job; a segunda
   exige `git diff --exit-code` vazio antes do `gh pr create` (o mecanismo do contract-drift,
   trazido para o dado de dinheiro).
4. **JSON e não TS** porque um gerador que reescreve `seed.ts` destruiria os comentários
   curatoriais (verbatims Shopee) — que **migram na mesma fatia** para
   `packages/fee-ingest/data/` como âncoras EXECUTÁVEIS (RA4: se a migração não acontecer na
   mesma fatia, esta decisão reverte).

## Consequências

- Proibida qualquer literal de `catalogVersion` em teste/app/fixture não-datada.
- O guarda fica verde num mês COM e num mês SEM execução (SC-1007) — a relação não depende de
  valores absolutos.
- "Paridade estrita" da clarify Q3 significa paridade da PROJEÇÃO (conflito 2 do desenho,
  apontado): igualdade de documento contrariaria a poda medida e o orçamento de boot — se o
  dono quiser igualdade plena, é decisão nova com custo de boot declarado.

## Rejeitadas

- Só igualar `catalogVersion` (não guarda conteúdo — a semente poderia divergir para sempre).
- Igualdade de documento (estoura SC-810 e muda a primeira pintura offline).
