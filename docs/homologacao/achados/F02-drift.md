# F02 — Drift spec ↔ código (consolidação)

## Resumo

~238 requisitos (FR/SC) das **14 specs** avaliados contra o código do head do PR #36. **Nenhum
AUSENTE sem decisão que o justifique**, e nenhum caso do padrão caro ("o `tasks.md` diz FEITO e o
código não faz") sobreviveu à verificação — 9 remediações da auditoria anterior foram reconferidas
uma a uma e todas batem. As fórmulas de preço batem **linha a linha** com `pricing-core`.
O drift real é **documental, e é de um tipo específico e recorrente: a spec antiga nunca é emendada
quando uma decisão posterior a supera.** Quem lê a `001` conclui que a calculadora exige login
(a `003` a tornou pública de propósito); quem lê a `007`/`008` conclui que não há preço em teaser
(o E6 acendeu os quatro); quem lê a `011` até o §4 conclui que o piloto ficou em aberto (o veredito
fechado está 47 linhas abaixo, no mesmo arquivo). **O código não mente; três documentos mentem.**
Detalhe por spec em `F02-drift-A.md` (001–005), `F02-drift-B.md` (006–010), `F02-drift-C.md`
(011–014 + audit-confirmation).

---

## Como esta fase foi executada

Três subagentes em paralelo (R9), um por grupo de specs, cada um gravando seu próprio arquivo (R3).
O main loop **verificou as afirmações antes de consolidar** — protocolo adotado depois de a F01 ter
recebido um fato falso de um subagente.

### Afirmações verificadas nesta consolidação

| afirmação do subagente | verificação | resultado |
| --- | --- | --- |
| `PRICING_MODEL_VERSION` é 3.1.0, não 3.0.0 | `grep -n` em `packages/pricing-core/src/index.ts` | **confirmado** — linha 20 |
| A `011` diz `*(empty slot)*` e traz o veredito fechado no mesmo arquivo | `sed -n '259,263p'` e `'309,313p'` | **confirmado** — linhas 262 e 309 |
| A1-r continua aberto (`sort` por rank antes de preço) | leitura de `channels.ts:235-237` | **confirmado** |
| Zero schemas fantasma no contrato | `grep -c HTTPValidationError contracts/openapi.json` | **confirmado** — 0 |
| `pnpm gate:all` é o mesmo literal em lefthook e CI | `grep -n` nos três arquivos | **confirmado** — `lefthook.yml:20`, `ci.yml:32` |
| O gatilho PL/pgSQL de imutabilidade existe | `grep -c` em `0003_e4_snapshots.py` | **confirmado** — 3 ocorrências |
| `serializeKitBasis` não tem chamador de produção | `grep -rn` excluindo testes | **confirmado** — só a definição, `config-document.ts:164` |

Nada de produção foi tocado (R8): `git status` fora de `docs/homologacao/` está vazio.

---

## O achado transversal — e é o único que aparece em TODAS as três frentes

### [F02-000] Specs antigas nunca emendadas quando uma decisão posterior as superou

- **Classificação**: DIVERGENTE-POR-DECISÃO, documental
- **Certeza**: 98% (três instâncias independentes, cada uma verificada no código)
- **Origem**: `develop` (as três precedem o PR #36)

Três instâncias medidas:

1. **`001` FR-002 exige login para a calculadora.** A `003` a tornou pública **deliberadamente** e
   registrou isso no próprio `tasks.md:267` ("not drift"). A `001` nunca foi emendada.
2. **`007` e `008` prometem "sem preço e sem CTA de compra antes do E6"** como garantia de
   honestidade. O E6 chegou, os quatro teasers acenderam com preço real, e a mudança está registrada
   **só na spec 012** — nunca reescrita de volta nas specs 007/008 nem nos `dod-evidence` delas.
3. **`011` se contradiz dentro do mesmo arquivo**: `dod-evidence.md:262` diz
   `Pilot verdict (T033): *(empty slot)*`, e a linha 309 abre "Veredito do piloto — fechado
   2026-07-20" com os números.

**Por que isto importa mais do que parece**: esta auditoria existe para preparar um provisionamento,
e um provisionamento é feito por quem **lê** o registro. As três instâncias enganam na mesma direção
— fazem o produto parecer mais restrito e menos pronto do que é. E a instância 2 é a mais cara,
porque a frase que envelheceu é uma **promessa de honestidade**: um leitor da `007` concluiria que a
implementação atual viola a própria spec.

**Não é defeito de comportamento.** O código faz o certo nas três. O que está errado é o documento.

---

## O que NÃO foi encontrado, e vale dizer

- **Zero** requisito de núcleo AUSENTE sem decisão registrada.
- **Zero** casos de "`tasks.md` marca FEITO e o código não faz" — o padrão mais caro, procurado
  explicitamente nas 14 specs e reconferido em 9 remediações da `audit-confirmation`.
- As fórmulas de precificação (`004` FR-024–039, `005` FR-101–119) batem **linha a linha** com
  `packages/pricing-core/src/index.ts`. **Isto não substitui a F03**: bater com a spec é uma coisa,
  estar numericamente correto é outra, e a F03 é quem mede a segunda.

---

## Pendências abertas por esta fase

Cada arquivo parcial termina com a sua própria seção `## Não verificado`. Os itens são de dois tipos:

- **Exigem execução** (rerodar e2e, medir tempo) — vão para as fases que já executam: F08, F11a/b, F13.
- **Exigem leitura que não coube no orçamento** (transcrever ~20 `CheckConstraint`, corpo completo do
  `deploy.yml`) — não são incerteza, são volume. Ficam registrados e podem ser fechados sob demanda.

Um item merece decisão do dono e foi para `PENDENCIAS.md` §P-005: **as três specs desatualizadas
devem ser emendadas?** Emendar spec fechada é decisão de processo, não de código, e a Constituição
(Princípio VI — documentação viva e enxuta) admite as duas leituras.
