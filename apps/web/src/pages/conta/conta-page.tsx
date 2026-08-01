import { type ReactNode, useState } from "react";
import { useSearch } from "@tanstack/react-router";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { useIdentity } from "@/entities/user/use-identity";
import { identityLabel } from "@/entities/user/user";
import { CheckoutReturnPanel } from "@/features/billing/checkout-return";
import { OfferPanel } from "@/features/billing/offer-panel";
import { PlanActions, planCaption, planDetail, planNote } from "@/features/billing/plan-panel";
import { planView } from "@/features/billing/plan-view";
import { useSubscription } from "@/features/billing/use-subscription";
import { apiErrorMessage } from "@/shared/api/error-messages";
import { messages } from "@/shared/i18n/messages.pt-br";
import { requestSignOut } from "@/shared/session/sign-out-guard";
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
  Sheet,
  SheetContent,
  SheetTitle,
  Spinner,
  Switch,
  useThemeStore,
} from "@/shared/ui";
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
      {/* No `title` here (PII): a DOM title would be captured verbatim in Sentry click
          breadcrumbs. The email is already the visible text; the tooltip isn't worth the leak. */}
      <span className="tf-conta__email">{q.data.email ?? label}</span>
    </Card>
  );
}

// E2/T025b (FR-304) — the plan line reads GET /api/v1/entitlement and never fabricates a
// state: none→Gratuito, active→Premium (+source; expiry when set; grantor never shown),
// lapsed→honest expired + read-only reassurance, error→honest unknown. "Atualizar" covers the
// ≤1-refresh just-granted window (ADR-0012). Display-only: the SERVER gates everything (IV).
function PlanSection() {
  const q = useEntitlement();
  const sub = useSubscription();
  const t = messages.conta;
  const tb = messages.billing;
  const [offerOpen, setOfferOpen] = useState(false);

  // E6/US6 (T026) — o painel COMPOE duas verdades do servidor (ledger + espelho do PSP) e nao
  // infere nenhuma (SC-708). A regra mora em `plan-view.ts`, pura e testada; aqui so ha
  // renderizacao. Enquanto a assinatura ainda nao respondeu, `undefined` faz o painel cair para a
  // superficie de entitlement — que e a resposta certa, e nao um estado de espera inventado.
  const state = planView({
    entitlement: q.data,
    subscription: sub.data,
    failed: q.isError,
  });
  const { badge: badgeText, tone } = planCaption(state);
  const badge: ReactNode = <Badge tone={tone}>{badgeText}</Badge>;
  let caption: string | null = planDetail(state);
  const note = planNote(state);
  // 009/T011b — o plano exibido e a ULTIMA resposta do servidor, nao uma fresca (offline). Dizer
  // isso e o preco de usa-la: o selo e honesto sobre o plano E sobre como ele sabe.
  if (q.stale) {
    caption = [caption, t.planStale].filter(Boolean).join(" · ");
  }

  return (
    <>
      <Card className="tf-conta__row tf-conta__row--plan">
        <div className="flex flex-1 flex-col gap-1">
          <span className="tf-conta__row-label">{t.planLabel}</span>
          <div className="flex items-center gap-2">
            {badge}
            {caption && (
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                {caption}
              </span>
            )}
          </div>
          {note && (
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
              {note}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PlanActions state={state} onSubscribe={() => setOfferOpen(true)} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void q.refetch()}
            loading={q.isFetching}
            aria-label={t.planRefresh}
          >
            {t.planRefresh}
          </Button>
        </div>
      </Card>
      <Sheet open={offerOpen} onOpenChange={setOfferOpen}>
        {offerOpen && (
          <SheetContent>
            <SheetTitle>{tb.offerTitle}</SheetTitle>
            <OfferPanel />
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

// Theme Switch (T059). Labelled by the row text; checked = dark (the v1 default).
function ThemeSection() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <Card className="tf-conta__row">
      <span id="tf-conta-theme-label" className="tf-conta__row-label">
        {messages.conta.themeLabel}
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
  // E6/T013/T015: MP's `back_url` returns here as `/conta?checkout=retorno` (§0.4/§10-F5 — a
  // 1-segment route, never `/conta/assinatura/retorno` under `base:'./'`). That state is a full
  // takeover of the page — the return surface polls server truth on its own (checkout-return.tsx);
  // it is NOT a Conta badge (§0.3, the pending-vs-grace firewall keeps `pending` off this panel).
  const search = useSearch({ strict: false }) as { checkout?: string };

  if (search.checkout === "retorno") {
    return (
      <section className="tf-conta mx-auto flex w-full max-w-md flex-col">
        <PageHeader title={messages.conta.title} />
        <CheckoutReturnPanel />
      </section>
    );
  }

  return (
    <section className="tf-conta mx-auto flex w-full max-w-md flex-col">
      <PageHeader title={messages.conta.title} />
      <IdentitySection />
      <PlanSection />
      <ThemeSection />
      <div className="tf-conta__signout">
        <Button variant="secondary" onClick={() => void requestSignOut()}>
          <Icon name="log-out" size={18} />
          {messages.account.signOut}
        </Button>
      </div>
    </section>
  );
}
