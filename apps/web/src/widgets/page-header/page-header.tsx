import {
    forwardRef,
    type HTMLAttributes,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
} from "react";

import "./page-header.css";

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
    /** The section title, presented at the top of every page (spec scenario 3). */
    title: ReactNode;
    /** Optional supporting line under the title. */
    description?: ReactNode;
}

// Focus-to-title on navigation (T045 / NAV-2). The FIRST page-header to mount after a
// document load is the initial landing — it must NOT steal focus off the user's landing
// point. Every later mount is an in-app section change and DOES move focus to the new
// title so keyboard/AT users are announced onto the fresh screen. This lives here (not in
// the app-shell) because a page-header's own mount is the only reliable moment the new
// title is committed to the DOM; a route-level effect fires before the `<Outlet/>` swaps
// pages. The flag is module-scoped and resets naturally on every full page load/reload.
let initialHeaderPending = true;

/**
 * Section title (T030 / NAV-2). The heading is focusable (`tabindex="-1"`) and, on
 * navigation, focuses itself (T045) so the destination section is announced. The `<h1>`
 * is the page's single top-level heading; the wrapper is a plain `<div>` (not `<header>`)
 * to avoid a second `banner` landmark alongside the app-shell top-bar.
 */
export const PageHeader = forwardRef<HTMLHeadingElement, PageHeaderProps>(function PageHeader(
    { title, description, className = "", ...rest },
    forwardedRef,
) {
    const headingRef = useRef<HTMLHeadingElement | null>(null);

    // Merge the internal focus ref with any forwarded ref (non-breaking for callers).
    const setRef = useCallback(
        (node: HTMLHeadingElement | null) => {
            headingRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
        },
        [forwardedRef],
    );

    useEffect(() => {
        if (initialHeaderPending) {
            initialHeaderPending = false;
            return;
        }
        headingRef.current?.focus();
    }, []);

    return (
        <div className={["tf-page-header", className].filter(Boolean).join(" ")} {...rest}>
            <h1
                ref={setRef}
                tabIndex={-1}
                data-page-header
                className="tf-page-header__title tf-title"
            >
                {title}
            </h1>
            {description && <p className="tf-page-header__desc">{description}</p>}
        </div>
    );
});
