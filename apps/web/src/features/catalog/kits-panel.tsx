import { useNavigate } from "@tanstack/react-router";

import { useBoms, useDeleteBom } from "@/entities/bom/use-bom";
import { useEntitlement } from "@/entities/user/use-entitlement";
import type { BomOut } from "@/shared/api/generated";
import { premiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatDayMonthPtBr } from "@/shared/lib/format-date";
import { useSessionStore } from "@/shared/session/session-store";

import { CatalogPanel } from "./catalog-panel";

// Kits tab (E3/T015c — US6/K2). A saved kit is catalog content, so it reuses the SAME premium
// panel every other tab uses (list · empty state · confirm-delete) in NAVIGATION mode: opening a
// kit routes back to the composer, which reloads its lines and RECOMPUTES the price — no price
// was ever stored (FR-407), so a row can only ever describe structure ("2 peças"), never money.
//
// 019/PR-B (T044) — o único dos quatro que ainda não lia `useEntitlement()` (não tinha faixa
// lapsed nem vazio didático antes): ganha o MESMO `gate` dos irmãos agora.

const catalogo = messages.catalogo;

export function KitsPanel() {
    const list = useBoms();
    const remove = useDeleteBom();
    const navigate = useNavigate();
    const entitlement = useEntitlement();
    const gate = premiumGate(entitlement.data, { status: useSessionStore((s) => s.status) });

    return (
        <CatalogPanel<BomOut, never>
            list={list}
            detailKicker={catalogo.detailKit}
            feature="kits"
            gate={gate}
            copy={{
                addLabel: catalogo.addKit,
                emptyTitle: catalogo.emptyKitsTitle,
                emptyBody: catalogo.emptyKitsBody,
                newTitle: catalogo.addKit,
                editTitle: catalogo.editKit,
                savedToast: messages.bom.saved,
                count: (n) => catalogo.countKits.replace("{n}", String(n)),
            }}
            rowName={(k) => k.name}
            rowSummary={(k) => catalogo.countKitPieces.replace("{n}", String(k.lines?.length ?? 0))}
            // 019/PR-D (T076, prancheta 17e) — "{n} peças · salvo em {data}". O preço do kit fica FORA
            // desta fatia (T124: nenhuma função pronta de preço de kit na lista) — registrado no
            // relatório; a linha do kit não ganha `rowPrice`/`rowFlag`, só a meta.
            rowMeta={(k) =>
                catalogo.kitMeta
                    .replace("{n}", String(k.lines?.length ?? 0))
                    .replace("{data}", formatDayMonthPtBr(k.updatedAt))
            }
            onCreateNavigate={() => void navigate({ to: "/kits" })}
            onEditNavigate={(k) => void navigate({ to: "/kits", search: { id: k.id } })}
            // Duplicate (US4) opens the copy in the composer as a NEW, unsaved kit — the seller reviews
            // and saves it. Nothing is written behind their back, and the copy's lines reference the same
            // products, so a duplicate never forks the catalog.
            onDuplicate={(k) => void navigate({ to: "/kits", search: { id: k.id, copy: true } })}
            remove={gate === "active" ? (id) => remove.mutateAsync(id) : undefined}
            deleting={remove.isPending}
        />
    );
}
