// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { dismissKey, usePlausibilityDismissStore } from "./plausibility-dismiss-store";

// 019/PR-C (T050, prancheta 14a) — a dispensa ("Entendi") do aviso de plausibilidade, POR SESSÃO.
// Vermelho primeiro: nem o store nem o módulo existem no início desta fatia.

describe("plausibility-dismiss-store — dispensa de sessão (019/PR-C, T050)", () => {
    it("dismissKey compõe campo+valor — chaves diferentes para valores diferentes do MESMO campo", () => {
        expect(dismissKey("rollWeightKg", "1000")).toBe("rollWeightKg:1000");
        expect(dismissKey("rollWeightKg", "1000")).not.toBe(dismissKey("rollWeightKg", "2000"));
    });

    it("uma chave dispensada sobrevive a leituras seguintes (sobrevive a unmount/remount do consumidor)", () => {
        usePlausibilityDismissStore.setState({ dismissed: new Set() });
        const key = dismissKey("rollWeightKg", "1000");
        expect(usePlausibilityDismissStore.getState().dismissed.has(key)).toBe(false);

        usePlausibilityDismissStore.getState().dismiss(key);
        expect(usePlausibilityDismissStore.getState().dismissed.has(key)).toBe(true);

        // "Remontar" o consumidor não recria o store — é módulo singleton, o mesmo `create()`.
        expect(usePlausibilityDismissStore.getState().dismissed.has(key)).toBe(true);
    });

    it("dispensar uma chave NÃO dispensa outro valor do MESMO campo (14a — 'não volta para o mesmo valor')", () => {
        usePlausibilityDismissStore.setState({ dismissed: new Set() });
        usePlausibilityDismissStore.getState().dismiss(dismissKey("rollWeightKg", "1000"));
        expect(
            usePlausibilityDismissStore
                .getState()
                .dismissed.has(dismissKey("rollWeightKg", "2000")),
        ).toBe(false);
    });

    it("NÃO usa localStorage — é dispensa de sessão, não preferência de conta/aparelho", () => {
        // `create` puro (sem `persist`): nenhuma chamada a localStorage.setItem acontece ao dispensar.
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        usePlausibilityDismissStore.setState({ dismissed: new Set() });
        usePlausibilityDismissStore.getState().dismiss(dismissKey("rollWeightKg", "1000"));
        expect(setItem).not.toHaveBeenCalled();
        setItem.mockRestore();
    });
});
