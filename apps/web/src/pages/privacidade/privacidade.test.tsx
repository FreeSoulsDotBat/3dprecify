// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { PrivacidadePage } from "./privacidade-page";

afterEach(() => cleanup());

const t = messages.privacy;

// FR-214 (006) — the minimal honest privacy notice. Public content page: renders signed-out with
// the four honest statements (Google e-mail, error monitoring, no resale/tracking, calculator
// collects nothing). The reachability + sign-in link live in the e2e (privacy.spec.ts).
describe("PrivacidadePage — minimal honest privacy notice (FR-214)", () => {
    it("renders the notice title as a heading", () => {
        render(<PrivacidadePage />);
        expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();
    });

    it("states the honest facts — never more, never marketing-speak", () => {
        render(<PrivacidadePage />);
        expect(screen.getByText(t.google)).toBeInTheDocument();
        expect(screen.getByText(t.monitoring)).toBeInTheDocument();
        expect(screen.getByText(t.noSale)).toBeInTheDocument();
        expect(screen.getByText(t.calculatorFree)).toBeInTheDocument();
        // E2 (007/T034): now that the catalog persists user data, the notice says so honestly.
        expect(screen.getByText(t.catalogData)).toBeInTheDocument();
    });
});
