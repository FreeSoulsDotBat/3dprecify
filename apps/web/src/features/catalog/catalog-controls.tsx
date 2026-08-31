import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

import type { PremiumGate } from "@/shared/billing/premium-gate";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Field, NumberField } from "@/shared/ui";

// Small RHF↔DS control adapters shared by the filament + printer forms (T019/T022). They mirror the
// calculator's `ControlledField` (Field render-fn → NumberField) so a saved value validates with the
// same wiring the calculator uses — no new field mechanics, just the DS composed around RHF.

const catalogo = messages.catalogo;

// 019/PR-B (T045) — os dois pedaços do rodapé do formulário inerte (prancheta 32b/32e/32f),
// extraídos aqui para não duplicar a regra "lapsed → reativar, free/deslogado → assinar, unknown →
// nem frase nem convite" entre FilamentForm/PrinterForm/ProdutoPage — os três compõem o MESMO
// footer, nunca uma segunda cópia da lógica.

/** A frase acima da linha de botões (`data-testid="premium-footer-note"`) — ausente em `active`
 *  (o formulário funciona, não há nada a explicar) e em `unknown` (nunca presume, T045). */
export function PremiumFooterNote({ gate }: { gate: PremiumGate }) {
    if (gate === "lapsed") {
        return <p data-testid="premium-footer-note">{catalogo.reactivateBody}</p>;
    }
    if (gate === "free-nunca-teve" || gate === "signed-out") {
        return (
            <p data-testid="premium-footer-note">
                {messages.premiumTeaser.salvarFazParteDoPremium}
            </p>
        );
    }
    return null;
}

/** O ÚNICO convite da tela quando o formulário inerte está aberto (FR-1906) — o MESMO elemento do
 *  vazio didático, nunca um segundo link. Ausente em `active` e `unknown`. */
export function PremiumInviteCta({ gate }: { gate: PremiumGate }) {
    if (gate === "active" || gate === "unknown") return null;
    return (
        <TeaserUpgrade
            variant="secondary"
            price={false}
            signedOut={gate === "signed-out"}
            label={gate === "lapsed" ? messages.billing.reactivateAction : undefined}
        />
    );
}

interface BaseProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    required?: boolean;
    /** Show the muted "opcional" tag (explicit — not every non-required field wants it). */
    optional?: boolean;
    disabled?: boolean;
}

/** A free-text field (name / material) wired to RHF + the DS `Field` frame. */
export function ControlledText<T extends FieldValues>({
    control,
    name,
    label,
    required = false,
    optional = false,
    disabled = false,
    placeholder,
}: BaseProps<T> & { placeholder?: string }) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => (
                <Field
                    label={label}
                    required={required}
                    optional={optional}
                    error={fieldState.error?.message}
                    tightLabel
                >
                    {(p) => (
                        <div
                            className={["tf-inputwrap", fieldState.error && "tf-inputwrap--error"]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            <input
                                {...p}
                                type="text"
                                className="tf-input"
                                placeholder={placeholder}
                                disabled={disabled}
                                name={field.name}
                                value={(field.value as string) ?? ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                            />
                        </div>
                    )}
                </Field>
            )}
        />
    );
}

/** A pt-BR numeric field (currency/unit affixes) wired to RHF + the DS `NumberField`. */
export function ControlledNumber<T extends FieldValues>({
    control,
    name,
    label,
    required = false,
    optional = false,
    disabled = false,
    currency = false,
    unit,
    hint,
    precision,
}: BaseProps<T> & {
    currency?: boolean;
    unit?: string;
    hint?: string;
    /** 019/PR-C (T060) — repassado ao `NumberField`; nenhum consumidor atual precisa passar
     *  (default 2, o mesmo de sempre). */
    precision?: number;
}) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => (
                <Field
                    label={label}
                    required={required}
                    optional={optional}
                    hint={hint}
                    error={fieldState.error?.message}
                    tightLabel
                >
                    {(p) => (
                        <NumberField
                            {...p}
                            currency={currency}
                            unit={unit}
                            precision={precision}
                            disabled={disabled}
                            name={field.name}
                            value={(field.value as string) ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            error={Boolean(fieldState.error)}
                        />
                    )}
                </Field>
            )}
        />
    );
}
