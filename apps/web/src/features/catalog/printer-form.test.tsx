// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { emptyPrinterForm, printerToForm } from "./catalog-schema";
import { PrinterForm } from "./printer-form";

afterEach(() => cleanup());

const cf = messages.catalogForm;
const fields = messages.calculator.fields;
const validation = messages.calculator.validation;
const catalogo = messages.catalog;

const field = (name: string) => screen.getByRole("textbox", { name });

function renderForm(over: Partial<Parameters<typeof PrinterForm>[0]> = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
        <PrinterForm
            mode="create"
            defaultValues={emptyPrinterForm}
            gate="active"
            onSubmit={onSubmit}
            onCancel={onCancel}
            {...over}
        />,
    );
    return { onSubmit, onCancel };
}

describe("PrinterForm — E1 denominator rule + money-as-string wire", () => {
    it("renders the printer fields (name + machine value + lifetime + avg power)", () => {
        renderForm();
        expect(field(cf.name)).toBeInTheDocument();
        expect(field(fields.machineValue)).toBeInTheDocument();
        expect(field(fields.machineLifetime)).toBeInTheDocument();
        expect(field(fields.avgPower)).toBeInTheDocument();
    });

    it("blocks an invalid submit (name required, machine lifetime > 0 denominator rule)", async () => {
        const { onSubmit } = renderForm();
        fireEvent.change(field(fields.machineValue), { target: { value: "4000,00" } });
        fireEvent.change(field(fields.machineLifetime), { target: { value: "0" } });
        fireEvent.change(field(fields.avgPower), { target: { value: "0,12" } });

        fireEvent.click(screen.getByRole("button", { name: cf.save }));

        await waitFor(() =>
            expect(screen.getByText(validation.machineLifetimePositive)).toBeInTheDocument(),
        );
        expect(screen.getAllByText(validation.required).length).toBeGreaterThan(0);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("emits the printer values as decimal STRINGS on the wire for a valid submit", async () => {
        const { onSubmit } = renderForm();
        fireEvent.change(field(cf.name), { target: { value: "Ender 3" } });
        fireEvent.change(field(fields.machineValue), { target: { value: "4000,00" } });
        fireEvent.change(field(fields.machineLifetime), { target: { value: "2000" } });
        fireEvent.change(field(fields.avgPower), { target: { value: "0,12" } });

        fireEvent.click(screen.getByRole("button", { name: cf.save }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            name: "Ender 3",
            machineValue: "4000",
            machineLifetimeHours: "2000",
            avgPowerKw: "0.12",
            maintenanceReservePerHour: "0",
        });
    });

    it("pre-fills from a saved printer in edit mode and swaps the CTA label", () => {
        const saved = {
            id: "p1",
            name: "Bambu X1",
            machineValue: "6000.00",
            machineLifetimeHours: "3000",
            avgPowerKw: "0.15",
            maintenanceReservePerHour: "0",
            createdAt: "2026-07-09T00:00:00Z",
            updatedAt: "2026-07-09T00:00:00Z",
        };
        renderForm({ mode: "edit", defaultValues: printerToForm(saved) });
        expect(field(cf.name)).toHaveValue("Bambu X1");
        expect(screen.getByRole("button", { name: cf.saveChanges })).toBeInTheDocument();
    });
});

describe("PrinterForm — os cinco estados do gate (019/PR-B T045, ex-013/FB-02)", () => {
    it("lapsed: campos inertes (Frozen), Salvar visível e disabled, convite 'Reativar Premium' fora do Frozen", () => {
        renderForm({ gate: "lapsed" });
        const frozen = screen.getByTestId("catalog-form-frozen");
        expect(within(frozen).getByRole("textbox", { name: cf.name })).toBeDisabled();
        expect(within(frozen).getByRole("textbox", { name: fields.machineValue })).toBeDisabled();
        expect(
            within(frozen).getByRole("textbox", { name: fields.machineLifetime }),
        ).toBeDisabled();
        expect(within(frozen).getByRole("textbox", { name: fields.avgPower })).toBeDisabled();
        expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(
            catalogo.reactivateBody,
        );

        const saveBtn = screen.getByRole("button", { name: cf.save });
        expect(saveBtn).toBeVisible();
        expect(saveBtn).toBeDisabled();

        const cta = screen.getByTestId("teaser-upgrade-cta");
        expect(cta).toHaveTextContent(messages.billing.reactivateAction);
        expect(cta.closest("fieldset[disabled]")).toBeNull();
        expect(screen.queryByRole("button", { name: cf.cancel })).not.toBeInTheDocument();
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
