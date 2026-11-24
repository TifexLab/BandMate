import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { bandCol, bandDoc } from "../../lib/scope";
import { useLiveQuery } from "../../lib/live";
import { useBand } from "../../state/band";
import { useSettings } from "../../state/settings";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { useTenant } from "../../state/tenant";
import { errorText, money } from "../../lib/format";
import { cleanPayUrl } from "../../lib/qrdecode";
import { cleanupEnded, defaultPrefix, deleteCode, isEnded, markPaid, markUnpaid, markUsed, prefixOk, ticketLink, todayLocal, unmarkUsed } from "../../lib/tickets";
import { useT } from "../../i18n";
import { useQr } from "../../components/brand";
import { ConfirmButton, PaySection, Sheet, Toggle } from "../../components/ui";
import type { Ticket, TicketCode } from "../../types";

const dmy = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : s; };
const range = (t: Ticket) => (t.endDate && t.endDate !== t.startDate ? `${dmy(t.startDate)} – ${dmy(t.endDate)}` : dmy(t.startDate));

export default function Tickets() {
  const t = useT();
  const { bandId } = useTenant();
  const { settings } = useSettings();
  const list = useLiveQuery<Ticket>(() => bandCol("tickets"), `tickets-${bandId}`);
  const [edit, setEdit] = useState<Ticket | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const cleaned = useRef(false);

  // Events that are over: their codes are deleted (nothing to keep), once, when someone from the band opens this page.
  useEffect(() => {
    if (!list.ready || cleaned.current) return;
    cleaned.current = true;
    cleanupEnded(list.data).catch(() => {});
  }, [list.ready, list.data]);

  const today = todayLocal();
  const sorted = list.data.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const upcoming = sorted.filter((x) => !isEnded(x, today));
  const ended = sorted.filter((x) => isEnded(x, today)).reverse();
  const open = list.data.find((x) => x.id === openId) || null;
  if (open) return <Detail ticket={open} onBack={() => setOpenId(null)} onEdit={() => setEdit(open)} edit={edit} setEdit={setEdit} />;

  const card = (x: Ticket, done = false) => (
    <article className={`tile ${done ? "dim" : ""}`} key={x.id}>
      <div className="tile-top">
        <div>
          <h3>{x.name}</h3>
          <div className="sub">{range(x)}{x.time ? ` · ${x.time}` : ""}{x.place ? ` · ${x.place}` : ""}</div>
        </div>
        <span className="tag">{money(x.price, settings.currency)}</span>
      </div>
      <div className="meta-row">
        <span className="note">{t("tk.sold", { n: x.paidCount || 0, max: x.max == null ? "∞" : x.max })}</span>
        {!x.visible && <span className="hidden-tag">{t("bundles.hiddenFromFans")}</span>}
      </div>
      <div className="stack-sm">
        {!done && <button className="btn primary block" onClick={() => setOpenId(x.id)}>{t("tk.open")}</button>}
        <button className="btn ghost block" onClick={() => setEdit(x)}>{t("tk.edit")}</button>
      </div>
    </article>
  );

  return (
    <>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setEdit("new")}>{t("tk.new")}</button>
      </div>
      {!list.ready ? null : !sorted.length ? (
        <div className="empty">
          <h3>{t("tk.emptyTitle")}</h3>
          <p>{t("tk.emptyText")}</p>
        </div>
      ) : (
        <>
          <div className="grid">{upcoming.map((x) => card(x))}</div>
          {ended.length > 0 && (
            <>
              <h2 className="sec">{t("tk.ended")}</h2>
              <div className="grid">{ended.map((x) => card(x, true))}</div>
            </>
          )}
        </>
      )}
      {edit && <TicketSheet ticket={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDeleted={() => { setEdit(null); setOpenId(null); }} />}
    </>
  );
}

