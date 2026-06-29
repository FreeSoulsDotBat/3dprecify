import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { SignInScreen } from "@/features/auth/sign-in-screen";
import { CalculatorScreen } from "@/features/calculator/calculator-screen";
import { messages } from "@/shared/i18n/messages.pt-br";
import { type SessionStatus, signOutUser, useSessionStore } from "@/shared/session/session-store";
import { useThemeStore } from "@/shared/ui/theme-store";

// Auth state the router needs to gate routes. Fed from the session store via RouterProvider context
// in main.tsx; beforeLoad guards read it synchronously (Option A — beforeLoad + context).
export interface RouterContext {
  status: SessionStatus;
}

// Account chrome (identity + sign-out) lives in the app shell header, so feature screens stay pure.
function AccountChrome() {
  const status = useSessionStore((s) => s.status);
  const email = useSessionStore((s) => s.user?.email);
  if (status !== "authenticated") return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      {email && (
        <span style={{ color: "var(--color-muted)" }}>
          {messages.account.signedInAs} {email}
        </span>
      )}
      <button type="button" onClick={() => void signOutUser()} className="rounded border px-3 py-1">
        {messages.account.signOut}
      </button>
    </div>
  );
}

function RootLayout() {
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <span className="text-lg font-semibold" style={{ color: "var(--color-accent)" }}>
          {messages.appName}
        </span>
        <div className="flex items-center gap-3">
          <AccountChrome />
          <button
            type="button"
            onClick={toggle}
            className="rounded border px-3 py-1 text-sm"
            aria-label={messages.theme.toggle}
          >
            {messages.theme.toggle}
          </button>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout });

// Protected calculator (US1 destination). Anonymous/not-configured users are redirected to /sign-in.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    if (context.status !== "authenticated") {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: CalculatorScreen,
});

// Public sign-in. Already-authenticated users are bounced to the calculator.
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  beforeLoad: ({ context }) => {
    if (context.status === "authenticated") {
      throw redirect({ to: "/" });
    }
  },
  component: SignInScreen,
});

const routeTree = rootRoute.addChildren([indexRoute, signInRoute]);

export const router = createRouter({
  routeTree,
  context: { status: "loading" },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
