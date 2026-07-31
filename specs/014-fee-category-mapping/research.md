# Phase 0 — Research: 014 category→fee mapping

**Data**: 2026-07-28 · **Regra**: nada aqui é suposto. Cada linha é medição desta sessão, decisão registrada do
dono, ou fonte oficial. Onde não medi, digo que não medi.

---

## R1. A comissão do ML varia por profundidade da árvore? — **MEDIDO, e corrigiu minha primeira hipótese**

**Método.** Duas amostragens contra a API real com o token da conta da casa, egress BR, 2026-07-28.

**Amostra 1 (3 trilhas, raiz → 4º nível).** A alíquota se manteve constante em todas:

```
MLB5672 Acessórios p/ Veículos  17%  →  17%  →  17%  →  17%
MLB1051 Celulares e Telefones   18%  →  18%  →  18%  →  18%
MLB1574 Casa, Móveis e Decor    16.5% → 16.5% → 16.5% → 16.5%
```

**Hipótese formada e depois REFUTADA**: "a alíquota é definida no topo; bastam ~32 entradas".

**Amostra 2 (32 raízes × até 3 filhos = 96 comparações).** **84 herdam, 12 divergem (12,5%)**:

| raiz | alíquota raiz | filho divergente |
|---|---|---|
| Celulares e Telefones | 18% | **Celulares e Smartphones 16%** |
| Games | 18% | **Consoles 16%** |
| Joias e Relógios | 17,5% | **Acessórios Para Relógios 19%** |
| Instrumentos Musicais | 16,5% | **Caixas de Som 18%** · Equipamento para DJs 18% |
| Agro | 14% | Agricultura de Precisão 17% · Animais 17% |
| Eletrodomésticos | 18% | Cuidado Pessoal 17% |
| Esportes e Fitness | 17,5% | Artes Marciais e Boxe 16,5% |
| Arte, Papelaria e Armarinho | 16,5% | Artigos de Armarinho 17% |
| Mais Categorias | 17% | Assinatura do MELI Plus 16% |

**Decisão**: a alíquota é **constante por trechos** — herdada por padrão, sobrescrita em pontos específicos.

**Consequência de design** (o achado mais valioso desta fase): guardar a alíquota **apenas nos nós onde ela difere
do pai**, e resolver **subindo a cadeia de ancestrais até o primeiro nó com valor definido**. Isso não é só
compressão: **é o casamento mais-específico do SC-801 expresso estruturalmente**, determinístico e independente de
ordem *por construção*, em vez de depender de ordenação ou desempate.

**Alternativas consideradas**:
- *Uma entrada por folha* — rejeitada: infla o artefato sem informação nova em ~87,5% dos nós.
- *Só as 32 raízes* — **rejeitada por medição**: erraria a alíquota em ~1 de cada 8 categorias, e justamente nas de
  maior volume (Celulares, Games). Era minha hipótese inicial; a amostra 2 a matou.

**O que NÃO medi**: o total de nós onde a alíquota diverge na árvore inteira. Só uma varredura completa responde, e
ela é uma tarefa do incremento — não um número para eu estimar aqui. **Confiança de que a compressão por herança
reduz o artefato em pelo menos uma ordem de grandeza: 85%** (12,5% de divergência numa amostra de largura 96).

---

## R2. Geo-gate do ML — **MEDIDO: não existe**

G1, duas pontas, mesmo token: runner hospedado nos EUA devolve números **idênticos** aos de egress BR (ADR-0010
§A13). A crença registrada desde 2026-07-06 é falsa.

**Causa real dos 403 anteriores**: permissões da aplicação. Uma app com tudo em "Sem acesso" recebe 403
`PA_UNAUTHORIZED_RESULT_FROM_POLICIES` em toda a família `/sites/*`, **inclusive anônimo**, enquanto `/users/me`
responde 200. **Mínimo suficiente medido: "Publicação e sincronização: Leitura".**

