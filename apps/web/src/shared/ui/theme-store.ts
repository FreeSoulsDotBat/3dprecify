import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

// localStorage key. MUST match the pre-paint inline script in index.html (A34) so
// the store and the first-paint resolution read the same saved preference.
export const THEME_STORAGE_KEY = "precifica3d-theme";

// First-paint theme is resolved BEFORE React mounts by the inline script in
// index.html (saved pref → prefers-color-scheme → dark) and written to
// <html data-theme>. The store seeds from that already-resolved attribute so the
// runtime store and the painted theme never disagree; `persist` then owns the
// saved preference for subsequent visits.
function resolveInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" || attr === "dark") return attr;
  }
  return "dark";
}

// Light/dark via the `data-theme` attribute on <html> (FR-C5.2), persisted to
// localStorage (A34) so the choice survives reloads and feeds the pre-paint script.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: resolveInitialTheme(),
      toggle: () => {
        const next: Theme = get().theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        set({ theme: next });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        // Reconcile <html data-theme> with the rehydrated saved preference.
        if (state && typeof document !== "undefined") {
          document.documentElement.dataset.theme = state.theme;
        }
      },
    },
  ),
);

export function applyInitialTheme(): void {
  document.documentElement.dataset.theme = useThemeStore.getState().theme;
}
