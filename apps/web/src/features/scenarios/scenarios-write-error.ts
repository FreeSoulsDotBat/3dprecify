import { apiErrorMessage } from "@/shared/api/error-messages";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";

const t = messages.scenarios;

/** A failed write's honest, specific line — never a generic error, never a fake success (§0.1). */
// 016/T072-A9 (2026-08-07): the non-`ApiError` fallback used to ALSO claim "precisa de conexão" —
// an unmeasured cause (see `shared/api/error-messages.ts:honestWriteError`, the canonical version
// of this same rule). `transport.ts` normalises every real request failure into a typed
// `ApiError`, so anything else is unexpected and gets the generic honest phrase instead.
//
// 019/Polish — moved verbatim out of `scenarios-list-sheet.tsx` so `rename-scenario-sheet.tsx` and
// `delete-scenario-dialog.tsx` (the two overlays extracted alongside it) can share it without a
// circular import back into the file they came from. B10 (registered, unchanged here): this text
// still diverges from `shared/api/error-messages.ts`'s own `honestWriteError` — unifying them would
// change copy, which is explicitly out of scope for this pass.
export function honestWriteError(err: unknown): string {
    if (err instanceof ApiError) {
        return err.status === 0 ? t.writeOffline : apiErrorMessage(err);
    }
    return messages.apiError.unknown;
}
