import { bandPath } from "../lib/scope";
import { useLiveDoc } from "../lib/live";
import { PLATFORM_FEE_FIXED_CENTS, PLATFORM_FEE_PERCENT, bandReceivesCents, platformFeeCents } from "../lib/fees";
import { CARD_CHECKOUT_ENABLED } from "../lib/plans";
import { money } from "../lib/format";
import { useSettings } from "../state/settings";
import { useTenant } from "../state/tenant";
import { useT } from "../i18n";
import type { PaymentsState } from "../types";

/** Settings card: take card payments through Stripe (tickets, later merch). Pay as you go: a fee per payment, no monthly fee. */
export default function PaymentsCard() {
  const t = useT();
  const { bandId } = useTenant();
  const { settings } = useSettings();
  const doc = useLiveDoc<PaymentsState>(() => bandPath("settings/payments"), `payments-${bandId}`);
  const p = doc.data;
  const cur = settings.currency;
  const state = p?.chargesEnabled && p?.payoutsEnabled ? "active" : p?.stripeAccountId ? "pending" : "off";
  const example = 1000;
  const pct = String(PLATFORM_FEE_PERCENT).replace(".", ",");
  const fixed = money(PLATFORM_FEE_FIXED_CENTS / 100, cur);

  return (
    <section className="card">
      <h2 className="card-h">{t("sp.title")}</h2>
      <p className="note">{t("sp.lead")}</p>
      <p><b>{t(`sp.state.${state}` as "sp.state.off")}</b></p>
      <ul className="plainlist">
        <li>{t("sp.how1")}</li>
        <li>{t("sp.how2", { pct, fixed })}</li>
        <li>{t("sp.how3", { price: money(example / 100, cur), fee: money(platformFeeCents(example) / 100, cur), net: money(bandReceivesCents(example) / 100, cur) })}</li>
        <li>{t("sp.how4")}</li>
        <li>{t("sp.how5")}</li>
      </ul>
      {state !== "active" && (
        <button className="btn primary block" disabled={!CARD_CHECKOUT_ENABLED}>
          {t("sp.enable")}{!CARD_CHECKOUT_ENABLED && <span className="soon"> · {t("plan.soon")}</span>}
        </button>
      )}
    </section>
  );
}
