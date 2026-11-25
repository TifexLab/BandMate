// iPhone / iPad apps added to the home screen are fussy about the window:
//  1. env(safe-area-inset-*) can be 0 -> we set a fallback (--sa-top / --sa-bottom, read in styles.css; the larger of env() and the fallback wins).
//  2. The layout viewport can start ~62px shorter than the screen (fixed after the first tap or a rotation), which clipped position:fixed elements and made the
//     bottom menu jump between two looks. In a home-screen app we therefore mark <html class="ios-app">; styles.css then builds the page as a 100dvh scroller
//     with a sticky header and a sticky menu, so nothing depends on position:fixed. DO NOT try to "fix" the window by toggling the viewport meta (it looped and
//     made the header and menu strobe) and do not bring back position:fixed for the menu in this mode.
const isHomeScreenApp = () => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && standalone;
};

/** Height of the app window: the full screen height in a home-screen app, even when iOS first reports a window that is ~62px shorter (it is fixed after the
 *  first tap or a rotation). Only an iPhone and only when the difference is small, otherwise the real inner height is used. */
function appHeight() {
  if (!/iphone/i.test(navigator.userAgent)) return window.innerHeight;
  const portrait = window.innerHeight >= window.innerWidth;
  const full = portrait ? screen.height : screen.width;
  return full >= window.innerHeight && full - window.innerHeight <= 100 ? full : window.innerHeight;
}

function applyInsets() {
  const root = document.documentElement;
  if (!document.body) return;
  root.style.setProperty("--app-h", `${appHeight()}px`);
  let top = 0, bottom = 0;
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
  top ? root.style.setProperty("--sa-top", `${top}px`) : root.style.removeProperty("--sa-top");
  bottom ? root.style.setProperty("--sa-bottom", `${bottom}px`) : root.style.removeProperty("--sa-bottom");
}

export function initSafeArea() {
  if (!isHomeScreenApp()) return;
  document.documentElement.classList.add("ios-app"); // before the first paint
  applyInsets();
  // The window itself must never scroll (only #root does): if iOS scrolls it (e.g. to reveal a focused field) put it back at once.
  window.addEventListener("scroll", () => { if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0); }, { passive: true });
  window.addEventListener("resize", applyInsets);
  window.addEventListener("orientationchange", () => setTimeout(applyInsets, 100));
}
