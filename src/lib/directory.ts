import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/** A band's entry in the public directory on the BandMate home page. Exists only if the band chose to be listed. */
export interface DirectoryEntry {
  id: string;
  name: string;
  logoUrl: string | null;
}

export const directoryDoc = (bandId: string) => doc(db, "directory", bandId);

export const listInDirectory = (bandId: string, name: string, logoUrl: string | null) =>
  setDoc(directoryDoc(bandId), { name: name.trim() || bandId, logoUrl: logoUrl || null, updatedAt: Date.now() });

export const unlistFromDirectory = (bandId: string) => deleteDoc(directoryDoc(bandId));

export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const snap = await getDocs(collection(db, "directory"));
  return snap.docs
    .map((d) => ({ id: d.id, name: String(d.data().name || d.id), logoUrl: (d.data().logoUrl as string | null) || null }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Lowercase and strip accents, so "kosice" finds "Košice". */
export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
