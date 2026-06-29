import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { useAuthStore } from "@/features/auth/auth-store";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useThemeStore } from "@/shared/ui/theme-store";

function RootLayout() {
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-lg font-semibold" style={{ color: "var(--color-accent)" }}>
          {messages.appName}
        </span>
        <button
          type="button"
          onClick={toggle}
          className="rounded border px-3 py-1 text-sm"
          aria-label={messages.theme.toggle}
        >
          {messages.theme.toggle}
        </button>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}

const AUTH_LABEL: Record<string, string> = {
  loading: messages.auth.loading,
  authenticated: messages.auth.authenticated,
  anonymous: messages.auth.anonymous,
  "not-configured": messages.auth.notConfigured,
};

function HomeShell() {
  const status = useAuthStore((s) => s.status);
  return (
    <section className="space-y-2">
      <p>{messages.foundationReady}</p>
      <p style={{ color: "var(--color-muted)" }}>{AUTH_LABEL[status]}</p>
    </section>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeShell,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
