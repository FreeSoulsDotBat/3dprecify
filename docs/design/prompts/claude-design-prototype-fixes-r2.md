# Prompt de correção — Precifica3D Protótipo Clicável (rodada 2, 2026-07-02)

> Enviar ao Claude Design no projeto "Precifica3D — Protótipo Clicável". Resíduo da rodada 1
> (20 dos 37 itens foram corrigidos e verificados — não os toque). Verificação:
> `docs/design/prototype-audit-2026-07-02.md` §"V2 verification".

---

A rodada 1 foi verificada com renderização real: 20 itens corrigidos, zero regressões — bom trabalho.
NÃO altere o que já foi corrigido (teaser do catálogo, copies, sementes canônicas 100/1/20/50,
arredondamento, tela de erro 500, card Premium da Conta, overflow, glow no resultado, one-shot do
splash). Esta rodada fecha os 17 itens restantes.

**IMPORTANTE — camada certa:** na rodada 1, todas as mudanças ficaram no `prototype.dc.html`; a camada
do design system (`_ds/.../readme.md` e `_ds/.../tokens/*.css`) não foi tocada. Os itens 1–5 abaixo
DEVEM ser feitos nos arquivos do design system, porque é deles que o app real herda tokens e
documentação — correção só no HTML do protótipo não resolve.

## No design system (tokens + readme)

1. **Tokens de status-como-texto** (era o item 25): promova o `--p3d-danger-text` local do protótipo
   para `tokens/colors.css` como `--danger-text` oficial (`:root` → `--danger-deep`;
   `[data-theme="dark"]` → vermelho claro ≥ 4,5:1 sobre `--surface-card`, ex. `#ff6b73`). Crie
   também `--success-text` e `--info-text` com o mesmo critério. Aplique `--info-text` ao banner de
   offline no dark (hoje o teal `--info-deep` sobre fundo teal-escuro tem contraste baixo). Faça o
   protótipo consumir os tokens oficiais (remova o `--p3d-danger-text` local). Documente a regra
   "status como texto" no readme §3.
2. **Docs de tema** (item 28): corrija `tokens/colors.css` ("Semantic — LIGHT (default, v1)") e o
   readme §3 ("Light is the default theme") — o produto usa DARK como default; light é first-class.
3. **Tabela de erros** (item 20): o mapa `errorMessage()` do protótipo usa códigos próprios
   (`unavailable/network/auth/server`). Rechaveie para os códigos canônicos do produto —
   `UNAUTHENTICATED` ("Sua sessão expirou. Entre de novo."), `TOKEN_EXPIRED` (idem), `VALIDATION_ERROR`
   (mensagem do campo), `INTERNAL` ("Não foi possível completar. Tente de novo."), mais o estado de
   offline — e documente a tabela código→frase no readme.
4. **Seção "Escopo por época" no readme** (item 37): fatia 001 = login Google + material+markup
   único; E1 = energia/máquina/falha/atacado (modelo ILUSTRATIVO, não ratificado); E2 =
   catálogo/salvar; E4 = histórico/export/compartilhar; E5 = marketplace; E6 = assinatura. Explicite
   que fórmulas além de material+markup são propostas a ratificar.
5. **Nota de identidade no readme** (parte do item 36): nome/e-mail da Conta vêm do endpoint
   `/api/v1/me` (identidade confirmada pelo servidor) e o status Premium vem do servidor — o
   `localStorage` do protótipo é apenas simulação.

## No protótipo

6. **Identidade placeholder** (item 36): troque "Jonatan Silva / jonatan@email.com" por um
   placeholder neutro (ex.: "Sua conta / voce@gmail.com"), mantendo o rótulo "sessão demo".
7. **Pré-paint** (item 27): no script inline do `<head>`, resolva
   `localStorage → window.matchMedia('(prefers-color-scheme: dark)') → dark`. Hoje a primeira visita
   pula a preferência do sistema.
8. **Validação de negativos** (item 10): todos os campos numéricos da calculadora (custo do rolo,
   gramas, tarifa, consumo, custo/hora, horas, falha, markups) devem rejeitar valores < 0 com
   mensagem inline — sem clamps silenciosos.
9. **Moeda × Idioma** (item 15): na Conta, separe em duas linhas — "Moeda: R$ (BRL)" e "Idioma:
   Português (Brasil)".
10. **Seed do catálogo** (item 21): no empty do Catálogo (segmento Filamentos), adicione o CTA
    secundário "Começar com filamentos comuns" (semeia PLA/PETG/ABS ilustrativos).
11. **Foco** (item 22): ao fechar modal/sheet com Escape, devolva o foco ao elemento que abriu — o
    fechamento por botão já restaura o foco corretamente; ligue o handler de Escape ao mesmo
    mecanismo (aceite: após fechar com Escape, `document.activeElement` == o gatilho). Na troca de
    aba (e ao entrar em 404/500), mova o foco para o título da nova tela (`tabindex="-1"` no h1).
12. **Alvos de toque** (item 23): fechar do upsell (38px), toggle de tema da sidebar (40px), Switch
    (28px de altura tocável) e opções do SegmentedControl (36px) — todos ≥ 44px de área tocável.
13. **ARIA** (item 24): `aria-pressed` no toggle de tema da sidebar; `aria-live="polite"` explícito
    no banner offline (o `role="status"` já está lá).
14. **Loading demo + skeleton no dark** (item 16): adicione o toggle "Demo: carregando" na Conta
    (como os de erro/offline), que SEGURA o estado de skeleton em Catálogo/Histórico/resultado (hoje
    o skeleton só aparece na janela de ~650ms do setTab); e aumente a visibilidade do skeleton no
    tema escuro (base ~`--surface-raised` com shimmer mais claro — hoje é quase invisível sobre o
    fundo; respeite `prefers-reduced-motion`).
14b. **Empty do Histórico alcançável** (item 18, opcional): o estado renderiza corretamente mas não
    há caminho de UI até ele (2 cálculos semeados, sem excluir). Adicione um toggle "Demo: histórico
    vazio" na Conta ou uma ação "Limpar histórico (demo)".
15. **Largura de conteúdo e raios** (item 31): `contentMax` deve usar `var(--content-max)` (1120px
    no desktop — hoje string fixa "880px"); substitua os raios hardcoded restantes (12/10/8/7px)
    pelos tokens `--radius-*`.
16. **Campo "Nome"** (item 32): troque o `<input>` cru do sheet pelo componente Input/Field do
    design system (anel de foco de marca).
17. **Formulários do catálogo** (item 34): impressora — adicione "Modelo", "Horas/dia", "Dias/mês" e
    "Payback (meses)" (ou anote no readme por que a simplificação Valor+Custo/hora é intencional);
    filamento — adicione o campo "Cor"; em ambos, desabilite "Salvar" enquanto o formulário estiver
    inválido (hoje valida só no clique).

Limpeza opcional: remova o `@keyframes p3dpulse` morto.
