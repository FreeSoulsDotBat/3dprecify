# Como obter cada dado dinamicamente — plano por marketplace

**Data:** 2026-08-05 · **Base:** workflow de pesquisa em 6 frentes (ML custo fixo · ML comissão por categoria · ML frete/cubagem · Amazon tabela medida · Amazon isenção/planos · Shopee), com cada achado submetido a um verificador adversarial que re-mediu de forma independente.

**Convenção:** MEDIDO = obtido por medição direta nesta data (HTTP, parser, visão sobre artefato baixado); REPORTADO = afirmado por terceiro e não confirmado em fonte oficial. Um achado REFUTADO entra abaixo pelo valor da **correção**, nunca pelo texto original.

---

## O que este workflow respondeu (e o veredito)

### Mercado Livre — custo fixo

| Pergunta | Resposta curta | Veredito | Fonte principal |
|---|---|---|---|
| (a) Limiar do custo fixo (R$ 79)? Varia por categoria/logística? Mudança 02/03/2026? | Limiar **R$ 79 mantido**. Desde **02/03/2026** o custo fixo depende do **tipo de logística**: abaixo do limiar, só Flex (`self_service`), ME1, `custom` e `not_specified` pagam; os demais ME2 (Coleta, Agências, Full) **não pagam** — substituído por custo operacional por peso/preço. Acima de R$ 79, ninguém paga. **Não varia por categoria** (categoria afeta só o percentual). MEDIDO (doc oficial developers, "Última atualização em 06/03/2026"). | **CONFIRMADA** | developers.mercadolivre.com.br/pt_br/comissao-por-vender |
| (b) Valores em R$ do custo fixo nas faixas R$ 12,50–79? | **PARCIAL.** O oficial confirma a estrutura ("três faixas") mas **não publica os números**. A tabela pós-03/2026 (reproduzida por Ferax e corroborada independentemente por Tecnospeed) usa faixas novas **0–18,99 / 19–48,99 / 49–78,99 × peso** — REPORTADO, verbatim em duas fontes independentes. A tabela nova do **Flex** não foi encontrada em nenhuma fonte confiável. Números só viram fato via `listing_prices` autenticado (403 sem token, MEDIDO). | **CONFIRMADA** (como parcial) | vendedores.mercadolivre.com.br + Ferax/Tecnospeed (blogs concordantes) |
| (c) Regra "50% do preço" abaixo de R$ 12,50 ainda vale? | **PARCIAL.** A página oficial de vendedores **ainda publica a regra hoje** (MEDIDO, verbatim, reproduzido pelo verificador). Mas a página não tem data e descreve o modelo pré-reforma; blogs recentes não a repetem. Pós-reforma ela só pode incidir onde ainda existe custo fixo (Flex/ME1/custom). Prova numérica pendente (`price=8` → `fixed_fee==4,00` via API autenticada). | **CONFIRMADA** (com risco residual reforçado) | vendedores.mercadolivre.com.br/nota/como-funcionam-as-taxas-do-mercado-livre |
| (d) Existe PISO de comissão percentual no MLB? | **NAO_ENCONTRADA.** Nenhuma fonte afirma nem nega. Doc oficial: 0 menções a mínimo. A resolução empírica (sondar `percentage_fee` na API) está fechada sem token (403 MEDIDO). **O catálogo deve manter "não determinado" — nunca gravar "não existe".** | — (não passou pelo verificador) | developers + vendedores (ausência de menção) |

### Mercado Livre — comissão por categoria (landing)

