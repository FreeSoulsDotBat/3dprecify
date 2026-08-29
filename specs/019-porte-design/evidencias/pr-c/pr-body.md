## 019 PR-C — Comportamentos da calculadora (US4 · FR-1909/1910/1911/1912 · SEM bump)

**Estado: CORREÇÃO DECLARADA** — nada homologado; a Rodada 1 fecha antes (D5). Evidência em `specs/019-porte-design/dod-evidence.md` §PR-C e `evidencias/pr-c/` (16 screenshots 1:1 nos dois temas + `medidas-pr-c.json`).

### O que muda

- **Aviso de plausibilidade** (prancheta 14): entra **no blur**, não a cada tecla; é `<Aviso>` irmão do campo (não mais o `hint` colorido), anunciado (`role="status"`), com **"Entendi"** que guarda o par campo+valor **pela sessão** (store sem `persist`); **o erro não come mais a lição** — com recusa junta, o fecho troca para "Corrija o campo acima para calcular." e o "Entendi" some; dinheiro na frase com 2 casas ("R$ 6.000.061,60"); o aviso do resultado vira duas linhas quando são dois fatos. Nos 3 pontos da Calculadora e, por herança do `ControlledField`, na linha de peça de kit.
- **Bloco da máquina** (prancheta 15): `Estimar · Ajustar` como `Segmented`; o custo/hora vira **readout** ("Custo da máquina por hora de impressão · R$ 1,11 · de R$ 4.000,00 ÷ 3.600 h") nos **dois** modos; sem valor da máquina, o zero ganha a ressalva "falta o valor da máquina"; voltar à estimativa com horas digitadas à mão **pergunta antes** — inline, com os dois números em disputa ("Usar 3.600 h" / "Manter 2.000 h"); nada sobrescrito antes do "Usar". **`PRICING_MODEL_VERSION` continua 4.1.0** (vetor 27,55/41,33/35,82 intacto).
- **Selo de procedência** (prancheta 13): de `Badge` dobrado para `Alert compact` — rótulo nomeia o número ("Comissão"/"Taxa fixa"), citação em 2 linhas, categoria de origem, data, **"Ver fonte"** (abre a citação inteira + o `sourceUrl` que o catálogo sempre carregou e nunca mostrou), **"Dispensar"** até a fonte mudar (chave `marketplace::source::data`, 50 recentes, `localStorage`). Os qualificadores curtos continuam pílulas; o catch-all vira linha do corpo (o transbordo de 360px do 016).
- **Precisão**: a tarifa de energia aceita 4 casas (R$ 0,8734/kWh) sem truncar no blur — custo de energia numericamente igual (SC-1905); "0" reabre "0,00". **Achado real**: a reabertura de cenário (`moneyLeafToPtBr`, o "R5" do 016) cortava a tarifa a 2 casas — corte de VALOR, não de exibição — morto com teste vermelho→verde.

### O que espera prancheta nova (prompt de correção já no projeto de design — `uploads/019-pr-c-correcoes.md`)

- **T212** (resumo do preço a 390px): o dono decidiu o desenho — o preço provisório acompanha o preenchimento e se **mescla** com o cartão final ao chegar ao fim da rolagem. Implementa quando a prancheta existir (T059/T054).
- **Confirmação de modo como diálogo** (o inline da 15e fica até lá — T144), a **marca da seção** `{n} avisos` (T145) e a **linha de kit com `tf-aviso`** (T146).

### Verificação

- Frontend **1916/1916** (gate) · tsc · eslint/boundaries · depcruise · cobertura 89,53%; backend 474 passed, ruff/basedpyright/import-linter ok. Servidor intocado.
- E2E completo na stack real: **354 passed** + as 2 falhas eram uma âncora por substring (`getByText("Frete")`, adotada); screenshots 6/6 + 2/2 após o fix do link.
- Não-vácuo provado por mutação no `precision`; vermelho capturado antes em T049/T050/T051/T052/T053/T060.
- A captura do "Ver fonte" achou a URL inquebrável transbordando o diálogo a 390px — corrigido antes do gate (a lição de sempre: geometria só aparece na imagem).

### Decisões do dono já aplicadas (28/08)

- Pílulas continuam pílulas (13b) · hook `useIsCalcWide` (1024, limiar nomeado) + segmented na linha do título ≥1024 (15f) · as 8 copies só-lição aprovadas (campo recusado mostra só a lição) · ícone wifi e chevron como no design · prancheta 10 (rodapé redesenhado) entra na PR-F (T141–T143).
- Ainda sem copy do dono: o ⓘ "Sobre o custo da máquina" que a 15a desenha ao lado do título "A máquina" (o corpo não está na prancheta); o diálogo da taxa fixa reusa "Fonte da comissão".

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DP6jGooCvL3M2dac3o34EW
