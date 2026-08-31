// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Alert } from "./alert";

// 019/PR-A T013 (contracts/ui-porte.md §C0) — as variantes do selo de procedência: `compact`,
// `action`, `onDismiss`, `tone="warning"`. Geometria (alvo 44×44 do `__close` por pseudo-elemento,
// altura do alerta de uma linha que NÃO cresce) é invisível ao jsdom — fica para a T016/T022
// (e2e `a11y-targets-contrast` / `overflow-geometria`); aqui só a ESTRUTURA é asserida.

afterEach(cleanup);

describe("Alert — compact (selo de procedência)", () => {
    it("compact aplica tf-alert--compact", () => {
        render(
            <Alert compact title="Comissão">
                Tabela de comissões
            </Alert>,
        );
        expect(screen.getByRole("status")).toHaveClass("tf-alert--compact");
    });

    it("action renderiza tf-alert__action com o nó recebido", () => {
        render(
            <Alert compact action={<a href="#fonte">Ver fonte</a>}>
                Texto
            </Alert>,
        );
        const action = screen.getByRole("link", { name: "Ver fonte" });
        expect(action).toHaveClass("tf-alert__action");
    });

    it("onDismiss renderiza tf-alert__close com nome acessível Dispensar e chama o callback", async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        render(
            <Alert compact onDismiss={onDismiss}>
                Texto
            </Alert>,
        );
        const close = screen.getByRole("button", { name: "Dispensar" });
        expect(close).toHaveClass("tf-alert__close");
        await user.click(close);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("sem onDismiss não há botão de dispensa", () => {
        render(<Alert compact>Texto</Alert>);
        expect(screen.queryByRole("button", { name: "Dispensar" })).not.toBeInTheDocument();
    });

    it('tone="warning" aplica tf-alert--warning e mantém role="status"', () => {
        render(<Alert tone="warning">O preço sugerido ficou abaixo do custo declarado.</Alert>);
        const alert = screen.getByRole("status");
        expect(alert).toHaveClass("tf-alert--warning");
    });

    // 019/PR-C (prancheta 13b·3, decisão do dono 28/08) — a prop `icon` sobrepõe o ícone do `tone`;
    // sem a prop, nada muda (o `info` padrão de `neutral` continua). Identificado pelo glifo mesmo —
    // o DS não marca `data-icon`, então a assinatura é um `<path>`/`<circle>` exclusivo de cada ícone.
    it('icon sobrepõe o ícone do tone (ex.: tone="neutral" + icon="wifi")', () => {
        const { container } = render(
            <Alert tone="neutral" icon="wifi">
                Referência embutida no dispositivo — funciona sem internet.
            </Alert>,
        );
        const glyph = container.querySelector(".tf-alert__icon");
        expect(glyph?.innerHTML).toContain('d="M12 20h.01"'); // exclusivo do glifo wifi
        expect(glyph?.innerHTML).not.toContain('cx="12" cy="12" r="10"'); // o círculo do "info" padrão
    });

    it("sem icon, o tone continua escolhendo o glifo padrão (neutral ⇒ info)", () => {
        const { container } = render(<Alert tone="neutral">Texto</Alert>);
        const glyph = container.querySelector(".tf-alert__icon");
        expect(glyph?.innerHTML).toContain('cx="12" cy="12" r="10"');
    });
});
