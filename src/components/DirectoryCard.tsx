import { useEffect } from "react";
import { useLiveDoc } from "../lib/live";
import { directoryDoc, listInDirectory, unlistFromDirectory } from "../lib/directory";
import { useSettings } from "../state/settings";
import { useTenant } from "../state/tenant";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { errorText } from "../lib/format";
import { useT } from "../i18n";
import { Toggle } from "./ui";

/** Settings card: show this band in the public directory on the BandMate home page (off by default, admin only). */
export default function DirectoryCard() {
  const t = useT();
  const { bandId } = useTenant();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const toast = useToast();
  const entry = useLiveDoc<{ name: string; logoUrl: string | null }>(() => directoryDoc(bandId), `dir-${bandId}`);
  const listed = !!entry.data;
  const isAdmin = profile?.role === "admin";

  // Keep the listed name and logo in step with the band's settings.
  useEffect(() => {
    if (!isAdmin || !entry.data) return;
    const name = settings.bandName.trim() || bandId;
    if (entry.data.name !== name || (entry.data.logoUrl || null) !== (settings.logoUrl || null)) {
      listInDirectory(bandId, name, settings.logoUrl).catch(() => {});
    }
  }, [isAdmin, entry.data, settings.bandName, settings.logoUrl, bandId]);

  if (!isAdmin) return null;
  const change = (on: boolean) => {
    (on ? listInDirectory(bandId, settings.bandName, settings.logoUrl) : unlistFromDirectory(bandId)).catch((e) => toast(errorText(e)));
  };
  return (
    <section className="card">
      <h2 className="card-h">{t("dir.title")}</h2>
      <Toggle id="dirListed" checked={listed} onChange={change} label={t("dir.toggle")} hint={t("dir.hint")} />
    </section>
  );
}
