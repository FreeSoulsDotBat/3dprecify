import { useForm } from "react-hook-form";

import type { PrinterIn } from "@/shared/api/generated";
import type { PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button } from "@/shared/ui";
import { Frozen } from "@/shared/ui/frozen";

import {
    ControlledNumber,
    ControlledText,
    PremiumFooterNote,
    PremiumInviteCta,
} from "./catalog-controls";
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
    const active = gate === "active";
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
        <form
            className="flex flex-col gap-3"
            onSubmit={onSubmit && handleSubmit((values) => onSubmit(printerToWire(values)))}
            noValidate
        >
            {active ? (
                <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">{formFields}</fieldset>
            ) : (
                <Frozen
                    className="flex flex-col gap-3 border-0 p-0 m-0"
                    data-testid="catalog-form-frozen"
                >
                    {formFields}
                </Frozen>
            )}

            {submitError && <Alert tone="danger">{submitError}</Alert>}

            {!active && <PremiumFooterNote gate={gate} />}

            <div className={active ? "flex justify-end gap-2" : "flex justify-between gap-2"}>
                {active && (
                    <Button variant="ghost" onClick={onCancel}>
                        {cf.cancel}
                    </Button>
                )}
                {!active && <PremiumInviteCta gate={gate} />}
                <Button type={active ? "submit" : "button"} disabled={!active} loading={submitting}>
                    {mode === "edit" ? cf.saveChanges : cf.save}
                </Button>
            </div>
        </form>
    );
}