| Pergunta | Resposta curta | Veredito | Fonte principal |
|---|---|---|---|
| (a) Landing de custos mostra alíquota por categoria sem login? | **NÃO.** 302 do servidor → login com reCAPTCHA Enterprise, nas 3 URLs (landing ×2 + simulador). MEDIDO com navegador real e reproduzido com curl pelo verificador. | **CONFIRMADA** | medição direta das URLs |
| (b) Há XHR público atrás da landing? | **NÃO observável:** o 302 acontece antes de qualquer JS executar; só telemetria e reCAPTCHA na rede. Não existe endpoint escondido acessível de fora. | **CONFIRMADA** | inspeção de rede (Playwright) + curl |
| (c) Existe QUALQUER caminho oficial sem credencial para alíquota por categoria? | **NÃO.** API anônima → 403 PolicyAgent (MEDIDO 2×). A única página pública (ajuda/870) traz só **faixas agregadas**: Clássico 10–14%, Premium 15–19% — útil apenas como sanity-check. Tabelas por categoria só em blogs (inadequadas para o catálogo). | **CONFIRMADA** | api.mercadolibre.com (403 medido) + ajuda pública |
| (d) Com credencial: qual endpoint e qual permissão? | `GET /sites/MLB/listing_prices?price=X&category_id=Y` com Bearer token; devolve `sale_fee_details.percentage_fee` etc. Permissão mínima **medida pelo projeto** (ADR-0010 §A13): "Publicação e sincronização: Leitura". Token expira em 6h; **correção do verificador a favor**: o refresh token antigo sobrevive à rotação (medição G3 do projeto) — custo operacional no CI **menor** do que o finding sugeria. | **CONFIRMADA** | doc oficial developers + ADR-0010 §A13 |

### Mercado Livre — frete e cubagem

| Pergunta | Resposta curta | Veredito | Fonte principal |
|---|---|---|---|
| (a) Tabela Mercado Envios por peso, 2026 | **OBTIDA COMPLETA e MEDIDA:** 3 tabelas oficiais (uma por cor de reputação), 29 faixas de peso × 8 faixas de preço, extraídas por parser determinístico. Verificador re-mediu **todas as 696 células: 0 divergências**. O 403 anterior era só falta de User-Agent. | **CONFIRMADA** | mercadolivre.com.br/ajuda/40538, /40545, /40547 |
| (b) Divisor do peso cubado | **6.000** — `peso_cobrado = max(peso_físico, A×L×P/6000)`, cm→kg. MEDIDO, verbatim no oficial. | **CONFIRMADA** | ajuda/4413 |
| (c) Frete depende de reputação? | **SIM** — a reputação seleciona a **tabela inteira** (desconto já embutido): verde/MercadoLíder/sem reputação, amarela, laranja/vermelha (base). Aritmética re-verificada em todas as 29 linhas: nas colunas ≥R$ 79 verde = 50% exato da base e amarela = 60% exato; nas colunas <R$ 79, ~0,70 e 0,80. Sem tabela extra por nível de MercadoLíder. | **CONFIRMADA** | as 3 páginas de ajuda |
| (d) Limiar de frete grátis (R$ 79) e quem paga | **R$ 79 vigente** (MEDIDO nos headers). Três regimes: <R$ 19 comprador paga frete, vendedor paga custo operacional (máx. metade do preço); R$ 19–78,99 frete grátis padrão do ML, vendedor paga coluna subsidiada; ≥R$ 79 vendedor paga o frete grátis rápido. Kits pagam **um único custo por kit**. | **CONFIRMADA** | ajuda/40538 + /3362 |
| (e) API pública de cálculo de frete? | **NÃO existe** no nível de site (404/403 MEDIDOS em 5 endpoints, reproduzidos). `users/{id}/shipping_options/free` existe mas está atrás do PolicyAgent — **plausível** com o token da casa, **NÃO TESTADO**. O caminho sem credencial que funciona é a tabela do help center (a). | **CONFIRMADA** | medições diretas na API |

### Amazon BR — tabela medida

