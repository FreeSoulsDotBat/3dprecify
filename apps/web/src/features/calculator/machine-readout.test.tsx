// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { MachineCostFields } from "@/features/calculator/calculator-form";
import {
    calculatorResolver,
    type CalcFormValues,
    defaultCalcValues,
} from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { installMatchMedia, type MatchMediaHandle } from "@/shared/lib/match-media.test-helper";

// 019/PR-C (T051, prancheta "Calculadora - Bloco da Maquina") — o readout do custo/hora, o par
// segmented "Estimar · Ajustar" e a confirmação inline de troca (15e). Vermelho primeiro: nada
// disto existe no início desta fatia (o par era dois `Button`, o custo/hora era uma legenda solta
// SEM a divisão que o produziu, e "Usar estimativa por ritmo" sobrescrevia sem perguntar).

beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});
afterEach(() => cleanup());

const t = messages.calculator;

function Harness({ machineLifetimeHours = "3600" }: { machineLifetimeHours?: string } = {}) {
    const { control } = useForm<CalcFormValues>({
        defaultValues: { ...defaultCalcValues, machineLifetimeHours },
        resolver: calculatorResolver,
        mode: "onChange",
    });
    return <MachineCostFields control={control} />;
}

describe("T051 — o readout do custo/hora existe nos DOIS modos (15a/15b)", () => {
    it("modo estimar (seed 3.600 h) mostra 'de R$ 4.000,00 ÷ 3.600 h'", () => {
        render(<Harness />);
        const readout = screen.getByTestId("machine-readout");
        expect(readout).toHaveTextContent(t.machineCost.readoutLabel);
        expect(readout).toHaveTextContent("de R$ 4.000,00 ÷ 3.600 h");
    });

    it("modo ajustar (2.000 h — não bate ritmo × payback) TAMBÉM mostra o readout", () => {
        render(<Harness machineLifetimeHours="2000" />);
        // 2.000h não é produto de ritmo × payback ⇒ abre em ajustar sozinho (US8-AC4).
        expect(screen.getByRole("radio", { name: t.machineCost.adjust })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        const readout = screen.getByTestId("machine-readout");
        expect(readout).toHaveTextContent("de R$ 4.000,00 ÷ 2.000 h");
    });
});

describe("T051 — o par vira Segmented 'Estimar · Ajustar' (role=radiogroup, split)", () => {
    it("os dois papéis existem, um selecionado", () => {
        render(<Harness />);
        const group = screen.getByTestId("machine-mode");
        expect(group).toHaveAttribute("role", "radiogroup");
        expect(within(group).getByRole("radio", { name: t.machineCost.estimate })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        expect(within(group).getByRole("radio", { name: t.machineCost.adjust })).toHaveAttribute(
            "aria-checked",
            "false",
        );
    });
});

describe("T057 (prancheta 15f, decisão do dono 28/08) — 1024px move o segmented para a linha do título", () => {
    let mm: MatchMediaHandle | null = null;
    afterEach(() => {
        mm?.restore();
        mm = null;
    });

    it("abaixo de 1024px (mobile, sem matchMedia instalado): continua 'split', sem título 'A máquina'", () => {
        render(<Harness />);
        const group = screen.getByTestId("machine-mode");
        expect(group.className).toContain("tf-segmented--split");
        expect(group.className).not.toContain("tf-segmented--sm");
        expect(screen.queryByText("A máquina")).not.toBeInTheDocument();
    });

    it("a partir de 1024px: 'size=sm', SEM split, na linha do título 'A máquina'", () => {
        mm = installMatchMedia(1024);
        render(<Harness />);
        const group = screen.getByTestId("machine-mode");
        expect(group.className).toContain("tf-segmented--sm");
        expect(group.className).not.toContain("tf-segmented--split");
        // Mesma linha: o título e o grupo são irmãos, dentro do mesmo wrapper flex.
        const title = screen.getByText("A máquina");
        expect(title.parentElement).toBe(group.parentElement);
        // Ainda os dois papéis certos (radiogroup, um selecionado) — só a APARÊNCIA mudou.
        expect(within(group).getByRole("radio", { name: t.machineCost.estimate })).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });
});

describe("T051 — valor 0 da máquina: ressalva verbatim, sem divisão por zero (15d/15c)", () => {
    it("machineValue vazio ⇒ readout mostra a ressalva 'falta o valor da máquina'", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        const valueInput = screen.getByRole("textbox", { name: t.fields.machineValue });
        await user.clear(valueInput);
        await user.tab();
        const readout = screen.getByTestId("machine-readout");
        expect(readout).toHaveTextContent(t.machineCost.missingValueCaveat);
    });

    it("vida útil <= 0 (campo recusado) ⇒ o readout NÃO renderiza (não há divisão por zero)", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole("radio", { name: t.machineCost.adjust }));
        const hoursInput = screen.getByRole("textbox", { name: t.fields.machineLifetime });
        await user.clear(hoursInput);
        await user.type(hoursInput, "0");
        await user.tab();
        expect(screen.queryByTestId("machine-readout")).not.toBeInTheDocument();
    });

    // decisão do dono 28/08, prancheta 14b ("Erro e aviso juntos") — o campo dedicado da máquina
    // (fora de `ControlledField`, ver o comentário do próprio `MachineCostFields`) passa pelo MESMO
    // `useAvisoDeCampo`, então a recusa "vida útil deve ser maior que zero" também troca o aviso pela
    // LIÇÃO — nunca "Confira a vida útil: 0 horas…" com o fecho trocado.
    it("vida útil = 0 ⇒ erro + a LIÇÃO (sem 'Confira', sem 'Entendi'); o readout continua ausente", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole("radio", { name: t.machineCost.adjust }));
        const hoursInput = screen.getByRole("textbox", { name: t.fields.machineLifetime });
        await user.clear(hoursInput);
        await user.type(hoursInput, "0");
        await user.tab();

        expect(screen.queryByTestId("machine-readout")).not.toBeInTheDocument();
        const aviso = await screen.findByTestId("aviso-machineLifetimeHours");
        expect(aviso).toHaveTextContent(t.plausibility.lesson.machineLifetimeHours);
        expect(aviso).not.toHaveTextContent("Confira a vida útil");
        expect(
            within(aviso).queryByRole("button", { name: t.plausibility.understood }),
        ).not.toBeInTheDocument();
    });
});

