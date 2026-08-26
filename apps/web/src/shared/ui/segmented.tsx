import { type KeyboardEvent, type ReactNode, useRef } from "react";

import "./segmented.css";

/**
 * Grupo segmentado (018) — pílulas numa bandeja, uma selecionada.
 *
 * **Por que existe**: o padrão já vivia no app, escondido dentro de `catalogo-page.tsx` como um
 * `CatalogTabs` local. O 018 precisa dele em dois lugares (as seções do Catálogo e o tema da Conta),
 * e duas cópias do mesmo comportamento de teclado é como uma delas fica para trás numa correção.
 * Aqui ele passa a ter UM dono.
 *
 * **O que é honesto dizer sobre o DS**: isto acrescenta uma família de classes `tf-segmented*` ao
 * design system. Não é uma primitiva nova de interação — a interação é a que o Catálogo já tinha —,
 * mas também não é "zero CSS novo": o visual de bandeja com pílula selecionada não sai de
 * `Button` + tokens sem folha própria. A `research.md` §I registra isso.
 *
 * **A11y**: dois papéis, porque são duas semânticas diferentes.
 * - `tablist` — a escolha TROCA o painel abaixo (seções do Catálogo). Itens são `tab`, com
 *   `aria-selected` e `aria-controls`.
 * - `radiogroup` — a escolha é um VALOR (tema claro/escuro). Itens são `radio`, com `aria-checked`.
 *
 * Nos dois casos há **um único ponto de tabulação** (roving tabindex): Tab entra no grupo uma vez e
 * as setas percorrem — que é como um grupo de opções deve se comportar para quem usa teclado.
 */
export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Ícone opcional à esquerda do rótulo (a Conta usa; o Catálogo não). */
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Nome do grupo para leitor de tela — obrigatório: um grupo sem nome não se explica. */
  ariaLabel: string;
  /** `tablist` quando a escolha troca um painel; `radiogroup` quando ela é um valor. */
  role?: "tablist" | "radiogroup";
  /** Prefixo de `id` dos itens (necessário para `aria-controls` no modo tablist). */
  idPrefix?: string;
  /** Prefixo do painel controlado, no modo tablist. */
  controlsPrefix?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  role = "tablist",
  idPrefix,
  controlsPrefix,
  size = "md",
  className = "",
}: SegmentedProps<T>) {
  const refs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const isTabs = role === "tablist";

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const id = options[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={["tf-segmented", `tf-segmented--${size}`, className].filter(Boolean).join(" ")}
    >
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[option.id] = el;
            }}
            type="button"
            role={isTabs ? "tab" : "radio"}
            id={idPrefix ? `${idPrefix}-${option.id}` : undefined}
            aria-selected={isTabs ? selected : undefined}
            aria-checked={isTabs ? undefined : selected}
            aria-controls={isTabs && controlsPrefix ? `${controlsPrefix}-${option.id}` : undefined}
            tabIndex={selected ? 0 : -1}
            className={`tf-segmented__item${selected ? " tf-segmented__item--selected" : ""}`}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.icon}
            <span className="tf-segmented__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
