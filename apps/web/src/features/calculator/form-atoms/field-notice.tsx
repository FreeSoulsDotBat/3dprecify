// `CampoAviso` — the per-field `<Aviso>` body shared by ControlledField/TimeHmField/MachineCostFields,
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { messages } from "@/shared/i18n/messages.pt-br";
import type { UseFieldWarningResult } from "@/shared/lib/use-field-warning";
import { Notice, Button } from "@/shared/ui";

const t = messages.calculator;

/** 019/PR-C (T056, prancheta 14) — o corpo do `<Aviso>` de UM campo, comum aos três consumidores
 *  de `useAvisoDeCampo` (`ControlledField`/`TimeHmField`/`MachineCostFields`): nenhum aviso ⇒ nada
 *  renderiza; com uma recusa junto (14b), sem "Entendi" — não se dispensa uma lição que acompanha
 *  uma recusa. */
export function FieldNotice({ notice, testId }: { notice: UseFieldWarningResult; testId: string }) {
    if (!notice.notice) return null;
    return (
        <Notice
            data-testid={testId}
            action={
                !notice.comErro && (
                    <Button variant="ghost" size="sm" onClick={notice.onEntendi}>
                        {t.plausibility.understood}
                    </Button>
                )
            }
        >
            {notice.notice}
        </Notice>
    );
}
