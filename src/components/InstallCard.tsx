import { useEffect, useState } from "react";
import { useT } from "../i18n";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install the app": a button on Android/Chrome, a short how-to on iPhone, hidden once installed. */
export default function InstallCard() {
  const t = useT();
  const [ev, setEv] = useState<InstallEvent | null>(null);
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const done = () => setEv(null);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);

  if (standalone || (!ev && !ios)) return null;
  return (
    <section className="card">
      <h2 className="card-h">{t("install.title")}</h2>
      <p className="note">{ev ? t("install.android") : t("install.ios")}</p>
      {ev && <button className="btn block" onClick={() => { ev.prompt().catch(() => {}); setEv(null); }}>{t("install.button")}</button>}
    </section>
  );
}
