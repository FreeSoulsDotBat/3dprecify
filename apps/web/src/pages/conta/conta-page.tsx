import { useIdentity } from "@/entities/user/use-identity";
import { identityLabel } from "@/entities/user/user";
import { apiErrorMessage } from "@/shared/api/error-messages";
import { messages } from "@/shared/i18n/messages.pt-br";
import { signOutUser } from "@/shared/session/session-store";
import { Alert, Badge, Button, Card, Icon, Spinner, Switch, useThemeStore } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import "./conta-page.css";

// Conta page (T060, US5). Server-confirmed identity (entities/user via GET /api/v1/me),
// a static display-only "Gratuito" indicator (gates nothing — no entitlement field yet,
// Principle IV), a theme Switch (T059) and sign-out. No upsell/billing (honest copy).
// The auth guard that makes this route signed-in-only lives in the router (US2/T037).

// Identity section — reads the /me query (A23). Never fabricates a fallback identity:
// a 401/expired session shows the re-login message; any other failure shows a retryable
// error state.
function IdentitySection() {
  const q = useIdentity();

  if (q.isLoading) {
    return (
      <Card className="tf-conta__identity tf-conta__identity--loading">
        <Spinner />
      </Card>
    );
  }

  if (q.isError) {
    const err = q.error;
    const isSession =
      err.status === 401 || err.code === "UNAUTHENTICATED" || err.code === "TOKEN_EXPIRED";
    return (
      <Card className="tf-conta__identity">
        <Alert tone="danger" title={messages.conta.identityErrorTitle}>
          {isSession ? messages.apiError.tokenExpired : apiErrorMessage(err)}
        </Alert>
        {!isSession && (
          <div className="tf-conta__retry">
            <Button variant="secondary" onClick={() => void q.refetch()} loading={q.isFetching}>
              {messages.conta.retry}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  if (!q.data) return null;
  const label = identityLabel(q.data);
  const initial = label.charAt(0).toUpperCase();
  return (
    <Card className="tf-conta__identity">
      <span className="tf-conta__avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="tf-conta__email" title={label}>
        {q.data.email ?? label}
      </span>
    </Card>
  );
}

// Static, honest plan indicator — display-only (Principle IV: gates nothing).
function PlanSection() {
  return (
    <Card className="tf-conta__row">
      <span className="tf-conta__row-label">{messages.conta.planLabel}</span>
      <Badge tone="neutral">{messages.conta.planFree}</Badge>
    </Card>
  );
}

// Theme Switch (T059). Labelled by the row text; checked = dark (the v1 default).
function ThemeSection() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <Card className="tf-conta__row">
      <span id="tf-conta-theme-label" className="tf-conta__row-label">
        {messages.conta.themeDark}
      </span>
      <Switch
        aria-labelledby="tf-conta-theme-label"
        checked={theme === "dark"}
        onCheckedChange={() => {
          toggle();
        }}
      />
    </Card>
  );
}

export function ContaPage() {
  return (
    <section className="tf-conta mx-auto flex w-full max-w-md flex-col">
      <PageHeader title={messages.conta.title} />
      <IdentitySection />
      <PlanSection />
      <ThemeSection />
      <div className="tf-conta__signout">
        <Button variant="secondary" onClick={() => void signOutUser()}>
          <Icon name="log-out" size={18} />
          {messages.account.signOut}
        </Button>
      </div>
    </section>
  );
}