describe("T051 — a confirmação inline ao voltar para 'Estimar' com horas fora de todo ritmo (15e)", () => {
    it("'Ajustar' NUNCA pede confirmação", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole("radio", { name: t.machineCost.adjust }));
        expect(screen.queryByTestId("machine-confirm")).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: t.machineCost.adjust })).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });

    it("tocar 'Estimar' vindo de 'Ajustar' com 2.000h (fora de todo ritmo) pede confirmação — nada é sobrescrito antes de 'Usar'", async () => {
        const user = userEvent.setup();
        render(<Harness machineLifetimeHours="2000" />);
        // Já abre em ajustar (2.000h não bate ritmo algum).
        await user.click(screen.getByRole("radio", { name: t.machineCost.estimate }));

        const confirm = await screen.findByTestId("machine-confirm");
        expect(confirm).toHaveAttribute("role", "alertdialog");
        expect(confirm).toHaveTextContent(
            t.machineCost.confirmTitle.replace("{atual}", "2.000").replace("{novo}", "3.600"),
        );
        // O segmented continua em "Ajustar" enquanto a confirmação está aberta (15e).
        expect(screen.getByRole("radio", { name: t.machineCost.adjust })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        // Nada foi sobrescrito ainda: a hora crua continua 2.000.
        // A vida útil não é campo `currency` — sem máscara de milhar no blur; permanece "2000".
        expect(screen.getByRole("textbox", { name: t.fields.machineLifetime })).toHaveValue("2000");

        await user.click(within(confirm).getByRole("button", { name: /Usar 3\.600 h/ }));

        expect(screen.queryByTestId("machine-confirm")).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: t.machineCost.estimate })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        expect(screen.getByTestId("machine-readout")).toHaveTextContent("de R$ 4.000,00 ÷ 3.600 h");
    });

    it("'Manter {atual} h' fecha a confirmação e devolve o segmented para 'Ajustar' — o número não muda", async () => {
        const user = userEvent.setup();
        render(<Harness machineLifetimeHours="2000" />);
        await user.click(screen.getByRole("radio", { name: t.machineCost.estimate }));
        const confirm = await screen.findByTestId("machine-confirm");

        await user.click(within(confirm).getByRole("button", { name: /Manter 2\.000 h/ }));

        expect(screen.queryByTestId("machine-confirm")).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: t.machineCost.adjust })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        // A vida útil não é campo `currency` — sem máscara de milhar no blur; permanece "2000".
        expect(screen.getByRole("textbox", { name: t.fields.machineLifetime })).toHaveValue("2000");
    });

    it("horas digitadas em ajustar que JÁ batem ritmo × payback trocam para 'Estimar' sem confirmação", async () => {
        const user = userEvent.setup();
        // Abre em ajustar (2.000h não bate ritmo algum); digitar 3.600h (ritmo 1 × 3 anos) na mão e
        // tocar "Estimar" não pede nada — nada seria sobrescrito, o número já É o do ritmo.
        render(<Harness machineLifetimeHours="2000" />);
        const hoursInput = screen.getByRole("textbox", { name: t.fields.machineLifetime });
        await user.clear(hoursInput);
        await user.type(hoursInput, "3600");
        await user.tab();

        await user.click(screen.getByRole("radio", { name: t.machineCost.estimate }));
        expect(screen.queryByTestId("machine-confirm")).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: t.machineCost.estimate })).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });
});
