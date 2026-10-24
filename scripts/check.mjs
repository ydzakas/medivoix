import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXEMPLE_DICTEE, buildDossierLocal } from "../public/js/dossier.js";
import { lireJeton } from "../public/js/qr.js";
import {
  COMPTE_DEMO,
  changerMotDePasse,
  createMemoryStore,
  createPatient,
  listerJournal,
  journaliser,
  majProfil,
  memoireVide,
  signInCaregiver,
  signInPatient,
  signOut,
  utilisateurCourant,
  utiliserBackend,
} from "../public/js/store.js";
import { extraireJson } from "../lib/extraire.js";
import { MODEL, genererAvecGemma } from "../lib/gemma.js";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let echecs = 0;

function ok(condition, message) {
  if (condition) {
    console.log(`ok  ${message}`);
    return;
  }
  echecs += 1;
  console.error(`ECHEC  ${message}`);
}

const dossier = buildDossierLocal({
  dictation: EXEMPLE_DICTEE,
  patient: { age: 45, sex: "M" },
  antecedents: { medicaux: "HTA", allergies: "Pénicilline", traitements_en_cours: "Amlodipine" },
});
ok(dossier.examen_general.constantes.ta.startsWith("160/100"), "TA 160/100 extraite de l'exemple");
ok(
  dossier.resume_syndromique.startsWith("Au total, il s'agit d'un patient de 45 ans qui présente"),
  "résumé syndromique au format attendu",
);
const normaux = Object.values(dossier.examen_appareils).filter((a) => a.source === "normal_par_defaut");
ok(normaux.length >= 4, "plusieurs appareils restent normaux par défaut");
ok(
  dossier.traitement_suggere.every((l) => !/pénicilline|penicilline|amoxicilline/i.test(l.molecule)),
  "aucune pénicilline proposée en cas d'allergie",
);
ok(dossier.traitement_suggere.every((l) => l.accepte === false), "aucune ligne de traitement n'est acceptée d'office");

const memoire = memoireVide();
utiliserBackend(await createMemoryStore(memoire));
const medecin = await signInCaregiver(COMPTE_DEMO.medecin.email, COMPTE_DEMO.medecin.motDePasse);
ok(medecin.role === "medecin", "le médecin de démonstration se connecte");
const cree = await createPatient({ nom_complet: "Awa Koffi", sexe: "F", date_naissance: "1990-04-12" });
ok(cree.motDePasse && cree.identifiant, "la création rend l'identifiant et le mot de passe une fois");
await journaliser(cree.patient.id, "creation");
const journal = await listerJournal();
ok(journal.total >= 1 && journal.lignes[0].action === "creation", "le journal conserve la création");
await signOut();

await signInCaregiver(COMPTE_DEMO.infirmier.email, COMPTE_DEMO.infirmier.motDePasse);
let interdit = false;
try {
  await createPatient({ nom_complet: "Interdit", sexe: "M" });
} catch {
  interdit = true;
}
ok(interdit, "l'infirmier ne peut pas créer de patient");
await signOut();

const patient = await signInPatient(cree.identifiant, cree.motDePasse);
ok(patient.role === "patient" && patient.doit_changer_identifiants === true, "le patient doit changer son mot de passe");
await changerMotDePasse("NouveauMot2");
await majProfil({ doit_changer_identifiants: false });
ok(utilisateurCourant().doit_changer_identifiants === false, "le drapeau provisoire peut être levé après changement");
await signOut();

const origine = "https://clinique.example";
ok(lireJeton("AbcdEfghijkLmnop12", origine) === "AbcdEfghijkLmnop12", "un jeton saisi à la main est accepté");
ok(
  lireJeton(`${origine}/index.html#/p/AbcdEfghijkLmnop12`, origine, { strict: true }) === "AbcdEfghijkLmnop12",
  "un lien du même site est lu en mode strict",
);
ok(lireJeton("https://autre.example/#/p/AbcdEfghijkLmnop12", origine, { strict: true }) === null, "un autre site est refusé");

const embarque = extraireJson("Voici le dossier :\n```json\n{\"motif_consultation\":\"Toux\"}\n```");
ok(embarque.motif_consultation === "Toux", "le JSON est extrait même entouré de texte");

let urlAppelee = "";
const faux = async (url) => {
  urlAppelee = url;
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "{\"motif_consultation\":\"Céphalées\"}" }] } }] }),
  };
};
const genere = await genererAvecGemma({
  dictation: "Céphalées.",
  patient: { age: 45, sex: "M" },
  antecedents: {},
  apiKey: "test-key",
  fetchImpl: faux,
});
ok(urlAppelee.includes(MODEL) && urlAppelee.includes("test-key"), "Gemma 4 est appelé avec la clé, sans réseau réel");
ok(genere.motif_consultation === "Céphalées" && genere.traitement_suggere.every((l) => l.accepte === false), "la réponse Gemma est normalisée");

const couleurs = new Set(["#0B2A4A", "#1E9E6A", "#FFFFFF"]);
const interdits = /rgba\s*\(|\bopacity\s*:|box-shadow|blur\s*\(|gradient|transparent/i;
function auditer(relatif) {
  const texte = fs.readFileSync(path.join(racine, relatif), "utf8");
  ok(!interdits.test(texte), `${relatif} reste dans la charte (pas d'effet interdit)`);
  const hex = texte.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  const hors = [...new Set(hex.map((c) => c.toUpperCase()).filter((c) => !couleurs.has(c)))];
  ok(hors.length === 0, `${relatif} n'utilise que les trois couleurs${hors.length ? ` (${hors.join(", ")})` : ""}`);
}
auditer("public/css/app.css");
for (const fichier of fs.readdirSync(path.join(racine, "public/js"))) {
  if (fichier.endsWith(".js")) auditer(`public/js/${fichier}`);
}

if (echecs) {
  console.error(`${echecs} échec(s).`);
  process.exit(1);
}
console.log("Toutes les vérifications passent.");
