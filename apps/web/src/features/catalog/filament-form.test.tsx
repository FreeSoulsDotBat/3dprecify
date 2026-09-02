// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { emptyFilamentForm, filamentToForm } from "./catalog-schema";
import { FilamentForm } from "./filament-form";

afterEach(() => cleanup());

const cf = messages.catalogForm;
const fields = messages.calculator.fields;
const validation = messages.calculator.validation;
const catalog = messages.catalog;

// Inputs are queried by their ACCESSIBLE NAME (getByRole), like the calculator tests — the required
// "*" is aria-hidden so the name is the bare label, and the value inputs are role="textbox".
const field = (name: string) => screen.getByRole("textbox", { name });

function renderForm(over: Partial<Parameters<typeof FilamentForm>[0]> = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
        <FilamentForm
            mode="create"
            defaultValues={emptyFilamentForm}
            gate="active"
            onSubmit={onSubmit}
            onCancel={onCancel}
            {...over}
        />,
    );
    return { onSubmit, onCancel };
}

describe("FilamentForm — E1 validation reused verbatim + money-as-string wire", () => {
    it("renders the filament fields (name + material + E1 numeric inputs)", () => {
        renderForm();
        expect(field(cf.name)).toBeInTheDocument();
        expect(field(cf.material)).toBeInTheDocument();
        expect(field(fields.costPerRoll)).toBeInTheDocument();
        expect(field(fields.rollWeight)).toBeInTheDocument();
    });

    it("blocks an invalid submit and shows the E1 pt-BR messages (name required, rollWeight > 0)", async () => {
        const { onSubmit } = renderForm();
        // Name left blank (required); roll weight = 0 (the E1 denominator rule → rollWeightError).
        fireEvent.change(field(fields.costPerRoll), { target: { value: "110,00" } });
        fireEvent.change(field(fields.rollWeight), { target: { value: "0" } });

        fireEvent.click(screen.getByRole("button", { name: cf.save }));

        await waitFor(() =>
            expect(screen.getByText(messages.calculator.rollWeightError)).toBeInTheDocument(),
        );
        expect(screen.getAllByText(validation.required).length).toBeGreaterThan(0);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("emits money/weight as decimal STRINGS on the wire for a valid submit (FR contract)", async () => {
        const { onSubmit } = renderForm();
        fireEvent.change(field(cf.name), { target: { value: "PLA Azul" } });
        fireEvent.change(field(cf.material), { target: { value: "PLA" } });
        fireEvent.change(field(fields.costPerRoll), { target: { value: "110,50" } });
        fireEvent.change(field(fields.rollWeight), { target: { value: "1" } });

        fireEvent.click(screen.getByRole("button", { name: cf.save }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            name: "PLA Azul",
            material: "PLA",
            costPerRoll: "110.5",
            rollWeightKg: "1",
        });
    });

    it("pre-fills from a saved filament in edit mode and swaps the CTA label", () => {
        const saved = {
            id: "f1",
            name: "PETG Preto",
            material: "PETG",
            costPerRoll: "135.00",
            rollWeightKg: "1",
            createdAt: "2026-07-09T00:00:00Z",
            updatedAt: "2026-07-09T00:00:00Z",
        };
        renderForm({ mode: "edit", defaultValues: filamentToForm(saved) });
        expect(field(cf.name)).toHaveValue("PETG Preto");
        expect(screen.getByRole("button", { name: cf.saveChanges })).toBeInTheDocument();
    });
});

describe("FilamentForm — os cinco estados do gate (019/PR-B T045, ex-013/FB-02)", () => {
    it("lapsed: campos inertes (Frozen), Salvar visível e disabled, convite 'Reativar Premium' fora do Frozen", () => {
        renderForm({ gate: "lapsed" });
        const frozen = screen.getByTestId("catalog-form-frozen");
        expect(within(frozen).getByRole("textbox", { name: cf.name })).toBeDisabled();
        expect(within(frozen).getByRole("textbox", { name: cf.material })).toBeDisabled();
        expect(within(frozen).getByRole("textbox", { name: fields.costPerRoll })).toBeDisabled();
        expect(within(frozen).getByRole("textbox", { name: fields.rollWeight })).toBeDisabled();
        expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(catalog.reactivateBody);

        const saveBtn = screen.getByRole("button", { name: cf.save });
        expect(saveBtn).toBeVisible();
        expect(saveBtn).toBeDisabled();

        const cta = screen.getByTestId("teaser-upgrade-cta");
        expect(cta).toHaveTextContent(messages.billing.reactivateAction);
        expect(cta.closest("fieldset[disabled]")).toBeNull();
        // "Voltar" saiu do rodapé inerte — o convite ocupa o lugar dele (decisão T045, ver relatório).
        expect(screen.queryByRole("button", { name: cf.cancel })).not.toBeInTheDocument();
    });

    it("never-subscribed: mesma inércia, mas o convite é 'Assinar Premium' sem preço", () => {
        renderForm({ gate: "never-subscribed" });
        expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(
            messages.premiumTeaser.saveIsPartOfPremium,
        );
        const cta = screen.getByTestId("teaser-upgrade-cta");
        expect(cta).toHaveTextContent(messages.billing.subscribeAction);
        expect(screen.queryByText(messages.billing.planMonthlyPrice)).not.toBeInTheDocument(); // price={false}
    });

    it("unknown: nem frase nem convite — nunca presume (T045)", () => {
        renderForm({ gate: "unknown" });
        expect(screen.queryByTestId("premium-footer-note")).not.toBeInTheDocument();
        expect(screen.queryByTestId("teaser-upgrade-cta")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: cf.save })).toBeDisabled();
    });

    it("active (o default) stays fully editable — regression guard", () => {
        renderForm();
        expect(field(cf.name)).not.toBeDisabled();
        const saveBtn = screen.getByRole("button", { name: cf.save });
        expect(saveBtn).toBeInTheDocument();
        expect(saveBtn).not.toBeDisabled();
        expect(screen.queryByTestId("catalog-form-frozen")).not.toBeInTheDocument();
        expect(screen.queryByTestId("premium-footer-note")).not.toBeInTheDocument();
    });
});