| Pergunta | Resposta curta | Veredito | Fonte principal |
|---|---|---|---|
| (a) Quantas categorias na tabela oficial? | **38** (não 37) — MEDIDO com Playwright headless **sem login** (curl devolve casca vazia). Mapeiam **1:1** nos 38 slugs do catálogo, percentuais idênticos linha a linha, 3 progressivas (Acessórios Eletrônicos 15%/10% corte 100; Móveis e Colchões 15%/10% corte 200). Duas medições independentes (28/07 e 05/08) concordam. | **CONFIRMADA** | sellercentral.amazon.com.br G200336920 |
| (b) Quais categorias têm mínimo R$ 1,00 e quais R$ 2,00? | Na página vigente do Seller Central: **R$ 1,00 em TODAS as 38** — não há fronteira. Os únicos "2,00" do documento são a tarifa por item do **plano Individual** (outra taxa). **PORÉM** o verificador achou a origem provável do "segundo piso": a página oficial **/precos** imprime "Comissão mínima R$ 2,00" em ~11 categorias — mas ela se auto-data ("comissões atualizadas em 20/01/2025") e **defere a autoridade** exatamente à página G200336920 medida. Ver §Divergências. | **CONFIRMADA** (com ressalva importante) | G200336920 (vigente) vs venda.amazon.com.br/precos (vintage ≤ jan/2025) |
| (c) Onde o oficial diz R$ 2,00 e nosso catálogo diz 1? | **Conjunto vazio** contra a fonte vigente: catálogo (78 entradas AMAZON, `minPerItem=1` uniforme, 38 slugs, 3 progressivas) **concorda** com a página medida — o 1,00 uniforme não é bug de parser. Nota do verificador: a tarifa R$ 2,00/item do plano Individual **não está modelada** no catálogo (entradas INDIVIDUAL têm `fixedFee=0`). | **CONFIRMADA** | diff determinístico G200336920 × backend/app/data/catalog.json |

### Amazon BR — isenção e planos

| Pergunta | Resposta curta | Veredito | Fonte principal |
|---|---|---|---|
| (a) "Comissão zero até R$ 500 mil" — vale em 2026-08? | **ATIVA e MEDIDA**, mas **condicional**: vendedor **novo** em FBA/DBA/FBA Onsite, CNPJ, origem em **São Paulo**; 90 dias com teto de R$ 40 mil de comissão isenta (+2 meses/R$ 20 mil sob condições); campanha 10/02–31/12/2026. **NÃO entra no catálogo como `commissionPct=0`** — é benefício temporário por vendedor. | **CONFIRMADA** | venda.amazon.com.br/termos/vender-com-amazon + press release aboutamazon.com.br |
| (b) Plano altera a comissão? Valores dos planos? | **REFUTADA — entra pela correção.** O núcleo vale (plano **não** altera o percentual; Individual = R$ 2,00/item; Profissional = R$ 19/mês a partir do 13º mês, 1º ano grátis; estável desde ≥dez/2020 — MEDIDO). **A correção:** segundo o verificador, "minPerItem = R$ 1,00 único" está errado — a /precos lista **R$ 2,00 em ≥11 categorias** (Brinquedos, Casa, Cozinha, PC, Esportes/lazer, Autopeças, Jardim, Bebês, Pet, etc.), exatamente onde peças 3D baratas vendem; o schema deveria modelar `minPerItem` **por categoria**. ⚠️ Este veredito **conflita** com o veredito (b) da frente "tabela medida" (que data a /precos como jan/2025 e defere à G200336920 vigente com 1,00 uniforme). Conflito não resolvido pelo workflow → §Divergências + §Decisões. | **REFUTADA** | venda.amazon.com.br/precos vs G200336920 |
| (c) Existe closing fee por item (mídia etc.)? | **PARCIAL.** Nenhuma fonte oficial pública menciona closing fee; as únicas cobranças fixas por item são o R$ 2,00 do plano Individual e o piso da comissão. Um blog (REPORTADO, sem valor) afirma closing fee em mídia; a página oficial de closing fees exige login (shell vazio MEDIDO em 2 domínios). Para categorias não-mídia (as relevantes a 3D): sem evidência de tarifa extra. | **CONFIRMADA** (como parcial) | /precos + sellerblog oficial |
| (d) Onde vivem as URLs e cadência histórica | Mapa completo MEDIDO: /precos (fetch simples, cadência de ANOS), /vender-com-amazon + /termos (campanha anual), G200336920 (headless sem login p/ a tabela; curl não serve), sellerblog (histórico datado). Ressalva do verificador: o parser da /precos deve capturar a **comissão mínima por categoria** (para monitorar o conflito 1,00 vs 2,00). | **CONFIRMADA** | medições nas 4 famílias de URL |

