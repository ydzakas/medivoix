import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraireJson } from "../lib/extraire.js";
import { genererAvecGemma, MODEL } from "../lib/gemma.js";
import { buildDossierLocal, EXEMPLE_DICTEE } from "../public/js/dossier.js";
import { lireJeton } from "../public/js/qr.js";
import {
  changerMotDePasse,
  COMPTE_DEMO,
  createMemoryStore,
  createPatient,
  getConsultation,
  listConsultations,
  listerJournal,
  listPatients,
  journaliser,
  majProfil,
  memoireVide,
  saveConsultation,
  signInCaregiver,
  signInPatient,
  signOut,
  utiliserBackend,
  utilisateurCourant,
} from "../public/js/store.js";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COULEURS = new Set([
  "#0B2A4A", "#102C4C", "#1E9E6A", "#167C52", "#FFFFFF",
  "#F4F7FB", "#F8FAFC", "#E6EDF5", "#D5E0EC", "#3E5168", "#E7F6EF",
]);

function verifierDossier() {
  const dossier = buildDossierLocal({
    dictation: EXEMPLE_DICTEE,
    patient: { age: 45, sex: "M" },
    antecedents: { medicaux: "HTA", allergies: "Pénicilline" },
  });
  assert.ok(
    String(dossier.examen_general.constantes.ta).includes("160/100"),
    `TA inattendue : ${dossier.examen_general.constantes.ta}`,
  );
  assert.ok(
    dossier.resume_syndromique.startsWith("Au total, il s'agit d'un patient de 45 ans qui présente"),
    dossier.resume_syndromique,
  );
  const normaux = Object.values(dossier.examen_appareils).filter((appareil) => appareil.source === "normal_par_defaut");
  assert.ok(normaux.length >= 4, `appareils normaux : ${normaux.length}`);
  const traitement = JSON.stringify(dossier.traitement_suggere).toLowerCase();
  assert.equal(/p[eé]nicilline|penicilline|amoxicilline|ampicilline/.test(traitement), false, traitement);
  assert.ok(dossier.traitement_suggere.length >= 1, "aucun traitement suggéré");
  assert.ok(dossier.traitement_suggere.every((ligne) => ligne.accepte === false));
  console.log("ok dossier local");
}

async function verifierMemoire() {
  const memoire = await createMemoryStore(memoireVide());
  utiliserBackend(memoire);
  const medecin = await signInCaregiver(COMPTE_DEMO.medecin.email, COMPTE_DEMO.medecin.motDePasse);
  assert.equal(medecin.role, "medecin");
  const cree = await createPatient({
    nom_complet: "Awa Koffi",
    sexe: "F",
    date_naissance: "1990-04-02",
  });
  assert.ok(cree.patient.id);
  assert.ok(cree.identifiant);
  assert.ok(cree.motDePasse);
  assert.equal(cree.patient.nom_complet, "Awa Koffi");
  await journaliser(cree.patient.id, "creation");
  const journal = await listerJournal({ limit: 30 });
  assert.ok(journal.total >= 1);
  assert.equal(journal.lignes[0].action, "creation");
  assert.equal(journal.lignes[0].patient_id, cree.patient.id);
  const brouillon = await saveConsultation({
    patientId: cree.patient.id,
    dictee: "brouillon secret",
    dossier: { motif_consultation: "Secret brouillon" },
    dureeSecondes: 10,
    valide: false,
  });
  await saveConsultation({
    patientId: cree.patient.id,
    dictee: "texte valide",
    dossier: { motif_consultation: "Motif visible", resume_patient: "Résumé visible" },
    dureeSecondes: 12,
    valide: true,
  });
  const vuesMedecin = await listConsultations(cree.patient.id);
  assert.equal(vuesMedecin.length, 2);
  await signOut();

  await signInCaregiver(COMPTE_DEMO.infirmier.email, COMPTE_DEMO.infirmier.motDePasse);
  await assert.rejects(
    () => createPatient({ nom_complet: "Interdit Test", sexe: "M" }),
    /autorisée/,
  );
  const vuesInfirmier = await listConsultations(cree.patient.id);
  assert.equal(vuesInfirmier.length, 1);
  assert.equal(vuesInfirmier[0].valide, true);
  assert.equal(vuesInfirmier[0].dossier.motif_consultation, "Motif visible");
  assert.equal(JSON.stringify(vuesInfirmier).includes("Secret"), false);
  await assert.rejects(() => getConsultation(brouillon.id), /introuvable/);
  await signOut();

  const patient = await signInPatient(cree.identifiant, cree.motDePasse);
  assert.equal(patient.role, "patient");
  assert.equal(patient.doit_changer_identifiants, true);
  await assert.rejects(() => listPatients(), /autorisée/);
  const visibles = await listConsultations(cree.patient.id);
  assert.equal(visibles.length, 1);
  assert.equal(visibles[0].valide, true);
  assert.equal(JSON.stringify(visibles).includes("Secret"), false);
  await changerMotDePasse("NouveauMot2");
  await majProfil({ doit_changer_identifiants: false });
  assert.equal(utilisateurCourant().doit_changer_identifiants, false);
  await signOut();
  await assert.rejects(() => signInPatient(cree.identifiant, cree.motDePasse));
  const revenu = await signInPatient(cree.identifiant, "NouveauMot2");
  assert.equal(revenu.role, "patient");
  assert.equal(revenu.doit_changer_identifiants, false);
  console.log("ok mémoire");
}

