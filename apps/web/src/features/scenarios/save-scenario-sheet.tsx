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
} from "@/shared/ui";

// 010/T010 (E5, PR-A US1) — the "Salvar cenário" affordance + the name/note Sheet.
//
// Mirrors the E4 `RecordSnapshotButton` idiom exactly (`features/history/record-snapshot-sheet.tsx`):
// a PREMIUM-ONLY inline affordance that is simply ABSENT without an active server entitlement — not
// greyed-out, not a teaser trigger (the SC-109 posture this feature inherits, §0.1/§11-F2 of
// ux-scenarios.md). This is the honest CLIENT route-guard ADR-0015 asks for: it is informational only
// — the server's `require_entitlement(ACTIVE)` on `POST /api/v1/scenarios` is the real gate, and a
// stale-`active` client can still be refused there (surfaced honestly below, never assumed).
//
// `buildConfig()` is called once, at Sheet-OPEN time (the `RecordSource.freeze()` pattern) — the
// config that gets saved is the one the seller reviewed on screen, not one re-derived after they
// started typing the name. `features/scenarios` never imports `features/calculator`: the caller
// (the Calcular page) builds the closure via `features/calculator/scenario-bridge.ts`.

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

/** A failed write's honest, specific line — never a generic error, never a fake "salvo!" (§0.1). */
function honestSaveError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 0 ? t.saveOffline : apiErrorMessage(err);
  }
  return t.saveOffline;
}

function SaveForm({ source, onDone }: { source: SaveScenarioSource; onDone: () => void }) {
  const [config] = useState(() => source.buildConfig());
  const create = useCreateScenario();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nameError =
    name.trim() === "" ? t.nameRequired : name.length > NAME_MAX ? t.nameTooLong : undefined;
  const noteError = note.length > NOTE_MAX ? t.noteTooLong : undefined;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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

      <Field label={t.nameField} required error={nameError && name !== "" ? nameError : undefined}>
        {(p) => (
          <div className="tf-inputwrap">
            <input
              {...p}
              type="text"
              className="tf-input"
              maxLength={NAME_MAX + 1}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
          calculator state that was on screen when the Sheet opened. */}
      <p className="text-sm text-[var(--text-muted)]">
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
