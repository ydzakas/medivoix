import { normalizeDossier } from "../../public/js/dossier.js";
import { extraireJson } from "../../lib/extraire.js";
import { SYSTEM_PROMPT, messageUtilisateur } from "../../prompts/dossier.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function texteReponse(resultat) {
  if (!resultat) return "";
  if (typeof resultat === "string") return resultat;
  if (typeof resultat.response === "string") return resultat.response;
  if (typeof resultat.result === "string") return resultat.result;
  const choix = resultat.choices?.[0]?.message?.content;
  if (typeof choix === "string") return choix;
  return "";
}

async function appeler(env, model, messages) {
  const resultat = await env.AI.run(model, { messages, max_tokens: 3500, temperature: 0.2 });
  return texteReponse(resultat);
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.AI) {
      return json({ error: "Génération impossible, réessayez." }, 502);
    }
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Session invalide." }, 401);
    const verif = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization },
    });
    if (!verif.ok) return json({ error: "Session invalide." }, 401);
    const utilisateur = await verif.json();
    const profil = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profils?id=eq.${utilisateur.id}&select=role`,
      { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization } },
    );
    if (!profil.ok) return json({ error: "Session invalide." }, 401);
    const lignes = await profil.json();
    if (lignes?.[0]?.role !== "medecin") return json({ error: "Seul un médecin peut générer un dossier." }, 403);

    const corps = await request.json().catch(() => null);
    const dictation = String(corps?.dictation || "").trim();
    if (!dictation) return json({ error: "La dictée est vide." }, 400);
    if (dictation.length > 6000) return json({ error: "La dictée dépasse 6000 caractères." }, 400);

    const model = env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const user = messageUtilisateur({
      dictation,
      patient: corps?.patient,
      antecedents: corps?.antecedents,
    });
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ];
    let brut = await appeler(env, model, messages);
    let objet;
    try {
      objet = extraireJson(brut);
    } catch {
      brut = await appeler(env, model, [
        ...messages,
        { role: "assistant", content: brut },
        { role: "user", content: "Réponds uniquement avec un objet JSON valide." },
      ]);
      try {
        objet = extraireJson(brut);
      } catch {
        return json({ error: "Génération impossible, réessayez." }, 502);
      }
    }
    return json({ dossier: normalizeDossier(objet) });
  } catch {
    return json({ error: "Génération impossible, réessayez." }, 502);
  }
}
