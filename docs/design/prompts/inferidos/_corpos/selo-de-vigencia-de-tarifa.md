# Selo de procedência e vigência da tarifa (e o selo separado da taxa fixa)

## O que desenhar
O selo de honestidade que fecha cada **slot de canal** dentro da aba **Calcular** do Precifica3D. O vendedor escolhe um marketplace (Mercado Livre, Shopee, Amazon, Outro), o app **pré-preenche** comissão, taxa fixa e frete a partir do catálogo de tarifas, e o selo é a única coisa na tela que diz **de onde veio aquele número e quando ele foi conferido pela última vez** — ou que confessa que não veio de lugar nenhum. Ele aparece logo abaixo da grade de campos de taxa e das legendas do slot (banda aplicada, subsídio de frete Shopee, sobretaxas opcionais), e logo acima dos avisos de risco da Shopee. Podem coexistir **até três selos na mesma linha** (`flex-wrap`): o selo principal da comissão, o selo `estimativa de frete` e o selo separado da **taxa fixa**, quando ela tem fonte própria. Origem no código: `apps/web/src/features/calculator/fee-seal.tsx` + `fee-seal.css`, montado por `fee-prefill.ts` e posicionado em `calculator-form.tsx`.

## Por que este prompt existe
A auditoria classificou a peça como `PROTOTIPO_PARCIAL`. O que foi desenhado em 2026-07-02 foi uma **nota fixa** — "Taxas de referência — confirme as taxas atuais do canal" —, uma frase única, sem estados, sem data, sem categoria de origem, sem catch-all, sem "embutida (offline)", sem "pode estar desatualizada" e **sem segundo selo**. O que existe hoje é outra coisa: uma união de **5 estados** com **2 modificadores** que compõem, texto montado em runtime, e nada disso passou por desenho. A prova material está no CSS: `fee-seal.css` sobrescreve o `Badge` do DS (`white-space: normal`, `text-align: left`, `line-height: 1.3`, borda hairline) porque o primitivo foi desenhado para status curto e o selo carrega parágrafo. **O componente foi dobrado para caber.** E a homologação 015 mediu o pior efeito: ele era o elemento de **menor peso visual** do painel enquanto os campos ao lado estavam vazios e o preço já vinha descontado.

## O que já existe hoje (não invente do zero — corrija)
A peça é um `Badge` (`tf-badge`) com tom `info` ou `neutral`, texto concatenado. Os 5 estados e os textos **literais** de hoje:

| Estado | Texto renderizado hoje (literal) | Tom |
|---|---|---|
| `reference` (online) | `Referência: Central de Educação do Vendedor Shopee — Política de Comissão 2026, vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias) · atualizada em 06/08/2026` | `info` |
| `reference` + categoria de origem | `Referência: Tabela de comissões da Amazon — Casa e Cozinha (comissão sobre base que inclui frete) (para Casa e Cozinha) · atualizada em 06/08/2026` | `info` |
| `reference` + `embedded` | `referência embutida (offline) (para Calçados) · atualizada em 06/08/2026` | `neutral` |
| `reference` + `stale` | `… · pode estar desatualizada` (sufixo que **compõe** com `embedded`) | `neutral` |
| `catchAll` | `categoria não informada — usando a maior alíquota da tabela` | `neutral` |
| `catchAll` + `embedded` + `stale` | `referência embutida (offline) · categoria não informada — usando a maior alíquota da tabela · pode estar desatualizada` | `neutral` |
| `adjusted` | `ajustado por você` | `neutral` |
| `estimate` | `estimativa de frete` | `info` |
| `none` | `sem referência — informe as taxas` | `neutral` |
| `FixedFeeSourceBadge` | `Taxa fixa: Amazon — Preços e planos · vigente desde 01/03/2026` | `neutral` |

→ **Problema 1 — comprimento.** O texto real do estado `reference` tem **~160 caracteres**, porque o campo `source` do catálogo é uma citação inteira ("Central de Educação do Vendedor Shopee — Política de Comissão 2026, vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias)"). Isso não é uma pílula: é um parágrafo dentro de um `border-radius: pill` de `min-height: 24px`. Desenhe a forma que esse conteúdo pede.
→ **Problema 2 — hierarquia invertida.** O selo é hoje `--fs-caption`, `--bg-muted` (que no tema escuro **é a mesma cor da superfície do card**, daí a borda hairline de emergência), enquanto o preço grande ao lado grita. O elemento que separa "este número é seu" de "este número é um palpite do catálogo" é o mais fraco da tela.
→ **Problema 3 — a redundância que já foi medida.** Na Amazon o `source` **já contém** o nome da categoria, e o código só omite o sufixo `(para …)` quando detecta a repetição literal — ou seja, o desenho precisa de um lugar próprio para a categoria de origem, não de um sufixo entre parênteses.
→ **Problema 4 — três selos numa linha.** `flex-wrap: wrap` com três badges de comprimentos muito diferentes não tem hierarquia nenhuma: o selo da taxa fixa (curto) pode acabar na primeira linha e o principal (longo) empurrado para baixo. Nada diz qual selo se refere a qual número.
→ **Problema 5 — o link nunca renderizado.** O catálogo carrega `sourceUrl` (ex.: `https://seller.shopee.com.br/edu/article/26839`) em toda entrada. **O selo nunca o mostra.** A fonte é citada e não é alcançável.

