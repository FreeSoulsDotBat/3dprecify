// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// E6/T014 (US1/US2 — ux-billing.md §2.1/§3.1). The shared Assinar CTA in isolation: signed-out
// routes through sign-in first (FR-702), preserving the whitelisted return intent — never a
// checkout call for an anonymous caller.

const { navigateMock, createCheckoutMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  createCheckoutMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/shared/api/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api/generated")>();
  return {
    ...actual,
    createCheckoutApiV1BillingCheckoutPost: (...a: unknown[]) => createCheckoutMock(...a),
  };
});

import { CheckoutInPeriod } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { BillingCta } from "./billing-cta";

const t = messages.billing;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("BillingCta — signed-out routes through sign-in first (FR-702)", () => {
  it("routes to /sign-in carrying the return intent; never calls checkout", () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    render(<BillingCta period={CheckoutInPeriod.annual} signInRedirect="/conta" />);

    fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/sign-in",
      search: { redirect: "/conta" },
    });
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });
});

describe("BillingCta — signed-in starts a real checkout (US2)", () => {
  it("calls the checkout client with the given period and hands off via window.location", async () => {
    useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
    createCheckoutMock.mockResolvedValue({
      status: 200,
      data: { initPoint: "https://mp.example/checkout/x" },
    });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    render(<BillingCta period={CheckoutInPeriod.monthly} />);
    fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));

    await waitFor(() => expect(createCheckoutMock).toHaveBeenCalledWith({ period: "monthly" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://mp.example/checkout/x"));
    vi.unstubAllGlobals();
  });
});
