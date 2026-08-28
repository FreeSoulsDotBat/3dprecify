## 019 PR-C — Comportamentos da calculadora (US4 · FR-1909/1910/1911/1912 · SEM bump)

**Estado: CORREÇÃO DECLARADA** — nada homologado; a Rodada 1 fecha antes (D5). Evidência em `specs/019-porte-design/dod-evidence.md` §PR-C e `evidencias/pr-c/` (16 screenshots 1:1 nos dois temas + `medidas-pr-c.json`).

### O que muda

- **Aviso de plausibilidade** (prancheta 14): entra **no blur**, não a cada tecla; é `<Aviso>` irmão do campo (não mais o `hint` colorido), anunciado (`role="status"`), com **"Entendi"** que guarda o par campo+valor **pela sessão** (store sem `persist`); **o erro não come mais a lição** — com recusa junta, o fecho troca para "Corrija o campo acima para calcular." e o "Entendi" some; dinheiro na frase com 2 casas ("R$ 6.000.061,60"); o aviso do resultado vira duas linhas quando são dois fatos. Nos 3 pontos da Calculadora e, por herança do `ControlledField`, na linha de peça de kit.
- **Bloco da máquina** (prancheta 15): `Estimar · Ajustar` como `Segmented`; o custo/hora vira **readout** ("Custo da máquina por hora de impressão · R$ 1,11 · de R$ 4.000,00 ÷ 3.600 h") nos **dois** modos; sem valor da máquina, o zero ganha a ressalva "falta o valor da máquina"; voltar à estimativa com horas digitadas à mão **pergunta antes** — inline, com os dois números em disputa ("Usar 3.600 h" / "Manter 2.000 h"); nada sobrescrito antes do "Usar". **`PRICING_MODEL_VERSION` continua 4.1.0** (vetor 27,55/41,33/35,82 intacto).
- **Selo de procedência** (prancheta 13): de `Badge` dobrado para `Alert compact` — rótulo nomeia o número ("Comissão"/"Taxa fixa"), citação em 2 linhas, categoria de origem, data, **"Ver fonte"** (abre a citação inteira + o `sourceUrl` que o catálogo sempre carregou e nunca mostrou), **"Dispensar"** até a fonte mudar (chave `marketplace::source::data`, 50 recentes, `localStorage`). Os qualificadores curtos continuam pílulas; o catch-all vira linha do corpo (o transbordo de 360px do 016).
- **Precisão**: a tarifa de energia aceita 4 casas (R$ 0,8734/kWh) sem truncar no blur — custo de energia numericamente igual (SC-1905); "0" reabre "0,00". **Achado real**: a reabertura de cenário (`moneyLeafToPtBr`, o "R5" do 016) cortava a tarifa a 2 casas — corte de VALOR, não de exibição — morto com teste vermelho→verde.

### O que NÃO está aqui — ⛔ DONO

- **T212 (resumo fixo do preço a 390px — T059/T054)**: a prancheta 10 não nomeia elemento fixo; `sticky; top` no último elemento do DOM nunca gruda e `sticky; bottom` colide com o toaster (research §I). Cumprir exige mover/criar o resumo no topo do DOM mobile — a mudança estrutural que a T059 manda PARAR. Três opções em dod-evidence §T059; recomendo **(a)** uma barra-resumo compacta nova no topo do formulário mobile.

### Verificação

- Frontend **1916/1916** (gate) · tsc · eslint/boundaries · depcruise · cobertura 89,53%; backend 474 passed, ruff/basedpyright/import-linter ok. Servidor intocado.
- E2E completo na stack real: **354 passed** + as 2 falhas eram uma âncora por substring (`getByText("Frete")`, adotada); screenshots 6/6 + 2/2 após o fix do link.
- Não-vácuo provado por mutação no `precision`; vermelho capturado antes em T049/T050/T051/T052/T053/T060.
- A captura do "Ver fonte" achou a URL inquebrável transbordando o diálogo a 390px — corrigido antes do gate (a lição de sempre: geometria só aparece na imagem).

### Decisões a ratificar na segunda passada

1. Confirmação de troca de modo **inline** (15e, "não cobre a tela") em vez do diálogo central que a T057 citava.
2. `adjusted`/`estimate`/`none` continuam **pílulas** (13b), não `Alert compact` como a T052 dizia.
3. 15f (segmented `size="sm"` na linha do título ≥1024px) **não implementada** — o corte da Calculadora é 1024 e o hook de largura mede 1280.
4. A 14b desenha o caso "0 → só a lição" (sem cabeça "Confira…") — o módulo não gera aviso para 0; ficou como a T049 escreveu (o aviso do valor comprometido persiste com o fecho trocado). Copy "só-lição" por campo é decisão sua.
5. A "marca da seção" `{n} avisos` (14c) e a linha de kit como `tf-aviso` (14e — `bom-line-card.tsx` ainda usa `.tf-field__aviso`) não têm task — follow-ups.
6. A prancheta 10 redesenha o rodapé inteiro (segmented Varejo|Atacado, barra de proporção, markup no cabeçalho, marketplaces como seção) — **nenhuma task do 019 cobre isso**; decidir onde entra.
7. Diálogo da taxa fixa reusa o título "Fonte da comissão" e "vigente desde" como data (só uma string transcrita; a entrada não tem `lastReviewed` próprio da taxa fixa). Ícone `wifi` (13b·3) não existe no DS — renderiza `info`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DP6jGooCvL3M2dac3o34EW
