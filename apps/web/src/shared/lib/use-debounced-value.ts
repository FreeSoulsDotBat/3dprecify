import { useEffect, useState } from "react";

// A value that trails its source by `delayMs`, resetting the timer on every change. Used by the
// Histórico search (US6): a filtered read is a live server request, so we must not fire one on every
// keystroke — the query keys off the SETTLED term, while the input itself stays fully responsive.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);
    return debounced;
}
