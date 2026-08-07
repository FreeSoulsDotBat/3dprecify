// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (opts: { select: (s: { location: { href: string } }) => unknown }) =>
    opts.select({ location: { href: "/historico?snapshot=csid-1" } }),
}));

import { clearSessionExpired, markSessionExpired } from "@/shared/session/session-expiry";
import { messages } from "@/shared/i18n/messages.pt-br";

import { SessionExpiryBanner } from "./session-expiry-banner";

const t = messages.session;

beforeEach(() => clearSessionExpired());
afterEach(() => {
  cleanup();
  clearSessionExpired();
});

// hotfix 016/A3 (H5, 2026-08-07) — o CAMINHO DE VOLTA visível: nada enquanto a sessão está viva,
// um banner acionável assim que o transporte marca a expiração, preservando a intenção (a URL
// atual) através do `/sign-in`.
describe("SessionExpiryBanner", () => {
  it("renderiza nada enquanto a sessão não expirou", () => {
    render(<SessionExpiryBanner />);
    expect(screen.queryByTestId("session-expiry-banner")).not.toBeInTheDocument();
  });

  it("aparece com o botão assim que a sessão expira, e o botão preserva a intenção", () => {
    markSessionExpired();
    render(<SessionExpiryBanner />);

    const banner = screen.getByTestId("session-expiry-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(t.expiredTitle);

    const cta = screen.getByRole("link", { name: t.expiredAction });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toMatch(/^\/sign-in\?redirect=/);
    expect(decodeURIComponent(href)).toBe("/sign-in?redirect=/historico?snapshot=csid-1");
  });

  it("some de novo assim que o marcador é limpo (a sessão voltou)", () => {
    markSessionExpired();
    const { rerender } = render(<SessionExpiryBanner />);
    expect(screen.getByTestId("session-expiry-banner")).toBeInTheDocument();

    clearSessionExpired();
    rerender(<SessionExpiryBanner />);
    expect(screen.queryByTestId("session-expiry-banner")).not.toBeInTheDocument();
  });
});