## Conteúdo e dados reais
- **Fonte (`source`)**: string livre do catálogo, **1 a ~140 caracteres**, obrigatória. Exemplos verdadeiros acima. Nunca abrevie no desenho sem dizer como o texto completo é alcançado.
- **Data de conferência (`lastReviewed` → "atualizada em")**: ISO → `dd/mm/aaaa`, ex.: `06/08/2026`. É a data em que **nós conferimos**, não a data em que o app baixou.
- **Vigência (`effectiveDate` → "vigente desde")**, só no selo da taxa fixa: ex.: `01/03/2026`.
- **Janela de desatualização**: **45 dias** (31 do ciclo mensal do robô + 14 de folga de entrega). O comentário do componente ainda diz "30-day window" — está **desatualizado no código**, use 45.
- **Categoria de origem (`originCategoryName`)**: opcional; pode ser um **ancestral** da categoria escolhida ("Calçados" quando o vendedor escolheu "Tênis de corrida").
- **Números que o selo respalda** (aparecem nos campos logo acima, não no selo): Comissão `20%`, Taxa fixa `R$ 4,00`, taxa por item Amazon Individual `R$ 2,00`, teto de cupom Shopee `R$ 20,00 / R$ 30,00 / R$ 40,00`. Preço da semente para composição: `R$ 24,24`.
- Nada no selo é editável e nada nele é derivado de conta do usuário: é 100% procedência.

## Estados obrigatórios
1. **`reference` online (repouso)** — tom `info`. Mostra `Referência: {fonte} · atualizada em {data}`. É o único estado "tudo certo" e mesmo assim **não é um selo verde**: não é aprovação, é atribuição.
2. **`reference` com categoria de origem** — acrescenta `(para {categoria})`. Precisa deixar claro que a alíquota é da categoria **nomeada**, que pode não ser a que o vendedor escolheu.
3. **`embedded` (offline / semente embutida)** — `referência embutida (offline)`. **Sem citar fonte nenhuma** (o head troca de lugar). É o estado que mais envelhece.
4. **`stale` (passou dos 45 dias)** — sufixo `· pode estar desatualizada`. **Compõe** com `embedded` e com `catchAll` — desenhe a combinação, não só o caso isolado.
5. **`catchAll`** — `categoria não informada — usando a maior alíquota da tabela`. Deliberadamente **não** é tom `info`: o vendedor está aceitando a maior alíquota da tabela e precisa ver isso como alerta brando, nunca como confirmação.
6. **`adjusted`** — `ajustado por você`. O usuário sobrescreveu o pré-preenchido; a procedência do catálogo deixou de valer.
7. **`none`** — `sem referência — informe as taxas`. O catálogo não cobre este slot; os campos estão vazios e é o vendedor que tem de digitar. **É o estado mais perigoso da lista** e hoje é o mais discreto.
8. **`estimate`** — `estimativa de frete`, selo adicional ao lado do principal (subsídio ML/Shopee).
9. **Selo da taxa fixa** (`Taxa fixa: {fonte} · vigente desde {data}`) — coexiste com o principal, respalda um **número diferente**.
10. **Foco de teclado / hover** — hoje **não existem**: o selo é um `span` estático. Se o desenho tornar a fonte alcançável (ver Perguntas), foco visível e alvo ≥44px passam a ser obrigatórios.
11. **Ausência total** — sem `outcome` (slot ainda sem cálculo) nada renderiza. Mostre esse vazio para que ele não seja confundido com "sem referência".

## Viewports
- **Mobile 390px** — obrigatório: é a largura de trabalho do vendedor e onde o texto de 160 caracteres realmente vive.
- **Mobile 360px** — obrigatório como **teste de estresse** do estado mais longo (`referência embutida (offline) · categoria não informada — usando a maior alíquota da tabela · pode estar desatualizada`) com os **três selos** presentes. Foi a 360px que este projeto já mediu overflow horizontal real.
- **Desktop 1280px** — a Calculadora renderiza no desktop e o canvas 018 **não cobre a aba Calcular**; hoje o selo simplesmente estica. Desenhe o que ele deve virar quando há largura sobrando (não é "a mesma pílula, mais larga").