### Shopee BR

| Pergunta | Resposta curta | Veredito | Fonte principal |
|---|---|---|---|
| (a) Fórmula do adicional CPF para itens < R$ 12 | **PARCIAL.** Os dois pontos são **oficiais e verbatim** (R$ 10 → R$ 6,50; R$ 8 → R$ 6,00), no contexto CPF >450 pedidos/90 dias (+R$ 3/item). A **fórmula/tabela completa NÃO é publicada** — só os 2 exemplos. A hipótese linear (R$ 4 + 0,25×preço) é colinear com os pontos mas **não é fato** — nenhuma fonte a publica; precisaria de mais pontos (ex.: extrato real). | **CONFIRMADA** (como parcial) | seller.shopee.com.br/edu/article/26839 |
| (b) Existe PISO de comissão na Shopee? | **NAO_ENCONTRADA.** Texto oficial completo varrido: zero menções a piso/mínimo; nenhum blog cita. Ausência não é negação — manter "não determinado". | **INCONCLUSIVA** (pulada pelo verificador por instrução; re-leitura incidental consistente) | art. 26839 |
| (c) Cobrança adicional por peso/dimensão aferidos | Regra oficial existe; **tabela de valores do ajuste, não** — o valor é o **recálculo do frete** na faixa real (análises semanais; cobrança até 90 dias; contestação até 12 meses). **Não é fee determinística — é risco operacional**, não entra como tarifa. **Correção positiva do verificador:** a taxa de **R$ 50,00/pedido** de manuseio de itens volumosos (vigência 02/02/2026) **é OFICIAL** (art. 3305) — sobe de REPORTADO para MEDIDO/OFICIAL. | **CONFIRMADA** (+ correção que fortalece) | art. 4478 + art. 3305 |
| (d) Como obter a tabela Shopee todo mês | MEDIDO: páginas públicas **sem login mas 100% JS-renderizadas** (fetch simples → casca SPA; endpoint interno → 403). As tabelas de faixas vivem em **PNGs públicos content-addressed** (URL nova = tabela nova — sinal de versão determinístico, 0 tokens). Faixas lidas por visão e corroboradas por 2 fontes independentes: CNPJ 20%+R$4 (até 79,99) · 14%+R$16 / +R$20 / +R$26 · Pix 5%/8%; CPF = mesmas +R$3. **Sem API pública.** Ressalva: a sub-regra <R$ 8 (CNPJ) = 50% do preço vive **fora** da tabela-imagem. | **CONFIRMADA** | art. 26839 + PNGs susercontent + endpoint 403 medido |

---

## O plano de obtenção mensal, por dado

### Mercado Livre

**1. Comissão percentual por categoria (`commissionPct` × `categorySpine`)**
- **Método:** API com credencial — `GET /sites/MLB/listing_prices?price=X&category_id=Y` (Bearer), iterando as categorias do spine; ler `sale_fee_details.percentage_fee`. **Único caminho automatizável** — landing e simulador estão atrás de login (302 servidor, MEDIDO); API anônima → 403 (MEDIDO).
- **Credencial:** token OAuth da conta da casa; permissão mínima **medida** "Publicação e sincronização: Leitura" (ADR-0010 §A13). Token expira em 6h; refresh rotaciona no uso e o antigo sobrevive (MEDIDO, G3) — a rotina de refresh no CI é viável.
- **Cadência:** mudanças ~1–2×/ano por anúncio → **coleta mensal** captura qualquer mudança com atraso ≤1 mês.
- **Risco/detecção:** políticas do PolicyAgent mudam sem aviso (um 403 súbito com token deve **falhar alto**, nunca silenciar); sanity-check 0-credencial: as faixas agregadas 10–14%/15–19% raspáveis da página pública de ajuda — se um percentual coletado sair da faixa, alerta.

