import { useState, type FormEvent } from "react";
import { mailtoSupport, sendSupportMessage, SUPPORT_EMAIL } from "../lib/support";
import { useAuth } from "../state/auth";
import { useSettings } from "../state/settings";
import { useTenant } from "../state/tenant";
import { useToast } from "../state/toast";
import { errorText } from "../lib/format";
import { useT } from "../i18n";

/** Settings card: write to the BandMate admin. */
export default function ContactAdminCard() {
  const t = useT();
  const { profile, user } = useAuth();
  const { settings } = useSettings();
  const { bandId } = useTenant();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const bandName = settings.bandName || bandId;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email || !text.trim()) return;
    setBusy(true);
    sendSupportMessage({ uid: user.uid, email: user.email, name: profile?.displayName ?? "", bandId, bandName, message: text.trim().slice(0, 2000) })
      .then(() => { setSent(true); setText(""); })
      .catch((x) => toast(errorText(x)))
      .finally(() => setBusy(false));
  };

  return (
    <section className="card">
      <h2 className="card-h">{t("sup.title")}</h2>
      <p className="note">{t("sup.lead")}</p>
      {sent ? (
        <>
          <p className="notice">{t("sup.sent")}</p>
          <button className="btn ghost block" onClick={() => setSent(false)}>{t("sup.another")}</button>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="supMsg">{t("sup.message")}</label>
            <textarea id="supMsg" required rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("sup.ph")} />
          </div>
          <button className="btn primary block" disabled={busy || !text.trim()}>{t("sup.send")}</button>
        </form>
      )}
      <p className="hint center">
        {t("sup.orMail")} <a href={mailtoSupport(`BandMate: ${bandName}`, `${t("sup.mailBody", { band: bandName, email: user?.email ?? "" })}\n\n`)}>{SUPPORT_EMAIL}</a>
      </p>
    </section>
  );
}
