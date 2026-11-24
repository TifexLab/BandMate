import { useEffect, useState } from "react";
import { useT } from "../i18n";

/** /diag: shows how big the window really is on this device, to debug layout problems in a home-screen app. */
export default function DiagPage() {
  const t = useT();
  const [, tick] = useState(0);
  const [env, setEnv] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    window.addEventListener("resize", on);
    window.visualViewport?.addEventListener("resize", on);
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    setEnv({ top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 });
    probe.remove();
    return () => { window.removeEventListener("resize", on); window.visualViewport?.removeEventListener("resize", on); };
  }, []);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const rows: [string, string][] = [
    ["innerWidth x innerHeight", `${window.innerWidth} x ${window.innerHeight}`],
    ["visualViewport", `${Math.round(window.visualViewport?.width ?? 0)} x ${Math.round(window.visualViewport?.height ?? 0)}`],
    ["screen", `${screen.width} x ${screen.height}`],
    ["documentElement client", `${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`],
    ["env(safe-area) top/right/bottom/left", `${env.top} / ${env.right} / ${env.bottom} / ${env.left}`],
    ["--sa-top / --sa-bottom", `${getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim() || "-"} / ${getComputedStyle(document.documentElement).getPropertyValue("--sa-bottom").trim() || "-"}`],
    ["home-screen app (standalone)", String(standalone)],
    ["devicePixelRatio", String(window.devicePixelRatio)],
    ["orientation", window.innerHeight >= window.innerWidth ? "portrait" : "landscape"],
    ["userAgent", navigator.userAgent],
  ];
  return (
    <main className="page">
      <div className="wrap">
        <h1>{t("diag.title")}</h1>
        <p className="note">{t("diag.hint")}</p>
        <div className="stack-sm">
          {rows.map(([k, v]) => (
            <div className="card" key={k}><small className="note">{k}</small><div className="mono">{v}</div></div>
          ))}
        </div>
      </div>
      <div className="diag-top" aria-hidden="true" />
      <div className="diag-bottom" aria-hidden="true" />
    </main>
  );
}
