// Messages from a band to the BandMate admin. Stored in `supportMessages` (read only by the operator, shown in the admin console) because the app
// has no mail server yet; a plain e-mail link to the same address is offered next to the form.
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

/** The BandMate admin's contact e-mail. Change it here if it ever changes. */
export const SUPPORT_EMAIL = "tifexlab@gmail.com";

export interface SupportMessage {
  id: string;
  uid: string;
  email: string;
  name: string;
  bandId: string;
  bandName: string;
  message: string;
  createdAt: number;
  status: "new" | "done";
}

export const supportCol = () => collection(db, "supportMessages");

export const sendSupportMessage = (m: Omit<SupportMessage, "id" | "createdAt" | "status">) =>
  addDoc(supportCol(), { ...m, createdAt: Date.now(), status: "new" });

export const setSupportDone = (id: string, done: boolean) => updateDoc(doc(db, "supportMessages", id), { status: done ? "done" : "new" });
export const deleteSupportMessage = (id: string) => deleteDoc(doc(db, "supportMessages", id));

export const mailtoSupport = (subject: string, body: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
