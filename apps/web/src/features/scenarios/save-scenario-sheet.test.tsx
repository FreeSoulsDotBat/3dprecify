// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
vi.mock("@/entities/scenario/use-scenarios", () => ({
    useCreateScenario: () => ({ mutateAsync, isPending: false }),
}));

const entitlement = { data: undefined as { status: string } | undefined };
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => entitlement,
}));

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Toaster, useToastStore } from "@/shared/ui";

import { SaveScenarioSheet } from "./save-scenario-sheet";

// 010/T010 (E5, PR-A US1) — the save action + Sheet, written FAILING-first.
//
// Three properties pinned here (mirrors 009/T010's suite, the E4 lineage):
//   1. Premium-only inline, ABSENT without an active server entitlement (SC-109 mirror) — not
//      greyed out, not a teaser trigger.
//   2. The config is frozen at Sheet-OPEN time (`buildConfig()` called once).
//   3. Every failure path is honest and SPECIFIC (offline vs a coded denial) — never a fake "salvo!".

const t = messages.scenarios;

const CONFIG: ScenarioConfig = {
    schemaVersion: 1,
    includeMarketplace: true,
    costBasis: { kind: "AD_HOC", ref: null, lastKnown: { costPerRoll: "100" } },
    channels: [],
    otherCosts: [],
};

function renderSheet(buildConfig = () => CONFIG) {
    return render(
        <>
            <SaveScenarioSheet source={{ buildConfig, basisLabel: t.basisKindAdhoc }} />
            <Toaster />
        </>,
    );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

beforeEach(() => {
    vi.clearAllMocks();
    entitlement.data = { status: "active" };
});

afterEach(() => {
    cleanup();
    useToastStore.setState({ toasts: [] });
});

describe("SaveScenarioSheet — the premium-only client route-guard (ADR-0015)", () => {
    it("free/none: the button is simply ABSENT — not greyed, not a teaser trigger", () => {
        entitlement.data = { status: "none" };
        renderSheet();
        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });

    it("signed-out (no entitlement answer at all): also absent", () => {
        entitlement.data = undefined;
        renderSheet();
        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });

    it("lapsed: also absent (a scenario write needs ACTIVE, not merely readable)", () => {
        entitlement.data = { status: "lapsed" };
        renderSheet();
        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });

    it("active premium: the trigger is visible and opens the Sheet", async () => {
        const user = setup();
        renderSheet();
        await user.click(screen.getByTestId("save-scenario-trigger"));
        expect(screen.getByText(t.saveSheetIntro)).toBeInTheDocument();
        expect(
            screen.getByText(t.basisEcho.replace("{nome}", t.basisKindAdhoc)),
        ).toBeInTheDocument();
    });
});

describe("SaveScenarioSheet — honest name/note validation (ux §2.3)", () => {
    it("blank name blocks submit with the inline required message", async () => {
        const user = setup();
        renderSheet();
        await user.click(screen.getByTestId("save-scenario-trigger"));
        await user.click(screen.getByTestId("save-scenario-submit"));
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});

describe("SaveScenarioSheet — a real 2xx only (honest success)", () => {
    it("saves on submit and toasts ONLY after the server accepts", async () => {
        mutateAsync.mockResolvedValue({ id: "s1" });
        const user = setup();
        renderSheet();
        await user.click(screen.getByTestId("save-scenario-trigger"));
        await user.type(
            screen.getByLabelText(new RegExp("^" + t.nameField)),
            "ML Clássico × Shopee",
        );
        await user.click(screen.getByTestId("save-scenario-submit"));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        const body = mutateAsync.mock.calls[0]![0];
        expect(body.name).toBe("ML Clássico × Shopee");
        expect(body.config).toEqual(CONFIG);
        await waitFor(() => expect(screen.queryByText(t.saveSheetIntro)).not.toBeInTheDocument());
        expect(useToastStore.getState().toasts.some((i) => i.message === t.saved)).toBe(true);
    });
});

describe("SaveScenarioSheet — honest, specific failure (FR-613: no queue, no fake success)", () => {
    it("offline (transport status 0) shows the specific conexão copy, Sheet stays open, nothing persists", async () => {
        mutateAsync.mockRejectedValue(
            new ApiError({ status: 0, code: "UNKNOWN", message: "offline", correlationId: null }),
        );
        const user = setup();
        renderSheet();
        await user.click(screen.getByTestId("save-scenario-trigger"));
        await user.type(screen.getByLabelText(new RegExp("^" + t.nameField)), "x");
        await user.click(screen.getByTestId("save-scenario-submit"));

        await waitFor(() => expect(screen.getByText(t.saveOffline)).toBeInTheDocument());
        expect(screen.getByText(t.saveSheetIntro)).toBeInTheDocument(); // still open
        expect(useToastStore.getState().toasts.some((i) => i.message === t.saved)).toBe(false);
    });

    it("a coded denial (e.g. a lapsed 403) shows its own honest phrase, never a generic error", async () => {
        mutateAsync.mockRejectedValue(
            new ApiError({
                status: 403,
                code: "ENTITLEMENT_REQUIRED",
                message: "denied",
                correlationId: null,
            }),
        );
        const user = setup();
        renderSheet();
        await user.click(screen.getByTestId("save-scenario-trigger"));
        await user.type(screen.getByLabelText(new RegExp("^" + t.nameField)), "x");
        await user.click(screen.getByTestId("save-scenario-submit"));

        await waitFor(() =>
            expect(screen.getByText(messages.apiError.entitlementRequired)).toBeInTheDocument(),
        );
    });

    // 016/T072-A9: an unexpected failure that ISN'T even a typed `ApiError` (transport.ts normalises
    // every real request failure into one) must not be relabelled "precisa de conexão" — an
    // unmeasured cause. It gets the generic honest phrase instead.
    it("an unexpected non-ApiError failure gets the generic honest phrase, never the conexão copy", async () => {
        mutateAsync.mockRejectedValue(new Error("boom — not an ApiError"));
        const user = setup();
        renderSheet();
        await user.click(screen.getByTestId("save-scenario-trigger"));
        await user.type(screen.getByLabelText(new RegExp("^" + t.nameField)), "x");
        await user.click(screen.getByTestId("save-scenario-submit"));

        await waitFor(() =>
            expect(screen.getByText(messages.apiError.unknown)).toBeInTheDocument(),
        );
        expect(screen.queryByText(t.saveOffline)).not.toBeInTheDocument();
    });
});
