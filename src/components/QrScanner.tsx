import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

/** Camera view that reads one QR code (jsqr, in the browser, nothing is uploaded) and reports its text once. */
export default function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setErr(t("tk.scanNoCamera"));
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        return setErr(t("tk.scanDenied"));
      }
      if (stopped) return stream.getTracks().forEach((x) => x.stop());
      const v = video.current!;
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      await v.play().catch(() => {});
      const { default: jsQR } = await import("jsqr");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        if (stopped || done.current) return;
        if (v.videoWidth) {
          const w = Math.min(720, v.videoWidth);
          const h = Math.round((v.videoHeight * w) / v.videoWidth);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
          if (hit?.data) {
            done.current = true;
            onScan(hit.data);
            return;
          }
        }
        timer = window.setTimeout(tick, 150);
      };
      tick();
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((x) => x.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scanbox">
      {err ? <p className="hint err">{err}</p> : <video ref={video} muted playsInline />}
      {!err && <p className="note center">{t("tk.scanAim")}</p>}
    </div>
  );
}
