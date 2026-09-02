import { useForm } from "react-hook-form";

import type { FilamentIn } from "@/shared/api/generated";
import type { PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { CatalogFormShell } from "./catalog-form-shell";
import { ControlledNumber, ControlledText } from "./catalog-controls";
import { type FilamentFormValues, filamentResolver, filamentToWire } from "./catalog-schema";

// Filament create/edit form (T019). RHF + the E1 pt-BR validation (via `filamentResolver`); on a
// valid submit it emits the WIRE payload (money as decimal string) so the page's mutation stays a
// thin call.
//
// 019/PR-B (T045, prancheta 32b/32e) — a barreira do não-premium é a AUSÊNCIA do handler: fora de
// `active` o `<form>` nem recebe `onSubmit` (não existe caminho de submit nativo — o botão também é
// `type="button"`), e os campos vestem `<Frozen>` (`tf-frozen`, fieldset nativo desabilitado por
// dentro do componente). O rodapé troca "Voltar" pelo convite (mesmo elemento do vazio didático,
// FR-1906) — nunca dois convites na mesma tela.

const cf = messages.catalogForm;
const fields = messages.calculator.fields;

export interface FilamentFormProps {
    mode: "create" | "edit";
    defaultValues: FilamentFormValues;
    /** The save request is in flight (drives the button spinner). */
    submitting?: boolean;
    /** Honest, already-mapped error line (e.g. "precisa de conexão") shown above the actions. */
    submitError?: string;
    /** Os cinco estados (`shared/billing/premium-gate`) — só `active` fica editável. */
    gate: PremiumGate;
    /** Ausente fora de `active` — a barreira é a ausência do handler, nunca um `disabled` sozinho. */
    onSubmit?: (body: FilamentIn) => void;
    onCancel: () => void;
}

export function FilamentForm({
    mode,
    defaultValues,
    submitting = false,
    submitError,
    gate,
    onSubmit,
    onCancel,
}: FilamentFormProps) {
    const { control, handleSubmit } = useForm<FilamentFormValues>({
        defaultValues,
        resolver: filamentResolver,
        mode: "onTouched",
    });
    const formFields = (
        <>
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
        </>
    );

    return (
        <CatalogFormShell
            mode={mode}
            gate={gate}
            submitting={submitting}
            submitError={submitError}
            onCancel={onCancel}
            onSubmit={onSubmit && handleSubmit((values) => onSubmit(filamentToWire(values)))}
        >
            {formFields}
        </CatalogFormShell>
    );
}
