# Relatório da homologação pré-provisionamento — Precifica3D

**Período**: 2026-08-02 a 2026-08-03 · **16 fases de investigação** (F01–F13, com F02, F03, F04 e
F11 desdobradas) · **31 achados** · **auditoria somente-leitura**, correções em rodada separada.

---

## Veredito

**Nenhum achado bloqueia o provisionamento hoje** — porque os que bloqueavam foram corrigidos.

| severidade | achados | corrigidos | abertos |
| --- | --- | --- | --- |
| **Bloqueante** | 1 | **1** | 0 |
| **Alto** | 5 | **5** | 0 |
| **Médio** | 12 | 4 | 8 |
| **Baixo** | 13 | 5 | 8 |
| **total** | **31** | **15** | **16** |

Os 16 abertos são todos **Médio ou Baixo**, todos registrados com `arquivo:linha`, e nenhum deles
impede cobrar, calcular ou entregar. A lista está em §Achados abertos.

---

## Os três padrões que a auditoria mediu

Estes valem mais que os achados individuais, porque preveem onde o próximo defeito vai estar.

### 1. A cura existe num módulo e não foi aplicada ao irmão — **cinco instâncias**

| curado em | não curado em |
| --- | --- |
| imports com extensão (`fee-ingest`, US4, blocker CRÍTICO) | `pricing-core` — **não bootava sob `node`** |
| `then(run, run)` no `outbox.ts:121` | seis pré-carregamentos de cache sem `.catch` |
| NBSP em três constantes de cópia | `formatBRL`, com **19 chamadores** |
| paginação keyset em `history` e `scenarios` | `filaments`, `printers`, `products`, `boms` — **sem limite** |
| regras migradas para fora do arquivo isento | `MIN_ROWS = 28`, o piso que aceita o catálogo de tarifas |

**O que fazer com isto**: quando um defeito for corrigido, a pergunta seguinte não é "testei?" — é
**"quem mais tem isto?"**.

### 2. O repositório descreve o que não cumpre

Quatro afirmações que o E6 tornou falsas e ninguém emendou; um `PRICING_MODEL_VERSION` que a spec dá
errado; um `dod-evidence` que se contradiz a 47 linhas de distância; tokens de cor com a promessa
escrita `/* AA: ~7:1 */` que nada media; e uma remediação de segurança marcada **"imediatamente"**
que ficou meses parada.

**O que fazer com isto**: a documentação envelhece em silêncio. O que a mantém honesta é ela ser
**verificada**, não revisada — foi um teste que provou os 7:1, não uma releitura.

### 3. Teste coerente por construção não testa coerência

As fixtures só alimentavam combinações consistentes, e a inconsistência é o caso que importa. Custou
dois defeitos reais: o **"ativo falso"** do T027 (14 testes de unidade cegos) e o `[F04a-001]`
(validade errada quando dois grants se sobrepõem).

---

## O Bloqueante, e por que ele era pior do que parecia

**`[F04b-001]`** — o webhook do Mercado Pago devolvia `200 "ignored"` tanto para "o MP disse que não
existe" quanto para "não consegui perguntar ao MP".

O que a medição da documentação oficial revelou: **o MP reenvia a cada 15 minutos até receber
200/201**. Ou seja, a recuperação já existia — e o código **a desarmava**, dizendo "recebi" para um
evento que jogou fora. Não faltava construir uma rede; faltava parar de cortar a que havia.

---

## O que foi corrigido

| lote | achados | PR |
| --- | --- | --- |
| A6+A1 — o preço para de quebrar no meio do número | `[F11a-002]` `[F11b-001]` `[F12-001]` | #37 |
| A2 — o webhook para de desarmar o reenvio do MP | `[F04b-001]` **Bloqueante** | #37 |
| A9 — exclusão de conta LGPD com caminho auditável | `[F05-001]` `[F07-001]` | #37 |
| A4 — 33 ações de CI fixadas por SHA + guarda | `[F09-001]` | #37 |
| A3+A5 — a validade certa e as quatro curas do irmão | `[F04a-001]` `[F03a-001]` `[F08-001]` `[F10-001]` `[F05-002]` | #37 |
| A10 — Shopee conferida na fonte | `[F06-001]` | #38 |
| A8+A11 — as seis decisões de UI | `[F11b-002]` `[F11b-004]` `[F11a-007]` `[F11a-006]` `[F03a-003]` `[F03a-002]` `[F11a-003]` | #39 |
| A7 — as specs que descreviam o que não é verdade | `[F02-000]` e família | este |

---

## Achados abertos (16) — nenhum bloqueia

### Médios (8)

