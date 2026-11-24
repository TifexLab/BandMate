// iPhone / iPad apps added to the home screen sometimes report 0 for env(safe-area-inset-*), so the header slid under the status bar and the
// bottom menu sat on the home-indicator line. When that happens we set a fallback (--sa-top / --sa-bottom, read in styles.css); where env() works
// (browsers, other phones) nothing is set and the real values are used.
function apply() {
  const root = document.documentElement;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  root.style.removeProperty("--sa-top");
  root.style.removeProperty("--sa-bottom");
  if (!ios || !standalone || !document.body) return;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const real = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  probe.remove();
  if (real > 0) return; // the real values work
  const portrait = window.innerHeight >= window.innerWidth;
  const h = Math.max(screen.width, screen.height);
  const tablet = Math.min(screen.width, screen.height) >= 700;
  const top = tablet ? 24 : !portrait ? 0 : h >= 852 ? 59 : h >= 812 ? 47 : 20;
  const bottom = tablet ? 20 : h >= 812 ? (portrait ? 34 : 21) : 0;
  root.style.setProperty("--sa-top", `${top}px`);
  root.style.setProperty("--sa-bottom", `${bottom}px`);
}
export function initSafeArea() {
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
}
