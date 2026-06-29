import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { messages } from "@/shared/i18n/messages.pt-br";
import { initSessionListener, useSessionStore } from "@/shared/session/session-store";
import { applyInitialTheme } from "@/shared/ui/theme-store";
import "@/styles/global.css";

applyInitialTheme();
initSessionListener();

function App() {
  const status = useSessionStore((s) => s.status);

  // Re-run route guards whenever auth changes (e.g. sign-out on a protected route → redirect).
  useEffect(() => {
    void router.invalidate();
  }, [status]);

  // Hold the gate until Firebase resolves the session, so we never flash a redirect to /sign-in
  // for a user who is actually authenticated.
  if (status === "loading") {
    return <p className="p-4">{messages.auth.loading}</p>;
  }

  return <RouterProvider router={router} context={{ status }} />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
