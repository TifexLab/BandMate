// iPhone / iPad apps added to the home screen are fussy about the window size:
//  1. env(safe-area-inset-*) can be 0 -> we set a fallback (--sa-top / --sa-bottom, read in styles.css; the larger of env() and the fallback wins).
//  2. After opening or resuming, the layout viewport can be shorter than the screen (by the status-bar height). Fixed elements (the bottom menu) then end
//     ~60px above the screen bottom and are clipped there. We mark <html class="vp-short"> (a compact look, see styles.css) and re-check every second,
//     because iOS often changes it without any event (rotating the phone makes iOS recompute it). DO NOT try to "fix" the window by toggling the viewport
//     meta: that made the layout flip back and forth in a loop (strobing header and menu).
let lastKey = "";
let pendingKey = ""; // a change is applied only after it was measured twice in a row, so a flickering reading can never make the layout flip

const isStandaloneIPhoneOrIPad = () => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && standalone;
};

/** Where `bottom: 0` really lands, compared with the screen height; > 0 means the window is shorter than the screen. */
function viewportGap(): number {
  if (!/iphone/i.test(navigator.userAgent) || window.innerHeight < window.innerWidth) return 0;
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none";
  document.body.appendChild(m);
  const gap = Math.round(screen.height - m.getBoundingClientRect().bottom);
  m.remove();
  return gap >= 20 && gap <= 100 ? gap : 0;
}

function apply(immediate = false) {
  const root = document.documentElement;
  if (!document.body) return;
  let top = 0, bottom = 0, gap = 0;
  if (isStandaloneIPhoneOrIPad()) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const real = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    probe.remove();
    if (real === 0) {
      const portrait = window.innerHeight >= window.innerWidth;
      const h = Math.max(screen.width, screen.height);
      const tablet = Math.min(screen.width, screen.height) >= 700;
      top = tablet ? 24 : !portrait ? 0 : h >= 874 ? 62 : h >= 852 ? 59 : h >= 812 ? 47 : 20;
      bottom = tablet ? 20 : h >= 812 ? (portrait ? 34 : 21) : 0;
    }
    gap = viewportGap();
  }
  const key = `${top}/${bottom}/${gap}`;
  if (key !== lastKey) { // only touch the page when something actually changed (and was measured twice in a row)
    if (!immediate && key !== pendingKey) { pendingKey = key; return; }
    pendingKey = "";
    lastKey = key;
    top ? root.style.setProperty("--sa-top", `${top}px`) : root.style.removeProperty("--sa-top");
    bottom ? root.style.setProperty("--sa-bottom", `${bottom}px`) : root.style.removeProperty("--sa-bottom");
    gap ? root.style.setProperty("--vp-gap", `${gap}px`) : root.style.removeProperty("--vp-gap");
    root.classList.toggle("vp-short", gap > 0);
  }
}

export function initSafeArea() {
  apply(true);
  window.addEventListener("resize", () => apply());
  window.addEventListener("orientationchange", () => { setTimeout(() => apply(), 100); });
  window.addEventListener("pageshow", () => { apply(); apply(); });
  window.addEventListener("focus", () => apply());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { apply(); setTimeout(() => apply(), 400); } });
  if (isStandaloneIPhoneOrIPad()) setInterval(() => apply(), 1000);
}
