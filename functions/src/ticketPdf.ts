// PDF the buyer gets by e-mail: one page per ticket with the event, the code and its QR.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PdfTicket { code: string; url: string }
export interface PdfInfo { bandName: string; ticketName: string; dateText: string; place: string; time: string; lang: "sk" | "en" }

const T = {
  sk: { ticket: "Vstupenka", code: "Kód", one: "1 osoba", hint: "Na vstupe ukáž tento QR kód. Platí raz za deň.", of: (i: number, n: number) => `Lístok ${i} z ${n}` },
  en: { ticket: "Ticket", code: "Code", one: "1 person", hint: "Show this QR code at the door. Valid once per day.", of: (i: number, n: number) => `Ticket ${i} of ${n}` },
};
const font = (name: string) => readFileSync(join(__dirname, "..", "assets", name));

export async function buildTicketsPdf(info: PdfInfo, tickets: PdfTicket[]): Promise<Uint8Array> {
  const L = T[info.lang];
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(font("DejaVuSans.ttf"), { subset: true });
  const bold = await pdf.embedFont(font("DejaVuSans-Bold.ttf"), { subset: true });
  const ink = rgb(0.07, 0.07, 0.07), muted = rgb(0.4, 0.4, 0.4), accent = rgb(0.93, 0.4, 0.2);
  for (const [i, tk] of tickets.entries()) {
    const page = pdf.addPage([420, 595]);
    const w = page.getWidth();
    const center = (text: string, y: number, size: number, f = regular, color = ink) => page.drawText(text, { x: (w - f.widthOfTextAtSize(text, size)) / 2, y, size, font: f, color });
    page.drawRectangle({ x: 0, y: 555, width: w, height: 40, color: accent });
    center(info.bandName, 568, 15, bold, rgb(1, 1, 1));
    center(L.ticket.toUpperCase(), 520, 12, bold, muted);
    // long names wrap onto two lines
    const words = info.ticketName.split(" "); let line = ""; const lines: string[] = [];
    for (const wd of words) { const next = line ? `${line} ${wd}` : wd; if (bold.widthOfTextAtSize(next, 22) > w - 60 && line) { lines.push(line); line = wd; } else line = next; }
    lines.push(line);
    lines.slice(0, 2).forEach((l, k) => center(l, 485 - k * 28, 22, bold));
    const y0 = 485 - Math.min(lines.length, 2) * 28 - 4;
    center([info.dateText, info.time].filter(Boolean).join("  ·  "), y0, 13);
    if (info.place) center(info.place, y0 - 20, 13, regular, muted);
    const png = await QRCode.toBuffer(tk.url, { margin: 1, width: 600, errorCorrectionLevel: "M" });
    const img = await pdf.embedPng(png);
    const size = 230;
    page.drawImage(img, { x: (w - size) / 2, y: y0 - 50 - size, width: size, height: size });
    center(`${L.code}: ${tk.code}`, y0 - 82 - size, 14, bold);
    center(`${L.one}  ·  ${L.of(i + 1, tickets.length)}`, y0 - 104 - size, 11, regular, muted);
    center(L.hint, 40, 10, regular, muted);
  }
  return pdf.save();
}
