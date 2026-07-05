# Phase 1 — Data model: E1 pricing

Two **ephemeral, client-only** entities (nothing is persisted in E1 — persistence is E2). Both live in
`packages/pricing-core`; the FE adapter builds the input and renders the result.

## Entity: `PriceInput`

The field set from spec §2.1. Numbers are already parsed (the FE adapter converts pt-BR strings → numbers and
validates before constructing this). Two field kinds:
- **required / pre-filled** — an editable UX starting value that affects the price.
- **optional / default 0** — contributes nothing until touched.

| Field | Type | Kind / default | Validation (FR-038) |
|---|---|---|---|
| `costPerRoll` | number (R$) | required | finite, ≥ 0 |
| `rollWeightKg` | number (kg) | required | finite, **> 0** |
| `printGrams` | number (g) | required | finite, ≥ 0 |
| `wasteGrams` | number (g) | optional, 0 | finite, ≥ 0 |
| `printTimeHours` | number (h) | required | finite, ≥ 0 |
| `avgPowerKw` | number (kW) | required, **pre-fill 0.12** | finite, ≥ 0 |
| `tariffPerKwh` | number (R$/kWh) | required | finite, ≥ 0 |
| `machineValue` | number (R$) | required | finite, ≥ 0 |
| `machineLifetimeHours` | number (h) | required | finite, **> 0** |
| `maintenanceReservePerHour` | number (R$/h) | optional, 0 | finite, ≥ 0 |
| `failurePct` | number (%) | optional, 0 | finite, ≥ 0 |
| `finishTimeHours` | number (h) | optional, 0 | finite, ≥ 0 |
| `finishRatePerHour` | number (R$/h) | optional, 0 | finite, ≥ 0 |
| `laborHours` | number (h) | optional, 0 | finite, ≥ 0 |
| `laborRatePerHour` | number (R$/h) | optional, 0 | finite, ≥ 0 |
| `adminTotal` | number (R$) | optional, 0 | finite, ≥ 0 |
| `markupVarejoPct` | number (%) | required, **pre-fill 50** | finite, ≥ 0 |
| `markupAtacadoPct` | number (%) | required, **pre-fill 30** | finite, ≥ 0 |
| `marketplaceCommissionPct` | number (%) | optional, 0 | finite, **in [0, 100)** |
| `marketplaceFixedFee` | number (R$) | optional, 0 | finite, ≥ 0 |

**No** `imposto`/tax field (FR-021, A24). Invalid inputs never compute — they raise a typed `ValidationError`
that the FE maps to a per-field pt-BR message; the calculator never renders `NaN`/`Infinity`/`#DIV/0!`.

## Entity: `PriceResult`

Everything the breakdown and price surfaces render. Every money field is 2-decimal HALF_UP (ADR-0008).

| Field | Type | Meaning |
|---|---|---|
| `material` | number (R$) | `(costPerRoll / (rollWeightKg×1000)) × (printGrams + wasteGrams)` |
| `energy` | number (R$) | `printTimeHours × avgPowerKw × tariffPerKwh` |
| `machine` | number (R$) | `(machineValue/machineLifetimeHours + maintenanceReservePerHour) × printTimeHours` |
| `falha` | number (R$) | `(material + energy + machine) × failurePct/100` — failure base = production inputs only |
| `finishing` | number (R$) | `finishTimeHours × finishRatePerHour` |
| `labor` | number (R$) | `laborHours × laborRatePerHour` |
| `admin` | number (R$) | `adminTotal` |
| `custoTotal` | number (R$) | sum of the seven lines above (of the rounded lines) |
| `precoVarejo` | number (R$) | `custoTotal × (1 + markupVarejoPct/100)` |
| `precoAtacado` | number (R$) | `custoTotal × (1 + markupAtacadoPct/100)` |
| `marketplace` | `MarketplaceResult \| null` | present only when commission % > 0 or fixed fee > 0 |
| `modelVersion` | string | `PRICING_MODEL_VERSION` = `"2.0.0"` |

### `MarketplaceResult` (nested, per base price)

For each of `varejo` and `atacado`:

| Field | Type | Meaning |
|---|---|---|
| `precoAnuncioVarejo` / `precoAnuncioAtacado` | number (R$) | `(base + fixedFee) / (1 − commissionPct/100)` (price to list) |
| `recebidoLiquidoVarejo` / `recebidoLiquidoAtacado` | number (R$) | `anuncio × (1 − commissionPct/100) − fixedFee` (= base by construction) |

## Invariants (enforced by tests)

1. **Breakdown closes**: `material + energy + machine + falha + finishing + labor + admin == custoTotal`
   (0 residual under HALF_UP 2dp) — SC-002.
2. **Optional isolation**: any optional field at 0 leaves `custoTotal` and both prices identical to the
   without-that-field computation — SC-004.
3. **Failure base**: `falha` uses `material + energy + machine`, never `material` alone — SC-006.
4. **Gross-up round-trips**: `recebidoLiquido` nets back to its base within R$ 0,01 — SC-003.
5. **Determinism**: identical `PriceInput` → identical `PriceResult`, locale-independent — SC-012/SC-011.
6. **No bad numbers**: invalid input → `ValidationError`, never a non-finite field — SC-008.