**2. Custo fixo por faixa de preço + logística**
- **Método (regra):** diff textual mensal da doc oficial de developers (**estática**, curl com UA de browser → 200, MEDIDO; 0 credencial) — detecta mudança de REGRA.
- **Método (valores):** `listing_prices` autenticado amostrando `price` em cada faixa × `logistic_type` (`self_service`, `drop_off`, `fulfillment`...), lendo `sale_fee_details.fixed_fee`. Sem token: 403 em todas as variantes (MEDIDO). As páginas oficiais com valores são JS/login.
- **Credencial:** mesma da (1); a suficiência da permissão da casa **contra este endpoint específico não foi testada** — teste único pendente.
- **Cadência:** estrutural rara (a última durou anos; reforma anunciada 20/01, ativa 02/03/2026); valores ~anuais → **mensal**.
- **Risco/detecção:** ⚠️ **o novo modelo não cabe em `priceBands` puro** — para ME2 não-Flex o "custo fixo" virou custo operacional dependente **também de peso** (faixas novas 18,99/48,99/78,99). Observação de síntese (dos dados deste workflow): os valores da tabela de custo operacional reproduzida pela Ferax **coincidem célula a célula** com as colunas 1–3 da tabela de frete verde medida oficialmente (ex.: 5,65/6,55/7,75 até 0,3 kg) — ou seja, as tabelas de frete do item 4 já carregam esses números por via oficial.
- **Regra dos 50% (<R$ 12,50):** monitor textual 0-credencial da página de vendedores (contém a regra verbatim hoje); **não promover a fato numérico** até a prova via API (`price=8` → `fixed_fee==4,00`).

**3. Piso de comissão (existe?)**
- **Método:** nenhum publicado. Resolução só por **sondagem empírica autenticada** (amostrar `percentage_fee` em preços/categorias variados). Até lá: campo **não-determinado** no catálogo — nunca gravar ausência.

**4. Frete Mercado Envios + cubagem (`freight`)**
- **Método:** **fetch estático com User-Agent de browser** nas 3 páginas por reputação (ajuda/40538, /40545, /40547) + limites físicos (/3163) + cubagem (/4413). O conteúdo vem embutido no HTML como JSON `\uXXXX`; decodificar + parsear a `<table>`. Parser determinístico, 0 tokens — **validado hoje** (696 células, re-verificadas com 0 divergências).
- **Credencial:** nenhuma (o 403 histórico era só falta de UA).
- **Cadência:** reforma ~1×/ano, reajustes 1–2×/ano → **mensal**.
- **Risco/detecção:** o embed é detalhe interno do help center e pode mudar de formato sem aviso → guarda de sanidade **29 linhas × 8 colunas** obrigatória; headers de coluna como sentinela do limiar (alerta se o corte deixar de ser 78,99/79). **Cubagem:** fixar `6000` no código + regex sentinela ("dividindo o resultado por N") no texto oficial — alerta se mudar. **Reputação:** determinant `reputacao ∈ {verde_ou_lider_ou_sem, amarela, laranja_vermelha}` — coletar as 3 páginas, desconto já embutido nos valores.

### Amazon BR

**5. Tabela de comissões por categoria (38 linhas, progressivas, mínimos)**
- **Método:** **navegador headless** (Playwright) em `sellercentral.amazon.com.br/.../G200336920?locale=pt-BR` — renderiza para visitante **anônimo** (MEDIDO em runner-equivalente; curl devolve casca vazia). Extração determinística da única `<table>` + diff do fee-ingest — é o que o pipeline 014 já faz.
- **Credencial:** nenhuma.
- **Cadência:** rara (0 mudanças entre 28/07 e 05/08; historicamente anos) → **mensal**.
- **Risco/detecção:** bloqueio de bot futuro (hoje ausente neste egress) e mudança de layout → assertar 1 tabela / 39 `<tr>` / 38 categorias; **asserção nova recomendada:** a string "BRL 2,00", quando aparecer, deve estar **fora** da tabela de comissões (hoje só existe na tarifa do plano Individual) — detecta a introdução de um segundo piso de verdade.

