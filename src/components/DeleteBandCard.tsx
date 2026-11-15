import { useState } from "react";
import { deleteOwnBand } from "../lib/platform";
import { platformUrl } from "../lib/host";
import { useAuth } from "../state/auth";
import { useTenant } from "../state/tenant";
import { useSettings } from "../state/settings";
import { useT } from "../i18n";
import { Sheet } from "./ui";

/** Settings: an admin can delete their own band and register again (e.g. after a typo in the address). */
export default function DeleteBandCard() {
  const t = useT();
  const { profile, user } = useAuth();
  const { bandId } = useTenant();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (profile?.role !== "admin" || !user) return null;

  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      await deleteOwnBand(bandId, user.uid);
      window.location.assign(platformUrl("/start")); // a fresh start: the registration form
    } catch {
      setErr(t("mydel.failed"));
      setBusy(false);
    }
  };

  return (
    <section className="card danger-zone">
      <h2 className="card-h">{t("mydel.cardTitle")}</h2>
      <p className="note">{t("mydel.cardText")}</p>
      <button className="btn danger" onClick={() => { setOpen(true); setTyped(""); setErr(""); }}>{t("mydel.open")}</button>
      {open && (
        <Sheet title={t("mydel.title", { name: settings.bandName || bandId })} onClose={() => !busy && setOpen(false)}>
          <p className="note">{t("mydel.warn", { id: bandId })}</p>
          <div className="field">
            <label htmlFor="myDelConfirm">{t("mydel.type", { id: bandId })}</label>
            <input id="myDelConfirm" value={typed} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy} onChange={(e) => setTyped(e.target.value)} />
          </div>
          {err && <p className="hint err">{err}</p>}
          <button className="btn danger block" disabled={typed.trim() !== bandId || busy} onClick={go}>{busy ? t("mydel.deleting") : t("mydel.go")}</button>
          <button className="btn ghost block" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
        </Sheet>
      )}
    </section>
  );
}
