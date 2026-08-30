// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { CostsSection, FieldGroup } from "@/features/calculator/calculator-form";
import {
  calculatorResolver,
  type CalcFormValues,
  COST_FIELDS,
  defaultCalcValues,
  LABOR_AND_FINISH_FIELDS,
} from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";

// 016/US6 (FR-908, SC-904) — the 9 fields explain themselves. Radix Popover ships no
// ResizeObserver in jsdom (see shared/ui/info-tip.test.tsx) — same no-op stub here.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => cleanup());

const t = messages.calculator;

/** A minimal harness mounting the two sections that carry all 9 tooltip-bearing fields. 016/PR-C
 *  homologação (B1) — the seed's `machineLifetimeHours` is now 3600 (a ritmo × payback product,
 *  "quase todo dia" × 3 anos), so the form opens in RITMO mode and the "vida útil" tooltip (which
 *  lives on the "ajustar" raw-hours field) is NOT visible until "Ajustar horas direto" is clicked —
 *  covered by its own test below, not the always-visible 8. */
function Harness() {
  const { control } = useForm<CalcFormValues>({
    defaultValues: defaultCalcValues,
    resolver: calculatorResolver,
    mode: "onChange",
  });
  return (
    <>
      <CostsSection control={control} fields={COST_FIELDS} />
      <FieldGroup
        control={control}
        title={t.sections.labor}
        info={t.sectionInfo.labor}
        fields={LABOR_AND_FINISH_FIELDS}
      />
    </>
  );
}

const EIGHT_ALWAYS_VISIBLE_TIPS = [
  t.fieldTips.avgPower,
  t.fieldTips.tariff,
  t.fieldTips.maintenance,
  t.fieldTips.failure,
  t.fieldTips.finishTime,
  t.fieldTips.finishRate,
  t.fieldTips.laborHours,
  t.fieldTips.laborRate,
];

describe("US6 — os 9 campos se explicam sozinhos (FR-908, SC-904)", () => {
  it("os 8 tooltips sempre visíveis têm um trigger acessível pelo próprio rótulo (aria-label)", () => {
    render(<Harness />);
    for (const tip of EIGHT_ALWAYS_VISIBLE_TIPS) {
      expect(screen.getByRole("button", { name: tip.label })).toBeInTheDocument();
    }
  });

  it("o conteúdo do tooltip abre por clique/toque e é o texto exato do registro", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: t.fieldTips.tariff.label });
    expect(screen.queryByText(t.fieldTips.tariff.body)).not.toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByText(t.fieldTips.tariff.body)).toBeInTheDocument();
  });

  it("o tooltip é acionável por teclado (foco + Enter), sem clique nenhum", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: t.fieldTips.failure.label });
    trigger.focus();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(t.fieldTips.failure.body)).toBeInTheDocument();
  });

  it("o tooltip de 'vida útil da máquina' aparece ao entrar no modo ajustar (US8)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.queryByRole("button", { name: t.fieldTips.machineLifetime.label }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: t.machineCost.ajustar }));
    expect(
      screen.getByRole("button", { name: t.fieldTips.machineLifetime.label }),
    ).toBeInTheDocument();
  });

  it("abrir um tooltip não altera NENHUM valor do formulário (US6-AC3)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: t.fieldTips.avgPower.label }));
    await screen.findByText(t.fieldTips.avgPower.body);
    // O consumo médio continua com o valor default do seed — o tooltip nunca escreveu no campo.
    expect(screen.getByDisplayValue(defaultCalcValues.avgPowerKw)).toBeInTheDocument();
  });
});
