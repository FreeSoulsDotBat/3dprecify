// `SectionTitle` — a section title with an inline ⓘ info tip, extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import { InfoTip } from "@/shared/ui";

import { sectionLabel } from "./form-styles";

/** A section title with an inline ⓘ info tip explaining what/how the section calculates. */
export function SectionTitle({
    title,
    info,
}: {
    title: string;
    info: { label: string; body: string };
}) {
    return (
        <div className="flex items-center gap-1">
            <p style={sectionLabel}>{title}</p>
            <InfoTip label={info.label}>{info.body}</InfoTip>
        </div>
    );
}
