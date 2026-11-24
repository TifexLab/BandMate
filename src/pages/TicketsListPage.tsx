import { Link } from "../lib/nav";
import { query, where } from "firebase/firestore";
import { bandCol } from "../lib/scope";
import { useLiveQuery } from "../lib/live";
import { money } from "../lib/format";
import { isEnded } from "../lib/tickets";
import { useSettings } from "../state/settings";
import { useTenant } from "../state/tenant";
import { useT } from "../i18n";
import BackBar from "../components/BackBar";
import LangSwitch from "../components/LangSwitch";
import { LogoBackdrop } from "../components/brand";
import { Loading } from "../components/ui";
import type { Ticket } from "../types";

const dmy = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : s; };

/** A separate screen for fans: the band's upcoming concerts / events with tickets (merch stays on the main page). */
export default function TicketsListPage() {
  const t = useT();
  const { bandId } = useTenant();
  const { settings } = useSettings();
  const list = useLiveQuery<Ticket>(() => query(bandCol("tickets"), where("visible", "==", true)), `pub-tickets-${bandId}`);
  const upcoming = list.data.filter((x) => !isEnded(x)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <>
      <LogoBackdrop settings={settings} />
      <BackBar fallback="/" />
      <header className="hero">
        <div className="hero-in">
          {settings.logoInHeader && settings.logoUrl && <img className="hero-logo" src={settings.logoUrl} alt="" />}
          <div className="hero-txt"><h1>{settings.bandName || t("tk.concerts")}</h1><p>{t("tk.concerts")}</p></div>
          <LangSwitch />
        </div>
      </header>
      <main className="page">
        <div className="wrap">
          {!list.ready ? <Loading /> : !upcoming.length ? (
            <div className="empty"><h3>{t("tk.noUpcoming")}</h3></div>
          ) : (
            <div className="grid">
              {upcoming.map((x) => (
                <article className="tile" key={x.id}>
                  <div className="tile-top">
                    <div>
                      <h3>{x.name}</h3>
                      <div className="sub">{x.endDate && x.endDate !== x.startDate ? `${dmy(x.startDate)} – ${dmy(x.endDate)}` : dmy(x.startDate)}{x.time ? ` · ${x.time}` : ""}{x.place ? ` · ${x.place}` : ""}</div>
                    </div>
                    <span className="tag">{money(x.price, settings.currency)}</span>
                  </div>
                  <Link className="btn primary block" to={`/listok/${x.id}`}>{t("tk.fanBuy")}</Link>
                </article>
              ))}
            </div>
          )}
          <footer className="foot"><Link to="/">{t("tk.toMerch")}</Link></footer>
        </div>
      </main>
    </>
  );
}
