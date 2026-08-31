// `CampoDeHoras` — the hours field with a local draft for mid-typing clock strings ("0:", "2h"),
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { useState } from "react";

import { parseRelogio } from "@/features/calculator/time-input";
import { messages } from "@/shared/i18n/messages.pt-br";
import { NumberField } from "@/shared/ui";

const t = messages.calculator;

/**
 * Review do PR #58 (2026-08-15) — o campo de HORAS com rascunho local.
 *
 * O achado: `2:30` funcionava COLADO e não funcionava DIGITADO. A causa é o campo ser controlado
 * por `String(h)`: ao teclar `0`, depois `:`, o texto `"0:"` não casa como relógio, cai no
 * `parseInt` que devolve 0, o React re-renderiza com `"0"` e o `:` que a pessoa acabou de digitar
 * some. Continuando, `"30"` vira **30 horas** — 60× o que ela quis dizer, calado.
 *
 * O conserto é dar um rascunho local ao campo enquanto o texto contém um separador: nesse estado
 * ele NÃO commita nada e deixa a pessoa terminar de escrever. Assim que o relógio fecha (`0:30`),
 * commita e devolve o controle ao valor derivado. No blur, um rascunho que nunca fechou cai no
 * `parseInt` de sempre — nada fica preso num estado que o motor não conhece.
 *
 * Esta é a única parte do campo com estado próprio, e ela existe só para os caracteres
 * intermediários — o valor que chega ao motor continua sendo o mesmo decimal de sempre.
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
