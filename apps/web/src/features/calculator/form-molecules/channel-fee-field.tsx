// `ChannelFeeField` — one channel fee input wired to `channels.{i}.{field}`, extracted verbatim
// from calculator-form.tsx (019-polish readability split, no behavior change).
import { type Control, Controller } from "react-hook-form";

import type { CalcFormValues, CHANNEL_FEE_FIELDS } from "@/features/calculator/calculator-schema";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";
import { avisoDeComissao } from "@/shared/lib/plausibilidade";
import { Field, NumberField } from "@/shared/ui";

/** One channel fee input, wired to `channels.{i}.{field}`. Its error comes from the per-slot
 *  model outcome (not RHF), so a bad slot flags itself while the siblings keep computing. */
export function ChannelFeeField({
    control,
    index,
    meta,
    error,
    applied,
}: {
    control: Control<CalcFormValues>;
    index: number;
    meta: (typeof CHANNEL_FEE_FIELDS)[number];
    error?: string;
    /** 015/A8 ([F11a-007]) — o valor que o CATÁLOGO está aplicando neste campo, quando ele é único
     *  OU o valor RESOLVIDO da banda aplicada (016/A1). Quando o valor vem de um `fixedFeeRule`, a
     *  frase da regra vive na legenda de largura total do slot — nunca como sufixo aqui (reverify:
     *  o sufixo cortava em todos os viewports e produzia a leitura errada que existia para evitar). */
    applied?: number;
}) {
    // 015/A8 ([F11a-007], decisão do dono 2026-08-03) — o placeholder passa a dizer a VERDADE.
    //
    // A homologação mediu: com Amazon e sem categoria os quatro campos ficavam vazios com o
    // placeholder padrão "0,00" — a tela lia `Comissão 0,00 %` — enquanto "Preços por canal" mostrava
    // um preço com 15% já descontados. O número que o vendedor procura primeiro estava em branco, e o
    // selo que o explicava era o elemento de menor peso visual do painel. Campo vazio ao lado de um
    // preço descontado é a única leitura errada possível.
    //
    // O placeholder é o registro visual certo para isto, e não um valor preenchido: ele JÁ significa
    // "não digitado" em toda a interface. Um valor real no campo faria o vendedor achar que vouchou
    // por ele — e o `editedFields` (que o cenário salva como `overridden`) passaria a mentir.
    const placeholder =
        applied === undefined
            ? undefined
            : meta.currency
              ? applied.toFixed(2).replace(".", ",")
              : String(applied).replace(".", ",");
    return (
        <Controller
            control={control}
            name={`channels.${index}.${meta.name}` as const}
            render={({ field }) => {
                // Homologação automatizada (CF-010-UI-02) — o vendedor escreve `0,12` querendo dizer 12%.
                // Ninguém recusa: 0,12% é uma comissão válida. Medido: o anúncio cai de R$ 27,55 para
                // R$ 25,24 e ele anuncia abaixo do necessário, descobrindo no extrato do marketplace.
                const aviso =
                    meta.name === "commissionPct"
                        ? avisoDeComissao(parseDecimal(String(field.value ?? "")))
                        : null;
                return (
                    <Field
                        label={meta.label}
                        optional
                        hint={
                            aviso ? (
                                <span className="tf-field__aviso" data-testid="aviso-commissionPct">
                                    {aviso}
                                </span>
                            ) : undefined
                        }
                        error={error}
                    >
                        {(p) => (
                            <NumberField
                                {...p}
                                currency={meta.currency}
                                unit={meta.unit}
                                name={field.name}
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                error={Boolean(error)}
                                {...(placeholder ? { placeholder } : {})}
                            />
                        )}
                    </Field>
                );
            }}
        />
    );
}
