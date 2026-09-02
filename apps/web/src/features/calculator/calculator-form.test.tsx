// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFieldArray, useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { feeFieldsToBlankOnMarketplaceChange } from "@/features/calculator/channel-field-plan";
import type { FeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { usePlausibilityDismissStore } from "@/shared/lib/plausibility-dismiss-store";

import { ControlledField, FieldGroup, MarketplaceSection } from "./calculator-form";
import {
    calculatorResolver,
    type CalcFieldMeta,
    type CalcFormValues,
    type ChannelSlotForm,
    COST_FIELDS,
    defaultCalcValues,
    defaultChannelSlot,
    LABOR_AND_FINISH_FIELDS,
    type ChannelFieldName,
    type MarketplaceId,
    slotResetOnMarketplaceChange,
} from "./calculator-schema";

afterEach(() => {
    cleanup();
    // 019/PR-C (T049) — a dispensa é um store SINGLETON de sessão (deliberadamente sem `persist`,
    // ver `plausibility-dismiss-store.ts`), então sobrevive entre testes do MESMO arquivo se
    // ninguém o limpar — um "Entendi" de um teste vazava para o próximo e escondia o aviso ali.
    usePlausibilityDismissStore.setState({ dismissed: new Set() });
});

const t = messages.calculator;

// 016/US11 (T044 homologação PR-E, bloqueador RA5) — the hidden-field-still-charges defect, at the
// component boundary this time (channel-field-plan.test.ts already pins the pure helper). Fixture:
// ML publishes `freightCost` in its `feeAxes`, Amazon does not (mirrors the real seed's curation).
const catalog: FeeCatalog = {
    catalogVersion: "test",
    schemaVersion: "1",
    generatedAt: "2026-08-06T00:00:00.000Z",
    marketplaces: [
        {
            marketplace: "MERCADO_LIVRE",
            determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"] },
            categorySpine: null,
            feeAxes: ["commissionPct", "fixedFee", "freightCost"],
            entries: [],
        },
        {
            marketplace: "AMAZON",
            determinantsSchema: { plan: ["INDIVIDUAL", "PROFISSIONAL"] },
            categorySpine: null,
            feeAxes: ["commissionPct", "fixedFee", "minPerItem"],
            entries: [],
        },
        { marketplace: "SHOPEE", determinantsSchema: null, categorySpine: null, entries: [] },
    ],
};

function Harness({ initialChannels }: { initialChannels: ChannelSlotForm[] }) {
    const { control, watch, setValue } = useForm<CalcFormValues>({
        defaultValues: { ...defaultCalcValues, channels: initialChannels },
    });
    const { fields, append, remove } = useFieldArray({ control, name: "channels" });
    const values = watch();

    const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
        const next = slotResetOnMarketplaceChange(marketplace);
        setValue(`channels.${index}.modality`, next.modality);
        setValue(`channels.${index}.category`, next.category);
        // The SAME fix the real pages apply (calcular-page.tsx/produto-page.tsx/bom-line-editor.tsx).
        for (const [field, value] of Object.entries(
            feeFieldsToBlankOnMarketplaceChange(catalog, marketplace),
        )) {
            setValue(`channels.${index}.${field as ChannelFieldName}` as const, value);
        }
    };

    return (
        <MarketplaceSection
            control={control}
            values={values}
            fields={fields}
            channelOutcomes={[]}
            included
            onToggleInclude={() => {}}
            onAppend={(slot) => append(slot)}
            onRemove={remove}
            onMarketplaceChange={handleMarketplaceChange}
            refreshFailed={false}
            refreshing={false}
            onRetryCatalog={() => {}}
            spineFor={() => []}
            catalog={catalog}
            entitled
            signedOut={false}
        />
    );
}

