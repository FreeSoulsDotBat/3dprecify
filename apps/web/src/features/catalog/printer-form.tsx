import { useForm } from "react-hook-form";

import type { PrinterIn } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button } from "@/shared/ui";

import { ControlledNumber, ControlledText } from "./catalog-controls";
import { type PrinterFormValues, printerResolver, printerToWire } from "./catalog-schema";

// Printer create/edit form (T022) — the mirror of FilamentForm. Same RHF + E1 validation (the
// `machineLifetimeHours > 0` denominator rule reuses `machineLifetimePositive`), same money-as-string
// wire payload, and the avgPower field carries the E1 "consumo médio real, não a placa" hint (FR-022).

const cf = messages.catalogForm;
const fields = messages.calculator.fields;
const hints = messages.calculator.hints;

export interface PrinterFormProps {
  mode: "create" | "edit";
  defaultValues: PrinterFormValues;
  submitting?: boolean;
  submitError?: string;
  onSubmit: (body: PrinterIn) => void;
  onCancel: () => void;
}

export function PrinterForm({
  mode,
  defaultValues,
  submitting = false,
  submitError,
  onSubmit,
  onCancel,
}: PrinterFormProps) {
  const { control, handleSubmit } = useForm<PrinterFormValues>({
    defaultValues,
    resolver: printerResolver,
    mode: "onTouched",
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((values) => onSubmit(printerToWire(values)))}
      noValidate
    >
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

      {submitError && <Alert tone="danger">{submitError}</Alert>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {cf.cancel}
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "edit" ? cf.saveChanges : cf.save}
        </Button>
      </div>
    </form>
  );
}
