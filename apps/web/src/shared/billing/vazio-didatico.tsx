import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { EmptyState, type IconName } from "@/shared/ui";

import type { PremiumGate } from "./premium-gate";
import { TeaserUpgrade } from "./teaser-upgrade";

// 019/PR-B (T043, research §E-4) — o VAZIO DIDÁTICO: o que quem não paga vê no lugar da parede.
//
// Prancheta 32a/32c ("Premium - O Caminho Sem Parede", cópia congelada em
// `specs/019-porte-design/design/`): a lista não é substituída por parede nenhuma — ela está vazia
// porque nunca houve o que salvar, e o vazio EXPLICA a feature. Mesma forma do vazio de quem paga
// (ícone, título, frase, botão); só o comprimento da frase muda. Sem coroa, sem preço no título.
//
// Ele COMPÕE o `EmptyState` que já existe (`shared/ui/empty-state.tsx` é o `tf-empty`) e não tem
// CSS próprio — a guarda `tf-class-uniqueness` (T006) é o que mantém isso estrutural.
//
// O ÚNICO convite da tela (FR-1906, invariante um-teaser do 016/US1) vive aqui enquanto a lista é
// o que está na tela; quando o formulário inerte abre, o rodapé DELE passa a ser o único
// (`teaser={false}` — T041 asserta a contagem nos dois estados). Divergência registrada para a
// segunda passada do dono: a 32a diz "nenhuma menção a plano" no vazio, e a FR-1906 exige um convite
// por tela — a FR ganhou (dod-evidence §T043).

export type VazioFeature = "filaments" | "printers" | "products" | "kits" | "quotes" | "scenarios";

interface VazioCopy {
  icon: IconName;
  title: string;
  body: string;
}

const c = messages.catalogo;

function copyOf(feature: VazioFeature): VazioCopy {
  switch (feature) {
    case "filaments":
      return { icon: "package", title: c.emptyFilamentsTitle, body: c.didaticoFilamentsBody };
    case "printers":
      return { icon: "package", title: c.emptyPrintersTitle, body: c.didaticoPrintersBody };
    case "products":
      return { icon: "package", title: c.emptyProductsTitle, body: c.didaticoProductsBody };
    case "kits":
      return { icon: "package", title: c.emptyKitsTitle, body: c.didaticoKitsBody };
    case "quotes":
      return {
        icon: "history",
        title: messages.historico.didaticoTitle,
        body: messages.historico.didaticoBody,
      };
    case "scenarios":
      return {
        icon: "boxes",
        title: messages.scenarios.emptyTitle,
        body: messages.scenarios.didaticoBody,
      };
  }
}

export interface VazioDidaticoProps {
  feature: VazioFeature;
  /** O estado que a tela leu de `premiumGate(...)`. Só decide DUAS coisas aqui: se o convite é
   *  "Assinar" (nunca teve / deslogado) ou "Reativar" (teve e venceu), e para onde o deslogado vai. */
  gate: Exclude<PremiumGate, "active">;
  /** O botão do vazio — "Adicionar filamento" (abre o formulário inerte) ou "Fazer um cálculo". */
  action: ReactNode;
  /** `false` enquanto o formulário inerte está aberto: o rodapé dele é o único convite da tela. */
  teaser?: boolean;
}

export function VazioDidatico({ feature, gate, action, teaser = true }: VazioDidaticoProps) {
  const copy = copyOf(feature);
  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      description={copy.body}
      data-testid="vazio-didatico"
      data-feature={feature}
      action={
        <div className="flex flex-col items-center gap-3">
          {action}
          {teaser && (
            <TeaserUpgrade
              signedOut={gate === "signed-out"}
              align="center"
              label={gate === "lapsed" ? messages.billing.reactivateAction : undefined}
            />
          )}
        </div>
      }
    />
  );
}
