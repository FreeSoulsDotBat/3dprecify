import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";

import type { FilamentIn, FilamentOut, PrinterIn, PrinterOut } from "@/shared/api/generated";
import { formatDecimal, parseDecimal } from "@/shared/lib/decimal-ptbr";
import { messages } from "@/shared/i18n/messages.pt-br";

// Catalog form schemas (T019/T022). The forms are pt-BR STRING forms (like the calculator); Zod
// validates each field with the EXACT E1 messages (FR-306 — a saved value can never flow NaN/∞
// into the engine), and the resolver keeps the raw strings on success. The wire mappers convert
// those strings to pt-BR-agnostic DECIMAL STRINGS (contract: money as string), and the `*ToForm`
// mappers turn a saved row back into editable pt-BR strings for the edit sheet.

const v = messages.calculator.validation;
const rollWeightError = messages.calculator.rollWeightError;

interface NumRule {
  /** Blank is allowed and contributes 0 (an optional field). */
  optional?: boolean;
  /** Must be strictly > 0 (a denominator: roll weight / machine lifetime). */
  positive?: boolean;
  /** Field-specific "> 0" message (defaults to the roll-weight message). */
  positiveMessage?: string;
}

/** One reusable pt-BR number parser+validator — the same shape the calculator asserts, so a bad
 *  string is rejected with the same pt-BR message and never silently coerced to 0. */
function numField(rule: NumRule) {
  return z.string().transform((raw, ctx): number => {
    const trimmed = (raw ?? "").trim();
    if (trimmed === "") {
      if (rule.optional) return 0;
      ctx.addIssue({ code: "custom", message: v.required });
      return z.NEVER;
    }
    const cleaned = trimmed.replace(/[^\d.,-]/g, "");
    const n = parseDecimal(cleaned);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: v.invalid });
      return z.NEVER;
    }
    if (rule.positive) {
      if (n <= 0) {
        ctx.addIssue({ code: "custom", message: rule.positiveMessage ?? rollWeightError });
        return z.NEVER;
      }
    } else if (n < 0) {
      ctx.addIssue({ code: "custom", message: v.negative });
      return z.NEVER;
    }
    return n;
  });
}

/** pt-BR string → canonical decimal string for the wire ("110,50" → "110.5"; blank/bad → "0"). */
function toWireDecimal(ptbr: string): string {
  const n = parseDecimal((ptbr ?? "").trim().replace(/[^\d.,-]/g, ""));
  return Number.isFinite(n) ? String(n) : "0";
}

/** Wire decimal string → editable pt-BR string ("135.00" → "135"; "110.5" → "110,5"). */
function wireToPtBr(dec: string): string {
  const n = Number(dec);
  return Number.isFinite(n) ? String(n).replace(".", ",") : "";
}

// ── Filament ────────────────────────────────────────────────────────────────────────────────────

export interface FilamentFormValues {
  name: string;
  material: string;
  costPerRoll: string;
  rollWeightKg: string;
  defaultWasteGrams: string;
}

const filamentSchema = z.object({
  name: z.string().trim().min(1, v.required),
  material: z.string(),
  costPerRoll: numField({}),
  rollWeightKg: numField({ positive: true, positiveMessage: rollWeightError }),
  defaultWasteGrams: numField({ optional: true }),
});

export const filamentResolver: Resolver<FilamentFormValues> = (values) => {
  const parsed = filamentSchema.safeParse(values);
  if (parsed.success) return { values, errors: {} };
  const errors: FieldErrors<FilamentFormValues> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof FilamentFormValues | undefined;
    if (key && !errors[key]) errors[key] = { type: "validation", message: issue.message };
  }
  return { values: {}, errors };
};

export const emptyFilamentForm: FilamentFormValues = {
  name: "",
  material: "",
  costPerRoll: "",
  rollWeightKg: "",
  defaultWasteGrams: "",
};

export function filamentToWire(values: FilamentFormValues): FilamentIn {
  return {
    name: values.name.trim(),
    material: values.material.trim() || null,
    costPerRoll: toWireDecimal(values.costPerRoll),
    rollWeightKg: toWireDecimal(values.rollWeightKg),
    defaultWasteGrams: toWireDecimal(values.defaultWasteGrams || "0"),
  };
}

export function filamentToForm(f: FilamentOut): FilamentFormValues {
  return {
    name: f.name,
    material: f.material ?? "",
    costPerRoll: wireToPtBr(f.costPerRoll),
    rollWeightKg: wireToPtBr(f.rollWeightKg),
    defaultWasteGrams: wireToPtBr(f.defaultWasteGrams),
  };
}

/** Muted second row for a filament list item: `{material} · R$ {cost} / {weight} kg`. */
export function filamentSummary(f: FilamentOut): string {
  const material = f.material?.trim();
  const head = material ? `${material} · ` : "";
  return `${head}R$ ${formatDecimal(Number(f.costPerRoll))} / ${wireToPtBr(f.rollWeightKg)} kg`;
}

// ── Printer ───────────────────────────────────────────────────────────────────────────────────

export interface PrinterFormValues {
  name: string;
  machineValue: string;
  machineLifetimeHours: string;
  avgPowerKw: string;
  maintenanceReservePerHour: string;
}

const printerSchema = z.object({
  name: z.string().trim().min(1, v.required),
  machineValue: numField({}),
  machineLifetimeHours: numField({ positive: true, positiveMessage: v.machineLifetimePositive }),
  avgPowerKw: numField({}),
  maintenanceReservePerHour: numField({ optional: true }),
});

export const printerResolver: Resolver<PrinterFormValues> = (values) => {
  const parsed = printerSchema.safeParse(values);
  if (parsed.success) return { values, errors: {} };
  const errors: FieldErrors<PrinterFormValues> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof PrinterFormValues | undefined;
    if (key && !errors[key]) errors[key] = { type: "validation", message: issue.message };
  }
  return { values: {}, errors };
};

export const emptyPrinterForm: PrinterFormValues = {
  name: "",
  machineValue: "",
  machineLifetimeHours: "",
  avgPowerKw: "",
  maintenanceReservePerHour: "",
};

export function printerToWire(values: PrinterFormValues): PrinterIn {
  return {
    name: values.name.trim(),
    machineValue: toWireDecimal(values.machineValue),
    machineLifetimeHours: toWireDecimal(values.machineLifetimeHours),
    avgPowerKw: toWireDecimal(values.avgPowerKw),
    maintenanceReservePerHour: toWireDecimal(values.maintenanceReservePerHour || "0"),
  };
}

export function printerToForm(p: PrinterOut): PrinterFormValues {
  return {
    name: p.name,
    machineValue: wireToPtBr(p.machineValue),
    machineLifetimeHours: wireToPtBr(p.machineLifetimeHours),
    avgPowerKw: wireToPtBr(p.avgPowerKw),
    maintenanceReservePerHour: wireToPtBr(p.maintenanceReservePerHour),
  };
}

/** Muted second row for a printer list item: `R$ {value} · {life} h · {power} kW`. */
export function printerSummary(p: PrinterOut): string {
  return `R$ ${formatDecimal(Number(p.machineValue))} · ${wireToPtBr(p.machineLifetimeHours)} h · ${wireToPtBr(p.avgPowerKw)} kW`;
}
