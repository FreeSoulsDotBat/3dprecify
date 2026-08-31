import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { premiumGate } from "./premium-gate";

// 019/PR-B (T036, research §E-1) — a união de CINCO estados que as quatro telas premium leem.
//
// A função é PURA e recebe FORMAS ESTRUTURAIS (`{status}`), no molde do `plan-view.ts` do E6: ela
// não sabe de itens ("lapsed-com-itens" é composição da TELA a partir de `list.items.length`), não
// sabe de rede e não importa nada de `entities`/`features` — é o que permite `shared/billing`
// (o vazio didático, o formulário inerte) consumi-la sem violar a fronteira FSD-Lite.
//
// O que ela NUNCA faz: presumir. Sem resposta do servidor (nem fresca, nem lembrada) o estado é
// `unknown` — nem "presume grátis" (mostraria o vazio didático a quem paga) nem "presume premium"
// (mostraria um Salvar vivo a quem o servidor vai recusar). O precedente é o `PlanState` do E6.

describe("premiumGate — a união de cinco estados (T036)", () => {
    const authed = { status: "authenticated" } as const;

    it("logado + {status:'none'} → never-subscribed", () => {
        expect(premiumGate({ status: "none" }, authed)).toBe("never-subscribed");
    });

    it("logado + {status:'lapsed'} → lapsed (o ledger decide, nunca uma heurística de tela)", () => {
        expect(premiumGate({ status: "lapsed" }, authed)).toBe("lapsed");
    });

    it("logado + {status:'active'} → active", () => {
        expect(premiumGate({ status: "active" }, authed)).toBe("active");
    });

    it("sessão não autenticada → signed-out, QUALQUER que seja o entitlement (E-5)", () => {
        for (const ent of [
            undefined,
            { status: "none" },
            { status: "active" },
            { status: "lapsed" },
        ] as const) {
            expect(premiumGate(ent, { status: "anonymous" })).toBe("signed-out");
            expect(premiumGate(ent, { status: "not-configured" })).toBe("signed-out");
        }
    });

    it("logado sem resposta do servidor (ausente/erro) → unknown — nunca presume", () => {
        expect(premiumGate(undefined, authed)).toBe("unknown");
        expect(premiumGate(null, authed)).toBe("unknown");
    });

    it("sessão ainda carregando → unknown (não é 'deslogado': ainda não se sabe)", () => {
        expect(premiumGate({ status: "active" }, { status: "loading" })).toBe("unknown");
    });

    it("resposta STALE do cache devolve o status LEMBRADO (ADR-0018 §9) — stale nunca promove none→active", () => {
        // O hook `useEntitlement()` entrega em `data` o que o servidor disse por último (fresco ou
        // lembrado do IndexedDB uid-scoped). A função recebe esse `data`: um `none` lembrado continua
        // `never-subscribed`; a ausência de resposta continua `unknown`. Não existe caminho em que um
        // valor lembrado vire MAIS permissivo do que o servidor disse.
        expect(premiumGate({ status: "none" }, authed)).toBe("never-subscribed");
        expect(premiumGate({ status: "active" }, authed)).toBe("active");
        // Um status que o servidor não emite não é "um plano que não reconhecemos" — é NÃO-RESPOSTA.
        expect(premiumGate({ status: "premium-forever" } as never, authed)).toBe("unknown");
    });
});

describe("premiumGate — guarda de grafo (molde tf-class-uniqueness)", () => {
    it("o módulo não importa `@/entities` nem `@/features` (shared → shared, só)", () => {
        const src = readFileSync(join(__dirname, "premium-gate.ts"), "utf8");
        const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
        for (const spec of imports) {
            expect(spec, `import proibido em premium-gate.ts: ${spec}`).not.toMatch(
                /^@\/(entities|features|pages|widgets|app)\b/,
            );
        }
    });
});