**Consequência**: ML em runner hospedado (Opção 3D). Sem runner BR, sem máquina a possuir.

---

## R3. Amazon precisa de credencial? — **MEDIDO: não**

G2: a tabela pública renderiza **byte a byte idêntica** de egress US (38 linhas, mesmas categorias e alíquotas,
catch-all "Outros 15%" presente). Página é JS-renderizada — exige browser headless; `curl` devolve casca vazia.

**SP-API descartada** (não é a ferramenta): `getMyFeesEstimate` estima taxa de um ASIN específico, não entrega mapa
categoria→alíquota, e exigiria registro de developer + IAM. **Confiança: 90%.**

**Armadilha registrada**: a Amazon escreve as células de dinheiro com **U+00A0**. Um parser que compare com espaço
comum falha silenciosamente — foi o que reprovou o G2 na terceira rodada. O parser do incremento precisa normalizar.

---

## R4. Rotação do refresh token do ML — **MEDIDO**

G3: o ML devolve um refresh token **diferente** a cada uso, **mas o antigo continua válido** (replay → 200).

**Consequência**: GitHub Secrets **sem write-back** é viável (QA2 opção (c)) — uma escrita-de-volta que falhe não
mata o laço mensal. Sem essa medição, o desenho teria que carregar um PAT com permissão de escrever segredos.

---

## R5. Estado atual do catálogo — **LIDO do repositório**

`backend/app/data/catalog.json` (`catalogVersion 2026-07-07.0`): **MERCADO_LIVRE 0 entradas · AMAZON 0 entradas ·
SHOPEE 1**. O 014 popula ML e Amazon **do zero**.

**Consequência**: o SC-805 (nunca reduzir cobertura) é trivialmente satisfeito para ML e Amazon — não há cobertura a
perder. O risco de regressão de cobertura se concentra na Shopee, que o incremento **não toca**.

---

## R6. `resolveEntry` viola o SC-801 hoje — **LIDO do código**

`apps/web/src/shared/fee-catalog/fee-catalog.ts:113` usa `.find()` com casamento por **subconjunto** de
determinantes. Uma entrada `{listingType}` e uma `{listingType, category}` **ambas** casam com um slot que informa
os dois — e vence **a primeira do array**. O resultado depende da ordem do arquivo, que é exatamente o que o SC-801
proíbe.

**Decisão**: reescrever a resolução como caminhada pela cadeia de ancestrais (R1). **Desempate**: entradas com
conjunto de determinantes idêntico são **erro de validação no parse/boot**, não uma escolha em runtime — a
ambiguidade deixa de ser resolvível porque deixa de ser representável.

**Alternativa rejeitada**: ordenar por número de determinantes e pegar a mais específica. Funciona, mas continua
admitindo empate entre duas entradas igualmente específicas e resolve por ordem — o mesmo defeito, mais escondido.

---

## R7. O guard F3 é cego a faixas de preço — **LIDO do código** (herdado do 013)

`fee-catalog.ts:69` exige que uma entrada com `commissionPct: null` carregue `priceBands`, **mas não verifica se as
bandas carregam comissão**. Uma entrada com bandas de comissão nula passa e pré-preenche 0% sob selo de
"referência".

**Decisão**: estender ao nível de banda (SC-802/FR-008). Rejeição no parse/boot, ruidosa.

---

## R8. O eixo `category` cabe no contrato atual sem mudança de forma

`determinants` já é `z.record(z.string(), z.string())`. Acrescentar a chave `category` **não** muda o schema do
envelope nem quebra entradas existentes (Shopee usa `determinants: null`).

**Consequência**: nenhuma migração de contrato; a mudança de shape fica confinada à **resolução** e ao novo artefato
de árvore de categorias.

---

## Pendências que NÃO resolvi aqui (Princípio VIII — não inferir)

Duas escolhas de **estrutura de projeto** e uma de **entrega de dados** não podem ser padrão silencioso. Estão
enumeradas com opções e confiança em `plan.md` §Decisões estruturais pendentes.
