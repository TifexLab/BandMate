import { useEffect, useState } from "react";
import { Link } from "../lib/nav";
import { useParams } from "react-router-dom";
import { bandPath } from "../lib/scope";
import { useLiveDoc } from "../lib/live";
import { money } from "../lib/format";
import QRCode from "qrcode";
import { checkUrl, isEnded, isSoldOut, issueCode, mailtoCode } from "../lib/tickets";
import { useSettings } from "../state/settings";
import { useTenant } from "../state/tenant";
import { useT } from "../i18n";
import BackBar from "../components/BackBar";
import LangSwitch from "../components/LangSwitch";
import { LogoBackdrop } from "../components/brand";
import { Loading, QrPopup } from "../components/ui";
import type { Ticket } from "../types";

const dmy = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : s; };

/** The page behind a ticket link / QR: event details and the payment options. Opening a payment option issues a code for the bank message. */
export default function TicketPage() {
  const t = useT();
  const { ticketId = "" } = useParams();
  const { bandId } = useTenant();
  const { settings } = useSettings();
  const live = useLiveDoc<Ticket>(() => bandPath(`tickets/${ticketId}`), `pub-ticket-${bandId}-${ticketId}`);
  const [qty, setQty] = useState(1);
  const [pay, setPay] = useState<{ code: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeQr, setCodeQr] = useState("");
  useEffect(() => {
    if (!pay) return setCodeQr("");
    QRCode.toDataURL(checkUrl(ticketId, pay.code), { margin: 1, width: 300, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }).then(setCodeQr).catch(() => setCodeQr(""));
  }, [pay, ticketId]);
  const tk = live.data ? ({ ...live.data, id: ticketId } as Ticket) : null;
  const cur = settings.currency;

  const open = async () => {
    if (!tk) return;
    setBusy(true);
    setErr("");
    try {
      setPay({ code: await issueCode(tk, qty) });
    } catch {
      setErr(t("tk.codeFailed"));
    } finally {
      setBusy(false);
    }
  };

  const ended = tk ? isEnded(tk) : false;
  const soldOut = tk ? isSoldOut(tk) : false;
  const left = tk && tk.max != null ? Math.max(0, tk.max - (tk.paidCount || 0)) : null;
  const maxQty = Math.max(1, Math.min(20, left ?? 20));
  const hasPay = !!(tk && (tk.qrUrl || tk.payUrl || tk.cardPay));
  const mail = tk && pay ? mailtoCode(`${tk.name} – ${pay.code}`, `${tk.name}\n${dmy(tk.startDate)}\n${t("tk.yourCode")}: ${pay.code}\n${t("tk.mailBody", { qty, total: money(tk.price * qty, cur) })}`) : undefined;

  return (
    <>
      <LogoBackdrop settings={settings} />
      <BackBar fallback="/listky" />
      <header className="hero">
        <div className="hero-in">
          {settings.logoInHeader && settings.logoUrl && <img className="hero-logo" src={settings.logoUrl} alt="" />}
          <div className="hero-txt"><h1>{settings.bandName || "Tickets"}</h1></div>
          <LangSwitch />
        </div>
      </header>
      <main className="page">
        <div className="wrap">
          {!live.ready ? <Loading /> : !tk || !tk.visible ? (
            <div className="empty"><h3>{t("tk.notFound")}</h3></div>
          ) : (
            <section className="card">
              <h2 className="card-h">{tk.name}</h2>
              <p className="note">{tk.endDate && tk.endDate !== tk.startDate ? `${dmy(tk.startDate)} – ${dmy(tk.endDate)}` : dmy(tk.startDate)}{tk.time ? ` · ${tk.time}` : ""}</p>
              {tk.place && <p className="note">{tk.place}</p>}
              <p className="tag big">{money(tk.price, cur)}</p>
              {ended ? <p className="notice">{t("tk.eventEnded")}</p> : soldOut ? <p className="notice">{t("tk.soldOut")}</p> : !hasPay ? <p className="notice">{t("tk.payAtDoor")}</p> : (
                <div className="stack">
                  <div className="field">
                    <label htmlFor="tQty">{t("tk.howMany")}</label>
                    <select id="tQty" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                      {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="hint">{t("tk.total", { total: money(tk.price * qty, cur) })}{left != null ? ` · ${t("tk.left", { n: left })}` : ""}</span>
                  </div>
                  {err && <p className="hint err">{err}</p>}
                  {(tk.qrUrl || tk.payUrl) && <button className="btn primary block" disabled={busy} onClick={open}>{tk.qrUrl && tk.payUrl ? t("tk.payBoth") : tk.qrUrl ? t("tk.payQr") : t("tk.payLink")}</button>}
                  {tk.cardPay && <button className="btn ghost block" disabled>{t("qr.card")} · {t("plan.soon")}</button>}
                </div>
              )}
            </section>
          )}
          <footer className="foot"><Link to="/">{t("tk.toMerch")}</Link></footer>
        </div>
      </main>
      {pay && tk && <QrPopup src={tk.qrUrl} title={tk.name} sub={`${qty}× · ${money(tk.price * qty, cur)}`} payUrl={tk.payUrl} cardPay={false} code={pay.code} codeMail={mail} codeQr={codeQr} onClose={() => setPay(null)} />}
    </>
  );
}
