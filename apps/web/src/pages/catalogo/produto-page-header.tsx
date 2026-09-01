import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { formatDayMonthPtBr } from "@/shared/lib/format-date";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, PriceHero } from "@/shared/ui";

// 019/Polish — moved verbatim out of produto-page.tsx: `productHeaderState` (pure) + the header
// block that reads it (PriceHero + o alerta de "parado" + as duas escolhas do 16b·2 + o aviso K3).
// No state/effect moved — every handler here is a prop closed over by the caller.

const catalogo = messages.catalog;
const pf = messages.productForm;

/** 019/PR-D (T076, prancheta 17g) — os quatro estados do cabeçalho: fixado > parado > mudou > sem
 *  mudança (a MESMA ordem do 16f/17c: fixado é escolha, parado é impedimento, os dois nunca se
 *  confundem). Extraída das três variáveis `headerLabel`/`headerValue`/`headerCaption` que repetiam
 *  a mesma árvore de decisão — os ternários aqui são os MESMOS, sem simplificação semântica. */
export function productHeaderState({
    isFixed,
    needsAttention,
    fixedPriceValue,
    savedObservation,
    todayPrice,
    priceChanged,
    sellerFixedAt,
}: {
    isFixed: boolean;
    needsAttention: boolean;
    fixedPriceValue: number | undefined;
    savedObservation: { observedPrice: number; observedAt: string } | undefined;
    todayPrice: number | undefined;
    priceChanged: boolean;
    sellerFixedAt: string | null | undefined;
}): { label: string; value: number | undefined; caption: string | undefined } {
    const label = isFixed
        ? catalogo.fixedByYou
        : needsAttention
          ? catalogo.stoppedPrice
          : catalogo.suggestedRetail;
    const value = isFixed
        ? fixedPriceValue
        : needsAttention
          ? savedObservation?.observedPrice
          : todayPrice;
    const caption =
        isFixed && sellerFixedAt && todayPrice !== undefined
            ? catalogo.capFixed
                  .replace("{data}", formatDayMonthPtBr(sellerFixedAt))
                  .replace("{hoje}", formatBRL(todayPrice))
            : needsAttention && savedObservation
              ? catalogo.capStopped.replace(
                    "{data}",
                    formatDayMonthPtBr(savedObservation.observedAt),
                )
              : priceChanged && savedObservation
                ? catalogo.capRecalculated.replace(
                      "{valor}",
                      formatBRL(savedObservation.observedPrice),
                  )
                : !isFixed && !needsAttention && savedObservation
                  ? catalogo.capUnchanged.replace(
                        "{data}",
                        formatDayMonthPtBr(savedObservation.observedAt),
                    )
                  : undefined;
    return { label, value, caption };
}

export function ProductPriceHeader({
    editing,
    headerLabel,
    headerValue,
    headerCaption,
    overFixed,
    todayPrice,
    fixedPriceValue,
    active,
    onUnfix,
    unfixLoading,
    priceChanged,
    savedObservation,
    onKeepPrice,
    onAcceptNewPrice,
    keepPriceLoading,
    needsAttention,
}: {
    editing: unknown;
    headerLabel: string;
    headerValue: number | undefined;
    headerCaption: string | undefined;
    overFixed: boolean;
    todayPrice: number | undefined;
    fixedPriceValue: number | undefined;
    active: boolean;
    onUnfix: () => void;
    unfixLoading: boolean;
    priceChanged: boolean;
    savedObservation: { observedPrice: number; observedAt: string } | undefined;
    onKeepPrice: () => void;
    onAcceptNewPrice: () => void;
    keepPriceLoading: boolean;
    needsAttention: boolean;
}) {
    return (
        <>
            {/* 019/PR-D (T076, prancheta 17g) — a tira do cabeçalho: um preço grande e uma legenda que
          muda de conteúdo, nunca de posição. Só para um produto SALVO — um novo/não-salvo não tem
          observação nem fixação para descrever ainda. */}
            {editing && headerValue !== undefined && (
                <PriceHero
                    label={headerLabel}
                    value={headerValue}
                    caption={headerCaption}
                    size="md"
                />
            )}

            {/* 17c — custo hoje > fixado: a spec (US5 AC3) vence o desenho (que pinta info) — este é o
          `tone="warning"` que a spec pede. Escrever (desfixar) só existe quando `active`. */}
            {overFixed && todayPrice !== undefined && (
                <Alert
                    tone="warning"
                    data-testid="product-fixed-over-alert"
                    action={
                        active ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onUnfix}
                                loading={unfixLoading}
                            >
                                {catalogo.unfix}
                            </Button>
                        ) : undefined
                    }
                >
                    {catalogo.fixedOverNote
                        .replace("{hoje}", formatBRL(todayPrice))
                        .replace("{diff}", formatBRL(todayPrice - fixedPriceValue!))}
                </Alert>
            )}

            {/* 16b·2 — quando o preço mudou desde a última observação e ninguém fixou nada ainda: as
          duas escolhas, lado a lado. */}
            {active && priceChanged && savedObservation && (
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={onKeepPrice} loading={keepPriceLoading}>
                        {catalogo.keepPrice.replace(
                            "{valor}",
                            formatBRL(savedObservation.observedPrice),
                        )}
                    </Button>
                    <Button onClick={onAcceptNewPrice}>{catalogo.acceptNewPrice}</Button>
                </div>
            )}

            {/* K3: ONE calm, actionable state — the product has no live filament/printer behind it,
          whether a kit save materialized it that way or a deletion severed the links. It says
          what is true (nothing linked, values kept) and never invents a removal it cannot know
          happened. Clears live, the moment both pickers are set (SC-412). */}
            {needsAttention && (
                <Alert tone="info" title={messages.catalog.needsAttention}>
                    {pf.manualValuesKept}
                </Alert>
            )}
        </>
    );
}
