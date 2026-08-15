# DoD evidence — 018 Abas desktop

**Branch**: `018-abas-desktop` (a partir de `develop`) · **Data**: 2026-08-11
**Estado**: código completo · **homologado pelo assistente** (PASS COM RESSALVAS 88%, 2 defeitos achados e corrigidos) · **NÃO homologado pelo dono**. Registro: [evidencias/homologacao-2026-08-11.md](./evidencias/homologacao-2026-08-11.md). Ver §7.

---

## 1. O que foi construído

| Fatia | Entrega | Onde |
|---|---|---|
| Fundação | `useIsWide` (gate único, 1280px) · `nav-rail-store` · `Segmented` · auxiliar de teste de `matchMedia` | `shared/lib/`, `shared/ui/` |
| US5 | Menu recolhível 240↔76px, botão "Recolher" no rodapé do menu | `widgets/app-nav/`, `app/app-shell.*` |
| US1 | Catálogo mestre-detalhe: cabeçalho com pílulas, busca, lista, ficha fixa de 560px | `features/catalog/catalog-panel.tsx` + `catalog-master-detail.css`, `pages/catalogo/` |
| US2 | Orçamentos mestre-detalhe: lista 520px + registro congelado | `pages/historico/` |
| US3 | Kits em duas colunas, resumo de 480px, sem barra no rodapé | `pages/bom/`, `features/bom/assembly-summary.tsx` |
| US4 | Conta em três colunas, tema segmentado, oferta inline, aviso de privacidade | `pages/conta/` |

Nenhuma fórmula, contrato de API ou esquema foi tocado. `pricing-core` não subiu de versão.

---

## 2. A prova do mobile (US6 / SC-005) — **medida, não afirmada**

**Método**: assinatura de 5 rotas × 2 larguras (390 e 360), capturada ANTES do primeiro commit
(`evidencias/baseline-mobile/`) e recapturada depois de todas as fatias. A assinatura lê **caixas do
DOM** (`getBoundingClientRect` de 10 marcos de layout), os dois eixos de rolagem, o `data-layout`, o
`<h1>` e a contagem de teasers.

```
MOBILE IDENTICO: 0 diferencas em 10 telas
```

Nenhum marco moveu um décimo de pixel. Isso não é sorte: é consequência de duas escolhas.

1. **`useIsWide` responde `false` sem `matchMedia`** (ADR-0031/B). Em jsdom não existe `matchMedia`,
   então **a suíte inteira do app continua exercitando o ramo mobile** — 1 528 testes, nenhum
   alterado para acomodar o 018.
2. **`display: contents` nos invólucros do Kits.** Abaixo do corte os dois `<div>` novos somem do
   layout e os filhos voltam a ser filhos diretos da `<section>`, herdando o mesmo `gap`. O mobile
   não ficou "equivalente" — ficou a mesma caixa.

## 3. O corte de 1280px (SC-003) — medido em quatro larguras

| Largura | Catálogo: lista / ficha | Transbordo horizontal |
|---|---|---|
| 1920 | 1032 / 560 (duas colunas de cards) | 0 |
| 1600 | 712 / 560 | 0 |
| 1280 | 392 / 560 (uma coluna) | 0 |
| **1279** | **não existe** — a tela de hoje | 0 |
| 1024 | não existe | 0 |
| 390 / 360 | não existe | 0 |

O par 1280/1279 é o que prova o limiar. `overflowX = 0` em todas as larguras, nas quatro telas.

## 4. Largura útil (SC-001)

A 1920px, com `--content-max-wide` em 1720px: **100% da largura útil de conteúdo** nas quatro telas
(medido como `section.width / (main.clientWidth − goteiras)`). O teto de 1120px do 016 continua
valendo até 1279px.

Recolher o menu devolve **164px** ao conteúdo (main 1680 → 1844) — SC-004 pede ≥160.

## 5. Testes

`pnpm gate:all` verde: formato · lint + fronteiras · dependency-cruiser (466 módulos) · typecheck ·
**1 528 testes de frontend** · backend 473 + cobertura 82,67% · import-linter 5/5.

Testes novos deste incremento:

