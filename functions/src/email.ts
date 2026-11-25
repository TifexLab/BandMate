// Sends mail through Resend (https://resend.com). Needs the RESEND_API_KEY secret and a verified sender address.
export interface Mail { from: string; to: string; subject: string; html: string; attachments?: { filename: string; content: string }[] }
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function sendMail(fetchImpl: FetchLike, apiKey: string, mail: Mail): Promise<void> {
  const res = await fetchImpl("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(mail) });
  if (!res.ok) throw new Error(`mail failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** The buyer's e-mail: short text, the PDF is attached. */
export function ticketMail(lang: "sk" | "en", o: { bandName: string; ticketName: string; dateText: string; qty: number }): { subject: string; html: string } {
  const sk = lang === "sk";
  const subject = sk ? `Tvoje lístky: ${o.ticketName}` : `Your tickets: ${o.ticketName}`;
  const html = sk
    ? `<p>Ďakujeme za nákup!</p><p><b>${esc(o.ticketName)}</b> (${esc(o.bandName)})<br>${esc(o.dateText)}<br>Počet lístkov: ${o.qty}</p><p>Lístky (každý s vlastným QR kódom) sú v prílohe vo formáte PDF. Na vstupe ukáž QR kód z PDF. Každý kód platí raz za deň.</p>`
    : `<p>Thank you for your purchase!</p><p><b>${esc(o.ticketName)}</b> (${esc(o.bandName)})<br>${esc(o.dateText)}<br>Tickets: ${o.qty}</p><p>Your tickets (each with its own QR code) are attached as a PDF. Show the QR code at the door. Each code is valid once per day.</p>`;
  return { subject, html };
}
