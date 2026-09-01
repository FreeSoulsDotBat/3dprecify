import { useRef, useState } from "react";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { useDuplicateScenario, useScenarios } from "@/entities/scenario/use-scenarios";
import { useEntitlement } from "@/entities/user/use-entitlement";
import type { ScenarioOut } from "@/shared/api/generated";
import { premiumGate, type PremiumGate } from "@/shared/billing/premium-gate";
import { VazioDidatico } from "@/shared/billing/vazio-didatico";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { useOnline } from "@/shared/lib/use-online";
import { useSessionStore } from "@/shared/session/session-store";
import {
    Alert,
    Button,
    Card,
    EmptyState,
    Field,
    Icon,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    Spinner,
    toast,
} from "@/shared/ui";

import { DeleteScenarioDialog, type DeleteScenarioDialogHandle } from "./delete-scenario-dialog";
import { RenameScenarioSheet, type RenameScenarioSheetHandle } from "./rename-scenario-sheet";
import { honestWriteError } from "@/shared/api/error-messages";

import "./scenario-list.css";

// ⚠ @doc DEC-016 — Sheet e não sub-rota: com `base:'./'` uma rota de 2 segmentos abre em
//   BRANCO no cold load. Em e2e, chega-se aqui por navegação de cliente, nunca `page.goto`.
// @doc DEC-017 — linha de ícones inline no lugar do menu "⋯": não há `DropdownMenu` no DS.

const t = messages.scenarios;

export interface ScenariosListSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenScenario: (
        config: ScenarioConfig,
        meta: { id: string; name: string; note: string | null },
    ) => void;
}

/** "há poucos minutos" / "há N min/h/dia(s)/semana(s)" — a MANAGEMENT convenience, never a
 *  date-as-claim (§0.2/§11-F6: the card states no date, only how long since it last changed). */
function relativeLabel(iso: string, now: number): string {
    const diffMin = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
    if (diffMin < 1) return t.relative.now;
    if (diffMin < 60) return t.relative.minutes.replace("{n}", String(diffMin));
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t.relative.hours.replace("{n}", String(diffH));
    const diffDay = Math.floor(diffH / 24);
    if (diffDay < 7) {
        return (diffDay === 1 ? t.relative.day : t.relative.days).replace("{n}", String(diffDay));
    }
    const diffWeek = Math.floor(diffDay / 7);
    return (diffWeek === 1 ? t.relative.week : t.relative.weeks).replace("{n}", String(diffWeek));
}

