import { useState, type FormEvent } from "react";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { useCreateScenario } from "@/entities/scenario/use-scenarios";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { ApiError } from "@/shared/api/transport";
import { apiErrorMessage } from "@/shared/api/error-messages";
import type { ScenarioIn } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import {
    Button,
    Field,
    Icon,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    toast,
    TextField,
} from "@/shared/ui";

// ⚠ @doc DEC-069 — `buildConfig()` roda UMA vez, na ABERTURA da Sheet: salva-se o que o vendedor
//   revisou, não algo re-derivado enquanto ele digitava o nome. Sem premium, o botão não existe.

const t = messages.scenarios;

export interface SaveScenarioSource {
    /** True while the live calculator form is invalid — the trigger stays visible but inert (never a
     *  dead click that pretends to work): the honest `saveInvalid` line explains inline instead. */
    disabled?: boolean;
    /** Builds the config document from what is on screen RIGHT NOW. Called once, when the Sheet opens. */
    buildConfig: () => ScenarioConfig | null;
    /** The read-only "Base de custo: {…}" echo line (ux §2.3) — already resolved by the caller. */
    basisLabel: string;
}

export function SaveScenarioSheet({ source }: { source: SaveScenarioSource }) {
    const { data } = useEntitlement();
    const entitled = data?.status === "active";
    const [open, setOpen] = useState(false);

    // Owner-mirrored decision (E4/E2 lineage, §0.1): without an ACTIVE premium the button does not
    // exist. The free 005 calculator stays literally untouched (SC-109); the honest door for a
    // free/signed-out seller is the "Meus cenários" entry (T013/T016), never this inline button.
    if (!entitled) return null;

    return (
        <>
            <Button
                variant="secondary"
                disabled={source.disabled}
                onClick={() => setOpen(true)}
                data-testid="save-scenario-trigger"
            >
                <Icon name="save" size={18} aria-hidden />
                {t.saveAction}
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
                {/* Mounted only while open, so `buildConfig()` freezes exactly what is on screen now. */}
                {open && (
                    <SheetContent>
                        <SaveForm source={source} onDone={() => setOpen(false)} />
                    </SheetContent>
                )}
            </Sheet>
        </>
    );
}

const NAME_MAX = 120;
const NOTE_MAX = 500;

/** A failed write's honest, specific line — never a generic error, never a fake "salvo!" (§0.1).
 *
 *  016/T072-A9 (2026-08-07): the non-`ApiError` fallback used to ALSO claim "precisa de conexão"
 *  — an unmeasured cause (see `shared/api/error-messages.ts:honestWriteError`, the canonical
 *  version of this same rule). `transport.ts` normalises every real request failure into a typed
 *  `ApiError`, so anything else is unexpected and gets the generic honest phrase instead. */
export function honestSaveError(err: unknown): string {
    if (err instanceof ApiError) {
        return err.status === 0 ? t.saveOffline : apiErrorMessage(err);
    }
    return messages.apiError.unknown;
}

function SaveForm({ source, onDone }: { source: SaveScenarioSource; onDone: () => void }) {
    const [config] = useState(() => source.buildConfig());
    const create = useCreateScenario();
    const [name, setName] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    // Homologação automatizada (CF-013-UI-01) — o campo vazio escondia o erro de propósito ("não
    // gritar antes de a pessoa digitar", e isso está certo), MAS o submit também retornava calado:
    // o vendedor clicava em "Salvar simulação" e não acontecia absolutamente nada. Medido: botão
    // habilitado, clique registrado, folha aberta, nenhuma mensagem. Depois de TENTAR salvar, o
    // campo deixa de ser intocado — é aí que a frase que já existe escrita precisa aparecer.
    const [tentouSalvar, setTentouSalvar] = useState(false);

    const nameError =
        name.trim() === "" ? t.nameRequired : name.length > NAME_MAX ? t.nameTooLong : undefined;
    const noteError = note.length > NOTE_MAX ? t.noteTooLong : undefined;

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        setTentouSalvar(true);
        if (!config) {
            setError(t.saveInvalid);
            return;
        }
        if (nameError || noteError) return;

        const body: ScenarioIn = {
            name: name.trim(),
            note: note.trim() || null,
            config: config as unknown as ScenarioIn["config"],
        };

        try {
            await create.mutateAsync(body);
        } catch (err) {
            setError(honestSaveError(err)); // nothing persisted; the Sheet stays open with the values intact
            return;
        }

        toast(t.saved, { tone: "success" }); // real 2xx only — never an optimistic fake
        onDone();
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
            <SheetTitle>{t.saveSheetTitle}</SheetTitle>
            <SheetDescription>{t.saveSheetIntro}</SheetDescription>

            <Field
                label={t.nameField}
                required
                error={nameError && (name !== "" || tentouSalvar) ? nameError : undefined}
            >
                {(p) => (
                    <TextField
                        {...p}
                        type="text"
                        maxLength={NAME_MAX + 1}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                )}
            </Field>

            <Field label={t.noteField} optional error={noteError}>
                {(p) => (
                    <div className="tf-inputwrap">
                        <textarea
                            {...p}
                            className="tf-input"
                            rows={3}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                )}
            </Field>

            {/* Read-only echo of the current cost basis (ux §2.3) — no editing here; it comes from the
          calculator state that was on screen when the Sheet opened. `[overflow-wrap:anywhere]`: a
          120-char spaceless product name must wrap, not overflow the 390px sheet (T031 nit). */}
            <p className="text-sm break-words [overflow-wrap:anywhere] text-[var(--text-muted)]">
                {t.basisEcho.replace("{nome}", source.basisLabel)}
            </p>

            {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}

            <Button
                type="submit"
                disabled={create.isPending || !config}
                data-testid="save-scenario-submit"
            >
                {t.saveAction}
            </Button>
        </form>
    );
}
