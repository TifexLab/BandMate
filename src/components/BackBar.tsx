import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../state/tenant";
import { useSwipeBack } from "../lib/swipeBack";
import { useT } from "../i18n";

/** One step back: the real browser history when there is some, else a fixed page (`fallback`, e.g. when the page was opened from a shared link). */
export function useGoBack(fallback: string) {
  const nav = useNavigate();
  const { base } = useTenant();
  return useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) nav(-1);
    else nav((base + (fallback === "/" ? "" : fallback)) || "/", { replace: true });
  }, [nav, base, fallback]);
}

/** Back button at the top left, plus swiping right across the screen does the same. */
export default function BackBar({ fallback }: { fallback: string }) {
  const t = useT();
  const back = useGoBack(fallback);
  useSwipeBack(back);
  return (
    <div className="backbar">
      <button type="button" className="backbtn" onClick={back} aria-label={t("tk.back")}>← {t("tk.back")}</button>
    </div>
  );
}
