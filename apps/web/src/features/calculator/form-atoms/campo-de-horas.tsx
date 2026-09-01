// `CampoDeHoras` — the hours field with a local draft for mid-typing clock strings ("0:", "2h"),
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { useState } from "react";

import { parseRelogio } from "@/features/calculator/time-input";
import { messages } from "@/shared/i18n/messages.pt-br";
import { NumberField } from "@/shared/ui";

const t = messages.calculator;

/**
 * ⚠ @doc DEC-072 — rascunho local SÓ enquanto o texto tem separador: sem ele, digitar `2:30`
 *   fazia o `:` sumir e `"30"` virar 30 HORAS — 60× o pretendido, calado.
 */
export function CampoDeHoras({
    h,
    min,
    onCommit,
    onBlurField,
}: {
    h: number;
    min: number;
    onCommit: (h: number, min: number) => void;
    onBlurField: () => void;
}) {
    const [rascunho, setRascunho] = useState<string | null>(null);
    const temSeparador = (v: string) => /[:hH]/.test(v);
    return (
        <NumberField
            aria-label={t.timeInput.hoursAria}
            unit={t.timeInput.hoursUnit}
            inputMode="text"
            placeholder="0"
            value={rascunho ?? String(h)}
            onChange={(e) => {
                const bruto = e.target.value;
                const relogio = parseRelogio(bruto);
                if (relogio) {
                    setRascunho(null);
                    onCommit(relogio.h, relogio.min);
                    return;
                }
                if (temSeparador(bruto)) {
                    // Meio de digitação ("0:", "2h"): segura o texto e NÃO mexe no número ainda.
                    setRascunho(bruto);
                    return;
                }
                setRascunho(null);
                onCommit(Number.parseInt(bruto, 10) || 0, min);
            }}
            onBlur={() => {
                if (rascunho !== null) {
                    const relogio = parseRelogio(rascunho);
                    if (relogio) onCommit(relogio.h, relogio.min);
                    else onCommit(Number.parseInt(rascunho, 10) || 0, min);
                    setRascunho(null);
                }
                onBlurField();
            }}
        />
    );
}