describe("bloqueador PR-E — a hidden fee field must never keep charging (RA5)", () => {
    it("switching marketplace BLANKS a fee field the new plan does not show — no field, no value", async () => {
        render(
            <Harness
                initialChannels={[
                    {
                        ...defaultChannelSlot("MERCADO_LIVRE"),
                        modality: "CLASSICO",
                        freightCost: "50",
                    },
                ]}
            />,
        );
        const slot0 = screen.getByTestId("channel-slot");

        // Frete visible + carries the typed 50 on ML (freightCost IS in ML's feeAxes).
        expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toHaveValue("50");

        // Switch to Amazon (freightCost NOT in its feeAxes) — the field must disappear...
        const { fireEvent } = await import("@testing-library/react");
        fireEvent.change(screen.getByLabelText(t.channels.marketplace), {
            target: { value: "AMAZON" },
        });
        expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toBeNull();

        // ...and switching BACK to ML must show it EMPTY, never the stale 50 (the value was blanked,
        // not merely hidden — a hidden-but-alive R$50 is exactly the defect this closes).
        fireEvent.change(screen.getByLabelText(t.channels.marketplace), {
            target: { value: "MERCADO_LIVRE" },
        });
        expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toHaveValue("");
    });

    it("a field the new plan hides is NOT charged: switching marketplace clears the RHF value itself", () => {
        // Regression-shaped assertion for the exact homologação repro: ML+Frete=50 → Amazon must not
        // merely hide the input, the underlying form value backing the price computation is gone too
        // (computeFromForm reads `values.channels[i].freightCost` — an empty string parses to 0).
        const slot: ChannelSlotForm = {
            ...defaultChannelSlot("MERCADO_LIVRE"),
            modality: "CLASSICO",
            freightCost: "50",
        };
        const blanked = feeFieldsToBlankOnMarketplaceChange(catalog, "AMAZON");
        expect(blanked.freightCost).toBe("");
        // Sanity: applying the blank patch onto the ML slot removes exactly the leaking field.
        expect({ ...slot, ...blanked }).toMatchObject({ freightCost: "" });
    });

    it("a field OUTSIDE the plan but carrying a value (a reopened scenario) RENDERS — never invisible money", () => {
        // Simulates a scenario saved BEFORE the plan narrowed (or one built against a different
        // catalog): the channel array is set directly (as a scenario reopen does via `replaceChannels`,
        // never through `onMarketplaceChange`), so nothing would have blanked it.
        render(
            <Harness
                initialChannels={[
                    {
                        ...defaultChannelSlot("AMAZON"),
                        modality: "PROFISSIONAL",
                        freightCost: "50",
                    },
                ]}
            />,
        );
        const slot0 = screen.getByTestId("channel-slot");
        // Amazon's plan does NOT include freightCost — yet the field is visible because it carries a
        // value (the "OR has value" render clause), editable/erasable, never a silent number.
        expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toHaveValue("50");
    });
});

// 019/PR-C (T049, US4/FR-1909-1910, prancheta "Calculadora - Aviso de Plausibilidade") — o aviso
// de plausibilidade nasce no BLUR, nunca no `change` (o defeito de hoje). Um harness mínimo em
// torno de `FieldGroup`/`ControlledField` — um único `CalcFieldMeta` por vez, para isolar o campo
// sob teste do resto do formulário.
function rollWeightHarness() {
    const meta = COST_FIELDS.find((f) => f.name === "rollWeightKg") as CalcFieldMeta;
    function Harness() {
        const { control } = useForm<CalcFormValues>({
            defaultValues: defaultCalcValues,
            resolver: calculatorResolver,
            mode: "onChange",
        });
        return (
            <FieldGroup
                control={control}
                title="Custos"
                info={{ label: "info", body: "corpo" }}
                fields={[meta]}
            />
        );
    }
    return Harness;
}

/** A harness that also exposes RHF's `setError`, para o cenário "erro E aviso juntos" (14b) — o
 *  par não nasce naturalmente do `rollWeightKg` (positivo é a única validação, e nenhum valor
 *  negativo cruza o limiar de 50 kg), então o erro é forçado exatamente como o comentário do
 *  T049 permite ("monte o erro via setError do RHF sobre um valor com aviso"). */
function RollWeightWithForcedError() {
    const meta = COST_FIELDS.find((f) => f.name === "rollWeightKg") as CalcFieldMeta;
    const { control, setError } = useForm<CalcFormValues>({
        defaultValues: defaultCalcValues,
        resolver: calculatorResolver,
        mode: "onChange",
    });
    return (
        <>
            <ControlledField control={control} meta={meta} />
            <button
                type="button"
                onClick={() =>
                    setError("rollWeightKg", { type: "manual", message: "erro forçado" })
                }
            >
                forçar erro
            </button>
        </>
    );
}

