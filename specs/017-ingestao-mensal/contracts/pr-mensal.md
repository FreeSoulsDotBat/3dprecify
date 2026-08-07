# Contrato: o corpo do PR mensal (US2 — o relatório que não mente)

Gerado por `pr-body.ts` — função pura `(vereditos, diff, vigias, exemption) → markdown`.
Testado nas DUAS direções: presença do que mudou, AUSÊNCIA do que não mudou (lição 014/US4).

## Estrutura (ordem fixa)

1. **[condicional, TOPO] Seção de DECISÃO** (clarify Q2) — só quando um vigia pede decisão do
   dono: valor da fonte A × valor da fonte B × auto-datação da página × as duas URLs. Título do
   PR prefixado `DECISÃO — `, label `decisao-do-dono`, dispensa FORÇADA a não.
2. **[condicional] Banner de divergência OCR** (clarify Q8) — quando qualquer folha vinda de OCR
   move além de `OCR_DIVERGENCE_BANNER`: "divergência acima do limiar declarado — confira a
   imagem", com lido × anterior × link da imagem.
3. **Estado por marketplace** (SEMPRE, 100% dos corpos — SC-1003): tabela sobre
   `MARKETPLACE_COVERAGE` com LIDO (data) · ABORTADO (motivo) · NÃO LIDO (porquê — ML: "sem
   credencial, fora do escopo do 017"). Mesma lista da liveness e do compositor.
4. **[somente se houver] Mudanças de tarifa**: `antigo → novo` por categoria, com URL da fonte e
   data de coleta. Folha de OCR SEMPRE acompanha lido × anterior × link (AC5 — sem isso a
   revisão humana de OCR é teatro; guardas pegam ~35% do erro plausível de célula única).
5. **[somente se houver] `## Vigias (nenhum dado alterado)`**: o que cada vigia viu, com diff de
   baseline como evidência. A frase "nenhum dado alterado" é parte do TÍTULO da seção — ninguém
   lê alerta de vigia como escrita de catálogo.
6. **Rodapé de dispensa**: imprime o estado de `ALLOW_FRESHNESS_EXEMPTION` (nasce DESLIGADA) e o
   porquê (P0-b pendente); quando ligada e negada, imprime o eixo que negou.

## Asserções de teste (mínimas, cada uma vermelha antes)

- Execução sem mudança ⇒ `not.toContain("Mudanças de tarifa")` e zero `antigo → novo`.
- Execução com 1 folha mudada ⇒ exatamente ela como `antigo → novo`, com fonte+data.
- Sempre: 3 estados presentes para TODOS os marketplaces da cobertura.
- OCR no diff ⇒ dispensa negada + AC5 presente, mesmo abaixo do limiar do banner.
- Vigia com mudança + catálogo intacto ⇒ seção 5 presente, seções 4 ausentes, dispensa NEGADA
  pelo eixo (b) do classificador (arquivo de baseline no PR).
