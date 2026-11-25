import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/format";
import { useT } from "../i18n";

/** "Continue with Google" popup. Works only on addresses on Firebase's authorized-domains list (bandmate.shop), not on <band>.bandmate.shop. */
export default function GoogleSignIn({ onError }: { onError: (message: string) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    onError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (x) {
      const code = (x as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") onError(code === "auth/unauthorized-domain" ? t("login.googleDomain") : errorText(x));
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" className="btn ghost block" disabled={busy} onClick={go}>{t("login.google")}</button>;
}
