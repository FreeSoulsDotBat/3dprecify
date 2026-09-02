import type { BomLineResult } from "@3dprecify/pricing-core";

import type { CalcOutcome } from "@/features/calculator/calculator-model";
import { BomLineCard } from "@/features/bom/bom-line-card";
import type { ProductOut } from "@/shared/api/generated";
import { Button, Field, Icon, TextField } from "@/shared/ui";
import { BomLineEditor } from "@/widgets/bom-line-editor/bom-line-editor";

import { defaultPieceName, type KitSaveLine, savesAsReference } from "./kit-save";
import { messages } from "@/shared/i18n/messages.pt-br";
import type { LineState } from "./bom-page";

const t = messages.bom;

// 019/Polish — the left column of `tf-kits-grid`, moved verbatim out of `bom-page.tsx`'s render
// (no behavior change) once the page itself passed ~450 lines after the earlier extractions.

export function BomLinesColumn({
    lines,
    outcomes,
    lineResults,
    parseQuantity,
    expandedId,
    setExpandedId,
    updateLine,
    onRemoveLine,
    products,
    bindProduct,
    saveLines,
    kitName,
    addLine,
}: {
    lines: LineState[];
    outcomes: CalcOutcome[];
    lineResults: (BomLineResult | null)[];
    parseQuantity: (raw: string) => number | null;
    expandedId: number | null;
    setExpandedId: (id: number | null) => void;
    updateLine: (id: number, patch: Partial<LineState>) => void;
    onRemoveLine: (id: number) => void;
    products: ProductOut[];
    bindProduct: (id: number, productId: string) => void;
    saveLines: KitSaveLine[];
    kitName: string;
    addLine: () => void;
}) {
    return (
        <div className="tf-kits-grid__lines">
            {lines.map((line, i) => {
                const qty = parseQuantity(line.quantityRaw);
                const invalid = qty === null || !outcomes[i].ok;
                return (
                    <BomLineCard
                        key={line.id}
                        index={i + 1}
                        name={line.productName}
                        quantityRaw={line.quantityRaw}
                        onQuantityChange={(raw) => updateLine(line.id, { quantityRaw: raw })}
                        expanded={expandedId === line.id}
                        onToggle={() => setExpandedId(expandedId === line.id ? null : line.id)}
                        onRemove={() => onRemoveLine(line.id)}
                        lineResult={lineResults[i]}
                        invalid={invalid}
                        // Caption only while the degraded line is still Manual — rebinding a saved product
                        // (productId set) resolves it live again and retires the caption (ux §1.2-D).
                        degraded={line.degraded && line.productId === ""}
                    >
                        <BomLineEditor
                            key={`${line.id}:${line.productId}`}
                            values={line.values}
                            onValuesChange={(values) =>
                                updateLine(line.id, {
                                    values,
                                    adjusted: line.productId !== "",
                                })
                            }
                            products={products}
                            productId={line.productId}
                            onBindProduct={(productId) => bindProduct(line.id, productId)}
                            adjusted={line.adjusted}
                        />
                        {/* Any line that does NOT save as a live reference becomes a catalog piece on
                    save (K4), so it needs a name — and the seller sees that before it happens,
                    never as a surprise row appearing in Produtos. */}
                        {!savesAsReference(saveLines[i]) && (
                            <div className="flex flex-col gap-1 pt-2">
                                {line.adjusted && line.productId !== "" && (
                                    <p className="text-xs text-[var(--text-muted)]">
                                        {t.adjustedBecomesPiece}
                                    </p>
                                )}
                                <Field label={t.pieceName}>
                                    {(p) => (
                                        <TextField
                                            {...p}
                                            type="text"
                                            placeholder={defaultPieceName(i, kitName)}
                                            value={line.pieceNameRaw}
                                            onChange={(e) =>
                                                updateLine(line.id, {
                                                    pieceNameRaw: e.target.value,
                                                })
                                            }
                                        />
                                    )}
                                </Field>
                            </div>
                        )}
                    </BomLineCard>
                );
            })}

            <Button variant="secondary" onClick={addLine}>
                <Icon name="plus" size={16} aria-hidden /> {t.addLine}
            </Button>
        </div>
    );
}
