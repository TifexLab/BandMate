// Calls to the BandMate server (functions/): Stripe Connect onboarding and ticket checkout. Both stay switched off until CARD_CHECKOUT_ENABLED (lib/plans.ts) is true.
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

const functions = () => getFunctions(app, "europe-west1");

/** Band admin: open Stripe's own form for the band's payout account (IBAN + identity). Returns the Stripe URL to go to. */
export async function startConnectOnboarding(bandId: string): Promise<string> {
  const r = await httpsCallable<{ bandId: string }, { url: string }>(functions(), "createConnectLink")({ bandId });
  return r.data.url;
}

/** Fan: pay for `qty` tickets by card. Returns the Stripe Checkout URL to go to. */
export async function startTicketCheckout(bandId: string, ticketId: string, qty: number, lang: string): Promise<string> {
  const r = await httpsCallable<{ bandId: string; ticketId: string; qty: number; lang: string }, { url: string }>(functions(), "createTicketCheckout")({ bandId, ticketId, qty, lang });
  return r.data.url;
}
