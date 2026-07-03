import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Toaster } from "@/shared/ui";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Global toast queue (T020). Mapped from ErrorCode → pt-BR at call sites (T055). */}
      <Toaster />
    </QueryClientProvider>
  );
}