describe("T049 — o aviso de plausibilidade nasce no BLUR, não no change (019/PR-C)", () => {
    it("digitar até um valor acima do limiar SEM sair do campo não mostra aviso nenhum", async () => {
        const Harness = rollWeightHarness();
        const user = userEvent.setup();
        const { container } = render(<Harness />);
        const input = container.querySelector('input[name="rollWeightKg"]') as HTMLInputElement;
        await user.clear(input);
        await user.type(input, "60");
        expect(screen.queryByTestId("aviso-rollWeightKg")).not.toBeInTheDocument();
    });

    it("blur mostra o <Aviso role=status> com 'Entendi'; 'Entendi' o dispensa", async () => {
        const Harness = rollWeightHarness();
        const user = userEvent.setup();
        const { container } = render(<Harness />);
        const input = container.querySelector('input[name="rollWeightKg"]') as HTMLInputElement;
        await user.clear(input);
        await user.type(input, "60");
        await user.tab();

        const notice = await screen.findByTestId("aviso-rollWeightKg");
        expect(notice).toHaveAttribute("role", "status");
        const entendi = within(notice).getByRole("button", { name: t.plausibility.understood });

        await user.click(entendi);
        expect(screen.queryByTestId("aviso-rollWeightKg")).not.toBeInTheDocument();
    });

    it("outro valor acima do limiar + blur volta a mostrar o aviso, mesmo após dispensado", async () => {
        const Harness = rollWeightHarness();
        const user = userEvent.setup();
        const { container } = render(<Harness />);
        const input = container.querySelector('input[name="rollWeightKg"]') as HTMLInputElement;

        await user.clear(input);
        await user.type(input, "60");
        await user.tab();
        await user.click(
            within(screen.getByTestId("aviso-rollWeightKg")).getByRole("button", {
                name: t.plausibility.understood,
            }),
        );
        expect(screen.queryByTestId("aviso-rollWeightKg")).not.toBeInTheDocument();

        await user.clear(input);
        await user.type(input, "70");
        await user.tab();
        expect(await screen.findByTestId("aviso-rollWeightKg")).toBeInTheDocument();
    });

    it("com uma recusa junto (fieldState.error), o aviso vira a LIÇÃO — sem 'Confira', sem 'Entendi' (decisão do dono 28/08, prancheta 14b)", async () => {
        const user = userEvent.setup();
        render(<RollWeightWithForcedError />);
        const input = screen.getByRole("textbox") as HTMLInputElement;
        await user.clear(input);
        await user.type(input, "60");
        await user.tab();

        const noticeOk = await screen.findByTestId("aviso-rollWeightKg");
        expect(noticeOk).toHaveTextContent(t.plausibility.closingNormal);

        await user.click(screen.getByRole("button", { name: "forçar erro" }));

        const noticeWithError = screen.getByTestId("aviso-rollWeightKg");
        expect(noticeWithError).toBeInTheDocument();
        expect(noticeWithError).toHaveTextContent(t.plausibility.lesson.rollWeightKg);
        expect(noticeWithError).not.toHaveTextContent("Confira o peso do rolo");
        expect(noticeWithError).not.toHaveTextContent(t.plausibility.closingNormal);
        expect(
            within(noticeWithError).queryByRole("button", { name: t.plausibility.understood }),
        ).not.toBeInTheDocument();
    });

    it("dinheiro no texto do aviso usa SEMPRE 2 casas — 'R$ 6.000.061,60', nunca 'R$ 6.000.061,6'", async () => {
        const meta = LABOR_AND_FINISH_FIELDS.find(
            (f) => f.name === "laborRatePerHour",
        ) as CalcFieldMeta;
        function Harness() {
            const { control } = useForm<CalcFormValues>({
                defaultValues: defaultCalcValues,
                resolver: calculatorResolver,
                mode: "onChange",
            });
            return (
                <FieldGroup
                    control={control}
                    title="Mão de obra"
                    info={{ label: "info", body: "corpo" }}
                    fields={[meta]}
                />
            );
        }
        const user = userEvent.setup();
        const { container } = render(<Harness />);
        const input = container.querySelector('input[name="laborRatePerHour"]') as HTMLInputElement;
        await user.clear(input);
        await user.type(input, "6000061,60");
        await user.tab();
        expect(await screen.findByTestId("aviso-laborRatePerHour")).toHaveTextContent(
            "R$ 6.000.061,60",
        );
    });
});
