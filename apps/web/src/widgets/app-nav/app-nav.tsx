import { Link, useRouterState } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { Icon, type IconName } from "@/shared/ui";

import "./app-nav.css";

export type AppNavVariant = "tabbar" | "sidebar";

export interface AppNavProps {
  /** `tabbar` = mobile bottom bar (≤425px); `sidebar` = desktop side nav (>425px). */
  variant: AppNavVariant;
  /**
   * 018/US5 — sidebar recolhida (rail de ícones). Só faz sentido na variante `sidebar`; o TabBar
   * ignora. `undefined` = a sidebar de sempre, sem botão de recolher: é o que mantém intacto
   * qualquer lugar que monte o menu sem saber do rail.
   */
  collapsed?: boolean;
  /** Presente ⇒ o rodapé do menu ganha o botão Recolher/Expandir. */
  onToggleCollapsed?: () => void;
}

// The five-section IA (routes.md; 008/K1 added Kits — owner-approved amendment of the
// original fixed four). Icons come from the DS Icon set; labels from the i18n `nav.*`
// keys. `to` values are registered TanStack routes.
const NAV_ITEMS = [
  { to: "/calcular", label: messages.nav.calcular, icon: "calculator" },
  { to: "/catalogo", label: messages.nav.catalogo, icon: "package" },
  { to: "/kits", label: messages.nav.kits, icon: "boxes" },
  { to: "/historico", label: messages.nav.historico, icon: "history" },
  { to: "/conta", label: messages.nav.conta, icon: "circle-user" },
] as const satisfies readonly { to: string; label: string; icon: IconName }[];

/**
 * App navigation (T028 / NAV-1). A semantic `<nav>` of real router links — the
 * a11y-correct model for route navigation (each item announces as a link with
 * `aria-current="page"` on the active section), not a tabs/panel widget. The
 * "roving-tabindex nav" realization permitted by ADR-0007 / contracts/ui-components
 * is implemented here: arrow keys (+ Home/End) move a single roving tabstop across
 * the items so the nav behaves as one composite widget for keyboard users, while
 * every item stays a genuine link. Renders as a bottom TabBar (mobile) or a side
 * nav (desktop) from the same markup; the app-shell picks the variant by viewport.
 */
export function AppNav({ variant, collapsed = false, onToggleCollapsed }: AppNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)),
  );

  const [rovingIndex, setRovingIndex] = useState(activeIndex);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the single tabstop on the current section as the route changes.
  useEffect(() => setRovingIndex(activeIndex), [activeIndex]);

  const horizontal = variant === "tabbar";
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
    const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";
    let next: number;
    if (event.key === nextKey) next = (rovingIndex + 1) % NAV_ITEMS.length;
    else if (event.key === prevKey) next = (rovingIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = NAV_ITEMS.length - 1;
    else return;
    event.preventDefault();
    setRovingIndex(next);
    listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-nav-item]")[next]?.focus();
  }

  // 018/US5 — o BOTÃO de recolher só existe quando alguém entrega o interruptor.
  const railable = variant === "sidebar" && onToggleCollapsed !== undefined;
  // 2026-08-15 — "ser rail" deixou de depender do botão existir. Abaixo de 600px o menu é recolhido
  // por NECESSIDADE de espaço (`useRailForcado`), e ali não há interruptor: expandir devolveria o
  // transbordo de 131px que a homologação mediu. Antes, `isRail` exigia o botão, então um
  // `collapsed` forçado encolhia a coluna para 76px e os rótulos continuavam renderizados — o pior
  // dos dois mundos.
  const isRail = variant === "sidebar" && collapsed;

  return (
    <nav
      className={`tf-nav tf-nav--${variant}${isRail ? " tf-nav--rail" : ""}`}
      aria-label={messages.nav.ariaLabel}
    >
      <ul ref={listRef} className="tf-nav__list" onKeyDown={onKeyDown}>
        {NAV_ITEMS.map((item, index) => (
          <li key={item.to} className="tf-nav__cell">
            <Link
              to={item.to}
              data-nav-item
              tabIndex={index === rovingIndex ? 0 : -1}
              className="tf-nav__item"
              activeProps={{ "aria-current": "page" }}
              activeOptions={{ exact: true }}
              // Recolhido, o rótulo sai da TELA: a dica devolve o nome ao mouse.
              title={isRail ? item.label : undefined}
            >
              <Icon name={item.icon} size={22} className="tf-nav__icon" />
              {/* 018/ADR-0031 — recolhido, o rótulo é escondido VISUALMENTE (`sr-only`), nunca com
                  `display: none`. O arquivo de design usa `display:none`, o que tiraria o rótulo da
                  árvore de acessibilidade e deixaria cada item do menu sem nome para quem usa
                  leitor de tela. O que se vê é o desenho; o que se ouve continua sendo "Catálogo". */}
              <span className={isRail ? "tf-nav__label sr-only" : "tf-nav__label"}>
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* FORA da <ul>: o botão não é uma seção, e não pode entrar na travessia por setas que o
          roving tabindex acima governa. */}
      {railable && (
        <button
          type="button"
          className="tf-nav__item tf-nav__collapse"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? messages.nav.expand : messages.nav.collapse}
        >
          <Icon name="panel-left" size={22} className="tf-nav__icon" />
          <span className={isRail ? "tf-nav__label sr-only" : "tf-nav__label"}>
            {collapsed ? messages.nav.expand : messages.nav.collapse}
          </span>
        </button>
      )}
    </nav>
  );
}
