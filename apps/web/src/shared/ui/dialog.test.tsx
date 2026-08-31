// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

// Radix's RemoveScroll toggles `pointer-events: none` on the page while a dialog
// is open; in jsdom that style can outlive an un-closed dialog across tests. The
// check is a jsdom artifact (not a real UI state), so we opt out of it and clean
// up between tests. The a11y assertions (trap, isolation, Escape, focus-return)
// are unaffected.
const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

afterEach(() => cleanup());

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "./dialog";

function Harness() {
    return (
        <div>
            <button type="button">outside</button>
            <Dialog>
                <DialogTrigger asChild>
                    <button type="button">Abrir</button>
                </DialogTrigger>
                <DialogContent>
                    <DialogTitle>Título do diálogo</DialogTitle>
                    <DialogDescription>Descrição de apoio.</DialogDescription>
                    <button type="button">Ação interna</button>
                    <DialogClose asChild>
                        <button type="button">Fechar diálogo</button>
                    </DialogClose>
                </DialogContent>
            </Dialog>
        </div>
    );
}

describe("Dialog/Sheet accessibility (T072 / FR-016)", () => {
    it("moves focus into the dialog on open and isolates the rest of the page", async () => {
        const user = setup();
        render(<Harness />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Abrir" }));

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toBeInTheDocument();
        // Focus is trapped: it entered the dialog subtree...
        expect(dialog.contains(document.activeElement)).toBe(true);
        // ...and the outside content is hidden from the accessibility tree.
        expect(screen.queryByRole("button", { name: "outside" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ação interna" })).toBeInTheDocument();
    });

    it("closes on Escape and returns focus to the opener", async () => {
        const user = setup();
        render(<Harness />);
        const trigger = screen.getByRole("button", { name: "Abrir" });

        await user.click(trigger);
        expect(await screen.findByRole("dialog")).toBeInTheDocument();

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(document.activeElement).toBe(trigger);
    });
});
