// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumTeaser, type PremiumFeatureId } from "./premium-teaser";

// 016/US1 (T002, arquitetura-016 §E) — the structural homologation (SC-901): the five
// `PremiumFeatureId`s render the SAME TREE (order of elements), never compared by text. A
// caller may only ever change COPY (via the `messages.premiumTeaser` registry, tested
// elsewhere) — never structure. The 6th case below is deliberately malformed to prove the
// comparator is non-vacuous: it must FAIL to equal the golden order.

const FEATURES: readonly PremiumFeatureId[] = [
    "SCENARIOS",
    "CATALOG",
    "CATALOG_PICKER",
    "KITS",
    "QUOTES",
];

const TESTIDS = [
    "premium-teaser-title",
    "premium-teaser-subtitle",
    // TeaserUpgrade itself carries no data-testid (E6, not touched here) — its wrapper class is the
    // stable seam this test can key off without reaching into its internals.
    "tf-teaser-upgrade",
    "premium-teaser-caption",
] as const;

/** The ORDERED list of structural markers actually present in the rendered tree — DOM order,
 *  not source order (React could theoretically reorder; the DOM is the ground truth a screen
 *  reader/visual layout would also see). */
function structuralOrder(container: HTMLElement): string[] {
    const order: string[] = [];
    const walk = (node: Element) => {
        if (
            node.getAttribute("data-testid") &&
            TESTIDS.includes(node.getAttribute("data-testid") as never)
        ) {
            order.push(node.getAttribute("data-testid")!);
        } else if (node.classList.contains("tf-teaser-upgrade")) {
            order.push("tf-teaser-upgrade");
        }
        for (const child of Array.from(node.children)) walk(child);
    };
    walk(container);
    return order;
}

afterEach(() => cleanup());

describe("PremiumTeaser — structural homologation (SC-901)", () => {
    it.each(FEATURES)("feature=%s renders the four elements in the fixed order", (feature) => {
        const { container } = render(<PremiumTeaser feature={feature} signedOut={false} />);
        expect(structuralOrder(container)).toEqual([
            "premium-teaser-title",
            "premium-teaser-subtitle",
            "tf-teaser-upgrade",
            "premium-teaser-caption",
        ]);
    });

    it("the five features produce the IDENTICAL structural order (not just each individually correct)", () => {
        const orders = FEATURES.map((feature) => {
            const { container, unmount } = render(
                <PremiumTeaser feature={feature} signedOut={false} />,
            );
            const order = structuralOrder(container);
            unmount();
            return order;
        });
        const [golden, ...rest] = orders;
        for (const order of rest) expect(order).toEqual(golden);
    });

    it("signedOut does not change the structure, only TeaserUpgrade's own internal href", () => {
        const { container: signedIn } = render(
            <PremiumTeaser feature="CATALOG" signedOut={false} />,
        );
        const orderSignedIn = structuralOrder(signedIn);
        cleanup();
        const { container: signedOut } = render(<PremiumTeaser feature="CATALOG" signedOut />);
        expect(structuralOrder(signedOut)).toEqual(orderSignedIn);
    });

    it("the ONE named exception (disabledAffordance) appends AFTER the fixed four, never reorders them", () => {
        const { container } = render(
            <PremiumTeaser
                feature="CATALOG_PICKER"
                signedOut={false}
                disabledAffordance={<button disabled>Usar do catálogo</button>}
            />,
        );
        const order = structuralOrder(container);
        expect(order.slice(0, 4)).toEqual([
            "premium-teaser-title",
            "premium-teaser-subtitle",
            "tf-teaser-upgrade",
            "premium-teaser-caption",
        ]);
        expect(
            container.querySelector('[data-testid="premium-teaser-disabled-affordance"]'),
        ).not.toBeNull();
    });

    // Non-vacuity (Constitution III): a comparator that always passes proves nothing. This renders
    // a DELIBERATELY malformed tree (caption before subtitle — the exact "elemento fora de ordem"
    // the task calls for) using the SAME testids, and asserts the comparator CATCHES it.
    it("[non-vacuity] a mutated (out-of-order) tree does NOT equal the golden structure", () => {
        function MalformedTeaser() {
            return (
                <div>
                    <h2 data-testid="premium-teaser-title">Título</h2>
                    {/* caption swapped ahead of subtitle — the adulterated 6th case */}
                    <p data-testid="premium-teaser-caption">Legenda</p>
                    <div className="tf-teaser-upgrade" />
                    <p data-testid="premium-teaser-subtitle">Subtítulo</p>
                </div>
            );
        }
        const { container } = render(<MalformedTeaser />);
        expect(structuralOrder(container)).not.toEqual([
            "premium-teaser-title",
            "premium-teaser-subtitle",
            "tf-teaser-upgrade",
            "premium-teaser-caption",
        ]);
    });
});
