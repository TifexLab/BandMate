import { useState, type ReactNode } from "react";
import { useT, type Key } from "../i18n";

// The in-app manual (Settings). Each topic is an expandable row; its texts are help.<id>.title / .lead / .b1…bN
// in src/i18n/en.ts and sk.ts. Add a topic: add it here with its bullet count, then write the keys in both languages.
const svg = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const TOPICS: { id: string; bullets: number; icon: ReactNode }[] = [
  { id: "start", bullets: 5, icon: svg("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h0") },
  { id: "stock", bullets: 6, icon: svg("M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8") },
  { id: "qr", bullets: 5, icon: svg("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4M14 18h2") },
  { id: "sell", bullets: 4, icon: svg("M3 7h18l-2 12H5zM8 7a4 4 0 0 1 8 0") },
  { id: "bundles", bullets: 3, icon: svg("M3 8h18v13H3zM3 12h18M12 8v13M12 8c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1") },
  { id: "tickets", bullets: 6, icon: svg("M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3zM14 6v12") },
  { id: "sales", bullets: 3, icon: svg("M4 20V10M10 20V4M16 20v-7M22 20H2") },
  { id: "fan", bullets: 5, icon: svg("M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z") },
  { id: "look", bullets: 3, icon: svg("M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5zM7.5 11h0M10 7.5h0M14.5 7.5h0") },
  { id: "people", bullets: 4, icon: svg("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 7") },
  { id: "plans", bullets: 4, icon: svg("M12 2l3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.500l-5-5 7-1z") },
  { id: "directory", bullets: 3, icon: svg("M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3") },
  { id: "install", bullets: 3, icon: svg("M7 2h10v20H7zM12 7v8M9 12l3 3 3-3") },
  { id: "account", bullets: 6, icon: svg("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0") },
];

/** Expandable manual: tap a topic to open how that part of the app works. One topic is open at a time. */
export default function Help() {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card help">
      <h2 className="card-h">{t("help.title")}</h2>
      <p className="note">{t("help.intro")}</p>
      <div className="acc">
        {TOPICS.map((tp) => {
          const isOpen = open === tp.id;
          const key = (suffix: string) => `help.${tp.id}.${suffix}` as Key;
          return (
            <div className={`acc-item ${isOpen ? "open" : ""}`} key={tp.id}>
              <button type="button" className="acc-head" aria-expanded={isOpen} aria-controls={`help-${tp.id}`} id={`help-h-${tp.id}`} onClick={() => setOpen(isOpen ? null : tp.id)}>
                <span className="acc-ico">{tp.icon}</span>
                <span className="acc-title">{t(key("title"))}</span>
                <svg className="acc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className="acc-panel" id={`help-${tp.id}`} role="region" aria-labelledby={`help-h-${tp.id}`} aria-hidden={!isOpen}>
                <div className="acc-in">
                  <p className="acc-lead">{t(key("lead"))}</p>
                  <ul>
                    {Array.from({ length: tp.bullets }, (_, i) => (
                      <li key={i}>{t(key(`b${i + 1}`))}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
