import { useEffect } from "react";

/**
 * Homologação automatizada (CF-001-LEIGO-E) — recarregar a página apagava tudo que o vendedor
 * tinha digitado, **sem aviso**. Medido: o custo voltou de R$ 19,91 para a semente.
 *
 * Isso importa mais do que parece porque o reflexo de quem acha que a tela travou é justamente
 * recarregar — a persona que perde o trabalho é a mesma que não entendeu o que estava vendo.
 *
 * ═══ POR QUE AVISAR E NÃO PERSISTIR O RASCUNHO ═══
 *
 * As duas correções resolvem o achado. Persistir é a mais generosa e foi descartada por uma razão
 * medida, não por preguiça: a semente da calculadora é um CONTRATO que boa parte da suíte existente
 * assume depois de um `reload` (o preço-semente 16,16/24,24/21,01 aparece pinado em vários testes,
 * e a própria homologação o confere). Restaurar um rascunho mudaria o que a tela mostra depois de
 * recarregar, trocando um defeito de acolhimento por um risco de regressão em cima de um PR que já
 * está pronto — e a decisão sobre o que a primeira visita mostra é do dono, não de uma correção de
 * homologação.
 *
 * O `beforeunload` do navegador é o mecanismo padrão para "você vai perder o que digitou". Ele não
 * inventa UI nova, não guarda nada, e some sozinho quando não há o que perder.
 *
 * Boundary conhecida e aceita: o navegador só mostra o diálogo se a pessoa já interagiu com a
 * página (regra de user-activation) — que é exatamente o caso em que existe algo a perder.
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