| achado | o quê | por que ficou |
| --- | --- | --- |
| `[F11b-003]` | a 360px a aba "Impressoras" renderiza **"mpressoras"** | cosmético, não decidido |
| `[F11a-004]` | sete gatilhos de ajuda com alvo de **28×28px** (mínimo 44) | não decidido |
| `[F11b-005]` | três ações só-ícone com **4px** entre "Duplicar" e "Excluir" | não decidido |
| `[F13-001]` | **7,1s de tela em branco** na primeira visita (celular fraco, 3G) | o PWA resgata a 2ª visita em **−98%**; e a medição mostrou que dividir por rota compra só **11,7%** |
| `[F13-002]` | toda leitura protegida é precedida de uma **escrita com commit** | envelhece mal com escala, não com um usuário |
| `[F13-004]` | quatro listas de catálogo **sem limite**, cliente sem virtualização | dói com volume que ninguém tem ainda |
| `[F13-005]` | **15,6ms por tecla** em celular médio, 99,3% re-render | precisa de projeto, não de remendo |
| `[F10-002]` | "teste que passa sem provar nada" não é detectável mecanicamente | virou linha na Definição de Pronto |

### Baixos (8)

`[F11a-005]` (37% da largura a 1440) · `[F11a-007]` residual · `[F11b-006]` (21% do nome) ·
`[F11b-007]` (cortesia sem caminho de assinatura) · `[F11b-008]` (painel do kit come 45%) ·
`[F13-003]` (ledger inteiro por requisição) · `[F13-006]` (`pricing-core` lança e mata a conta por
banda malformada — **inalcançável hoje**) · centavos na linha de baixo a 768px (pré-existente).

---

## Lacunas honestas — o que NÃO foi verificado

Esta seção existe porque silêncio se lê como cobertura.

| não verificado | por quê | risco de deixar assim |
| --- | --- | --- |
| **leitor de tela** nos fluxos principais | exige execução assistiva real | a lacuna mais séria da a11y; um vendedor cego não foi considerado |
| **cobrança real** (cartão, webhook, renovação, carência) | precisa do sandbox MP (**T002**, do dono) | tudo foi provado contra o stub local |
| **volume real de dados** | exigiria semear o banco, proibido na rodada somente-leitura | `[F13-004]` não foi sentido |
| **latência de rede e servidor** | nada provisionado | os 7,1s são `vite preview` em localhost |
| **rollback** documentado | `[F02B-001]` — escrito, **nunca exercitado** | um procedimento nunca executado é uma hipótese |
| **teclado ponta a ponta** | tempo | há foco-ao-título testado, não a jornada |
| **backups e restauração** | não existem | um restore reintroduz dado excluído (está no runbook LGPD) |
| **vazamento de memória** em sessão longa | não medido | há precedente: `QueryClient` não desmontado em teste |

---

## Fora do escopo, achado ao ler a fonte (A10)

Três lacunas do modelo de tarifas da Shopee, **não corrigidas**, registradas por serem dinheiro do
vendedor:

1. a tabela **CPF** cobra `+ R$ 3 por item` acima de 450 pedidos/90 dias — o catálogo modela só a CNPJ;
2. abaixo de **R$ 8** (CNPJ) e **R$ 12** (CPF) as taxas mudam;
3. o **subsídio Pix** (5–8%) não é modelado — este erra para o lado seguro.

---

## Na mão do dono

| item | por quê |
| --- | --- |
| ligar **`sha_pinning_required: true`** | configuração de repositório; o guarda cobre o versionado, isto cobre o que o GitHub executa |
| **T002** — sandbox real do MP | destrava homologar cobrança de verdade |
| excluir usuário no **Firebase Auth** | passo manual, separado do CLI de exclusão (está no runbook) |
| autorizar a **fatia ML (US6)** | precisa das 8 condições do parecer de segurança |

---

## Método — o que funcionou, medido

- **Observar o vermelho, e ler cada verde nele.** Pegou 4 das 5 instâncias de teste vácuo.
- **Mutar o código e exigir que o teste caia.** Provou o gatilho LGPD (**duas** mutações: a primeira
  bloqueava tudo, e 4 testes passavam pelo motivo errado), o guarda de SHA, a asserção de posição da
  promessa e o teste de boot do `pricing-core` — este último mostra o achado em miniatura: **ele cai
  e os outros 118 passam cegos**.
- **Executar o ponto de entrada.** Um pacote que não boota é invisível para o vitest, que é o
  resolvedor tolerante.
- **A imagem acha o que a geometria não acha; a geometria acha o que o texto não acha.** E o corolário
  que esta rodada acrescentou: **três dos meus próprios instrumentos produziram número falso** — o
  piso de dois `requestAnimationFrame`, a contagem de locales do esbuild, e `getClientRects()` num
  elemento de bloco. Todos pegos por controle. O critério vale para quem mede.

---

*Detalhe por fase em `docs/homologacao/achados/`. Decisões do dono e o plano de correção em
`_PLANO-CORRECAO.md`. Roteiro para a homologação humana em `ROTEIRO-MANUAL.md`.*
