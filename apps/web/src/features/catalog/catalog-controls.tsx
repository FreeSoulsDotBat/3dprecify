import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, NumberField } from "@/shared/ui";

// Small RHF↔DS control adapters shared by the filament + printer forms (T019/T022). They mirror the
// calculator's `ControlledField` (Field render-fn → NumberField) so a saved value validates with the
// same wiring the calculator uses — no new field mechanics, just the DS composed around RHF.

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
}: BaseProps<T> & { currency?: boolean; unit?: string; hint?: string }) {
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