function ScenarioCard({
    item,
    onOpen,
    writesDisabled,
    writesReason,
    onRename,
    onDuplicate,
    onDeleteRequest,
}: {
    item: ScenarioOut;
    onOpen: () => void;
    writesDisabled: boolean;
    writesReason: string | undefined;
    onRename: (item: ScenarioOut) => void;
    onDuplicate: (item: ScenarioOut) => void;
    onDeleteRequest: (item: ScenarioOut) => void;
}) {
    const reasonId = `tf-scenario-reason-${item.id}`;
    return (
        <Card padding="sm" className="flex flex-col gap-1" data-testid="scenario-card">
            <button
                type="button"
                onClick={onOpen}
                className="flex w-full flex-col gap-1 text-left"
                aria-label={`${t.open} ${item.name}`}
            >
                {/* T030b: single-line ellipsis on the name (already truncate); the note gets an EXPLICIT
            ellipsis marker layered on the 2-line clamp — `line-clamp-2` alone hides overflow but
            leaves no visual cue that text was cut (the T018 nit). */}
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.note && (
                    <p className="tf-scenario-note line-clamp-2 text-sm text-[var(--text-muted)]">
                        {item.note}
                    </p>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                    {t.updatedRelative.replace(
                        "{quando}",
                        relativeLabel(item.updatedAt, Date.now()),
                    )}
                </p>
            </button>
            <div className="flex items-center justify-end gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={writesDisabled}
                    aria-describedby={writesDisabled && writesReason ? reasonId : undefined}
                    aria-label={`${t.rename} ${item.name}`}
                    onClick={() => onRename(item)}
                >
                    <Icon name="pencil" size={18} aria-hidden />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={writesDisabled}
                    aria-describedby={writesDisabled && writesReason ? reasonId : undefined}
                    aria-label={`${t.duplicate} ${item.name}`}
                    onClick={() => onDuplicate(item)}
                >
                    <Icon name="copy" size={18} aria-hidden />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={writesDisabled}
                    aria-describedby={writesDisabled && writesReason ? reasonId : undefined}
                    aria-label={`${t.delete} ${item.name}`}
                    onClick={() => onDeleteRequest(item)}
                >
                    <Icon name="trash-2" size={18} aria-hidden />
                </Button>
            </div>
            {writesDisabled && writesReason && (
                <p id={reasonId} className="text-right text-xs text-[var(--text-muted)]">
                    {writesReason}
                </p>
            )}
        </Card>
    );
}

// 019/PR-F (T092, US7) — extraída de `ScenarioListBody` (nome privado até aqui) para um export
// NOMEADO no MESMO arquivo: `pages/calcular/calcular-page.tsx` (T095) monta ESTA função direto na
// coluna larga ≥1280px, sem passar pelo `Sheet`/gaveta que `ScenariosListSheet` continua sendo
// (estreito). Mesmas props de sempre — `onOpenScenario`/`onClose`/`lapsed`/`gate` — nada mudou na
// forma, só a visibilidade do símbolo. `ScenariosListSheet` (abaixo) é o único chamador da gaveta;
// o hospedeiro largo é o outro.
export function ScenariosList({
    onOpenScenario,
    onClose,
    lapsed,
    gate,
    teaser = true,
}: {
    onOpenScenario: (item: ScenarioOut) => void;
    onClose: () => void;
    lapsed: boolean;
    /** 019/PR-B (T046/T112, prancheta 32c/32f) — o estado que a folha lê de `premiumGate(...)`. */
    gate: PremiumGate;
    /** 019/PR-F (T095, revisão do main loop) — `false` na coluna larga de `/calcular`: a página já
     *  carrega os seus DOIS convites por desenho (o teaser do picker e o gate do marketplace), e a
     *  coluna fica ao lado deles o tempo todo; um terceiro "Assinar Premium" colado ao primeiro é o
     *  duplo convite que a PR-B matou no desktop do Catálogo. Na gaveta (estreito) o convite do vazio
     *  continua sendo o ÚNICO da folha (FR-1906). */
    teaser?: boolean;
}) {
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 250);
    const { items, isLoading, isError, error, stale, refetch, loadMore, hasMore, isFetchingMore } =
        useScenarios({ q: debouncedQuery });

    const online = useOnline();
    const writesDisabled = lapsed || !online;
    const writesReason = lapsed
        ? t.writeLapsed
        : !online
          ? messages.apiError.offlineWrite
          : undefined;

    // 019/PR-B (T112) — a parede caiu (`showTeaser` saiu): "nunca teve"/deslogado agora MONTAM esta
    // folha como todo mundo, e é AQUI que a decisão mora. O fallback do 403 (`ENTITLEMENT_REQUIRED`)
    // cobre o caso raro em que `premiumGate` ainda não sabe dizer (ex.: entitlement sem resposta) mas
    // a PRÓPRIA lista já ouviu a recusa do servidor (o mesmo par que `use-history.ts`/T111 usa).
    const doorGate: PremiumGate =
        gate === "unknown" && error?.code === "ENTITLEMENT_REQUIRED" ? "never-subscribed" : gate;
    const showDoor = doorGate === "never-subscribed" || doorGate === "signed-out";

    const duplicate = useDuplicateScenario();

    // 019/Polish — Renomear/Excluir moved to `RenameScenarioSheet`/`DeleteScenarioDialog` (own
    // state, imperative `open(item)`); this component only holds the refs that reach them.
    const renameSheetRef = useRef<RenameScenarioSheetHandle>(null);
    const deleteDialogRef = useRef<DeleteScenarioDialogHandle>(null);

    const [duplicateError, setDuplicateError] = useState<string | undefined>(undefined);

    const handleDuplicate = async (item: ScenarioOut) => {
        setDuplicateError(undefined);
        try {
            const copy = await duplicate.mutateAsync(item.id);
            toast(t.duplicated, { tone: "success" }); // real 2xx only
            // ux §5: the copy loads immediately so the seller can tweak-and-compare right away.
            onOpenScenario(copy);
        } catch (err) {
            setDuplicateError(honestWriteError(err));
        }
    };

    // 019/PR-B (T046, prancheta 32c/32f) — o vazio didático É o conteúdo inteiro: sem busca, sem
    // spinner de lista — não há nada para buscar em uma conta que nunca salvou (ou não está logada).
    // O convite (`TeaserUpgrade`, dentro do `VazioDidatico`) é o ÚNICO desta folha (FR-1906).
    if (showDoor) {
        return (
            <VazioDidatico
                feature="scenarios"
                gate={doorGate}
                action={
                    <Button onClick={onClose}>{messages.premiumTeaser.makeACalculation}</Button>
                }
                teaser={teaser}
            />
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center gap-2 py-8">
                <Spinner />
            </div>
        );
    }

    // A cold failure (nothing cached, nothing served) — never an error wall over data already held.
    if (isError) {
        return (
            <div className="flex flex-col gap-3">
                <Alert tone="danger">{t.loadError}</Alert>
                {/* 019/Polish (T139) — a 30a desenha o "Tentar novamente" do erro frio como `tf-btn--half`. */}
                <Button variant="secondary" width="half" onClick={refetch}>
                    {t.retry}
                </Button>
            </div>
        );
    }

    const searching = debouncedQuery.trim() !== "";

    return (
        <div className="flex flex-col gap-3">
            {/* No visible label — the input carries placeholder + aria-label. (`className="sr-only"` on
          the Field hid the WHOLE control, not the label: the search box shipped 1×1px invisible —
          the real T030 "manage" red.) */}
            <Field tightLabel>
                {(p) => (
                    <div className="tf-inputwrap">
                        <input
                            {...p}
                            type="text"
                            className="tf-input"
                            placeholder={t.searchPlaceholder}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label={t.searchPlaceholder}
                        />
                    </div>
                )}
            </Field>

            {stale && (
                <Alert tone="info" title={t.offlineTitle}>
                    {t.offlineBody}
                    <Button variant="secondary" size="sm" onClick={refetch} className="mt-2">
                        {t.retry}
                    </Button>
                </Alert>
            )}
            {!stale && !isError && items.length > 0 && lapsed && (
                <Alert tone="info" title={t.lapsedTitle}>
                    {t.lapsedBody}
                </Alert>
            )}
            {duplicateError && <Alert tone="danger">{duplicateError}</Alert>}

            {items.length === 0 ? (
                searching ? (
                    <EmptyState
                        icon="boxes"
                        title={t.searchEmpty.replace("{termo}", debouncedQuery.trim())}
                        action={
                            <Button variant="secondary" onClick={() => setQuery("")}>
                                {t.searchClear}
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon="boxes"
                        title={t.emptyTitle}
                        description={t.emptyBody}
                        action={
                            <Button variant="secondary" onClick={onClose}>
                                {t.emptyAction}
                            </Button>
                        }
                    />
                )
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        {items.map((item) => (
                            <ScenarioCard
                                key={item.id}
                                item={item}
                                onOpen={() => onOpenScenario(item)}
                                writesDisabled={writesDisabled}
                                writesReason={writesReason}
                                onRename={(i) => renameSheetRef.current?.open(i)}
                                onDuplicate={(i) => void handleDuplicate(i)}
                                onDeleteRequest={(i) => deleteDialogRef.current?.open(i)}
                            />
                        ))}
                    </div>
                    {hasMore && (
                        <Button variant="secondary" onClick={loadMore} loading={isFetchingMore}>
                            {t.loadMore}
                        </Button>
                    )}
                </>
            )}

            <RenameScenarioSheet ref={renameSheetRef} />
            <DeleteScenarioDialog ref={deleteDialogRef} />
        </div>
    );
}

/**
 * 019/PR-F (revisão do main loop) — o ÚNICO lugar que traduz um item da lista para o que a
 * Calculadora abre. A gaveta (estreito) e a coluna larga (≥1280) chamam esta função — se a
 * tradução mudar, muda nos dois; duas cópias divergiriam em silêncio (a mesma classe do D2/T091).
 */
export function scenarioOpenArgs(item: ScenarioOut): {
    config: ScenarioConfig;
    meta: { id: string; name: string; note: ScenarioOut["note"] };
} {
    return {
        config: item.config as unknown as ScenarioConfig,
        meta: { id: item.id, name: item.name, note: item.note },
    };
}

export function ScenariosListSheet({
    open,
    onOpenChange,
    onOpenScenario,
}: ScenariosListSheetProps) {
    const sessionStatus = useSessionStore((s) => s.status);
    const entitlement = useEntitlement();
    // 019/PR-B (T046/T112, prancheta 32c/32f) — a parede caiu: "nunca teve" e deslogado não saltam
    // mais para o `PremiumTeaser` de página inteira. `ScenarioListBody` monta para todo mundo e é ELA
    // quem decide (com o próprio `error` da lista) mostrar o vazio didático no lugar do conteúdo.
    const gate = premiumGate(entitlement.data, { status: sessionStatus });
    const showsDoor = gate === "never-subscribed" || gate === "signed-out";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            {open && (
                <SheetContent>
                    <SheetTitle>{t.listTitle}</SheetTitle>
                    {/* 016/T010-A1 — a descrição pertence à LISTA ("Estratégias salvas..."), então ela só
              renderiza quando existe (ou pode existir) uma lista para descrever — nunca por cima do
              vazio didático, que já explica a feature com a própria frase. */}
                    {!showsDoor && <SheetDescription>{t.listSubtitle}</SheetDescription>}

                    <ScenariosList
                        gate={gate}
                        lapsed={entitlement.data?.status === "lapsed"}
                        onClose={() => onOpenChange(false)}
                        onOpenScenario={(item) => {
                            const { config, meta } = scenarioOpenArgs(item);
                            onOpenScenario(config, meta);
                            onOpenChange(false);
                        }}
                    />
                </SheetContent>
            )}
        </Sheet>
    );
}
