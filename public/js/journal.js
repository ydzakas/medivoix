import { estPret, journaliser } from "./store.js";

export async function logAccess(patientId, action) {
  try {
    if (!estPret()) return;
    await journaliser(patientId, action);
  } catch {
    // Une erreur de journal ne bloque jamais l'interface.
  }
}
