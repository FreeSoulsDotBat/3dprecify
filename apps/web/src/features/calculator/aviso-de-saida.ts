import { useEffect } from "react";

/**
 * ⚠ @doc DEC-025 — avisa, e NÃO persiste o rascunho: a semente 16,16/24,24/21,01 é contrato
 *   que a suíte assume depois de um `reload`, e o que a primeira visita mostra é do dono.
 */
export function useAvisoDeSaida(temAlteracoes: boolean): void {
    useEffect(() => {
        if (!temAlteracoes) return;
        const aviso = (evento: BeforeUnloadEvent) => {
            // O texto é do navegador, não nosso: `preventDefault` + `returnValue` é a forma que todos os
            // navegadores atuais aceitam. Escrever uma frase aqui não a exibiria em lugar nenhum.
            evento.preventDefault();
            evento.returnValue = "";
        };
        window.addEventListener("beforeunload", aviso);
        return () => window.removeEventListener("beforeunload", aviso);
    }, [temAlteracoes]);
}
