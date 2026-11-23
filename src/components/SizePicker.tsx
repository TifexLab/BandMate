import { useState } from "react";
import { useT } from "../i18n";

/** The sizes offered as ready-made cells; a band can add its own next to them. */
export const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

/** "Which sizes am I adding to stock, and how many of each?" for a NEW product: tap a size to switch it on, then type its
 *  pieces under it. With no size switched on the product has one size and one number. `counts` holds the switched-on sizes
 *  (size -> pieces as typed). */
export default function SizePicker({ counts, onCounts, custom, onCustom, one, onOne, taken }: {
  counts: Record<string, string>;
  onCounts: (c: Record<string, string>) => void;
  custom: string[];
  onCustom: (c: string[]) => void;
  one: string;
  onOne: (v: string) => void;
  /** Sizes this product already has in stock (same name), shown but not selectable. */
  taken: string[];
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  // Own sizes this product already has (e.g. "Kids") are shown too, switched off, so the row tells the whole story.
  const known = [...PRESET_SIZES, ...custom];
  const oldCustom = taken.filter((sz) => !known.some((k) => k.toLowerCase() === sz.toLowerCase()));
  const all = [...known, ...oldCustom];
  const takenLower = taken.map((x) => x.toLowerCase());
  const none = Object.keys(counts).length === 0;

  const toggle = (sz: string) => {
    const next = { ...counts };
    if (sz in next) delete next[sz];
    else next[sz] = "";
    onCounts(next);
  };

  const addCustom = () => {
    const fresh: string[] = [];
    for (const raw of draft.split(",")) {
      const sz = raw.trim().slice(0, 12);
      const low = sz.toLowerCase();
      if (!sz || all.some((a) => a.toLowerCase() === low) || fresh.some((a) => a.toLowerCase() === low) || takenLower.includes(low)) continue;
      fresh.push(sz);
    }
    if (fresh.length) {
      onCustom([...custom, ...fresh]);
      const next = { ...counts };
      fresh.forEach((sz) => (next[sz] = ""));
      onCounts(next);
    }
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="field sizepick">
      <span className="label">{t("item.sizes")}</span>
      <div className="sizecols">
        {all.map((sz) => {
          const on = sz in counts;
          const isTaken = takenLower.includes(sz.toLowerCase());
          return (
            <div className="sizecol" key={sz}>
              <button type="button" className={`sizecell ${on ? "sel" : ""}`} aria-pressed={on} disabled={isTaken} title={isTaken ? t("item.sizeTaken") : undefined} onClick={() => toggle(sz)}>
                {sz}
              </button>
              {on && (
                <input className="sizecount" type="number" inputMode="numeric" min="0" step="1" required placeholder="0" value={counts[sz]} aria-label={t("item.piecesOf", { size: sz })} onChange={(e) => onCounts({ ...counts, [sz]: e.target.value })} />
              )}
            </div>
          );
        })}
        <div className="sizecol">
          <button type="button" className={`sizecell plus ${adding ? "sel" : ""}`} aria-label={t("item.sizeAdd")} aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
            +
          </button>
        </div>
      </div>
      {adding && (
        <div className="row-form sizeadd">
          <input
            autoFocus
            value={draft}
            maxLength={40}
            placeholder={t("item.sizeAddPh")}
            aria-label={t("item.sizeAdd")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // this sits inside the item form: Enter adds the size, it doesn't save the product
                addCustom();
              }
            }}
          />
          <button type="button" className="btn ghost" disabled={!draft.trim()} onClick={addCustom}>{t("item.sizeAddGo")}</button>
        </div>
      )}
      {none ? (
        <div className="field">
          <label htmlFor="fCountOne">{t("item.pieces")}</label>
          <input id="fCountOne" type="number" inputMode="numeric" min="0" step="1" required value={one} onChange={(e) => onOne(e.target.value)} />
          <span className="hint">{t("item.noSizeHint")}</span>
        </div>
      ) : (
        <span className="hint">{t("item.sizesHint")}</span>
      )}
    </div>
  );
}
