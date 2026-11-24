import { useEffect, useRef } from "react";

/** A finger swipe to the right across the screen = one step back. Ignores swipes that start on carousels, sheets and form fields. */
export function useSwipeBack(onBack: () => void) {
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    let sx = 0, sy = 0, active = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      active = e.touches.length === 1 && !(e.target as HTMLElement).closest(".car-track, .viewer, .scrim, input, select, textarea, [data-noswipe]");
    };
    const end = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
      if (dx > 80 && dy < 70 && dy < dx * 0.5) cb.current();
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, []);
}
