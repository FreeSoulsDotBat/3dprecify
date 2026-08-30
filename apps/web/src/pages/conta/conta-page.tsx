import { type ReactNode, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { useIdentity } from "@/entities/user/use-identity";
import { identityLabel } from "@/entities/user/user";
import { CheckoutReturnPanel } from "@/features/billing/checkout-return";
import { OfferPanel } from "@/features/billing/offer-panel";
import {
  PlanActions,
  planCaption,
  planDetail,
  planNote,
  planToneVar,
} from "@/features/billing/plan-panel";
import { planView } from "@/features/billing/plan-view";
import { useSubscription } from "@/features/billing/use-subscription";
import { apiErrorMessage } from "@/shared/api/error-messages";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useIsWide } from "@/shared/lib/use-is-wide";
import { requestSignOut } from "@/shared/session/sign-out-guard";
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
  Segmented,
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
      // qa pós-016 (N01) — o ramo de ERRO empilha: a linha flex do identity (feita para
      // avatar+texto) espremia o Alert a uma palavra por coluna e paria o "Tentar novamente"
      // fora do cartão E da viewport a 360px (right 378,5 > 360) — a classe E6/T028-B1, que o
      // comentário do __row--plan já citava e este cartão não tinha herdado.
      <Card className="tf-conta__identity tf-conta__identity--error">
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
  // 018/US4 — no desktop a oferta abre INLINE na coluna do plano (o desenho a mostra aberta), em vez
  // de dentro da gaveta. A gaveta continua existindo e continua sendo o caminho do mobile e do
  // `?assinar=1`. O que NÃO muda: `plan-panel.tsx` não é tocado — ele continua recebendo o estado já
  // resolvido e sem acesso ao ledger nem ao espelho do PSP (SC-708 é estrutural, não uma promessa).
  const isWide = useIsWide();
  // US7/T032 — os teasers chegam com `?assinar=1`, e a oferta abre ja montada. O estado inicial le
  // a intencao UMA vez: depois disso quem manda e o usuario (fechar tem de fechar, e um efeito
  // preso a URL reabriria o Sheet no proximo render).
  const intencao = (useSearch({ strict: false }) as { assinar?: string }).assinar === "1";
  const [offerOpen, setOfferOpen] = useState(intencao);

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
  // T028/A3 — a carência fala em tom de cautela; todo o resto segue no cinza neutro.
  const tom = planToneVar(state);
  // 009/T011b — o plano exibido e a ULTIMA resposta do servidor, nao uma fresca (offline). Dizer
  // isso e o preco de usa-la: o selo e honesto sobre o plano E sobre como ele sabe.
  if (q.stale) {
    caption = [caption, t.planStale].filter(Boolean).join(" · ");
  }

  // A oferta inline vale para os mesmos estados em que o painel oferece assinar — a regra é do
  // `PlanState`, não uma segunda leitura de entitlement.
  const ofereceAssinar =
    state.kind === "free" || state.kind === "lapsed" || state.kind === "subscription-canceled";
  const ofertaInline = isWide && ofereceAssinar;
  // 019/PR-A (dívida do 018, achada pelo e2e): `?assinar=1` abria a GAVETA por cima da oferta inline —
  // a mesma oferta duas vezes na tela (dois rádios de período, dois preços), exatamente o que o botão da
  // linha já evita. A intenção da URL faz o que o botão faz: com oferta na coluna, LEVA até ela; a gaveta
  // só existe quando não há coluna. Derivado, não efeito preso à URL — fechar continua fechando.
  const sheetOpen = offerOpen && !ofertaInline;
  useEffect(() => {
    if (offerOpen && ofertaInline)
      document.getElementById("tf-conta-oferta")?.scrollIntoView?.({ block: "nearest" });
  }, [offerOpen, ofertaInline]);

  return (
    <>
      <Card className="tf-conta__row tf-conta__row--plan">
        <div className="flex flex-1 flex-col gap-1">
          <span className="tf-conta__row-label">{t.planLabel}</span>
          <div className="flex items-center gap-2">
            {badge}
            {caption && (
              <span style={{ fontSize: "var(--fs-caption)", color: tom }}>{caption}</span>
            )}
          </div>
          {note && <span style={{ fontSize: "var(--fs-caption)", color: tom }}>{note}</span>}
        </div>
        {/* T028/B1 — `flex-wrap` NAO e cosmetico aqui. O `.tf-conta__row--plan` ja tem `flex-wrap`,
            mas ele nao socorria: as acoes sao UM item flex, e um item mais largo que o container nao
            quebra. MEDIDO a 390px: a linha media 453,5px contra 316px de conteudo do card, o
            `scrollWidth` da PAGINA ia a 491 (100,5px de transbordo) e o botao "Atualizar" nascia
            INTEIRAMENTE fora da viewport, em x=396,3. Com o modal aberto o overlay cobria so 390px e
            sobrava uma faixa clara a direita com o botao solto a mostra. E a tela de quem esta
            PAGANDO, e viola o invariante duro do ux-billing §0.4. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PlanActions
            state={state}
            onSubscribe={() => {
              // Com a oferta já aberta na coluna, abrir a gaveta por cima dela seria mostrar a
              // mesma oferta duas vezes. Aqui o botão LEVA até ela.
              if (ofertaInline) {
                document
                  .getElementById("tf-conta-oferta")
                  ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                return;
              }
              setOfferOpen(true);
            }}
          />
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

      {ofertaInline && (
        <Card id="tf-conta-oferta" className="flex flex-col gap-3">
          <h2 className="tf-conta__offer-title">{tb.offerTitle}</h2>
          <OfferPanel />
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={setOfferOpen}>
        {sheetOpen && (
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
//
// 018/US4 — no desktop o interruptor vira um controle segmentado que NOMEIA as opções ("Claro" /
// "Escuro"): um interruptor diz ligado/desligado, e ligado não é um tema. Os dois escrevem no MESMO
// `useThemeStore` — dois controles, uma verdade. O mobile mantém o interruptor de hoje (clarify).
function ThemeSection() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isWide = useIsWide();
  const t = messages.conta;

  return (
    <Card className="tf-conta__row">
      <span id="tf-conta-theme-label" className="tf-conta__row-label">
        {t.themeLabel}
      </span>
      {isWide ? (
        <Segmented
          options={[
            { id: "light", label: t.themeLight, icon: <Icon name="sun" size={16} aria-hidden /> },
            { id: "dark", label: t.themeDark, icon: <Icon name="moon" size={16} aria-hidden /> },
          ]}
          value={theme}
          onChange={(next) => {
            if (next !== theme) toggle();
          }}
          ariaLabel={t.themeLabel}
          role="radiogroup"
          size="sm"
        />
      ) : (
        <Switch
          aria-labelledby="tf-conta-theme-label"
          checked={theme === "dark"}
          onCheckedChange={() => {
            toggle();
          }}
        />
      )}
    </Card>
  );
}

// 018/US4 — o aviso de privacidade na terceira coluna, como no desenho: título + as duas frases
// que importam, reaproveitando a redação já ratificada em `messages.privacy` (FR-214).
//
// Sem link para `/privacidade` — o desenho não tem um, e a versão que eu tinha escrito com `Link`
// exigia contexto de roteador dentro da Conta, quebrando 7 testes que hoje montam a página sozinha.
// A página inteira da política continua existindo e continua acessível pelo mesmo caminho de antes.
function PrivacySection() {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="tf-conta__offer-title">{messages.privacy.title}</h2>
      <p className="tf-conta__privacy-line">{messages.privacy.google}</p>
      <p className="tf-conta__privacy-line">{messages.privacy.noSale}</p>
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
      <section className="tf-conta mx-auto flex w-full tf-page-wide flex-col">
        <PageHeader title={messages.conta.title} />
        <CheckoutReturnPanel />
      </section>
    );
  }

  // 018/US4 — no desktop as três colunas do desenho: identidade+plano · tema · privacidade+sair.
  // A grade é CSS pura (`tf-conta__grid`), e abaixo do corte ela colapsa numa coluna só — que é
  // exatamente o empilhamento de hoje, na mesma ordem de DOM. Nenhuma seção muda de conteúdo.
  return (
    <section className="tf-conta mx-auto flex w-full tf-page-wide flex-col">
      <PageHeader title={messages.conta.title} />
      <div className="tf-conta__grid">
        <div className="tf-conta__col">
          <IdentitySection />
          <PlanSection />
        </div>
        <div className="tf-conta__col">
          <ThemeSection />
        </div>
        <div className="tf-conta__col">
          <PrivacySection />
          <div className="tf-conta__signout">
            <Button variant="secondary" onClick={() => void requestSignOut()}>
              <Icon name="log-out" size={18} />
              {messages.account.signOut}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