| Arquivo | O que trava |
|---|---|
| `shared/lib/use-is-wide.test.ts` | o gate, incluindo o caso sem `matchMedia` — o que protege o mobile |
| `shared/ui/nav-rail-store.test.ts` | preferência do rail, incl. degradação quando o armazenamento recusa escrita |
| `shared/ui/segmented.test.tsx` | teclado (um tabstop, setas, Home/End) e os dois papéis (tablist/radiogroup) |
| `widgets/app-nav/app-nav-rail.test.tsx` | recolher/expandir + **o rótulo sai da tela, nunca da árvore de acessibilidade** |
| `features/catalog/catalog-master-detail.test.tsx` | clicar seleciona sem navegar · busca · seleção derivada · produto abre a página · nada disso existe a 1279 |
| `features/bom/assembly-summary-variant.test.tsx` | `pinned` é o padrão; `column` não deixa nada no rodapé |
| `pages/conta/conta-desktop.test.tsx` | tema segmentado no desktop, **interruptor no mobile**, oferta inline |

## 6. O que o navegador achou que os testes não achariam

Duas coisas, e as duas só apareceram na imagem ou na medida — não numa asserção:

1. **O botão "Recolher" nascia fora de alcance.** A sidebar é irmã flex do `<main>` e esticava com o
   conteúdo: medido em **2 803px de altura** numa `/calcular` cheia, com o botão no fim daquilo. O
   conserto foi dar ao menu a altura da janela (`position: sticky; height: 100dvh;
   align-self: flex-start`).
2. **O campo de busca do Catálogo usava o ícone de PACOTE.** Não havia lupa no conjunto de ícones.
   Nenhuma asserção de texto veria isso; a imagem viu na primeira olhada. Entrou `search` (Lucide),
   com o SVG de proveniência em `public/brand/icons/lucide/`.

E um defeito que os **testes** acharam, este sim: a primeira versão do `HistoryLedger` declarava o
invólucro como um **componente dentro do componente**. Cada render criava uma função nova, o React
via um tipo novo e desmontava a subárvore — o campo de busca do Orçamentos perdia o que era digitado
a cada tecla e o debounce nunca chegava ao servidor. Dois testes do US6 falharam na hora.

## 7. O que NÃO está feito — e é preciso dizer

