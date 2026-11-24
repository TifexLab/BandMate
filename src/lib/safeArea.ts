// iPhone / iPad apps added to the home screen are fussy about the window size:
//  1. env(safe-area-inset-*) can be 0 -> we set a fallback (--sa-top / --sa-bottom, read in styles.css; the larger of env() and the fallback wins).
//  2. After opening or resuming, the layout viewport can be shorter than the screen (by the status-bar height). Fixed elements (the bottom menu) then end
//     ~60px above the screen bottom and are clipped there. Rotating the phone makes iOS recompute it, so we try the same by toggling the viewport meta,
//     and meanwhile mark <html class="vp-short"> (a compact look, see styles.css). The state is re-checked every second because iOS often changes it
//     without any event, which used to leave the compact look on after the window had already been fixed.
let healTries = 0;
let healing = false;
let lastKey = "";
let originalViewport: string | null = null; // the viewport meta as shipped, captured once

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

/** Make iOS lay the window out again (what rotating the phone does) by briefly dropping viewport-fit from the viewport meta. */
function heal() {
  if (healing || healTries >= 4 || document.hidden) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  if (originalViewport === null) originalViewport = meta.getAttribute("content") || "";
  healing = true;
  healTries++;
  meta.setAttribute("content", originalViewport.replace(/,?\s*viewport-fit=cover/, ""));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    meta.setAttribute("content", originalViewport as string);
    healing = false;
    setTimeout(apply, 150);
  }));
}

function apply() {
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
  if (key !== lastKey) { // only touch the page when something actually changed
    lastKey = key;
    top ? root.style.setProperty("--sa-top", `${top}px`) : root.style.removeProperty("--sa-top");
    bottom ? root.style.setProperty("--sa-bottom", `${bottom}px`) : root.style.removeProperty("--sa-bottom");
    gap ? root.style.setProperty("--vp-gap", `${gap}px`) : root.style.removeProperty("--vp-gap");
    root.classList.toggle("vp-short", gap > 0);
  }
  if (gap > 0) heal(); // a few tries per launch / resume
  else healTries = 0;
}

export function initSafeArea() {
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", () => { healTries = 0; setTimeout(apply, 100); });
  window.addEventListener("pageshow", () => { healTries = 0; apply(); });
  window.addEventListener("focus", apply);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { healTries = 0; apply(); setTimeout(apply, 400); } });
  if (isStandaloneIPhoneOrIPad()) setInterval(apply, 1000);
}
