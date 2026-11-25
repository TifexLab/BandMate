export type Role = "pending" | "bandmate" | "admin" | "disabled";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt?: number;
  approvedBy?: string | null;
  approvedAt?: number | null;
}

/** A product photo stored in Firebase Storage (public/photos/*). */
export interface Photo {
  url: string;
  path: string;
}

export interface Item {
  id: string;
  name: string;
  variant: string;
  price: number;
  qrUrl: string | null;
  qrPath: string | null;
  /** Optional https payment link (from the bank) a fan on a phone can tap instead of scanning. */
  payUrl?: string | null;
  /** The band ticked card payment (Stripe) for this product. Takes effect once Stripe is connected. */
  cardPay?: boolean;
  visible: boolean;
  soldOut: boolean;
  /** Public stock hints, present only while the band chose to show them (see lib/stockView.ts). */
  left?: number;
  low?: boolean;
  order: number;
  /** Shared by every size of the same product (kept in sync on save). First one is the main photo. */
  images?: Photo[];
}

export interface BundlePart {
  name: string;
  qty: number;
}

export interface Bundle {
  id: string;
  name: string;
  price: number;
  parts: BundlePart[];
  qrUrl: string | null;
  qrPath: string | null;
  payUrl?: string | null;
  cardPay?: boolean;
  visible: boolean;
  order: number;
  images?: Photo[];
}

export interface Pick {
  itemId: string;
  qty: number;
}

export interface SaleLine {
  kind: "item" | "bundle" | "ticket";
  refId: string;
  label: string;
  detail?: string;
  price: number;
  qty: number;
  picks: Pick[];
}

export interface BasketLine extends SaleLine {
  key: string;
  qrUrl: string | null;
}

export type Method = "qr" | "cash" | "card" | "quick";

export interface Sale {
  id: string;
  at: number;
  by: string;
  byName: string;
  method: Method;
  gig: string;
  total: number;
  lines: SaleLine[];
  undone: boolean;
}

export interface Theme {
  primary: string;
  bg: string;
  surface: string;
  text: string;
}

export interface SocialLink {
  type: string;
  url: string;
}

export interface TopBarSettings {
  enabled: boolean;
  email: string;
  links: SocialLink[];
}

/** What fans may see about stock: exact count, a "few left" highlight (<= threshold pieces), both or neither. */
export interface StockView {
  count: boolean;
  low: boolean;
  threshold: number;
}

export interface PublicSettings {
  bandName: string;
  tagline: string;
  currency: string;
  preset: string;
  theme: Theme;
  logoUrl: string | null;
  logoPath: string | null;
  logoOpacity: number;
  logoInHeader: boolean;
  topBar: TopBarSettings;
  stockView?: StockView;
}

export interface BandSettings {
  gig: string;
}

/** A band's request for its own space, filed by a verified account at /start. One per account (doc id = uid). */
export interface BandRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  bandName: string;
  /** The wanted address: <bandId>.bandmate.shop. Final once the operator approves. */
  bandId: string;
  /** Optional domain the band already owns. */
  domain?: string;
  /** The plan chosen at sign-up. Only "free" can be requested until online payment exists. */
  plan?: "free" | "paid";
  termsVersion: string;
  termsAcceptedAt: unknown;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

/** A person invited into a band by email (paid plans). Doc id = the lowercase email address. */
export interface Invite {
  id: string;
  email: string;
  role: "bandmate";
  invitedBy: string;
  createdAt: number;
}

/** A ticketed event the band sells. Public if visible. Payment is by the band's own bank QR / link (not verified by BandMate). */
export interface Ticket {
  id: string;
  name: string;
  place: string;
  /** yyyy-mm-dd; endDate = last day (same as startDate for one day). Codes are valid until the end of endDate. */
  startDate: string;
  endDate: string;
  time: string;
  price: number;
  /** Maximum tickets; null = unlimited. */
  max: number | null;
  /** Tickets whose payment the band marked as verified (public, so fans see "sold out"). */
  paidCount: number;
  /** Start of every payment code, e.g. "Sawdust-may5". */
  prefix: string;
  qrUrl: string | null;
  qrPath: string | null;
  payUrl: string | null;
  cardPay: boolean;
  visible: boolean;
  createdAt: number;
  /** Expired codes were already deleted. */
  cleaned?: boolean;
}

/** A payment code issued to a fan (doc id = lowercase code). Readable only by the band's staff. */
export interface TicketCode {
  id: string;
  code: string;
  qty: number;
  createdAt: number;
  /** The band saw the payment in its bank (a sale was recorded). */
  paid: boolean;
  saleId?: string;
  /** Days (yyyy-mm-dd) on which this code was used at the door; once per day. */
  usedDays: string[];
}

/** Card payments through Stripe Connect for one band (`settings/payments`). Written ONLY by the server (Stripe webhooks); staff may read it. */
export interface PaymentsState {
  stripeAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  updatedAt?: number;
}
