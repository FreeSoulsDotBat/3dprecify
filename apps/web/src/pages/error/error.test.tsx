// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";

import { ErrorPage } from "./error-page";

afterEach(() => cleanup());

// The support-code line ("Código de suporte: <id>") — read the label element via its own
// direct text, then assert the full text content carries the id (works whether the id is a
// sibling text node or wrapped in a styling span).
function supportCodeText(): string {
  const line = screen.getByText(new RegExp(messages.error.supportCode));
  return line.textContent ?? "";
}

function supportCodeId(): string {
  const text = supportCodeText();
  const marker = messages.error.supportCode;
  return text.slice(text.indexOf(marker) + marker.length).trim();
}

describe("ErrorPage (T050 / US4 — SS-3)", () => {
  it("renders the error title, body and a reload action", () => {
    render(<ErrorPage error={new Error("boom")} />);
    expect(screen.getByText(messages.error.title)).toBeInTheDocument();
    expect(screen.getByText(messages.error.body)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: messages.error.reload })).toBeInTheDocument();
  });

  it("shows the support code from the ApiError correlationId (API failure)", () => {
    const error = new ApiError({
      status: 500,
      code: "INTERNAL",
      message: "kaboom",
      correlationId: "corr-abc-123",
    });
    render(<ErrorPage error={error} />);
    expect(supportCodeText()).toContain("corr-abc-123");
  });

  it("falls back to a non-empty local support code for non-API errors", () => {
    render(<ErrorPage error={new Error("no correlation")} />);
    expect(supportCodeId().length).toBeGreaterThan(0);
  });

  it("keeps the same local support code across re-renders (generated once per error)", () => {
    const error = new Error("stable");
    const { rerender } = render(<ErrorPage error={error} />);
    const first = supportCodeId();
    rerender(<ErrorPage error={error} />);
    const second = supportCodeId();
    expect(second).toBe(first);
  });
});
