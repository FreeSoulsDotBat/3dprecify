import { useState } from "react";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { useScenarios } from "@/entities/scenario/use-scenarios";
import { useEntitlement } from "@/entities/user/use-entitlement";
import type { ScenarioOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Spinner,
} from "@/shared/ui";

import { ScenarioTeaserDialog, ScenarioTeaserPanel } from "./scenario-teaser";

// 010/T013 (E5, PR-A US2) — "Meus cenários": the door (§0.1) + the list (§3) + the honest teaser
// (§3.5/§7, reusing T016). This is the "Meus cenários" Sheet reached from the Calcular page header
// entry — VISIBLE for everyone (free/signed-out included, per the entitlement × connectivity ×
// affordance matrix, §0.1). It renders the union `useScenarios()` already computed (server ∪
// uid-keyed offline cache) — never re-derives it.
//
// ROUTING NOTE (a measured repo fact, not a UX-doc default): a Sheet/overlay, never a
// `/calcular/cenarios` sub-route — `base:'./'` blanks any 2-segment route on cold load/refresh
// (the same trap `/kits?id=` sidestepped). Reaching a scenario in an e2e test must use client-nav.
//
// Reopening a card CLOSES the sheet and hands the raw `ScenarioConfig` + `{id, name}` to the caller
// (the Calcular page), which owns `applyScenarioConfig` (`features/calculator/scenario-bridge.ts`) —
// this feature never touches calculator form types (the FSD-Lite boundary, see scenario-bridge.ts).

const t = messages.scenarios;

export interface ScenariosListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScenario: (config: ScenarioConfig, meta: { id: string; name: string }) => void;
}

/** "há poucos minutos" / "há N min/h/dia(s)/semana(s)" — a MANAGEMENT convenience, never a
 *  date-as-claim (§0.2/§11-F6: the card states no date, only how long since it last changed). */
function relativeLabel(iso: string, now: number): string {
  const diffMin = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffDay = Math.floor(diffH / 24);
  if (diffDay < 7) return `há ${diffDay} dia${diffDay === 1 ? "" : "s"}`;
  const diffWeek = Math.floor(diffDay / 7);
  return `há ${diffWeek} semana${diffWeek === 1 ? "" : "s"}`;
}

function ScenarioCard({ item, onOpen }: { item: ScenarioOut; onOpen: () => void }) {
  return (
    <Card
      as="button"
      padding="sm"
      interactive
      onClick={onOpen}
      className="flex w-full flex-col gap-1 text-left"
    >
      <p className="truncate text-sm font-medium">{item.name}</p>
      {item.note && <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{item.note}</p>}
      <p className="text-xs text-[var(--text-muted)]">
        {t.updatedRelative.replace("{quando}", relativeLabel(item.updatedAt, Date.now()))}
      </p>
    </Card>
  );
}

function ScenarioListBody({
  onOpenScenario,
  onClose,
  lapsed,
}: {
  onOpenScenario: (item: ScenarioOut) => void;
  onClose: () => void;
  lapsed: boolean;
}) {
  const { items, isLoading, isError, stale, refetch, loadMore, hasMore, isFetchingMore } =
    useScenarios();

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
        <Button variant="secondary" onClick={refetch}>
          {t.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Serving cached rows after a failed read — most commonly offline (§3.2). Calm, never a wall
          over data the seller already holds; a retry is offered either way (§0.1). */}
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

      {items.length === 0 ? (
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
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <ScenarioCard key={item.id} item={item} onOpen={() => onOpenScenario(item)} />
            ))}
          </div>
          {hasMore && (
            <Button variant="secondary" onClick={loadMore} loading={isFetchingMore}>
              {t.loadMore}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function ScenariosListSheet({
  open,
  onOpenChange,
  onOpenScenario,
}: ScenariosListSheetProps) {
  const sessionStatus = useSessionStore((s) => s.status);
  const entitlement = useEntitlement();
  const signedOut = sessionStatus !== "authenticated";
  // Never/free (a session that exists but never bought Premium) meets the SAME honest door as
  // signed-out (§0.1 matrix, "none" row) — never a broken empty list pretending the feature is on.
  const showTeaser = signedOut || entitlement.data?.status === "none";
  const [teaserDialogOpen, setTeaserDialogOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent>
          <SheetTitle>{t.listTitle}</SheetTitle>
          <SheetDescription>{t.listSubtitle}</SheetDescription>

          {showTeaser ? (
            <>
              <ScenarioTeaserPanel
                signedOut={signedOut}
                onOpenDialog={() => setTeaserDialogOpen(true)}
              />
              <ScenarioTeaserDialog
                open={teaserDialogOpen}
                onOpenChange={setTeaserDialogOpen}
                signedOut={signedOut}
              />
            </>
          ) : (
            <ScenarioListBody
              lapsed={entitlement.data?.status === "lapsed"}
              onClose={() => onOpenChange(false)}
              onOpenScenario={(item) => {
                onOpenScenario(item.config as unknown as ScenarioConfig, {
                  id: item.id,
                  name: item.name,
                });
                onOpenChange(false);
              }}
            />
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}
