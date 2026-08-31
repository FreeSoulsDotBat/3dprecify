// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveFile } from "./save-file";

// 009/T028 — the last step of an export: bytes we already hold, onto the device.
//
// It cannot be a `<a href="/api/…">`: the export routes are authenticated, and a browser navigation
// carries no Firebase ID token — the seller would receive a 401 page named `orcamento.pdf`.

let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
    clicked = [];
    vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn(() => "blob:fake-url"),
        revokeObjectURL: vi.fn(),
    });
    // jsdom implements no navigation, so `click()` on an anchor is a no-op — capture it instead.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
    ) {
        clicked.push(this);
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("saveFile", () => {
    it("downloads the blob under the given name, and leaves no anchor behind", () => {
        saveFile(new Blob(["%PDF-1.4"]), "orcamento.pdf");

        expect(clicked).toHaveLength(1);
        expect(clicked[0]!.download).toBe("orcamento.pdf");
        expect(clicked[0]!.href).toBe("blob:fake-url");
        // The DOM is left exactly as it was found.
        expect(document.querySelector("a")).toBeNull();
    });

    it("revokes the object URL, but not in the same tick (it can race the browser's read)", () => {
        vi.useFakeTimers();
        saveFile(new Blob(["x"]), "historico.csv");

        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        vi.runAllTimers();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
        vi.useRealTimers();
    });
});
