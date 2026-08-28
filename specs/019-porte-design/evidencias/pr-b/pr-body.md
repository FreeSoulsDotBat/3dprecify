## 019 PR-B — Premium sem parede (US3 · FR-1906/1907/1908 · decisão D7 + decisão 3 do dono 27/08)

**Estado: CORREÇÃO DECLARADA** — nada aqui está homologado; a Rodada 1 fecha antes (D5). Evidência pronta para a segunda passada em `specs/019-porte-design/dod-evidence.md` §PR-B e `evidencias/pr-b/` (32 screenshots 1:1 + `medidas-pr-b.json`).

### O que muda (e o que NÃO muda)

A parede antes da lista, o botão de criar desabilitado e o aviso de reativação para quem nunca teve SAEM das quatro telas (Catálogo · Kits · Orçamentos · Simulações). ENTRAM o **vazio didático** (as 6 frases da prancheta 32c, byte a byte) e o **formulário inerte** (`<Frozen>`, campos vazios, "Salvar faz parte do Premium." ACIMA da linha de botões, "Assinar Premium" secundário FORA do fieldset, "Salvar" desabilitado e VISÍVEL). Quem TINHA e deixou vencer vê os itens e o formulário PREENCHIDO com "Reative o Premium… Seus itens estão salvos." — decidido pelo LEDGER (`premiumGate`), nunca por heurística. O deslogado vê o MESMO caminho (E-5); no clique, entra com a intenção preservada e cai na oferta.

**O servidor não muda um byte** — este PR é interface, não permissão.

### Ausências que este PR asserta

- **`git diff origin/develop -- backend/app/{entitlement,api,models,services}` = VAZIO** (SC-1903). A guarda `test_entitlement_gate.py` agora varre **43 rotas por MÉTODO** — a antiga era **vácua** (`app.routes` não achata `include_router` no FastAPI 0.138; varria 0 rotas) — e fica vermelha sob mutação (provado, revertido).
- **Zero escrita do grátis**: a barreira é a AUSÊNCIA do handler (research §E-2) — `create`/`update`/`remove` não chegam aos painéis fora de `active`, o `<form>` nem recebe `onSubmit`, o "Salvar kit" nem recebe `onClick`. Provado três vezes: unit (T037/T106), a guarda estrutural T107 (7 superfícies × 4 estados, 18 hooks espiados, lista PROVADA completa por leitura de `entities/**`, não-vácuo no `active`) e e2e (`page.route` contando POST/PUT/PATCH/DELETE = 0 nos 3 cenários).
- **Zero entrada no outbox**: IndexedDB `history:outbox:*` = 0 nos 3 cenários (e2e).
- **Zero toast falso**: `await create?.(body)` com writer ausente não dispara mais sucesso (T106, achado 01 da auditoria).
- **Um convite por tela, em cada estado** (FR-1906): `teaser-sweep` conta nos dois estados (lista / formulário aberto) a 390 e 1920; `medidas-pr-b.json` = 1 em todas as capturas (as duas leituras ≠1 explicadas na evidência).
- **Zero classe `tf-*` nova**: o vazio didático compõe o `EmptyState`; `tf-class-uniqueness` continua verde.

### Verificação

- Frontend: **1412/1412** unit (38 da T107 incluídos) · tsc · eslint (boundaries) · depcruise · `pnpm gate:all` verde (pre-push).
- Backend: `test_entitlement_gate.py` 10/10 com banco; suíte inteira no gate.
- E2E stack real (emulador 9500 + Postgres + backend): **rodada completa 351 passed / 0 failed** após adotar as âncoras; `premium-sem-parede.spec.ts` 18/18; 1 flaky infra (`overflow-geometria` mobile: "browser has been closed", verde no retry e na re-rodada).
- Screenshots 1:1 nos dois temas (390 e 1920), conferidas contra as pranchetas 32a/32b/32e/32g.

### Decisões tomadas (para o dono ratificar na segunda passada)

1. **32a × FR-1906**: a prancheta diz "nenhuma menção a plano" no vazio; a FR exige um convite por tela. A FR ganhou — o vazio carrega o `TeaserUpgrade` (preço + "Assinar Premium") abaixo do botão. Reverter = `teaser={false}` por padrão + relaxar a contagem.
2. Títulos do vazio de impressora/produto/kit/simulação NÃO foram desenhados no lote 32 — ficam os de hoje ("…salva ainda"). Filamentos perdeu o "ainda" como a 32a manda.
3. "Voltar" sai do rodapé inerte (o Sheet tem o X; a 32b só tem dois itens) — também na ficha do desktop.
4. `unknown` (logado sem resposta do servidor): Salvar desabilitado sozinho, sem frase e sem convite — nunca presume (CF-045).
5. A 32h (entrada-com-intenção do deslogado) **não existe no remoto**: o comportamento já existe (`/sign-in?redirect=/conta?assinar=1`), a copy entra quando a prancheta existir.
6. Observações das screenshots: custo "94,9" no edit inerte (formatação pré-existente do edit); a ficha inerte do desktop sem o título "Novo filamento"/"Voltar" do cartão da 32g.

### Pedido ao dono

Flip de nenhum ADR nesta fatia (o 0032 já foi no PR-A; 0033/0034 são D/E). Merge = squash em `develop`, como as demais.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DP6jGooCvL3M2dac3o34EW
