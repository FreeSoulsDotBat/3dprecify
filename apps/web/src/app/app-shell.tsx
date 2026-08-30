import { Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { OutboxSyncer } from "@/features/history/outbox-syncer";
import { SignOutOutboxGuard } from "@/features/history/sign-out-outbox-guard";
import { useIsWide, useRailForcado } from "@/shared/lib/use-is-wide";
import { useNavRailStore } from "@/shared/ui";
import { AppNav } from "@/widgets/app-nav/app-nav";
import { OfflineBanner } from "@/widgets/offline-banner/offline-banner";
import { SessionExpiryBanner } from "@/widgets/session-expiry-banner/session-expiry-banner";
import { TopBar } from "@/widgets/top-bar/top-bar";

import "./app-shell.css";

// Mobile ≤425px ⇒ bottom TabBar; >425px ⇒ desktop side nav (owner decision 2026-07-03,
// post-MVP homologation — widens desktop coverage; supersedes the 414px draft). Defensive
// against jsdom/SSR where matchMedia is absent (defaults to desktop) so tests never crash.
const MOBILE_QUERY = "(max-width: 425px)";

function useIsMobile(): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_QUERY).matches
      : false;
  const [isMobile, setIsMobile] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/**
 * App shell (T023/T033) — the app-layer chrome that hosts pages via `<Outlet/>`.
 * Slots:
 *   - offline-banner (top, role=status)     → US4 / T052 (placeholder for now)
 *   - top-bar (brand + theme + account)     → widgets/top-bar (T029)
 *   - app-nav (TabBar mobile / side desktop) → widgets/app-nav (T028), variant by viewport
 * No auth guards live here — guards are router `beforeLoad` (US2). The former inline
 * 001 top-bar chrome is superseded by `widgets/top-bar`.
 *
 * Focus-to-title on navigation (T045 / NAV-2) is owned by `widgets/page-header`: each
 * section title focuses itself on mount (skipping the first, initial-load mount). That
 * mount is the only reliable "the new title is in the DOM" signal — a pathname-keyed
 * effect here fires before the `<Outlet/>` commits the destination page, so the shell
 * would focus the OUTGOING title. See page-header.tsx.
 */
export function AppShell() {
  const isMobile = useIsMobile();
  // 018/US5 — o rail POR ESCOLHA. O estado é preferência do aparelho (nav-rail-store) e só vale
  // acima de 1280px, que é onde recolher é uma decisão do vendedor e não uma necessidade.
  //
  // (Este comentário dizia "entre 426px e 1279px a sidebar continua a de sempre". Deixou de ser
  //  verdade em 2026-08-15: abaixo de 600px ela recolhe sozinha — ver `railForcado`, logo abaixo.
  //  De 600 a 1279 a frase continua valendo.)
  const isWide = useIsWide();
  // 2026-08-15 (review do PR #58) — abaixo de 600px o menu recolhe por NECESSIDADE. A 426px, o
  // primeiro pixel em que a barra lateral monta, os 240px dela deixam ~150px de conteúdo e nada do
  // produto cabe: a medição acusava a página inteira como culpada de 131px de transbordo. Com o
  // rail de 76px sobram ~318px, que é onde o conteúdo volta a caber.
  //
  // Sem interruptor nessa faixa, de propósito: expandir devolveria o transbordo. É restrição de
  // espaço, não preferência do vendedor — por isso o `toggle` continua exclusivo do ≥1280px, onde
  // recolher é uma escolha e o estado é preferência do aparelho.
  const railForcado = useRailForcado();
  const collapsed = useNavRailStore((s) => s.collapsed);
  const toggleRail = useNavRailStore((s) => s.toggle);
  const railCollapsed = railForcado || (isWide && collapsed);
  return (
    <div
      className="tf-shell"
      data-layout={isMobile ? "mobile" : "desktop"}
      /* `data-rail` vale em TODO desktop, não só no wide: é ele que troca `--sidebar-w` para 76px,
         e a faixa 426–599 precisa disso tanto quanto o rail escolhido a ≥1280px. */
      data-rail={!isMobile ? (railCollapsed ? "collapsed" : "expanded") : undefined}
    >
      {/* slot: offline-banner (US4/T052) */}
      <OfflineBanner />
      {/* hotfix 016/A3 (H5) — the way back when the SERVER refuses a live client session. Renders
          nothing while nothing is expired. */}
      <SessionExpiryBanner />

      {/* 016/US3 (T014) — "a sidebar fica à frente do header": on desktop the side nav is now a
          full-height column to the LEFT of everything (banner landmark included), preparing the
          terrain for a future collapsible rail (the collapse itself is out of scope). The
          top-bar no longer spans the sidebar's width — it starts where the sidebar ends, over a
          right-hand column it shares with `<main>`. Mobile is UNCHANGED: the top-bar still spans
          the full width above the body, and the TabBar sits fixed at the bottom (no side nav is
          ever mounted there). DOM order now reads sidebar → top-bar → main, which is also the new
          tab order — coherent with the new visual left-to-right layout, not a regression of it
          (AC2: focus/tab-order/screen-reader do not get WORSE, they now match what is on screen). */}
      {isMobile ? (
        <>
          <TopBar isMobile />
          <div className="tf-shell__body">
            <main className="tf-shell__main">
              <Outlet />
            </main>
          </div>
        </>
      ) : (
        <div className="tf-shell__body">
          <AppNav
            variant="sidebar"
            collapsed={railCollapsed}
            onToggleCollapsed={isWide ? toggleRail : undefined}
          />
          <div className="tf-shell__content">
            <TopBar isMobile={false} />
            <main className="tf-shell__main">
              <Outlet />
            </main>
          </div>
        </div>
      )}

      {isMobile && <AppNav variant="tabbar" />}

      {/* Sign-out with a non-empty outbox (009/T011, ADR-0018 §10). It lives at the shell — NOT at
          either Sair button — because the FSD-Lite boundary keeps `shared/session` from seeing the
          queue, and because guarding one of the two call sites would leave the other silently
          destroying unsynced records. */}
      <SignOutOutboxGuard />

      {/* The queue drains itself on boot, on reconnect, and when Premium comes back (ADR-0018 §7) —
          the app promises "sincroniza sozinho quando a conexão voltar", so it must. */}
      <OutboxSyncer />
    </div>
  );
}
