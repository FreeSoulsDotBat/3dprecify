# Specification Quality Checklist: Mapeamento categoria→comissão (ML + Amazon)

**Purpose**: Validar completude e qualidade da spec antes de avançar para clarify/planning
**Created**: 2026-07-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — **com exceção declarada, ver Notas**
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — **4 perguntas deferidas, nenhuma bloqueante, ver Notas**
- [x] Requirements are testable and unambiguous — **resolvido na sessão de clarify de 2026-07-28**
- [x] Success criteria are measurable
- [ ] Success criteria are technology-agnostic — **3 SCs referenciam mecanismo, ver Notas**
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — **com exceção declarada**

## Notas

**Sobre os três itens não marcados — são desvios conscientes, não descuidos.**

1. **RESOLVIDO em 2026-07-28.** Os três requisitos que dependiam de pergunta aberta foram fechados na sessão de
   clarify: FR-011/FR-011a e US1 AS2/AS2b (Q5), FR-003a e US8 (Q10), FR-014a (Q8). Também entraram FR-020a (Q7) e a
   fatia própria do ML (Q2). A US7 continua dependente de **Q11**, mas deixou de ser bloqueante: ela era a mitigação
   para o ML travado, e o ML destravou.

2. **Marcadores [NEEDS CLARIFICATION] ausentes por decisão.** O dono instruiu, na abertura da spec: *"perguntas que
   ficam para o /speckit-clarify — não resolver agora, enumerar"*. Cinco foram resolvidas no clarify; **restam 4**
   (Q4, Q9, Q11, Q12), todas com recomendação de alta confiança no brief e nenhuma capaz de mudar o plano — as duas
   alternativas que mudariam (mexer em `pricing-core`, inventar taxonomia interna) já estão marcadas como FORA do
   escopo. **A ausência de marcadores não significa ausência de incerteza** — significa que a incerteza tem
   endereço.

3. **Vocabulário de mecanismo em 3 SCs e alguns FRs.** SC-810 fala em semente embutida, SC-811 em tokens de LLM,
   SC-813 e FR-025 em runner hospedado / self-hosted; FR-023 fala em refresh token. Isso viola a regra de
   "tecnologia-agnóstico" em sentido literal, e mantive de propósito: **são restrições já decididas** pelo ADR-0010
   §A10/§A13 e pelo parecer bloqueante do `seguranca`. Pelo Princípio VIII, o plano não pode redecidi-las; se a
   spec as apagasse em nome de pureza de forma, elas voltariam à mesa como se estivessem abertas. O custo de
   descrever mecanismo aqui é menor que o de perder uma decisão medida.

**Correções que esta spec faz no scope brief** (o brief é anterior aos gates e está desatualizado em dois pontos):
US6 deixa de estar bloqueada; a exigência de egress BR na US6 AS5 é **falsa** e foi substituída pelo resultado
medido do G1; Q6 sai da lista de abertas (os dois marketplaces em runner hospedado).

**Status**: pronta para `/speckit-clarify`. Os 9 itens da tabela de perguntas abertas são a pauta dele.
