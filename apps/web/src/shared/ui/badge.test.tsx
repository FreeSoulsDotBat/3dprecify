// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "./badge";

// 019/PR-A T014 (contracts/ui-porte.md §C0) — só o tom `warning` é novo; `success`/`danger` já
// existem (018) e não são recriados aqui.

afterEach(cleanup);

describe("Badge — tone=warning", () => {
  it('tone="warning" aplica tf-badge--warning', () => {
    render(<Badge tone="warning">850 g</Badge>);
    expect(screen.getByText("850 g")).toHaveClass("tf-badge--warning");
  });
});