function verifierJeton() {
  const origin = "http://127.0.0.1:8741";
  const token = "abcdefghij1234567890";
  assert.equal(lireJeton(`${origin}/#/p/${token}`, origin), token);
  assert.equal(lireJeton(`${origin}/#/p/${token}`, origin, { strict: true }), token);
  assert.equal(lireJeton(token, origin), token);
  assert.equal(lireJeton(token, origin, { strict: true }), null);
  assert.equal(lireJeton(`https://autre.exemple/#/p/${token}`, origin), null);
  assert.equal(lireJeton(`${origin}/#/patients/${token}`, origin), null);
  assert.equal(lireJeton("", origin), null);
  console.log("ok jeton");
}

function fichiersSources() {
  const trouves = [];
  for (const dossier of ["public/css", "public/js"]) {
    const racine = path.join(RACINE, dossier);
    const pile = [racine];
    while (pile.length) {
      const courant = pile.pop();
      for (const entree of fs.readdirSync(courant, { withFileTypes: true })) {
        const complet = path.join(courant, entree.name);
        if (entree.isDirectory()) {
          if (entree.name === "vendor") continue;
          pile.push(complet);
        } else if (/\.(css|js)$/.test(entree.name)) {
          trouves.push(complet);
        }
      }
    }
  }
  return trouves;
}

function verifierCouleurs() {
  const motifs = [
    [/\bblur\b/i, "blur"],
    [/gradient/i, "gradient"],
  ];
  const erreurs = [];
  for (const fichier of fichiersSources()) {
    const texte = fs.readFileSync(fichier, "utf8");
    const relatif = path.relative(RACINE, fichier);
    texte.split(/\n/).forEach((ligne, index) => {
      for (const [motif, nom] of motifs) {
        if (motif.test(ligne)) erreurs.push(`${relatif}:${index + 1} ${nom}`);
      }
      const hex = ligne.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
      for (const couleur of hex) {
        if (!COULEURS.has(couleur.toUpperCase())) erreurs.push(`${relatif}:${index + 1} couleur ${couleur}`);
      }
    });
  }
  assert.deepEqual(erreurs, [], erreurs.join("\n"));
  console.log("ok couleurs");
}

function verifierSources() {
  const pages = fs.readFileSync(path.join(RACINE, "public/js/pages.js"), "utf8");
  const main = fs.readFileSync(path.join(RACINE, "public/js/main.js"), "utf8");
  const carnet = fs.readFileSync(path.join(RACINE, "public/js/carnet.js"), "utf8");
  const serveur = fs.readFileSync(path.join(RACINE, "server.js"), "utf8");
  for (const nom of [
    "accueil", "connexion", "patients", "nouveau", "patient", "consultation", "edition",
    "dossier", "scanner", "journal", "compte", "qr", "interdit", "introuvable",
  ]) {
    assert.match(pages, new RegExp(`export function ${nom}\\b`));
  }
  assert.equal(pages.includes("innerHTML"), false);
  assert.match(main, /await init\(/);
  assert.match(main, /demarrer\(/);
  assert.match(main, /serviceWorker/);
  assert.match(main, /medivoix-leave/);
  assert.match(main, /speech\.stop/);
  assert.equal(main.includes("innerHTML"), false);
  assert.match(carnet, /doit_changer_identifiants/);
  assert.match(carnet, /signInPatient/);
  assert.match(carnet, /monDossier/);
  assert.match(carnet, /\/#\/patients/);
  assert.equal(carnet.includes("innerHTML"), false);
  assert.match(serveur, /8741/);
  assert.match(serveur, /0\.0\.0\.0/);
  assert.match(serveur, /buildDossierLocal/);
  assert.match(serveur, /genererAvecGemma/);
  assert.match(serveur, /GEMINI_API_KEY/);
  assert.match(serveur, /camera=\(self\)/);
  assert.match(serveur, /source: "local"/);
  assert.match(serveur, /source: "gemma"/);
  assert.match(pages, /Clé absente : structuration locale/);
  console.log("ok sources");
}

async function verifierGemma() {
  const extrait = extraireJson("```json\n{\"motif_consultation\":\"Toux\"}\n```");
  assert.equal(extrait.motif_consultation, "Toux");
  let urlVue = "";
  const dossier = await genererAvecGemma({
    dictation: "toux depuis trois jours",
    patient: { age: 30, sex: "F" },
    antecedents: { allergies: "Aucune" },
    apiKey: "cle-simulee",
    fetchImpl: async (url, options) => {
      urlVue = String(url);
      assert.equal(options.method, "POST");
      const corps = JSON.parse(options.body);
      assert.match(corps.systemInstruction.parts[0].text, /objet JSON/);
      assert.equal(corps.contents[0].parts[0].text.includes("toux depuis trois jours"), true);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{\"motif_consultation\":\"Toux\"}" }] } }],
        }),
      };
    },
  });
  assert.equal(MODEL, "gemma-4-26b-a4b-it");
  assert.equal(urlVue.includes("generativelanguage.googleapis.com"), true);
  assert.equal(urlVue.includes(MODEL), true);
  assert.equal(urlVue.includes("cle-simulee"), true);
  assert.equal(dossier.motif_consultation, "Toux");
  await assert.rejects(
    () => genererAvecGemma({ dictation: "x", apiKey: "", fetchImpl: async () => { throw new Error("reseau"); } }),
    /Clé absente/,
  );
  console.log("ok gemma");
}

try {
  verifierDossier();
  await verifierMemoire();
  verifierJeton();
  verifierCouleurs();
  verifierSources();
  await verifierGemma();
  console.log("Tous les contrôles MediVoix sont passés.");
} catch (error) {
  console.error(error);
  process.exit(1);
}
