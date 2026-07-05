import { messages } from "@/shared/i18n/messages.pt-br";
import { signOutUser, useSessionStore } from "@/shared/session/session-store";
import { Button, Icon, Logo, useThemeStore } from "@/shared/ui";

import "./top-bar.css";

// Theme toggle (T029). A real toggle control whose `aria-pressed` reflects the
// current theme — closes the audit note that the 001 toggle had no state. Pressed =
// dark. Purely client-side UI state (theme-store); gates nothing.
function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="tf-topbar__theme"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={messages.theme.toggle}
      title={messages.theme.toggle}
    >
      <Icon name={isDark ? "moon" : "sun"} size={20} />
    </button>
  );
}

// Account chrome (T029). Preserves the 001 signed-in identity + sign-out behavior,
// now living in the top-bar. Server-confirmed identity + a real Conta page arrive
// in US5; here it stays the lightweight signed-in affordance.
function AccountChrome() {
  const status = useSessionStore((s) => s.status);
  const email = useSessionStore((s) => s.user?.email);
  if (status !== "authenticated") return null;
  return (
    <div className="tf-topbar__account">
      {email && (
        <span className="tf-topbar__email" title={email}>
          {messages.account.signedInAs} {email}
        </span>
      )}
      <Button variant="secondary" size="sm" onClick={() => void signOutUser()}>
        {messages.account.signOut}
      </Button>
    </div>
  );
}

/**
 * Top bar (T029). The app-layer chrome extracted from the 001 inline header: brand
 * Logo + account chrome + theme toggle. Rendered once by the app-shell above the
 * page outlet. Top-level `<header>` ⇒ the single `banner` landmark.
 */
export function TopBar() {
  return (
    <header className="tf-topbar">
      <Logo variant="full" alt={messages.appName} className="tf-topbar__logo" />
      <div className="tf-topbar__actions">
        <AccountChrome />
        <ThemeToggle />
      </div>
    </header>
  );
}
