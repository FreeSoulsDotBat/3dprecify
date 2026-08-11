# Processo de homologação — Precifica3D

**Autoridade**: este documento define **como** se homologa. O `ROTEIRO-MANUAL.md` (ao lado) diz **o que
digitar e qual número tem de aparecer**; o `_LEDGER.md` registra achados de auditoria. O dono (Jonatan) é
a fonte de verdade do que é melhor para a aplicação — inclusive quando o apontamento contraria uma decisão
já tomada; nesse caso a decisão muda **por escrito**, não por silêncio.

**Última atualização**: 2026-08-10.

---

## 1. O que é homologar aqui

Homologar é o **dono abrindo o produto rodando e julgando o que vê**. Não é suíte verde, não é revisão de
código, não é um agente afirmando que renderizou.

O projeto pagou essa lição mais de uma vez, e caro:

- **012/PR-B**: mais de mil testes automatizados não acharam **nenhum** dos três defeitos reais. Cada um
  precisou de algo que **EXECUTASSE** o produto — a caminhada no navegador achou o "premium fake" (assinatura
  `authorized` com grant expirado renderizando "Premium · renova em {data}" sobre uma conta congelada), e a
  homologação visual achou 100,5px de overflow com botão nascido fora da viewport e um toast que nunca
  renderizou.
- **014/Fase 6C**: um screenshot acha o que uma asserção geométrica não acha, e uma asserção geométrica acha
  o que extração de texto não acha. `toBeVisible`/`toContainText` passam em elemento **totalmente ocluso**.
- **Corolário permanente**: uma revisão que só lê código não homologa nada.

---

## 2. A regra que este documento existe para fixar

> **Passar por todos os cenários é METADE do processo. A outra metade é REPASSAR por eles.**

Um ponto apontado **não fecha** quando o desenvolvedor (humano ou agente) diz que corrigiu. Ele fecha quando
**o dono repassa aquele mesmo cenário, no produto rodando, depois da correção, e confirma**. "Corrigido" é um
estado **intermediário** — uma declaração a ser verificada —, nunca o fim da linha.

**Corolário de sequenciamento** (decisão do dono, 2026-08-10):

> Enquanto houver ponto de uma rodada aguardando reverificação, **cenários ainda não tocados NÃO abrem**.
> Primeiro se fecha o que já foi apontado; só então se caminha por terreno novo.

### Por que a segunda passada não é cortesia

1. **Correção incompleta parece completa por dentro.** Em 012/PR-B o guard geométrico nascido do primeiro
   defeito pegou o **próprio conserto incompleto do agente** — 467px ainda estourando — antes de alguém
   chamar de pronto. Sem a segunda passada, "consertei" teria virado verdade.
2. **A correção conserta o ponto e quebra o vizinho.** Em 016/Polish a própria correção da rodada (os PNGs da
   logo do PR-B) ficou fora do precache do PWA — regressão introduzida *pelo conserto*, invisível para quem
   só olhasse o item consertado.
3. **O que o dono apontou nem sempre é o que o dev entendeu.** A reverificação é exatamente onde a
   interpretação errada aparece — e é barata ali; depois de três incrementos, não é.
4. **Um verde intermitente ensina "roda de novo".** Reverificação com evidência é o que separa "passou" de
   "passou desta vez".

---

## 3. Estados de um cenário

| Estado | Significado | Quem declara |
|---|---|---|
| **NÃO TOCADO** | Nunca foi caminhado pelo dono. Não tem opinião registrada. | — |
| **APONTADO** | Caminhado, com defeito/pedido registrado e evidência. | dono |
| **CORREÇÃO DECLARADA** | Alguém afirma ter corrigido; testes e homologação de agente podem estar verdes. **Não está homologado.** | dev / agente |
| **REVERIFICADO ✔** | O dono repassou o cenário no produto rodando **depois** da correção e confirmou. | dono |
| **REABERTO** | Reverificação falhou (não corrigido, corrigido pela metade, ou corrigido quebrando o vizinho). | dono |

**Regra de numeração**: um ponto REABERTO **mantém o mesmo identificador** (`R1-05`, não `R2-01`). O número
de idas e voltas de um mesmo ponto tem de ficar visível — renumerar apaga exatamente a informação que
interessa.

**Regra de fechamento de rodada**: uma rodada só fecha quando **todos** os seus pontos estão `REVERIFICADO ✔`.
Um ponto pode ser fechado como **"não será corrigido"** — mas só por decisão explícita do dono, registrada com
o motivo, e isso também conta como fechado.

---

## 4. O ciclo de uma rodada

1. **Caminhada** — o dono percorre os cenários no produto rodando (`ROTEIRO-MANUAL.md` §Antes de começar) e
   captura evidência do que vê.
