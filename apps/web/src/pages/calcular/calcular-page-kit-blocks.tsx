import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { freezeBomResult, type FrozenProvenance } from "@/entities/history/frozen-payload";
import { RecordSnapshotButton } from "@/features/history/record-snapshot-sheet";
import { type CatalogContext } from "@/features/calculator/calculator-model";
import {
    computeScenarioKitChannels,
    discardedFieldNotice,
} from "@/features/calculator/scenario-bridge";
import { Alert } from "@/shared/ui";

// 019/Polish — moved verbatim out of calcular-page.tsx (T036/US7 blocks), behavior unchanged.

/**
 * 016/T036 — the KIT twin of the scalar `discardedNotice` above: `computeScenarioKitChannels`
 * already strips any retired leaf line-by-line (never `ok:false` for that reason alone) and rolls
 * the discard up ONCE, deduped, across every line. Named out of the render's IIFE (019/Polish),
 * behavior unchanged.
 */
export function KitDiscardedNotice({
    config,
    ctx,
}: {
    config: ScenarioConfig;
    ctx: CatalogContext;
}) {
    const notice = discardedFieldNotice(computeScenarioKitChannels(config, ctx)?.discarded ?? []);
    return notice ? <Alert tone="info">{notice}</Alert> : null;
}

/**
 * 010/T036 (E5, PR-C, US7) — the KIT-basis twin of the SINGLE record button above, freezing
 * `computeScenarioKitChannels`'s OWN rollup (the exact numbers `KitBasisSummary` renders) via
 * `freezeBomResult` — the SAME E4 freeze function `bom-page.tsx`'s kit composer already uses (US1,
 * no new snapshot machinery). Renders nothing when the rollup has no priceable line yet (mirrors the
 * kit composer's own `disabled={frozenKitLines.length === 0}`, but as an absence rather than a dead
 * disabled state, since `RecordSnapshotButton` itself decides visibility on entitlement).
 */
export function KitScenarioRecordButton({
    loadedScenario,
    ctx,
}: {
    loadedScenario: { id: string; name: string; config: ScenarioConfig };
    ctx: CatalogContext;
}) {
    const rollup = computeScenarioKitChannels(loadedScenario.config, ctx);
    if (!rollup?.bom) return null;
    const bom = rollup.bom;

    const provenance: FrozenProvenance = {
        kind: "SCENARIO",
        id: loadedScenario.id,
        name: loadedScenario.name,
    };

    return (
        <div className="flex justify-center">
            <RecordSnapshotButton
                source={{
                    kind: "KIT",
                    // catalogVersion mirrors the kit composer's own rule (I2/Option A): every line shares the
                    // same catalog, so the first non-null line version is the kit's; `null` when every line
                    // priced with manual fees only.
                    freeze: () =>
                        freezeBomResult(
                            rollup.frozenLines,
                            bom,
                            provenance,
                            rollup.frozenLines.find((l) => l.input.catalogVersion != null)?.input
                                .catalogVersion ?? null,
                        ),
                }}
            />
        </div>
    );
}