function Detail({ ticket, onBack, onEdit, edit, setEdit }: { ticket: Ticket; onBack: () => void; onEdit: () => void; edit: Ticket | "new" | null; setEdit: (v: Ticket | "new" | null) => void }) {
  const t = useT();
  const toast = useToast();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const { band } = useBand();
  const { bandId } = useTenant();
  const codes = useLiveQuery<TicketCode>(() => bandCol(`tickets/${ticket.id}/codes`), `tcodes-${bandId}-${ticket.id}`);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid" | "today">("all");
  const link = ticketLink(ticket.id);
  const qr = useQr(link);
  const day = todayLocal();
  const by = profile?.id ?? "";
  const byName = profile?.displayName ?? "";
  const cur = settings.currency;
  const fail = (e: unknown) => toast(errorText(e));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return codes.data
      .filter((c) => (!needle || c.code.toLowerCase().includes(needle)) && (filter === "all" || (filter === "unpaid" ? !c.paid : filter === "paid" ? c.paid : (c.usedDays || []).includes(day))))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [codes.data, q, filter, day]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: ticket.name, url: link });
      else { await navigator.clipboard.writeText(link); toast(t("tk.copied")); }
    } catch { /* cancelled */ }
  };

  return (
    <>
      <div className="toolbar">
        <button className="btn ghost" onClick={onBack}>← {t("tk.back")}</button>
        <button className="btn ghost" onClick={onEdit}>{t("tk.edit")}</button>
      </div>
      <section className="card">
        <h2 className="card-h">{ticket.name}</h2>
        <p className="note">{range(ticket)}{ticket.time ? ` · ${ticket.time}` : ""}{ticket.place ? ` · ${ticket.place}` : ""} · {money(ticket.price, cur)}</p>
        <p className="note">{t("tk.sold", { n: ticket.paidCount || 0, max: ticket.max == null ? "∞" : ticket.max })}</p>
      </section>
      <section className="card">
        <h2 className="card-h">{t("tk.share")}</h2>
        <p className="note">{t("tk.shareHint")}</p>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t("tk.link")} />
        <div className="actions">
          <button className="btn primary" onClick={share}>{t("tk.shareBtn")}</button>
          <button className="btn ghost" onClick={() => navigator.clipboard.writeText(link).then(() => toast(t("tk.copied"))).catch(fail)}>{t("tk.copyLink")}</button>
        </div>
        {qr && (
          <div className="stack-sm">
            <div className="qr-tile"><img src={qr} alt={t("tk.qrAlt")} /></div>
            <a className="btn ghost block" href={qr} download={`${ticket.prefix}-qr.png`}>{t("tk.downloadQr")}</a>
          </div>
        )}
      </section>
      <section className="card">
        <h2 className="card-h">{t("tk.codes")}</h2>
        <p className="note">{t("tk.codesHint")}</p>
        <div className="field"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tk.search")} aria-label={t("tk.search")} autoComplete="off" /></div>
        <div className="field">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label={t("tk.filter")}>
            <option value="all">{t("tk.fAll")}</option>
            <option value="unpaid">{t("tk.fUnpaid")}</option>
            <option value="paid">{t("tk.fPaid")}</option>
            <option value="today">{t("tk.fToday")}</option>
          </select>
        </div>
        {!shown.length ? <p className="note">{t("tk.noCodes")}</p> : shown.map((c) => {
          const usedToday = (c.usedDays || []).includes(day);
          const everUsed = (c.usedDays || []).length > 0;
          return (
            <div className={`tcode ${usedToday ? "used" : ""}`} key={c.id}>
              <div className="tcode-main">
                <b className="mono">{c.code}</b>
                <span className="num">{c.qty}× · {money(ticket.price * c.qty, cur)}</span>
              </div>
              <div className="tcode-meta">
                {c.paid ? <span className="mpill">{t("tk.paid")}</span> : <span className="mpill off">{t("tk.unpaid")}</span>}
                {everUsed && <span className="mpill">{t("tk.usedDays", { days: (c.usedDays || []).map(dmy).join(", ") })}</span>}
              </div>
              {usedToday && <p className="hint err">{t("tk.alreadyUsed")}</p>}
              <div className="actions">
                {usedToday ? (
                  <button className="btn ghost sm" onClick={() => unmarkUsed(ticket, c, day).catch(fail)}>{t("tk.undoUsed")}</button>
                ) : (
                  <button className="btn primary sm" onClick={() => markUsed(ticket, c, day, by, byName, band.gig).then(() => toast(t("tk.markedUsed"))).catch(fail)}>{t("tk.markUsed")}</button>
                )}
                {c.paid ? (
                  <button className="btn ghost sm" disabled={everUsed} onClick={() => markUnpaid(ticket, c).catch(fail)}>{t("tk.unmarkPaid")}</button>
                ) : (
                  <button className="btn ghost sm" onClick={() => markPaid(ticket, c, by, byName, band.gig).then(() => toast(t("tk.markedPaid"))).catch(fail)}>{t("tk.markPaid")}</button>
                )}
                <button className="icon-btn" onClick={() => deleteCode(ticket, c).catch(fail)} aria-label={t("common.remove")}>×</button>
              </div>
            </div>
          );
        })}
      </section>
      {edit && edit !== "new" && <TicketSheet ticket={edit} onClose={() => setEdit(null)} onDeleted={() => { setEdit(null); onBack(); }} />}
    </>
  );
}