**6. Planos (Individual R$ 2,00/item · Profissional R$ 19/mês) + mínimos da /precos**
- **Método:** **fetch estático** de `venda.amazon.com.br/precos` (conteúdo íntegro sem headless, MEDIDO).
- **Credencial:** nenhuma.
- **Cadência:** valores estáveis desde ≥dez/2020 (~5,5 anos, MEDIDO em dupla data) → mensal como diff-alerta.
- **Risco/detecção:** a /precos usa taxonomia antiga e se auto-data (jan/2025) — **não é fonte primária de mínimos**, mas o parser deve **capturar a comissão mínima por categoria dela** para monitorar o conflito R$ 1,00 × R$ 2,00 (§Divergências) e alertar quando as duas fontes oficiais convergirem.

**7. Isenção promocional ("comissão zero")**
- **Método:** fetch estático + diff textual de `/termos/vender-com-amazon` e do banner em `/vender-com-amazon`.
- **Credencial:** nenhuma. **Cadência:** campanha anual/sazonal com vigência explícita (fev–dez/2026) → mensal.
- **Uso:** **alerta de mudança apenas** — benefício temporário, condicional (SP + CNPJ + novato em logística Amazon); **nunca** alimenta `commissionPct` do catálogo.

### Shopee BR

**8. Faixas de comissão (CNPJ/CPF)**
- **Método:** **headless** no art. 26839 (SPA pública sem login; fetch simples → casca vazia e endpoint interno → 403, MEDIDOS) para o TEXTO (regras, vigências, sub-regras) + download dos **PNGs públicos** das tabelas. **Detecção determinística e 0 tokens:** a URL da imagem é content-addressed — URL nova = tabela nova. **Extração dos números:** OCR (tesseract) ou curadoria humana disparada pelo alerta — parsing determinístico puro do HTML **não alcança** os valores.
- **Credencial:** nenhuma. **Cadência:** mudança grande 1×/2026 (vigência 01/03) → mensal.
- **Risco/detecção:** ⚠️ duas sub-regras vivem **fora** da tabela-imagem e o extrator precisa capturá-las do texto: <R$ 8 (CNPJ) = 50% do preço sem fixo (a faixa "20%+R$4" começa efetivamente em R$ 8) e a regressiva CPF <R$ 12 (item 9).

**9. Adicional CPF para item barato (<R$ 12)**
- **Método:** diff textual do art. 26839 (os 2 pontos oficiais estão no texto renderizado). A tabela/fórmula completa **não existe publicamente** — qualquer modelagem além dos 2 pontos é decisão de produto (§Decisões).
- **Cadência:** anual/ocasional → mensal como watcher.

**10. Frete aferido ≠ cadastrado + taxa de volumoso**
- **Método:** diff textual dos arts. 4478 (regra do ajuste) e 3305 (R$ 50,00 volumoso, **OFICIAL**, vigência 02/02/2026). O ajuste em si **não é modelável como tarifa** — é recálculo caso a caso pela tabela da transportadora → no schema, no máximo `freight=ESTIMATE` + aviso ao usuário.
- **Credencial:** nenhuma. **Risco:** limites exatos por modalidade vivem em imagem → mesmo padrão alert-then-curate.

---

## O que NÃO é automatizável (curadoria manual honesta)

