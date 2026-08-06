import { useForm } from "react-hook-form";

import type { FilamentIn } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button } from "@/shared/ui";

import { ControlledNumber, ControlledText } from "./catalog-controls";
import { type FilamentFormValues, filamentResolver, filamentToWire } from "./catalog-schema";

// Filament create/edit form (T019). RHF + the E1 pt-BR validation (via `filamentResolver`); on a
// valid submit it emits the WIRE payload (money as decimal string) so the page's mutation stays a
// thin call. Read-only mode (lapsed freeze, ux-catalog §3 / 013 FB-02): a native `<fieldset
// disabled>` inerts every field in one place (no per-control prop threading, works for anything
// nested inside), and the footer swaps Salvar for the reactivation line — up front, never a
// fail-at-save surprise.

const cf = messages.catalogForm;
const fields = messages.calculator.fields;
const catalogo = messages.catalogo;

export interface FilamentFormProps {
  mode: "create" | "edit";
  defaultValues: FilamentFormValues;
  /** The save request is in flight (drives the button spinner). */
  submitting?: boolean;
  /** Honest, already-mapped error line (e.g. "precisa de conexão") shown above the actions. */
  submitError?: string;
  /** Premium lapsed (ux-catalog §3): fields render inert and Salvar is replaced by the
   *  reactivation line. Presentation only — the server's own gate is unchanged (Constitution IV). */
  readOnly?: boolean;
  onSubmit: (body: FilamentIn) => void;
  onCancel: () => void;
}

export function FilamentForm({
  mode,
  defaultValues,
  submitting = false,
  submitError,
  readOnly = false,
  onSubmit,
  onCancel,
}: FilamentFormProps) {
  const { control, handleSubmit } = useForm<FilamentFormValues>({
    defaultValues,
    resolver: filamentResolver,
    mode: "onTouched",
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((values) => onSubmit(filamentToWire(values)))}
      noValidate
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-3 border-0 p-0 m-0">
        <ControlledText
          control={control}
          name="name"
          label={cf.name}
          placeholder={cf.namePlaceholderFilament}
          required
        />
        <ControlledText
          control={control}
          name="material"
          label={cf.material}
          placeholder={cf.materialPlaceholder}
        />
        <ControlledNumber
          control={control}
          name="costPerRoll"
          label={fields.costPerRoll}
          currency
          required
        />
        <ControlledNumber
          control={control}
          name="rollWeightKg"
          label={fields.rollWeight}
          unit="kg"
          required
        />
      </fieldset>

      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {readOnly && (
        <Alert tone="info" title={catalogo.reactivateTitle}>
          {catalogo.reactivateBody}
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {cf.cancel}
        </Button>
        {!readOnly && (
          <Button type="submit" loading={submitting}>
            {mode === "edit" ? cf.saveChanges : cf.save}
          </Button>
        )}
      </div>
    </form>
  );
}
