import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { initAuthListener } from "@/features/auth/auth-store";
import { applyInitialTheme } from "@/shared/ui/theme-store";
import "@/styles/global.css";

applyInitialTheme();
initAuthListener();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
