// 016/US8 (FR-910, SC-906, arquitetura-016.md §7) — pure derivation for "custo de máquina": the
// tela pergunta quanto custou (machineValue, unchanged) + com que frequência roda (3 opções, sem
// digitar) + em quantos anos quer que se pague, e DERIVA `machineLifetimeHours`; o motor continua
// recebendo os MESMOS dois campos de sempre — sem bump, sem migração (§7 invariant: a derivação
// de borda nunca entra em `PriceInput`, no documento de cenário ou no payload congelado).

/** The three usage RITMOS the dono approved (h/ano) — índice 0 = "poucas horas por semana",
 *  1 = "quase todo dia", 2 = "praticamente o dia todo" (SC-906). */
export const USAGE_RATE_HOURS_PER_YEAR = [260, 1200, 3300] as const;
export type UsageRateIndex = 0 | 1 | 2;

/** `machineLifetimeHours = ritmoHorasAno × paybackAnos` (arquitetura-016.md §7). Payback 3 anos
 *  dá os 780/3.600/9.900 aprovados pelo dono (SC-906). */
export function deriveMachineLifetimeHours(
    usageRateIndex: UsageRateIndex,
    paybackYears: number,
): number {
    const years = Number.isFinite(paybackYears) && paybackYears > 0 ? Math.trunc(paybackYears) : 0;
    return USAGE_RATE_HOURS_PER_YEAR[usageRateIndex] * years;
}

/** R$/hora de impressão — o derivado "dito em voz alta" (US8-AC2). `0` quando a vida útil não é
 *  um denominador utilizável (finito, positivo) — nunca NaN/Infinity na tela. */
export function costPerHour(machineValue: number, lifetimeHours: number): number {
    if (!Number.isFinite(machineValue) || !Number.isFinite(lifetimeHours) || lifetimeHours <= 0) {
        return 0;
    }
    return machineValue / lifetimeHours;
}

/**
 * US8-AC4 — um `machineLifetimeHours` salvo que NÃO bate com nenhum ritmo × payback inteiro (1..
 * maxPaybackYears) deriva para o modo "ajustar": `null` significa "digite as horas direto, isto
 * não é um produto de ritmo". Busca além do intervalo 1..5 que o seletor da tela oferece, para que
 * um payback salvo fora dessa faixa (um seletor futuro mais largo, ou dado editado à mão) ainda
 * seja reconhecido como ritmo quando genuinamente é um.
 */
export function detectUsageRateMode(
    machineLifetimeHours: number,
    maxPaybackYears = 10,
): { usageRateIndex: UsageRateIndex; paybackYears: number } | null {
    if (!Number.isFinite(machineLifetimeHours) || machineLifetimeHours <= 0) return null;
    for (const usageRateIndex of [0, 1, 2] as const) {
        for (let years = 1; years <= maxPaybackYears; years++) {
            if (USAGE_RATE_HOURS_PER_YEAR[usageRateIndex] * years === machineLifetimeHours) {
                return { usageRateIndex, paybackYears: years };
            }
        }
    }
    return null;
}