2. **Relatório** — um arquivo por rodada, em seções (funcional, visual, arquitetural, estrutural…), com a
   evidência referenciada item a item. As regras de entrega valem para quem recebe o relatório:
   - o apontamento **pode ou não** estar de acordo com as decisões já tomadas; para cada ponto, quem corrige
     traz **(a)** qual é a correção, **(b)** quão complexa é, **(c)** se ela bate ou conflita com a decisão
     vigente — e **decide COM o dono** se a decisão muda na documentação;
   - **não inferir**: sem entender o apontamento ou sem achar o erro, **perguntar**;
   - quem recebe deve dizer, ao fim, **se acredita que ficou algum cenário de fora**;
   - mudança visual sem certeza de como fazer → perguntar; persistindo, direcionar para o Claude Design **já
     com o prompt escrito**.
3. **Triagem + correção** — o fluxo spec-kit normal (specify → clarify → plan → tasks → implement), com os
   pontos virando user stories/FRs rastreáveis até o item do relatório.
4. **Reverificação — a segunda passada** (§5) — o dono repassa **cada** ponto apontado. Cada um sai daqui como
   `REVERIFICADO ✔` ou `REABERTO`.
5. **Fechamento** — a rodada fecha; **só então** a rodada seguinte, com cenários ainda não tocados, abre.

O que muda em relação a "rodar a suíte de novo": o passo 4 é do **dono**, no **produto**, sobre a **lista dos
pontos que ele mesmo apontou** — não uma varredura genérica.

---

## 5. Como se reverifica (senão a reverificação também mente)

- **No produto rodando, nunca em print antigo nem em relato de agente.** E depois de subir o serviço: a
  **SEED responde primeiro** — uma mutação de catálogo servido só é real quando o valor **MUTADO** aparece
  (lição do hotfix A2/A3).
- **Screenshot só vale em 1:1.** Imagem redimensionada esconde exatamente a classe de defeito que a imagem
  existe para achar.
- **Layout se mede por CAIXA, não por texto.** Oclusão não é propriedade de texto: `toBeVisible` passa em
  elemento coberto ou estourado. Ler geometria do DOM.
- **Medir os DOIS eixos de scroll.** Headless não desenha scrollbar clássica — o scroll vertical do item 9 da
  rodada 1 só apareceu quando o eixo Y passou a ser medido.
- **Frase honesta nunca mora em placeholder** — placeholder carrega número, e o texto é cortado. Se a
  reverificação depende de ler uma frase, ela tem de estar em elemento de largura cheia.
- **Reverificar o VIZINHO do ponto corrigido**, não só o ponto — ver §2, motivo 2.
- **Cada `REVERIFICADO ✔` carrega evidência nova** (screenshot/observação datada da segunda passada). Um ✔ sem
  evidência da segunda passada é uma declaração, e declaração é o estado anterior.

---

## 6. Registro das rodadas