1. **ML — comissão por categoria e custo fixo SEM o token da casa.** Não existe caminho público (login 302 no servidor + API 403 anônima, ambos MEDIDOS e reproduzidos). Enquanto o token não estiver no CI, esses números são curadoria manual. Revisão: a cada anúncio de reajuste do ML (~jan–mar) e no mínimo trimestral.
2. **ML — teste único do token da casa contra `listing_prices` e `users/{id}/shipping_options/free`.** A permissão "Publicação e sincronização: Leitura" é candidata **plausível, não testada** contra esses endpoints (o 403 é do PolicyAgent, mesma classe do resolvido em 2026-07-28). Ação humana pontual, uma vez.
3. **ML — piso de comissão.** Não documentado; só sondagem empírica autenticada resolve. Até lá: "não determinado" no catálogo. Revisão: junto com o item 1.
4. **ML — regra dos 50% (<R$ 12,50) como número.** A página que a publica não tem data e descreve o modelo pré-reforma; blogs recentes não a repetem. Confirmar via API antes de gravar. Revisão: no primeiro run autenticado.
5. **Amazon — conflito de comissão mínima (R$ 1,00 × R$ 2,00).** Duas páginas oficiais divergem e os dois verificadores deste workflow chegaram a leituras opostas. Resolução limpa exige conta de vendedor (extrato real) ou contato com a Amazon. Revisão: antes do próximo bump do catálogo Amazon.
6. **Amazon — closing fee de mídia.** Página oficial atrás de login (shell vazio MEDIDO em 2 domínios); única afirmação é blog sem valor. Irrelevante para 3D hoje; revisitar **somente se** o catálogo cobrir mídia.
7. **Shopee — números das faixas de comissão.** Vivem em PNG; OCR não é parsing determinístico. Padrão **alert-then-curate**: o loop detecta (URL nova da imagem / diff do texto) e um humano transcreve e confirma. Revisão: a cada alerta + conferência anual (as vigências têm sido 01/03).
8. **Shopee — fórmula regressiva CPF <R$ 12.** Só 2 pontos publicados; validar a forma completa exige mais pontos (ex.: extrato real de venda de conta CPF). Curadoria/decisão de produto.
9. **Shopee — limites de peso/dimensão por modalidade logística.** Tabelas em imagem (só o limite Correios ≤200 cm está em texto). Curadoria no alerta do art. 3305.

---

## Divergências contra o nosso catálogo atual

Cada item abaixo é um **potencial defeito de preço em produção**. Só a Amazon foi diffada mecanicamente contra `backend/app/data/catalog.json` (catalogVersion 2026-07-28.1) neste workflow; ML e Shopee entram como lacunas de schema/verificação pendente.

1. **Amazon `minPerItem` — conflito oficial × oficial, verificadores em desacordo.** Servimos **R$ 1,00 uniforme** nas 78 entradas. Isso **concorda** com a página vigente do Seller Central (G200336920: 1,00 nas 38 linhas, MEDIDO em duas datas). Mas a página oficial **/precos** imprime "Comissão mínima R$ 2,00" em ~11 categorias — **incluindo as típicas de peças 3D** (Brinquedos, Casa, PC, Esportes/lazer, Autopeças, Jardim, Bebês, Pet). O verificador da frente "tabela" data a /precos em ≤jan/2025 e a descarta; o verificador da frente "planos" **refutou** o mínimo único e manda modelar por categoria. **Se a /precos estiver certa, subestimamos a tarifa em até R$ 1,00/item exatamente nos itens baratos onde o piso morde.** Não resolvido → decisão do dono (item 1 abaixo).
2. **Amazon plano Individual — tarifa R$ 2,00/item não modelada.** As entradas INDIVIDUAL do catálogo têm `fixedFee=0` (verificado no diff). A tarifa oficial de R$ 2,00 por item vendido do plano Individual não está em `minPerItem` (correto — não é piso) **nem em `fixedFee`** (lacuna). Usuário no plano Individual tem custo real subestimado em R$ 2,00 por venda.
3. **Contagem de categorias Amazon: a "37" histórica estava errada; o catálogo está certo.** A tabela vigente tem **38** (incluindo Colchões) e o catálogo já tem os 38 com percentuais e progressivas idênticos — **diff vazio**. Ação: corrigir qualquer registro interno que ainda diga "37".
4. **ML custo fixo — o modelo servido pode não representar a reforma de 02/03/2026.** O modelo vigente depende de **logística** (Flex paga; ME2 não-Flex não paga — virou custo operacional por **peso×preço**, faixas novas 18,99/48,99/78,99) e **não cabe em `priceBands` puro**. Este workflow **não diffou** o que servimos hoje para o custo fixo ML contra isso — verificação pendente e prioritária: se o catálogo ainda modela custo fixo só por faixa de preço (modelo pré-03/2026), ele erra para todo usuário Full/Agências/Coleta.
5. **ML frete — a reputação seleciona a tabela inteira (3 tabelas oficiais medidas).** Se o catálogo serve frete sem o determinant de reputação, o valor pode divergir em até 2× (base laranja vs verde). Dados completos (3×29×8, verificados) disponíveis para ingestão; verificação contra o que servimos: pendente.
6. **Shopee — sub-regras fora da tabela principal.** A faixa <R$ 8 (CNPJ, 50% do preço sem fixo) e a regressiva CPF <R$ 12 não estão na tabela-imagem das faixas; se o catálogo reproduz só a tabela, superestima a taxa de itens muito baratos. Verificação contra o que servimos: pendente.
7. **Shopee — R$ 50,00/pedido de item volumoso agora é OFICIAL** (art. 3305, vigência 02/02/2026). Não é comissão, mas é custo real por pedido fora do padrão — hoje invisível ao usuário.