function TicketSheet({ ticket, onClose, onDeleted }: { ticket: Ticket | null; onClose: () => void; onDeleted: () => void }) {
  const t = useT();
  const toast = useToast();
  const { settings } = useSettings();
  const { bandId } = useTenant();
  const [name, setName] = useState(ticket?.name ?? "");
  const [place, setPlace] = useState(ticket?.place ?? "");
  const [startDate, setStart] = useState(ticket?.startDate ?? "");
  const [endDate, setEnd] = useState(ticket?.endDate ?? "");
  const [time, setTime] = useState(ticket?.time ?? "");
  const [price, setPrice] = useState(ticket ? String(ticket.price) : "");
  const [max, setMax] = useState(ticket?.max != null ? String(ticket.max) : "");
  const [prefix, setPrefix] = useState(ticket?.prefix ?? "");
  const [prefixTouched, setPrefixTouched] = useState(!!ticket);
  const [visible, setVisible] = useState(ticket?.visible ?? true);
  const [payUrl, setPayUrl] = useState(ticket?.payUrl ?? "");
  const [cardPay, setCardPay] = useState(ticket?.cardPay ?? false);
  const [qr, setQr] = useState<{ url: string; path: string } | null>(ticket?.qrUrl ? { url: ticket.qrUrl, path: ticket.qrPath || "" } : null);
  const autoPrefix = defaultPrefix(settings.bandName, bandId, startDate);
  const shownPrefix = prefixTouched ? prefix : autoPrefix;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pay = cleanPayUrl(payUrl);
    if (pay === null) return toast(t("item.payUrlBad"));
    if (!prefixOk(shownPrefix)) return toast(t("tk.prefixBad"));
    const end = endDate || startDate;
    if (end < startDate) return toast(t("tk.endBefore"));
    const m = max.trim() === "" ? null : Math.max(1, Math.round(Number(max)) || 1);
    const ref = ticket ? bandDoc("tickets", ticket.id) : doc(bandCol("tickets"));
    setDoc(ref, {
      name: name.trim(), place: place.trim(), startDate, endDate: end, time: time.trim(), price: Number(price) || 0, max: m,
      prefix: shownPrefix, visible, qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null, payUrl: pay || null, cardPay,
      ...(ticket ? {} : { paidCount: 0, createdAt: Date.now() }),
    }, { merge: true }).catch((x) => toast(errorText(x)));
    toast(t("tk.saved"));
    onClose();
  };

  return (
    <Sheet title={ticket ? t("tk.edit") : t("tk.new")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="tName">{t("tk.name")}</label><input id="tName" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tk.namePh")} /></div>
        <div className="field"><label htmlFor="tPlace">{t("tk.place")}</label><input id="tPlace" value={place} onChange={(e) => setPlace(e.target.value)} /></div>
        <div className="field"><label htmlFor="tStart">{t("tk.start")}</label><input id="tStart" type="date" required value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label htmlFor="tEnd">{t("tk.end")}</label><input id="tEnd" type="date" min={startDate} value={endDate} onChange={(e) => setEnd(e.target.value)} /><span className="hint">{t("tk.endHint")}</span></div>
        <div className="field"><label htmlFor="tTime">{t("tk.time")}</label><input id="tTime" value={time} onChange={(e) => setTime(e.target.value)} placeholder="20:00" /></div>
        <div className="field"><label htmlFor="tPrice">{t("tk.price", { cur: settings.currency })}</label><input id="tPrice" type="number" inputMode="decimal" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field"><label htmlFor="tMax">{t("tk.max")}</label><input id="tMax" type="number" inputMode="numeric" min="1" step="1" value={max} onChange={(e) => setMax(e.target.value)} placeholder={t("tk.unlimited")} /><span className="hint">{t("tk.maxHint")}</span></div>
        <div className="field"><label htmlFor="tPrefix">{t("tk.prefix")}</label><input id="tPrefix" value={shownPrefix} onChange={(e) => { setPrefix(e.target.value.replace(/\s/g, "")); setPrefixTouched(true); }} autoCapitalize="off" /><span className="hint">{t("tk.prefixHint", { ex: `${shownPrefix}-K7M2QX` })}</span></div>
        <PaySection idPrefix="t" qrUrl={qr?.url ?? null} onQr={setQr} payUrl={payUrl} onPayUrl={setPayUrl} cardPay={cardPay} onCardPay={setCardPay} />
        <Toggle id="tVisible" checked={visible} onChange={setVisible} label={t("tk.visible")} />
        <button className="btn primary block">{ticket ? t("tk.save") : t("tk.create")}</button>
        {ticket && (
          <ConfirmButton confirmText={t("tk.confirmDelete")} onConfirm={() => { deleteDoc(bandDoc("tickets", ticket.id)).catch((x) => toast(errorText(x))); toast(t("tk.deleted")); onDeleted(); }}>
            {t("tk.delete")}
          </ConfirmButton>
        )}
      </form>
    </Sheet>
  );
}
