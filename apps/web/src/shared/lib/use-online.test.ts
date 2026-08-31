// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useOnline } from "./use-online";

// 009 (E4, PR-A) — the one connectivity hook (review PR-A, C6). It must REACT to reconnection, not
// read `navigator.onLine` once and freeze — that froze [Sincronizar agora] disabled forever.

function setOnline(online: boolean) {
    Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
}

afterEach(() => setOnline(true));

describe("useOnline", () => {
    it("reads the initial connectivity", () => {
        setOnline(false);
        const { result } = renderHook(() => useOnline());
        expect(result.current).toBe(false);
    });

    it("flips to true when the window fires `online` — never a frozen one-time read", () => {
        setOnline(false);
        const { result } = renderHook(() => useOnline());
        expect(result.current).toBe(false);

        act(() => {
            setOnline(true);
            window.dispatchEvent(new Event("online"));
        });

        expect(result.current).toBe(true);
    });

    it("flips to false when the window fires `offline`", () => {
        setOnline(true);
        const { result } = renderHook(() => useOnline());

        act(() => {
            setOnline(false);
            window.dispatchEvent(new Event("offline"));
        });

        expect(result.current).toBe(false);
    });
});