- **A homologação do dono não aconteceu.** Tudo aqui é `CORREÇÃO DECLARADA`
  (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`). O que fecha o 018 é a segunda passada dele.
- **Não há guarda de geometria PERMANENTE** para as novas larguras. As medidas de §3 foram feitas
  por script, uma vez. A tarefa T028/T036/T043/T050 (estender
  `tests/e2e/pages-desktop-width.spec.ts`) **não foi executada** — sem ela, uma regressão de layout
  não tem quem a pegue no CI. É a pendência mais séria deste PR.
- **A caminhada e2e (Playwright) não rodou** neste ciclo; a verificação de navegador foi feita por
  script próprio contra o servidor de desenvolvimento, com conta premium real e catálogo semeado.
- ~~Orçamentos e Kits medidos sem dados densos~~ — **corrigido** na homologação de 2026-08-11, com dados adversariais semeados. Texto original: Orçamentos e Kits foram medidos sem dados densos: o Kits estava com o compositor vazio e o
  Orçamentos sem registros gravados, então o mestre-detalhe do Orçamentos e a coluna de resumo do
  Kits foram exercitados por teste e por composição, **não por uma tela cheia de dados reais**.
- ~~Não foi medido em tema claro~~ — **corrigido**: os dois temas foram medidos na homologação de 2026-08-11 (e a frase original estava invertida: o que faltava era o ESCURO). Segue sem **leitor de tela real**.

## 8. Desvios conscientes do arquivo de design

| Desvio | Por quê |
|---|---|
| O rótulo do menu recolhido usa `sr-only`, não `display: none` | O desenho apagaria o nome de cada item para leitor de tela. O que se vê é o desenho; o que se ouve continua sendo "Catálogo" |
| O botão de adicionar do Catálogo fica ao lado da BUSCA, não das pílulas | Levá-lo ao cabeçalho exigiria a página conhecer a ação de criar de cada um dos 4 painéis. Fica para o dono aceitar ou recusar |
| A ficha de Produto/Kit resume e abre a página cheia | Decisão do dono no clarify de 2026-08-10 |
| O aviso de privacidade não tem link para a política | O desenho não tem um; a versão com `Link` exigia contexto de roteador e quebrava 7 testes |

## 9. ADR

**ADR-0031** (`docs/adr/0031-desktop-composition-gate.md`) está **Proposed**. Ele cobre o gate único,
a invariância mobile estrutural, onde mora a seleção e a persistência do rail. O dono flipa para
Accepted no gate — com uma correção a registrar: o ADR diz que a seleção é estado do componente nos
dois mestre-detalhes; no **Orçamentos** ela mora em `?snapshot=`, onde já morava desde o 013/F-02.
Usar o que existia foi mais fiel ao código do que aplicar a regra ao pé da letra.

---

## Homologação automatizada — correções absorvidas neste incremento (2026-08-13)

O PR #58 foi reaproveitado, por decisão do dono, para carregar também as correções da homologação
automatizada (`docs/homologacao/automatizada/RELATORIO.md`). O escopo do incremento deixou de ser
só "abas desktop": ele passa a carregar 26 dos 35 achados daquela homologação.

**Prova — e a régua MUDOU entre as duas medições, o que precisa estar dito aqui e não implícito.**

A leitura é 35 → **9** defeitos, ALTA 11 → **1**. Mas a bateria da segunda execução não é a mesma da
primeira, e o review do PR #58 (2026-08-15) pegou essa afirmação sendo feita como se fosse. Três
mudanças de MEDIÇÃO, todas justificadas, todas com efeito no número:

1. `RETRATADO_VER_SC305 = false` desliga a verificação do `1,000` — o achado era falso (é um rolo de
   1 kg com três casas, SC-305) e sai da conta por retratação, não por conserto.
2. A ordem de preenchimento do campo de tempo foi corrigida: o teste apagava os minutos que ele
   mesmo tinha acabado de escrever. Dois achados saíram por erro meu de medição.
3. O alvo de toque passou a contar o `::after` que o projeto usa de propósito — quatro achados
   "28×28" eram falso positivo do medidor.

**Descontando as retratações, o conserto real cobre 26 achados.** O número honesto é esse; "35 → 9"
mede duas coisas ao mesmo tempo (o que foi consertado e o que era falso) e não deve ser lido como
prova isolada de correção.

### O que foi corrigido

| Bloco | Achados | Arquivos |
|---|---|---|
| Aviso de plausibilidade | 10 ALTA | `shared/lib/plausibilidade.ts` (novo, puro) + `messages.pt-br.ts` + `calculator-form.tsx` + `bom-line-card.tsx` |
| Texto longo estourando a página | 2 | `breakdown-row.css` (`__label`/`__sub`) · `catalog-master-detail.css` (`__card`) |
| Teaser estourando a 426px | 1 | `premium-teaser.css` (`max-width: min(28rem, 100%)`) |
| Foco invisível no item de navegação ATIVO | 1 | `app-nav.css` — anel INTERNO, que não colide com o realce de "ativo" |
| Contraste do "Premium" no badge | 3 | `tokens/colors.css` — `--success-text` medido contra o fundo REAL (o soft), não contra o card |
| Alvo de toque na tela de entrada | 1 | `sign-in-screen.tsx` |
| Salvar simulação sem nome não fazia NADA | 1 | `save-scenario-sheet.tsx` — a mensagem já existia escrita; faltava mostrá-la após a tentativa |
| Tempo colado do fatiador (`2:30`, `2h30`) | 2 | `time-input.ts` (`parseRelogio`) + `calculator-form.tsx` |
| Recarregar apagava tudo sem aviso | 1 | `features/calculator/aviso-de-saida.ts` (novo) |

**`PRICING_MODEL_VERSION` inalterado, e não é esquecimento:** nenhum dos 35 achados era erro de
cálculo. A fórmula da peça, o gross-up por canal, a soma do kit e a geometria do PDF passaram na
homologação. O que mudou é o que o produto **diz** e como ele **desenha**.

### A regra que governa o módulo novo

**AVISO NUNCA VIRA VALIDAÇÃO.** A decisão do dono de 2026-08-03 — `failurePct` sem teto, porque
"300% representa legitimamente uma peça que falha três vezes antes de sair" — fica a um passo destes
limiares. Um campo com aviso continua calculando e continua salvando, e há um teste estrutural que
cai se alguém transformar um aviso em recusa (`plausibilidade.test.ts`, último describe).

### Um achado RETRATADO, e ele quase virou um defeito grave

A bateria acusava `1,000` lido como 1 ("ele copiou mil de um site em inglês") como ALTA. A correção
foi escrita e **o gate do projeto a derrubou**: `"1,000" → "1.000"` está pinado em
`decimal-ptbr.test.ts` porque neste produto `1,000` é um rolo de 1 kg gravado com TRÊS CASAS, e essa
identidade byte a byte é o SC-305. Um fixture virou `'100000'` onde esperava `'100.000'`.

Ou seja: "consertar" o achado transformaria todo rolo de 1 kg em 1000 kg — o mesmo defeito que a
homologação existe para achar, ao contrário e pior. Revertido por inteiro; a verificação ficou
desligada com o motivo escrito ao lado (`estresse-leigo.spec.ts`, `RETRATADO_VER_SC305`).

### O que NÃO entrou, e por quê

1. **Resumo fixo com o preço no mobile** (o custo total só aparece após 3,9 telas a 390px). O 018
   promete, estruturalmente, que **o ramo mobile é o mesmo código, intocado** — é a propriedade que
   `useIsWide()` garante e que a suíte inteira exercita. Uma barra fixa nova no mobile contradiz
   exatamente isso. Precisa da decisão do dono e de um incremento próprio.
2. ~~**A faixa de 426px**~~ — **CORRIGIDO em 2026-08-15**, autorizado pelo dono. A barra lateral
   recolhe sozinha abaixo de 600px (76px em vez de 240px), o que devolve ~318px de conteúdo a
   426px. Feito como o ADR-0031 §Follow-ups manda: um limiar NOMEADO dentro de `use-is-wide.ts`,
   nunca um segundo `matchMedia`. A guarda de geometria testa o corte pelos dois lados (599/600) —
   um limiar testado só por dentro passa igual se alguém trocar o número.

### Os 9 restantes

1 ALTA: `CF-025` — corrida entre a concessão de Premium e o refetch do entitlement no PRÓPRIO teste
(passa na maioria das rodadas). 6 média: os dois acima + foco de um input + gramas absurdas (agora
avisadas, o registro é anterior) + "vida útil" fora do modo ritmo (consequência desejada do 016/US8)
+ recarga (o aviso nativo do navegador não é observável pelo Playwright). 2 baixa: confirmações, não
defeitos.

### Um achado RETRATADO por medição errada (2026-08-15) — o foco dos campos numéricos

A bateria acusava "1 elemento sem nenhuma mudança visual ao receber foco". Com o rótulo do achado
enriquecido, virou **todo campo numérico da calculadora** — Custo do rolo, Peso do rolo, Gramas
usadas, Consumo médio… (o rótulo genérico "INPUT[]" estava colapsando todos num só).

**Não era defeito.** Medido diretamente, sem o truque do detector: com foco, o invólucro fica
`border: rgb(120,0,255)` + `box-shadow: 0 0 0 2px`; sem foco, `rgb(185,187,198)` e sem sombra. O
anel funciona.

O erro era do medidor, e foi a TERCEIRA vez que ele errou sobre foco nesta homologação. A versão
anterior guardava uma referência ao nó em `window` e tirava o foco com `blur()` programático: se o
React recria aquele nó entre as duas leituras, a referência fica órfã, e `getComputedStyle` de um nó
fora do documento devolve valores padrão — **idênticos nas duas medições, ou seja "não mudou nada"
por construção**.

A versão atual carimba o elemento, sai do foco **com Tab** (nunca `blur()`) e reconsulta o nó pelo
carimbo, garantindo que a segunda leitura é do nó que está no documento agora. É a mesma medição que
eu fiz à mão para provar que o anel existe.

Fica registrado porque a lição vale mais que o achado: **um medidor que erra na mesma direção três
vezes precisa ser reescrito, não ajustado** — e cada ajuste anterior deixou a impressão de que o
produto tinha um defeito que ele não tinha.
