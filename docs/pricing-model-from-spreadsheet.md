# Legacy Pricing Model — reverse-engineered from Jonatan's spreadsheet

> Source: `Calculadora da Fórmula da Precificação 3D - Filamento.xlsx` (403 KB, 9 sheets).
> Reverse-engineered and numerically validated by 5 analysis agents (2026-06-26).
> Status: RESEARCH/REFERENCE — input for the pricing spec. Not the final model; see "Known defects".

> **PROVENANCE & IP CAUTION**: The spreadsheet is a THIRD-PARTY product — the "Calculadora da Fórmula da
> Precificação 3D" by **Diego Amado / Amado3D** (sheet `Inicio` credits the author and warns not to share the
> formula with competitors). We use it ONLY as domain research. Precifica3D must build an ORIGINAL, corrected
> model (we already diverge by fixing defects) and MUST NOT copy its specific expression: layout, labels,
> wording, or branding. Underlying math (R$/g, energy=h·kW·tariff, markup, marketplace %+fixed) is standard
> domain knowledge and broadly non-protectable; the specific spreadsheet expression is. Not legal advice —
> Jonatan should confirm the terms under which he obtained the tool. Pending owner decision before building.

## Architecture of the spreadsheet
- **`Listas`** = engine. One row per piece (`Tabela_produtos`, rows 6–15). Columns `AC:AI` compute 7 unit
  costs from per-piece inputs (`G` length m, `H` print time, `I` weight g, `J` kWh tariff, `K` finishing %)
  plus master tables.
- Master tables in `Listas`: `Tabela_impressoras` (AK:AS), `Tabela_filamentos` (AU:AZ),
  `Tabela_mktplace` (BB:BD), fiscal depreciation block (BF:BK), named cell `Depreciação`=`BK13`=2058.33.
- **Product tabs** (`Produto 1` + 5 clones) = sale template. Pull the 7 costs by `SUMIF(product name)`,
  sum, apply markup, simulate marketplace. A product = sum of its pieces (multi-piece BOM, implicit).

## Validated formula (numbers confirmed against the sheet)
```
# 7 unit costs (additive — NOT markups)
material    = custo_carretel / (peso_carretel_kg * 1000) * peso_g
energia     = tempo_h * potencia_kW * tarifa_kWh
manutencao  = (valor_maquina * pct_desgaste / horas_ano) * tempo_h     # horas_ano = h_dia*dias_mes*12
falhas      = material * pct_falhas
acabamento  = material * pct_acabamento                                 # "pós-processamento" = % acabamento
roi         = (valor_maquina / (retorno_meses * h_dia * dias_mes)) * tempo_h   # = machine payback per hour
depreciacao = uso_anual_hrs / depreciacao_fiscal_total                  # DEFECTIVE (see below)

custo_producao = material+energia+manutencao+falhas+acabamento+roi+depreciacao
custo_total    = custo_producao + custos_admin + (hrs_trab * custo_hora)

# Markup (over cost — matches Jonatan's stated preference)
preco_atacado = custo_total * markup_atacado     # default 1.3  (+30%)
preco_varejo  = custo_total * markup_varejo      # default 1.5  (+50%)

# Marketplace (applied after markup, in the simulator)
preco_final = preco_base * (1 + comissao_pct) + taxa_fixa_R$          # NOT a full gross-up
```
- `pct_desgaste` is categorical by printer "Nível de Uso": Basico 10% / Medio 20% / Profissional 30% / Intenso 45%.
- `Tabela_mktplace`: per channel = fixed fee (R$) + commission (%). Real values:
  Shopee ≤79.99 → R$4 + 20% · ML Clássico → R$6.75 + 14% · ML Premium → R$6.75 + 19% · Shopee >79.99 → R$18 + 14% · NENHUM → 0.
- `J4` dropdown = "Sugerido" vs "Final" (manual price override), NOT retail/wholesale. Retail/wholesale = columns J/K.
- Competitors tab = manual reference only; does not feed the price.

## Known defects (to decide: fix vs replicate)
1. **Depreciation is broken (~95%)**: `uso_anual_hrs / Depreciação` is constant (2.62) for every product and
   dimensionally `hours ÷ R$/month`. Mixes the whole company's assets (incl. an R$80k car) into each piece.
2. **Triple-counting machine capital (~80%)**: maintenance + ROI + depreciation each recover the machine cost
   in overlapping ways → inflates unit cost.
3. **Energy likely 5–10× high (~70%)**: uses nameplate 1.2 kW as continuous draw vs real FDM avg ~0.1–0.15 kW.
4. **Failure/finishing applied only to material (~85%)**: a failed print also wastes energy + machine-hours.
5. **Marketplace commission under-recovered (~85%)**: ML charges % on the FINAL price; `base*(1+pct)+fixa`
   recovers less. True pass-through ≈ `(base+fixa)/(1-pct)`.
6. Labor zeroed by default; markup(over cost) vs margin(over revenue) mixed in UI; 6 duplicated product tabs;
   unguarded divisions (`#DIV/0!`); length(m) collected but unused.

## Variable catalog (beyond the original project list)
Energy (kWh tariff, kW power, time→cost) · print time (driver of energy/maintenance/roi/labor) · machine
cadastre (value, h/day, days/month, payback months, usage level→wear%) · fiscal assets/depreciation · labor
(hours × R$/h) · admin costs (packaging, freight, domain/site, supplies, internet, extras) · marketplace fixed
fee + price bands · quantity-discount scenario (retail vs wholesale) · taxes % (present, zeroed) · competitors
(up to 3) · multi-piece BOM.

## Improvement backlog (to SURPASS the spreadsheet — PO to prioritize)
Real energy duty cycle · realistic machine utilization · filament waste (purge/brim/support/refugo) · failure
consumes energy+time · tax regime (MEI/DAS/Simples) · ML free-shipping subsidy >R$79 · goal-seek price (target
margin → price) · break-even/price floor per channel · competitor-positioning alerts · progressive quantity
curve · explicit post-processing time × rate.