## Regras que o desenho não pode quebrar
- **Procedência sempre nomeia o que ela respalda.** O selo da taxa fixa é separado justamente porque uma procedência que não diz de qual número ela é não é procedência.
- **Nunca apresentar tarifa de terceiro como fato nosso.** Nenhum estado pode ler como selo de aprovação/verificação.
- **Degradação dita, não escondida**: `offline`, `desatualizada` e `catch-all` são informações do usuário, não detalhes técnicos a esconder atrás de ícone mudo.
- **`catchAll` e `reference` nunca compartilham o mesmo tom.** Igualá-los é como o vendedor termina com a alíquota errada achando que é a dele.
- **Frase honesta fora de placeholder** e em elemento de largura total quando precisar — este projeto já cortou uma frase honesta pela metade dentro de um campo estreito.
- **Contraste medido contra o fundo real do card** nos dois temas — no escuro o `--bg-muted` do badge neutro coincide com a superfície do card.
- **Alvo ≥44px** para qualquer parte que vire clicável.
- O selo **não pode ser o elemento de menor peso visual do painel** quando o estado é `none`, `catchAll` ou `stale`.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido a 360px** (016/PR-B): `white-space: nowrap` no badge forçava a linha inteira como `min-content`; a correção foi feita no CSS, não no desenho.
- **Texto ocluso passa em teste** (014): `toBeVisible`/`toContainText` aprovam um elemento totalmente sobreposto ou estourado — layout se afirma com **caixas**, não com texto.
- **Sufixo cortado em campo estreito** (016/PR-F): a regra "taxa fixa = 50% do preço" virava `2,50 (= 50` em 77–187px úteis; por isso frases honestas saíram dos placeholders.
- **Selo invisível no tema escuro**: o fundo do badge neutro empatava com o card, e a borda hairline foi um remendo — resolva no desenho.
- **Slot com campos vazios e preço já descontado** (015): quando o pré-preenchimento falha, o vendedor vê um preço "pronto" com uma explicação minúscula ao lado.

## Entregável
Pranchetas, nos **temas escuro (padrão) e claro (first-class)**:
1. **Anatomia do selo** — a forma nova para texto longo, com os slots nomeados: rótulo do estado, fonte, categoria de origem, data, marca de desatualização.
2. **Os 9 estados em repouso**, empilhados e comparáveis, cada um com o texto pt-BR **literal** desta ficha.
3. **As combinações compostas**: `embedded + stale`, `catchAll + embedded + stale`, `reference + categoria de origem`.
4. **A linha de até três selos** (principal + `estimativa de frete` + `Taxa fixa`) a 390px e a 360px, com a hierarquia entre eles resolvida.
5. **O slot inteiro em contexto** a 390px e 1280px: grade de taxas → legenda de banda → selos → avisos Shopee.

Reutilize os primitivos existentes em vez de criar novos: o `tf-badge` (tons `neutral`/`info`) como base do selo — se a forma final precisar deixar de ser pílula, diga **qual** primitivo ela passa a ser em vez de inventar um componente órfão; `tf-card` como superfície do slot de canal; a escala de texto `--fs-caption` como piso, não como teto; e os tokens de status já existentes para os tons. Se o desenho exigir um primitivo novo (por exemplo, um bloco de procedência multilinha), **nomeie-o e justifique** — não o desenhe como exceção local de uma peça.

## Perguntas em aberto para o dono
1. **`sourceUrl` existe no catálogo e nunca é mostrado.** A fonte deve virar link alcançável (abrindo `seller.shopee.com.br/edu/article/26839`, `venda.amazon.com.br/precos`)? Isso muda a peça de estático para interativo — foco, hover, alvo ≥44px, e a decisão de abrir fora do app.
2. **O selo `none` ("sem referência — informe as taxas") merece virar aviso de bloqueio** em vez de pílula discreta? É o caso em que o app não sabe nada e o vendedor precisa agir.
3. **`stale` deve ter tom próprio** (alerta) em vez de reusar `neutral`, ou o alarme perde valor por disparar de mês em mês?
4. **A citação longa da fonte pode ser truncada** com o texto completo atrás de um "ver fonte"/tooltip, ou a procedência tem de aparecer inteira e sempre? (Truncar é decisão de produto, não de layout — este projeto já decidiu o contrário para frases de honestidade.)
5. **`Referência` vs `Taxa fixa`**: os dois selos usam rótulos com peso diferente ("Referência" nomeia a natureza, "Taxa fixa" nomeia o número). Deve haver um padrão único de rótulo — ex.: `Comissão: …` / `Taxa fixa: …`?