---

## Decisões que ficam para o dono

1. **Amazon `minPerItem`: 1,00 uniforme ou por categoria (2,00 em ~11)?**
   - *(i) Manter R$ 1,00* (fonte vigente do Seller Central, medida em dupla data): custo zero agora; risco de **subestimar** até R$ 1,00/item nas categorias onde peças 3D baratas vendem, se a /precos refletir a prática real.
   - *(ii) Adotar R$ 2,00 nas 11 categorias da /precos*: conservador (nunca subestima); risco de **superestimar** R$ 1,00/item se a /precos for mesmo vintage jan/2025 — e exige `minPerItem` por categoria no schema (mudança no domínio de pricing → escalação obrigatória por ADR-0022).
   - *(iii) Resolver empiricamente* (extrato de uma venda real barata em categoria disputada, via conta de vendedor): resposta definitiva; custo de ter/operar uma conta e uma venda de teste.
2. **Modelar a tarifa R$ 2,00/item do plano Individual como `fixedFee`?** Modelar = preço mais fiel para quem é Individual (e muda resultados exibidos hoje); não modelar = manter a subestimação conhecida e documentada. Se modelar: é mudança de dado no domínio de pricing.
3. **Habilitar o token ML da casa no loop mensal do CI?** É a **única via** para comissão por categoria e valores de custo fixo do ML. Custo: secret no GitHub + rotina de refresh (mitigada: refresh antigo sobrevive à rotação — MEDIDO) + o teste único de suficiência da permissão. Alternativa: seguir sem os números do ML (curadoria manual mensal, com risco de defasagem entre reajustes).
4. **Estender o schema para o custo fixo ML pós-reforma?** O modelo real é `logística × faixa de preço × peso`. Opções: *(i)* estender o schema (fiel; mudança estrutural no pricing-domain → opus, ADR-0022); *(ii)* aproximar usando as tabelas de frete já medidas (as colunas <R$ 79 são numericamente o custo operacional ME2) e reservar custo fixo só para Flex/ME1; *(iii)* manter como está com aviso de imprecisão. Cada opção tem custo de exatidão vs custo de schema.
5. **Shopee: OCR no loop ou alert-then-curate?** OCR (tesseract) automatiza a extração dos PNGs mas não é determinístico e pode errar silenciosamente números de tarifa; alert-then-curate mantém 0 tokens/determinismo na detecção e põe um humano só quando a URL da imagem muda (raro — ~1×/ano). Recomendação implícita dos dados: alert-then-curate; a escolha é do dono porque define quem faz a curadoria.
6. **Shopee CPF <R$ 12: como modelar?** *(i)* Só os 2 pontos oficiais (exato onde documentado, lacuna no resto); *(ii)* a hipótese linear R$ 4 + 0,25×preço (cobre a faixa toda, mas é **hipótese não publicada** — se errada, erra o preço de itens baratos); *(iii)* não modelar e exibir aviso "taxa regressiva não publicada pela Shopee" abaixo de R$ 12. Honestidade vs cobertura.
7. **Expor custos condicionais não-determinísticos (Shopee R$ 50 volumoso; ajuste de frete aferido)?** Não são tarifas de precificação, mas são custos reais. Opções: aviso informativo na UI (custo baixo, sem tocar o cálculo) vs campo opcional no cenário (mais fiel, mais schema) vs ignorar (usuário descobre na prática).
