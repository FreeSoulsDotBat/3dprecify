// O erro de validação do motor + as duas asserções numéricas de entrada. Movido de index.ts na
// divisão por responsabilidade (chore de legibilidade 2026-08-31); corpo verbatim.
export class ValidationError extends Error {
    readonly field?: string;
    constructor(message: string, field?: string) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
    }
}

/** Finite and ≥ 0 (the default bound for every numeric input). */
export function assertNonNegative(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new ValidationError(`${field} must be a finite number >= 0`, field);
    }
}

/** Finite and strictly > 0 (a denominator that must not be zero). */
export function assertPositive(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new ValidationError(`${field} must be a finite number > 0`, field);
    }
}
