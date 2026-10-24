export function extraireJson(texte) {
  const propre = String(texte || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const debut = propre.indexOf("{");
  const fin = propre.lastIndexOf("}");
  if (debut < 0 || fin <= debut) {
    throw new Error("Pas de JSON dans la réponse.");
  }
  return JSON.parse(propre.slice(debut, fin + 1));
}
