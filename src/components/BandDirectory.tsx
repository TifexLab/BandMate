import { useEffect, useState } from "react";
import { fetchDirectory, fold, type DirectoryEntry } from "../lib/directory";
import { bandUrl } from "../lib/host";
import { useT } from "../i18n";

/** Fans: find a band by any part of its name, or scroll the A-Z list, then open that band's own address. */
export default function BandDirectory() {
  const t = useT();
  const [all, setAll] = useState<DirectoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetchDirectory().then(setAll).catch(() => setFailed(true));
  }, []);
  if (failed || (all && !all.length)) return null; // nothing to show yet
  const needle = fold(q.trim());
  const shown = (all ?? []).filter((b) => !needle || fold(b.name).includes(needle));
  return (
    <section className="dir">
      <h2 className="card-h">{t("dir.find")}</h2>
      <div className="field">
        <input type="search" aria-label={t("dir.find")} placeholder={t("dir.search")} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      {!all ? (
        <p className="note">{t("common.loading")}</p>
      ) : !shown.length ? (
        <p className="note">{t("dir.none")}</p>
      ) : (
        <ul className="dir-list">
          {shown.map((b) => (
            <li key={b.id}>
              <a href={bandUrl(b.id)}>
                {b.logoUrl ? <img src={b.logoUrl} alt="" /> : <span className="dir-ph">{b.name.slice(0, 1).toUpperCase()}</span>}
                <span>{b.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
