import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

// Light/dark via the `data-theme` attribute on <html> (FR-C5.2).
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  toggle: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    set({ theme: next });
  },
}));

export function applyInitialTheme(): void {
  document.documentElement.dataset.theme = useThemeStore.getState().theme;
}
