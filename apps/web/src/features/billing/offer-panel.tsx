import { useState } from "react";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Badge } from "@/shared/ui";

import { BILLING_PLANS, type BillingPlanKey } from "@/shared/billing/plans";
import { BillingCta } from "./billing-cta";

import "./billing.css";

// E6/T014-T015 (US1 — ux-billing.md §2). The offer surface: two honest plan cards (annual
// pre-highlighted "recomendado", monthly one tap away — §10-F3) + the free promise + the shared
// Assinar CTA + the honest hand-off notice. Real prices from the ONE product constant
// (`billing-plans.ts`) — no "de/por" anchor, no struck-through R$ 191,88 (§0.2).
//
// "Já é Premium" guard (§2.3): a seller who reaches the offer while already entitled doesn't get
// sold twice — the offer never even shows the plan cards or a second Assinar button.

const t = messages.billing;

export function OfferPanel() {
  const entitlement = useEntitlement();
  const [selected, setSelected] = useState<BillingPlanKey>("annual");

  if (entitlement.data?.status === "active") {
    return (
      <div className="tf-billing-offer">
        <p>{t.alreadyPremium}</p>
      </div>
    );
  }

  const plan = BILLING_PLANS[selected];

  return (
    <div className="tf-billing-offer">
      {/* No own heading here: the caller (a Sheet's `SheetTitle`, or a future dedicated route)
          owns the accessible title — this panel is composed inside it (review PR-A). */}
      <p className="tf-billing-offer__lead">{t.offerFreeLead}</p>
      <p>{t.offerBody}</p>

      <fieldset className="tf-billing-offer__plans">
        <legend className="sr-only">{t.offerTitle}</legend>
        {(Object.keys(BILLING_PLANS) as BillingPlanKey[]).map((key) => {
          const p = BILLING_PLANS[key];
          const isSelected = key === selected;
          return (
            <label
              key={key}
              className={[
                "tf-billing-offer__plan",
                isSelected && "tf-billing-offer__plan--selected",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="tf-billing-offer__plan-head">
                {/* qa pós-016, ressalva A7 — o radio mora NA LINHA do nome do plano (a "cabeça"
                    já é flex row): `align-self:start` sozinho matava a barra de 292px mas
                    deixava o controle 22px ACIMA de "Plano mensal", órfão do rótulo. */}
                <span className="tf-billing-offer__plan-name">
                  <input
                    type="radio"
                    name="tf-billing-period"
                    value={key}
                    checked={isSelected}
                    onChange={() => setSelected(key)}
                  />
                  {p.name}
                </span>
                {"badge" in p && <Badge tone="success">{p.badge}</Badge>}
              </div>
              <span className="tf-billing-offer__plan-price">{p.price}</span>
              {"equivalent" in p && <span>{p.equivalent}</span>}
              {"saving" in p && <span>{p.saving}</span>}
              {"note" in p && <span className="tf-billing-offer__plan-note">{p.note}</span>}
            </label>
          );
        })}
      </fieldset>

      <BillingCta period={plan.period} />

      <p className="tf-billing-offer__notice">{t.handoffNotice}</p>
      <p className="tf-billing-offer__notice">{t.cardNeverTouches}</p>
    </div>
  );
}
