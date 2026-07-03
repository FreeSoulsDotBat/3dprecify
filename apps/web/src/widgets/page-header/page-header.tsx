import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import "./page-header.css";

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The section title, presented at the top of every page (spec scenario 3). */
  title: ReactNode;
  /** Optional supporting line under the title. */
  description?: ReactNode;
}

/**
 * Section title (T030 / NAV-2). The heading is focusable (`tabindex="-1"`) so US3
 * (T045) can move keyboard/AT focus to it on navigation — this widget only provides
 * the focusable target; the focus-move logic itself lands in US3. The `<h1>` is the
 * page's single top-level heading; the wrapper is a plain `<div>` (not `<header>`) to
 * avoid introducing a second `banner` landmark alongside the app-shell top-bar.
 */
export const PageHeader = forwardRef<HTMLHeadingElement, PageHeaderProps>(function PageHeader(
  { title, description, className = "", ...rest },
  ref,
) {
  return (
    <div className={["tf-page-header", className].filter(Boolean).join(" ")} {...rest}>
      <h1 ref={ref} tabIndex={-1} data-page-header className="tf-page-header__title tf-title">
        {title}
      </h1>
      {description && <p className="tf-page-header__desc">{description}</p>}
    </div>
  );
});
