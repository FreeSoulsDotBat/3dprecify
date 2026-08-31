import { create } from "zustand";

/**
 * 019/PR-C (T050/T056, prancheta 14a) — a dispensa ("Entendi") do aviso de plausibilidade.
 *
 * A chave é `${campo}:${valorNormalizado}` — dispensar "1.000" no peso do rolo NÃO dispensa
 * "2.000": um valor novo faz o aviso voltar (14a — "não volta para o mesmo valor NESTA SESSÃO").
 *
 * Deliberadamente SEM `persist` (ao contrário de `nav-rail-store.ts`/`theme-store.ts`): é dispensa
 * DE SESSÃO, não preferência de conta nem de aparelho — um recarregamento reabre o aviso.
 *
 * Mora em `shared/lib`, e não em `features/calculator`, pela mesma fronteira de `plausibilidade.ts`:
 * `widgets/bom-line-editor` renderiza os MESMOS `CalcFieldMeta` (via `ControlledField`), e
 * `features/bom` não pode importar `features/calculator`.
 */
export function dismissKey(campo: string, valorBruto: string): string {
    return `${campo}:${valorBruto}`;
}

interface PlausibilityDismissState {
    dismissed: ReadonlySet<string>;
    dismiss: (key: string) => void;
}

export const usePlausibilityDismissStore = create<PlausibilityDismissState>((set) => ({
    dismissed: new Set<string>(),
    dismiss: (key) =>
        set((s) => {
            if (s.dismissed.has(key)) return s;
            return { dismissed: new Set(s.dismissed).add(key) };
        }),
}));
