import { useForm } from "react-hook-form";

import type { PrinterIn } from "@/shared/api/generated";
import type { PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { CatalogFormShell } from "./catalog-form-shell";
import { ControlledNumber, ControlledText } from "./catalog-controls";
import { type PrinterFormValues, printerResolver, printerToWire } from "./catalog-schema";

// Printer create/edit form (T022) — the mirror of FilamentForm. Same RHF + E1 validation (the
// `machineLifetimeHours > 0` denominator rule reuses `machineLifetimePositive`), same money-as-string
// wire payload, and the avgPower field carries the E1 "consumo médio real, não a placa" hint (FR-022).
//
// 019/PR-B (T045) — mesma barreira-por-ausência do FilamentForm: fora de `active` o `<form>` não
// recebe `onSubmit`, os campos vestem `<Frozen>`, e o rodapé troca "Voltar" pelo convite único.

const cf = messages.catalogForm;
const fields = messages.calculator.fields;
const hints = messages.calculator.hints;

export interface PrinterFormProps {
    mode: "create" | "edit";
    defaultValues: PrinterFormValues;
    submitting?: boolean;
    submitError?: string;
    /** Os cinco estados (`shared/billing/premium-gate`) — só `active` fica editável. */
    gate: PremiumGate;
    /** Ausente fora de `active` — a barreira é a ausência do handler. */
    onSubmit?: (body: PrinterIn) => void;
    onCancel: () => void;
}

export function PrinterForm({
    mode,
    defaultValues,
    submitting = false,
    submitError,
    gate,
    onSubmit,
    onCancel,
}: PrinterFormProps) {
    const { control, handleSubmit } = useForm<PrinterFormValues>({
        defaultValues,
        resolver: printerResolver,
        mode: "onTouched",
    });
    const formFields = (
        <>
            <ControlledText
                control={control}
                name="name"
                label={cf.name}
                placeholder={cf.namePlaceholderPrinter}
                required
            />
            <ControlledNumber
                control={control}
                name="machineValue"
                label={fields.machineValue}
                currency
                required
            />
            <ControlledNumber
                control={control}
                name="machineLifetimeHours"
                label={fields.machineLifetime}
                unit="h"
                required
            />
            <ControlledNumber
                control={control}
                name="avgPowerKw"
                label={fields.avgPower}
                unit="kW"
                hint={hints.avgPower}
                required
            />
            <ControlledNumber
                control={control}
                name="maintenanceReservePerHour"
                label={fields.maintenance}
                currency
                unit="/h"
                optional
            />
        </>
    );

    return (
        <CatalogFormShell
            mode={mode}
            gate={gate}
            submitting={submitting}
            submitError={submitError}
            onCancel={onCancel}
            onSubmit={onSubmit && handleSubmit((values) => onSubmit(printerToWire(values)))}
        >
            {formFields}
        </CatalogFormShell>
    );
}