| Rodada | Caminhada | Itens | Incremento de correção | Situação |
|---|---|---|---|---|
| **1** | 2026-08-03/04 — grátis (deslogado + logado sem premium) | 15 (evidências 1–19) — [checklist](rodadas/rodada-01-2026-08-04.md) | `016-correcao-homologacao` (PRs #44–#50) | **ABERTA — em reverificação pelo dono desde 2026-08-10** |
| 2 | não iniciada | — | — | **BLOQUEADA** até a rodada 1 fechar (§2, corolário) |

### 6.1 Rodada 1 — pontos a reverificar

> **Checklist para caminhar, caixa a caixa: [`rodadas/rodada-01-2026-08-04.md`](rodadas/rodada-01-2026-08-04.md)**
> — é lá que se marca o que fechou e o que reabriu. A tabela abaixo é só o índice.

Relatório e evidências brutos (`Relatório.md`, `Instruções.txt`, `1.png`–`19.png`) ficam na pasta pessoal do
dono, fora do git (§8) — o checklist cita cada evidência pelo nome e se sustenta sozinho.

Estado de **todos** os itens abaixo: **CORREÇÃO DECLARADA — aguardando reverificação do dono**. A coluna
"onde foi tratado" é onde procurar o que mudou, não prova de que fechou.

| ID | Cenário / evidência | Onde foi tratado (016) |
|---|---|---|
| R1-01 | Header: sidebar na frente do header + logo inteira (1.png) | US3 · PR-B |
| R1-02 | Desktop com espaços vazios; seções em linhas, total centralizado no fim (2.png) | US4 · PR-B |
| R1-03 | "Meus cenários": subtítulo duplicado, subtítulo confuso, bloco premium fora, modal "Cenários fazem parte do Premium" morre (3.png) | US1 + US2 · PR-A |
| R1-04 | "Usar do catálogo": botão desabilitado, "Salvar faz parte do Premium." fora, explicação do que é o catálogo + tooltip no premium (4.png) | US1 (+ tooltips US6) · PR-A/PR-C |
| R1-05 | Custo da peça: consumo médio / tarifa de energia / vida útil explicados; tempo de impressão em h+min; máscara monetária no valor da máquina; os três campos deixam de ser obrigatórios (5.png) | US6 + US7 + US8 + US9 · PR-C |
| R1-06 | Ajustes opcionais fundidos em "Custos da peça"; campo "Desperdício" morre; reserva de manutenção / taxa de falha / tempo e valor de acabamento explicados (6.png) | US9 + US10 + US6 · PR-C/PR-D |
| R1-07 | "Mão de obra e custos" recebe tempo e valor do acabamento; mão de obra (horas) e valor da hora explicados (7.png) | US9 + US6 · PR-C |
| R1-08 | "Como chegamos no preço": marcadores laranja e roxo de Material e Energia removidos (8.png) | US5 · PR-B |
| R1-09 | "Preços finais": scroll não deve existir; textos centralizados nos cartões (9.png) | US4 · PR-B |
| R1-10 | Marketplace vira premium (switch desabilitado + falso no grátis); campos dirigidos pelo marketplace; frete some de "Outros custos"; "sem referência — informe as taxas" explicado; categoria por busca **e** por lista com subitens, também no Mercado Livre; seção reposicionada entre "Markup" e "Como chegamos no preço" (10.png) | US11 + US12 + US13 · PR-E |
| R1-11 | "Preços por canal" deixa de ser seção separada e entra em "Como chegamos no preço" (11.png) | US5 · PR-B |
| R1-12 | Catálogo no grátis: só título da página + título/subtítulo da feature + "Assinar premium" (12.png) | US1 · PR-A |
| R1-13 | Kits no grátis: idem, sem os botões "Entrar" e "Entendi" (13.png) | US1 · PR-A |
| R1-14 | Histórico/Orçamentos no grátis: idem, sem "Entrar" e "Ir para a calculadora" (14.png) | US1 + US2 · PR-A |
| R1-15 | Logado **sem** premium: as cinco telas mostravam erro de verificação de premium em vez do teaser (15–19.png) | V0 (medição antes de qualquer conserto) |

> **Nota sobre R1-15**: foi tratado como **medição**, não como conserto às cegas — a hipótese concorrente era
> que os prints antecediam o conserto de backend do PR #42 (toda rota de banco devolvia 500). A reverificação
> desse item é a que decide se a hipótese estava certa.

### 6.2 Cenários ainda não tocados — **proposta**, a confirmar pelo dono

Nada aqui abre antes de §6.1 fechar. A lista é **proposta** (o relatório da rodada 1 declara apenas o
primeiro item); o dono confirma, corta ou acrescenta:

- **Jornada premium logado** — declarada pelo próprio relatório: *"depois vou homologar com o usuário
  premium"*. É o maior bloco: Catálogo (filamentos/impressoras), Kits, Orçamentos, Simulações **de verdade**,
  não teaser.
- Assinatura ponta a ponta: preço → checkout → grant, cancelamento, carência/dunning, a tela Conta.
- Exportação PDF/CSV de orçamento.
- Offline: outbox, cache do catálogo, sessão expirada e o caminho de volta.
- 360px ponta a ponta e acessibilidade (foco, contraste, leitor de tela).

---

## 7. Papéis

- **Dono** — caminha, aponta, **reverifica** e fecha. É o único que transforma `CORREÇÃO DECLARADA` em
  `REVERIFICADO ✔`.
- **Thread principal / agentes de correção** — triam cada ponto (correção + complexidade + conformidade com a
  decisão vigente), corrigem e **declaram**. Não fecham.
- **`qa-produto`** — homologação visual do incremento (renderiza, mede, fotografa) antes de o dono caminhar.
  Reduz o que chega ao dono; **não substitui** a segunda passada dele.
- **`qa-software`** — testes lógicos. Verde aqui não é sinal de homologação (§1).

---

## 8. Onde ficam as coisas

| O quê | Onde |
|---|---|
| Este processo | `docs/homologacao/PROCESSO-HOMOLOGACAO.md` |
| Como subir o produto e o passo a passo com números | `docs/homologacao/ROTEIRO-MANUAL.md` |
| **Checklist de cada rodada** (o que fecha e o que não fechou) | `docs/homologacao/rodadas/` |
| Relatório e evidências brutos das caminhadas | pasta pessoal do dono, **fora do git** — por decisão dele (2026-08-10). O que entra no repositório é o checklist da rodada, que cita a evidência pelo nome (`1.png`…) sem depender do arquivo. |
| Evidências de homologação por incremento | `specs/<incremento>/dod-evidence.md` |
| Achados de auditoria (outra atividade, outro rito) | `docs/homologacao/achados/`, `_LEDGER.md` |
