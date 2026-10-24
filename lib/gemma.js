import { normalizeDossier } from "../public/js/dossier.js";
import { extraireJson } from "./extraire.js";
import { SYSTEM_PROMPT, messageUtilisateur } from "../prompts/dossier.js";

export const MODEL = "gemma-4-26b-a4b-it";

function texteGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("");
}

export async function genererAvecGemma({
  dictation,
  patient,
  antecedents,
  apiKey,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error("Clé absente.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const message = messageUtilisateur({ dictation, patient, antecedents });

  async function appel(consigne) {
    const reponse = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: consigne ? `${message}\n\n${consigne}` : message }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3500 },
      }),
    });
    if (!reponse.ok) throw new Error("modèle");
    return texteGemini(await reponse.json());
  }

  let brut = await appel("");
  try {
    return normalizeDossier(extraireJson(brut));
  } catch {
    brut = await appel("Réponds uniquement avec un objet JSON valide.");
    return normalizeDossier(extraireJson(brut));
  }
}
