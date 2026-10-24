import { buildDossierLocal } from "./dossier.js";
import { estLocal, jetonSession } from "./store.js";

export async function generateDossier(dictation, patient, antecedents) {
  const texte = String(dictation || "").trim();
  if (!texte) throw new Error("La dictée est vide.");
  if (texte.length > 6000) throw new Error("La dictée dépasse 6000 caractères.");
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 90000);
  try {
    const headers = { "Content-Type": "application/json" };
    if (!estLocal()) {
      const token = await jetonSession();
      if (!token) throw new Error("Session expirée. Reconnectez-vous.");
      headers.Authorization = `Bearer ${token}`;
    }
    const reponse = await fetch("/api/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ dictation: texte, patient, antecedents }),
      signal: controleur.signal,
    });
    const data = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !data.dossier) throw new Error(data.error || "Génération impossible, réessayez.");
    return data;
  } catch (error) {
    if (estLocal()) {
      return { dossier: buildDossierLocal({ dictation: texte, patient, antecedents }), source: "local" };
    }
    if (error?.name === "AbortError") throw new Error("La rédaction a pris trop de temps. Réessayez.");
    throw new Error(error?.message || "Génération impossible, réessayez.");
  } finally {
    clearTimeout(minuteur);
  }
}
