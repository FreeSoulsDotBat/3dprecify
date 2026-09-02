import type { FormEventHandler, ReactNode } from "react";

import type { PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button } from "@/shared/ui";
import { Frozen } from "@/shared/ui/frozen";

import { PremiumFooterNote, PremiumInviteCta } from "./catalog-controls";

// ⚠ @doc DEC-126 — a barreira do não-premium é a AUSÊNCIA do `onSubmit`, nunca um `disabled` só.
//   Esta casca é a ÚNICA dona dessa forma: `FilamentForm` e `PrinterForm` eram 37 linhas idênticas.

const cf = messages.catalogForm;

export interface CatalogFormShellProps {
    mode: "create" | "edit";
    /** Os cinco estados (`shared/billing/premium-gate`) — só `active` fica editável. */
    gate: PremiumGate;
    /** A requisição de salvar está em voo (aciona o spinner do botão). */
    submitting?: boolean;
    /** Linha de erro honesta, já mapeada (ex.: "precisa de conexão"), acima das ações. */
    submitError?: string;
    onCancel: () => void;
    /** Ausente fora de `active`: é a ausência dele que barra, não o `disabled` do botão. */
    onSubmit?: FormEventHandler<HTMLFormElement>;
    /** Os campos da entidade — a única coisa que difere entre um formulário e outro. */
    children: ReactNode;
}

export function CatalogFormShell({
    mode,
    gate,
    submitting = false,
    submitError,
    onCancel,
    onSubmit,
    children,
}: CatalogFormShellProps) {
    const active = gate === "active";
    return (
        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
            {active ? (
                <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">{children}</fieldset>
            ) : (
                <Frozen
                    className="flex flex-col gap-3 border-0 p-0 m-0"
                    data-testid="catalog-form-frozen"
                >
                    {children}
                </Frozen>
            )}

            {submitError && <Alert tone="danger">{submitError}</Alert>}

            {!active && <PremiumFooterNote gate={gate} />}

            <div className={active ? "flex justify-end gap-2" : "flex justify-between gap-2"}>
                {active && (
                    <Button variant="ghost" onClick={onCancel}>
                        {cf.cancel}
                    </Button>
                )}
                {!active && <PremiumInviteCta gate={gate} />}
                <Button type={active ? "submit" : "button"} disabled={!active} loading={submitting}>
                    {mode === "edit" ? cf.saveChanges : cf.save}
                </Button>
            </div>
        </form>
    );
}
