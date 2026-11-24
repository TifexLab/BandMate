import { useState } from "react";
import { saveDoc } from "../lib/ops";
import { syncPublicStock, DEFAULT_STOCK_VIEW } from "../lib/stockView";
import { useBand } from "../state/band";
import { useSettings } from "../state/settings";
import { useToast } from "../state/toast";
import { errorText } from "../lib/format";
import { useT } from "../i18n";
import { Toggle } from "./ui";
import type { StockView } from "../types";

/** Settings card: what fans may see about stock (nothing by default). */
export default function StockViewCard() {
  const t = useT();
  const { settings } = useSettings();
  const { items, stock } = useBand();
  const toast = useToast();
  const v = settings.stockView ?? DEFAULT_STOCK_VIEW;
  const [threshold, setThreshold] = useState(String(v.threshold));

  const apply = (next: StockView) => {
    saveDoc("settings/public", { stockView: next })
      .then(() => syncPublicStock(items, stock, next))
      .catch((e) => toast(errorText(e)));
    toast(t("sv.saved"));
  };
  const th = Math.min(50, Math.max(1, Math.round(Number(threshold)) || 1));
  return (
    <section className="card">
      <h2 className="card-h">{t("sv.title")}</h2>
      <p className="note">{t("sv.lead")}</p>
      <div className="stack">
        <Toggle id="svCount" checked={v.count} onChange={(c) => apply({ ...v, count: c })} label={t("sv.count")} hint={t("sv.countHint")} />
        <Toggle id="svLow" checked={v.low} onChange={(l) => apply({ ...v, low: l })} label={t("sv.low")} hint={t("sv.lowHint", { n: v.threshold })} />
        {v.low && (
          <div className="field">
            <label htmlFor="svTh">{t("sv.threshold")}</label>
            <input id="svTh" type="number" inputMode="numeric" min={1} max={50} value={threshold} onChange={(e) => setThreshold(e.target.value)}
              onBlur={() => { setThreshold(String(th)); if (th !== v.threshold) apply({ ...v, threshold: th }); }} />
          </div>
        )}
      </div>
    </section>
  );
}
