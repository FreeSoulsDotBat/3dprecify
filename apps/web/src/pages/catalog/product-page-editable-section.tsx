import { type ReactNode } from "react";

import { Frozen } from "@/shared/ui/frozen";

// 019/Polish — moved verbatim out of produto-page.tsx: shared by the identity block and the
// custos/mercado grid, both of which freeze the same way outside `active`.

/** 019/PR-B (T045) — `active` num `<fieldset>` normal, fora dele um `<Frozen>` (mesma regra nos
 *  três blocos do formulário: identidade, custos, mercado). Extraído das três IIFEs anônimas que
 *  decidiam a mesma coisa no JSX — a árvore DOM de cada sítio fica idêntica. */
export function EditableSection({ active, children }: { active: boolean; children: ReactNode }) {
    return active ? (
        <fieldset className="contents">{children}</fieldset>
    ) : (
        <Frozen className="contents" data-testid="catalog-form-frozen">
            {children}
        </Frozen>
    );
}
