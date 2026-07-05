import { useEffect } from "react";
import { create } from "zustand";

import { Icon, type IconName } from "./icon";

import "./toast.css";

export type ToastTone = "neutral" | "info" | "success" | "danger";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  /** ms before auto-dismiss; <= 0 disables it. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: { message: string; tone?: ToastTone; duration?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ message, tone = "neutral", duration = 5000 }) => {
    const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message, duration }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative helper. Message is pt-BR (map ErrorCode → phrase at the call site, T055). */
export function toast(message: string, opts?: { tone?: ToastTone; duration?: number }): string {
  return useToastStore.getState().push({ message, tone: opts?.tone, duration: opts?.duration });
}

const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: "info",
  info: "info",
  success: "circle-check",
  danger: "circle-alert",
};

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, dismiss]);
  return (
    <div
      className={`tf-toast tf-toast--${item.tone}`}
      role={item.tone === "danger" ? "alert" : "status"}
    >
      <Icon name={TONE_ICON[item.tone]} size={18} className="tf-toast__icon" />
      <span className="tf-toast__msg">{item.message}</span>
      <button
        type="button"
        className="tf-toast__close"
        onClick={() => dismiss(item.id)}
        aria-label="Fechar"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

/** Mount once (in app/providers). Polite live region hosting the toast queue. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="tf-toaster" role="region" aria-label="Notificações" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}
