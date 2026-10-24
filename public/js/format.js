export const MARINE = "#0B2A4A";
export const VERT = "#1E9E6A";
export const BLANC = "#FFFFFF";
export const DOMAINE_PATIENT = "patients.medivoix.app";
export const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function emailPatient(identifiant) {
  return `${identifiant}@${DOMAINE_PATIENT}`;
}

export function identifiantValide(valeur) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])$/.test(valeur);
}

export function plier(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function proposerIdentifiant(nomComplet) {
  const morceaux = plier(nomComplet).split(/[^a-z0-9]+/).filter(Boolean);
  const prenom = morceaux[0] || "patient";
  const nom = morceaux.slice(1).join("") || "sante";
  const n = Math.floor(Math.random() * 900 + 100);
  return `${prenom}.${nom}${n}`.slice(0, 40);
}

export function motDePasseProvisoire() {
  const octets = new Uint8Array(10);
  crypto.getRandomValues(octets);
  return [...octets].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function jeton(longueur = 22) {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return [...octets].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function ageAns(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  const aujourd = new Date();
  let age = aujourd.getFullYear() - y;
  const mois = aujourd.getMonth() + 1;
  if (mois < m || (mois === m && aujourd.getDate() < d)) age -= 1;
  return age < 0 ? 0 : age;
}

export function dateNaissancePourAge(age) {
  const d = new Date();
  const jour = d.getDate();
  d.setFullYear(d.getFullYear() - age);
  if (d.getDate() !== jour) d.setDate(0);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function parseDate(iso) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

export function formatDateLongue(iso) {
  const d = parseDate(iso);
  if (!d || Number.isNaN(d.getTime())) return "";
  const avecHeure = typeof iso === "string" && iso.includes("T");
  return new Intl.DateTimeFormat("fr-FR", avecHeure
    ? { dateStyle: "long", timeStyle: "short" }
    : { dateStyle: "long" }).format(d);
}

export function formatDateHeure(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export function formatDuree(secondes) {
  const s = Math.max(0, Math.round(Number(secondes) || 0));
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}

export function libelleSexe(sexe) {
  if (sexe === "M") return "Homme";
  if (sexe === "F") return "Femme";
  return "Non renseigné";
}

export function libelleRole(role) {
  return { medecin: "Médecin", infirmier: "Infirmier", patient: "Patient" }[role] || role || "";
}

export function libelleAction(action) {
  return {
    consultation: "Consultation",
    scan: "Scan du QR code",
    creation: "Création",
    modification: "Modification",
    validation: "Validation",
    suppression: "Suppression",
  }[action] || action || "";
}

export function libelleAge(iso) {
  const age = ageAns(iso);
  return age == null ? "Âge non renseigné" : `${age} ans`;
}

export function echapper(texte) {
  return String(texte ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function empreinte(motDePasse) {
  const data = new TextEncoder().encode(`medivoix-demo-v1|${motDePasse}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
