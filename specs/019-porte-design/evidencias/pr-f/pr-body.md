## 019 PR-F — Simulações ≥1280 + o rodapé da prancheta 10 + as divergências D1/D2 (US7 · FR-1917/1918/1919)

**Estado: CORREÇÃO DECLARADA** — nada homologado; a Rodada 1 fecha antes (D5). Evidência em `specs/019-porte-design/dod-evidence.md` §PR-F e `evidencias/pr-f/` (baseline ANTES do código + 36 capturas 1:1 nos dois temas + `medidas-pr-f.json`, `a11r.json`).

### O que muda

- **Simulações ≥1280 (DECISÃO 2 do dono, 27/08 — emenda 2 do ADR-0031)**: o privado `ScenarioListBody` vira o export `ScenariosList` no MESMO arquivo, e a coluna larga de `/calcular` monta a lista num `<aside>` sticky ao lado da calculadora preenchida — **uma instância só** (a gaveta não monta ≥1280; "Minhas simulações" rola+foca a coluna). O corte de 1024 da própria Calculadora continua valendo dentro da coluna — os dois limiares nomeados convivem. Mobile: a gaveta a 390/360 é **idêntica ao baseline** capturado antes de tocar código (T094 → T093, geometria + overflow). `widthRatio()` de `/calcular` a 1280/1440/1920 = **93,8 / 93,3 / 66,7 %**, igual ao baseline — a coluna vive dentro da mesma `section`. Um helper só (`scenarioOpenArgs`) traduz item → abertura para a gaveta e para a coluna.
- **O rodapé da prancheta 10** (decisão do dono 28/08): a conta **termina no custo total** ("Preço varejo/atacado" saem das linhas); o markup sobe para o cabeçalho ("markup 50% no varejo · 30% no atacado"); **barra de proporção** dos custos sob a conta com as bolinhas de volta (reversão datada do 016/US5 FR-907-AC2; tokens `--tf-purple/teal/orange` + `-deep`, hexes idênticos à prancheta); **"Preços por marketplace" vira seção própria ANTES dos cartões**, com a nota "O marketplace mostra só o nível escolhido acima…"; **Segmented Varejo | Atacado** governa o cartão grande (um preço por vez; o atacado escolhido em superfície neutra — `tf-price--neutral`, o único acréscimo ao DS), a linha-resumo do outro ("Atacado · markup 30%") e os dois números de cada marketplace; sem Premium a seção **não existe** no DOM. A 1280 o resultado atravessa as duas colunas, ≤ 720px centralizado. **R$ 950.096,00** (o número da 10b) sem transbordo em X e Y a 360/390/1280/1920.
- **D1/D2**: as 7 frases "Premium pausado" nomeadas (6 vivas + `catalogo.lapsedTitle` apagada na PR-B) num snapshot conjunto; as duas folhas de renomear leem a MESMA chave — as duas guardas provadas por mutação. **Q1/Q2**: `catalogo.searchEmpty` com `{termo}`; a ressalva offline por linha sai (fica só a faixa).
- **A11-r** (só medição): `tf-table` 1024 = 9 · 1279 = 9 · mestre-detalhe 1280 = 7 · 1920 = 14 itens sem rolar.

### O que o e2e achou nesta fatia (e o que foi feito)

- **Regressão da PR-D já em `develop`**: entre 1024–1279 o nome na `tf-table` do Catálogo era **invisível e inclicável** nas três abas — o `<button>` do nome repetia a classe `tf-table__name` da célula, e o `max-width: 0` da folha (inerte numa célula com `table-layout: auto`) valia no botão: largura **0** medida. As capturas da PR-D não pegaram porque a asserção era de texto (`toContainText` passa num elemento de largura zero — a lição do 014, de novo). Corrigido aqui + guarda e2e permanente por geometria (`offsetWidth > 0` a 1024/1279).
- **"Um convite só"**: a coluna larga deslogada trazia um terceiro "Assinar Premium" colado ao teaser da calculadora (mesma classe do duplo convite que a PR-B matou no Catálogo) — o vazio da coluna monta com `teaser={false}`; a página mantém os seus dois convites por desenho.
- **Vermelho intermitente** (SC-611, só sob a carga da suíte inteira): o focus-guard do Radix ainda fechando deixava o botão `aria-hidden` — morre na causa (`waitFor`), não no "roda de novo".
- O Chromium padrão do Playwright é 1280×720 — exatamente o limiar de `useIsWide`; `scenarios*.spec` fixados a 900px, os specs que assumiam a gaveta a ≥1280 adotados por largura.

### Verificação

- **Gate `pnpm gate:all` (final)**: frontend **2028/2028** (175 arquivos; format/lint+boundaries/depcruise/typecheck; cobertura 89,75%) · backend **577 passed** (ruff, basedpyright 0, pytest cov 84%, import-linter 6/6). O mesmo comando literal do pre-push e do CI.
- **E2E completo na stack real** (508 testes, chromium + mobile, `--workers=1`): 1ª rodada 363 passed · 12 failed (4 classes, todas tratadas: geometria A5 gera R$ 950.096,00; regex no `price-hero`; 3 specs ramificam por largura ≥1280; SC-611 na causa) · 3 flaky (`grant_premium` JIT×CLI, verdes no retry). Rerodagem dos 9 specs afetados: chromium todos verdes · mobile 51 passed / 2 flaky idem. Unit completo **1564/1564**.
- Baseline ANTES do código (T094) e comparação DEPOIS (T093); prancheta 20g se declara "proposta" — o que manda é a decisão do dono (registrado no README das pranchetas).

### Pede ao dono

- **Flip da emenda 2026-08-26 do ADR-0031** (Simulações, a quinta aba) — com a Emenda 2 (2026-08-27/29, os três limiares nomeados) já aplicada.
- **Ratificar**: (1) a coluna de Simulações tem 320px (a 20g desenha 300px fixos e se declara proposta); (2) a legenda da barra mostra só a parte fixa — "metade do seu custo é material" é EXEMPLO da prancheta (10a) e a 10d nem repete "bolinhas": falta uma regra para a frase dinâmica; (3) `role="radiogroup"` no Segmented Varejo|Atacado (a marcação estática da prancheta diz `tablist`; a convenção viva do arquivo é radiogroup); (4) `.tf-brow__dot` herdado do 016 é 10×10 com raio 3 onde a prancheta desenha 8px redondo; (5) o vazio da coluna larga SEM convite (a gaveta mantém o dela); (6) o `aria-label="Nível de preço"` transcrito além da lista da T141; (7) a lista a 1920 não destaca visualmente a simulação aberta (a barra de contexto já a nomeia) — ponto para a 2ª passada.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DP6jGooCvL3M2dac3o34EW
