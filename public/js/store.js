import { supabaseConfigure, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { dossierDemonstration } from "./dossier.js";
import {
  dateNaissancePourAge,
  emailPatient,
  empreinte,
  identifiantValide,
  jeton,
  motDePasseProvisoire,
  plier,
  proposerIdentifiant,
} from "./format.js";

const CLE = "medivoix.demo.v1";
const SESSION = "medivoix.demo.session";

export const COMPTE_DEMO = {
  medecin: { email: "medecin@clinique.medivoix.app", motDePasse: "CliniqueDemo1", nom: "Médecin démo" },
  infirmier: { email: "infirmier@clinique.medivoix.app", motDePasse: "CliniqueDemo1", nom: "Infirmier démo" },
};

let backend = null;

export function estPret() {
  return Boolean(backend);
}

export function estLocal() {
  return Boolean(backend?.local);
}

export function utilisateurCourant() {
  return backend?.user || null;
}

export async function init() {
  if (backend) return;
  backend = supabaseConfigure() ? await creerDistant() : await createMemoryStore(localStorage);
}

export function utiliserBackend(suivant) {
  backend = suivant;
}

function api() {
  if (!backend) throw new Error("Application non prête.");
  return backend;
}

export const signInCaregiver = (...args) => api().signInCaregiver(...args);
export const signUpCaregiver = (...args) => api().signUpCaregiver(...args);
export const signInPatient = (...args) => api().signInPatient(...args);
export const signOut = (...args) => api().signOut(...args);
export const changerMotDePasse = (...args) => api().changerMotDePasse(...args);
export const changerIdentifiant = (...args) => api().changerIdentifiant(...args);
export const majProfil = (...args) => api().majProfil(...args);
export const listPatients = (...args) => api().listPatients(...args);
export const getPatient = (...args) => api().getPatient(...args);
export const getPatientByQr = (...args) => api().getPatientByQr(...args);
export const monDossier = (...args) => api().monDossier(...args);
export const createPatient = (...args) => api().createPatient(...args);
export const updatePatient = (...args) => api().updatePatient(...args);
export const supprimerPatient = (...args) => api().supprimerPatient(...args);
export const regenererQr = (...args) => api().regenererQr(...args);
export const listConsultations = (...args) => api().listConsultations(...args);
export const getConsultation = (...args) => api().getConsultation(...args);
export const saveConsultation = (...args) => api().saveConsultation(...args);
export const supprimerConsultation = (...args) => api().supprimerConsultation(...args);
export const journaliser = (...args) => api().journaliser(...args);
export const listerJournal = (...args) => api().listerJournal(...args);
export const jetonSession = (...args) => api().jetonSession(...args);

export function memoireVide() {
  const m = new Map();
  return {
    getItem: (cle) => (m.has(cle) ? m.get(cle) : null),
    setItem: (cle, valeur) => m.set(cle, String(valeur)),
    removeItem: (cle) => m.delete(cle),
  };
}

function baseVide() {
  return { users: [], patients: [], consultations: [], journal: [] };
}

function exiger(user, roles) {
  if (!user || (roles && !roles.includes(user.role))) throw new Error("Action non autorisée pour votre rôle.");
  return user;
}

export async function createMemoryStore(storage) {
  let db = baseVide();
  try {
    db = storage.getItem(CLE) ? JSON.parse(storage.getItem(CLE)) : baseVide();
  } catch {
    db = baseVide();
  }
  if (!Array.isArray(db.users)) db = baseVide();
  let user = null;

  function ecrire() {
    storage.setItem(CLE, JSON.stringify(db));
  }

  function profilDe(compte) {
    const patient = db.patients.find((p) => p.user_id === compte.id);
    return {
      id: compte.id,
      email: compte.email,
      role: compte.role,
      nom_affichage: compte.nom_affichage,
      doit_changer_identifiants: Boolean(compte.doit_changer_identifiants),
      identifiant: patient?.identifiant || null,
      patient_id: patient?.id || null,
    };
  }

  if (!db.users.length) {
    const hash = await empreinte(COMPTE_DEMO.medecin.motDePasse);
    db.users.push(
      { id: crypto.randomUUID(), email: COMPTE_DEMO.medecin.email, password_hash: hash, role: "medecin", nom_affichage: COMPTE_DEMO.medecin.nom, doit_changer_identifiants: false },
      { id: crypto.randomUUID(), email: COMPTE_DEMO.infirmier.email, password_hash: hash, role: "infirmier", nom_affichage: COMPTE_DEMO.infirmier.nom, doit_changer_identifiants: false },
    );
    ecrire();
  }

  const sessionId = storage.getItem(SESSION);
  const compteSession = db.users.find((u) => u.id === sessionId);
  if (compteSession) user = profilDe(compteSession);

  async function connecter(email, motDePasse, roles, refus) {
    const compte = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const hash = await empreinte(motDePasse);
    if (!compte || compte.password_hash !== hash) throw new Error("Identifiants incorrects.");
    if (!roles.includes(compte.role)) throw new Error(refus);
    user = profilDe(compte);
    storage.setItem(SESSION, compte.id);
    return user;
  }

  function patientOuNull(id) {
    return db.patients.find((p) => p.id === id) || null;
  }

  function peutVoir(patient) {
    if (!patient) throw new Error("Dossier introuvable.");
    if (user.role === "patient" && patient.user_id !== user.id) throw new Error("Accès refusé.");
    return patient;
  }

  const apiStore = {
    local: true,
    get user() { return user; },
    async signInCaregiver(email, motDePasse) {
      return connecter(email.trim(), motDePasse, ["medecin", "infirmier"], "Cet accès est réservé à l'espace patient.");
    },
    async signUpCaregiver({ nom, email, motDePasse, role }) {
      if (!["medecin", "infirmier"].includes(role)) throw new Error("Choisissez médecin ou infirmier.");
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Un compte existe déjà avec cette adresse.");
      }
      const compte = {
        id: crypto.randomUUID(),
        email: email.trim(),
        password_hash: await empreinte(motDePasse),
        role,
        nom_affichage: nom.trim(),
        doit_changer_identifiants: false,
      };
      db.users.push(compte);
      ecrire();
      user = profilDe(compte);
      storage.setItem(SESSION, compte.id);
      return { confirmation: false };
    },
    async signInPatient(identifiant, motDePasse) {
      return connecter(emailPatient(identifiant.trim().toLowerCase()), motDePasse, ["patient"], "Cet accès est réservé à l'espace soignant.");
    },
    async signOut() {
      user = null;
      storage.removeItem(SESSION);
    },
    async changerMotDePasse(motDePasse) {
      exiger(user);
      const compte = db.users.find((u) => u.id === user.id);
      compte.password_hash = await empreinte(motDePasse);
      ecrire();
    },
    async changerIdentifiant(identifiant) {
      exiger(user, ["patient"]);
      const propre = identifiant.trim().toLowerCase();
      if (!identifiantValide(propre)) throw new Error("Identifiant invalide. Lettres minuscules, chiffres, points, au moins 3 caractères.");
      if (db.patients.some((p) => p.identifiant === propre && p.id !== user.patient_id)) {
        throw new Error("Cet identifiant est déjà utilisé.");
      }
      const compte = db.users.find((u) => u.id === user.id);
      const patient = patientOuNull(user.patient_id);
      if (!patient) throw new Error("Dossier introuvable.");
      compte.email = emailPatient(propre);
      patient.identifiant = propre;
      patient.updated_at = new Date().toISOString();
      user = profilDe(compte);
      ecrire();
    },
    async majProfil(patch) {
      exiger(user);
      const compte = db.users.find((u) => u.id === user.id);
      if (patch.nom_affichage != null) compte.nom_affichage = String(patch.nom_affichage).trim();
      if (patch.doit_changer_identifiants != null) compte.doit_changer_identifiants = Boolean(patch.doit_changer_identifiants);
      user = profilDe(compte);
      ecrire();
    },
    async listPatients(recherche = "") {
      exiger(user, ["medecin", "infirmier"]);
      const q = plier(recherche.trim());
      return db.patients
        .filter((p) => !q || plier(p.nom_complet).includes(q))
        .map((p) => ({ ...p, derniere_consultation: derniereConsultation(p.id) }))
        .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"));
    },
    async getPatient(id) {
      exiger(user);
      return structuredClone(peutVoir(patientOuNull(id)));
    },
    async getPatientByQr(token) {
      exiger(user, ["medecin", "infirmier"]);
      const patient = db.patients.find((p) => p.qr_token === token);
      if (!patient) throw new Error("Aucun dossier ne correspond à ce QR code.");
      return { ...patient };
    },
    async monDossier() {
      exiger(user, ["patient"]);
      const patient = db.patients.find((p) => p.user_id === user.id);
      if (!patient) throw new Error("Votre fiche est introuvable. Demandez-la au médecin.");
      return { ...patient };
    },
    async createPatient(fields) {
      exiger(user, ["medecin"]);
      const nom = String(fields.nom_complet || "").trim();
      if (!nom) throw new Error("Le nom complet est obligatoire.");
      if (!["M", "F"].includes(fields.sexe)) throw new Error("Indiquez le sexe.");
      let identifiant = "";
      for (let i = 0; i < 8; i += 1) {
        const candidat = proposerIdentifiant(nom);
        if (!db.patients.some((p) => p.identifiant === candidat)) {
          identifiant = candidat;
          break;
        }
      }
      if (!identifiant) throw new Error("Impossible de proposer un identifiant. Réessayez.");
      const motDePasse = motDePasseProvisoire();
      const compte = {
        id: crypto.randomUUID(),
        email: emailPatient(identifiant),
        password_hash: await empreinte(motDePasse),
        role: "patient",
        nom_affichage: nom,
        doit_changer_identifiants: true,
      };
      const patient = {
        id: crypto.randomUUID(),
        created_by: user.id,
        user_id: compte.id,
        identifiant,
        qr_token: jeton(),
        nom_complet: nom,
        sexe: fields.sexe,
        date_naissance: fields.date_naissance || null,
        telephone: fields.telephone || "",
        adresse: fields.adresse || "",
        groupe_sanguin: fields.groupe_sanguin || null,
        antecedents: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.users.push(compte);
      db.patients.push(patient);
      ecrire();
      return { patient: { ...patient }, identifiant, motDePasse };
    },
    async updatePatient(id, fields) {
      const patient = peutVoir(patientOuNull(id));
      if (user.role === "infirmier") throw new Error("Action réservée au médecin.");
      const clefs = user.role === "patient"
        ? ["telephone", "adresse", "identifiant"]
        : ["nom_complet", "sexe", "date_naissance", "telephone", "adresse", "groupe_sanguin", "antecedents"];
      for (const cle of clefs) {
        if (cle in fields) patient[cle] = fields[cle] === "" && (cle === "date_naissance" || cle === "groupe_sanguin") ? null : fields[cle];
      }
      patient.updated_at = new Date().toISOString();
      ecrire();
      return { ...patient };
    },
    async supprimerPatient(id) {
      exiger(user, ["medecin"]);
      const patient = patientOuNull(id);
      if (!patient) throw new Error("Dossier introuvable.");
      db.consultations = db.consultations.filter((c) => c.patient_id !== id);
      for (const ligne of db.journal) if (ligne.patient_id === id) ligne.patient_id = null;
      db.patients = db.patients.filter((p) => p.id !== id);
      if (patient.user_id) db.users = db.users.filter((u) => u.id !== patient.user_id);
      ecrire();
    },
    async regenererQr(id) {
      exiger(user, ["medecin"]);
      const patient = patientOuNull(id);
      if (!patient) throw new Error("Dossier introuvable.");
      patient.qr_token = jeton();
      patient.updated_at = new Date().toISOString();
      ecrire();
      return patient.qr_token;
    },
    async listConsultations(patientId) {
      peutVoir(patientOuNull(patientId));
      return db.consultations
        .filter((c) => c.patient_id === patientId && (user.role === "medecin" || c.valide))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((c) => ({ ...c }));
    },
    async getConsultation(id) {
      const row = db.consultations.find((c) => c.id === id);
      if (!row) throw new Error("Consultation introuvable.");
      peutVoir(patientOuNull(row.patient_id));
      if (user.role !== "medecin" && !row.valide) throw new Error("Consultation introuvable.");
      return structuredClone(row);
    },
    async saveConsultation({ id, patientId, dictee, dossier, dureeSecondes, valide, created_at }) {
      exiger(user, ["medecin"]);
      if (id) {
        const row = db.consultations.find((c) => c.id === id);
        if (!row) throw new Error("Consultation introuvable.");
        row.dictee = dictee;
        row.dossier = dossier;
        row.duree_secondes = dureeSecondes;
        row.valide = Boolean(valide);
        ecrire();
        return { ...row };
      }
      const row = {
        id: crypto.randomUUID(),
        patient_id: patientId,
        medecin_id: user.id,
        dictee,
        dossier,
        duree_secondes: dureeSecondes,
        valide: Boolean(valide),
        created_at: created_at || new Date().toISOString(),
      };
      db.consultations.push(row);
      ecrire();
      return { ...row };
    },
    async supprimerConsultation(id) {
      exiger(user, ["medecin"]);
      const row = db.consultations.find((c) => c.id === id);
      if (!row) throw new Error("Consultation introuvable.");
      db.consultations = db.consultations.filter((c) => c.id !== id);
      ecrire();
      return row.patient_id;
    },
    async journaliser(patientId, action) {
      exiger(user, ["medecin", "infirmier"]);
      const patient = patientId ? patientOuNull(patientId) : null;
      db.journal.push({
        id: crypto.randomUUID(),
        user_id: user.id,
        auteur_nom: user.nom_affichage,
        role: user.role,
        patient_id: patientId || null,
        patient_nom: patient?.nom_complet || "",
        action,
        created_at: new Date().toISOString(),
      });
      ecrire();
    },
    async listerJournal({ patientId = "", userId = "", action = "", offset = 0, limit = 30 } = {}) {
      exiger(user, ["medecin"]);
      let lignes = [...db.journal].sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (patientId) lignes = lignes.filter((l) => l.patient_id === patientId);
      if (userId) lignes = lignes.filter((l) => l.user_id === userId);
      if (action) lignes = lignes.filter((l) => l.action === action);
      const total = lignes.length;
      return { lignes: lignes.slice(offset, offset + limit), total };
    },
    async jetonSession() {
      return user ? "demo" : "";
    },
  };

  function derniereConsultation(patientId) {
    const lignes = db.consultations
      .filter((c) => c.patient_id === patientId && (user?.role === "medecin" || c.valide))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return lignes[0]?.created_at || null;
  }

  return apiStore;
}

function assertOk(error, secours = "Opération impossible. Réessayez.") {
  if (!error) return;
  const code = error.code || "";
  const msg = String(error.message || "").toLowerCase();
  if (code === "23505" || msg.includes("already registered") || msg.includes("already been registered")) {
    throw new Error("Cette valeur est déjà utilisée.");
  }
  if (code === "42501" || msg.includes("row-level") || msg.includes("permission")) {
    throw new Error("Action non autorisée pour votre rôle.");
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) throw new Error("Identifiants incorrects.");
  if (msg.includes("password")) throw new Error("Le mot de passe a été refusé. Utilisez au moins 8 caractères.");
  if (msg.includes("jwt") || msg.includes("session")) throw new Error("Session expirée. Reconnectez-vous.");
  if (msg.includes("failed to fetch") || msg.includes("network")) throw new Error("Connexion au service impossible. Vérifiez le réseau.");
  throw new Error(secours);
}

async function creerDistant() {
  const lib = globalThis.supabase;
  if (!lib?.createClient) throw new Error("Bibliothèque de connexion introuvable.");
  const client = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "medivoix-auth",
    },
  });
  let user = null;

  async function chargerProfil() {
    const { data: sessionData, error: sessionError } = await client.auth.getUser();
    assertOk(sessionError, "Session expirée. Reconnectez-vous.");
    const uid = sessionData.user?.id;
    if (!uid) return null;
    const { data: profil, error } = await client.from("profils").select("*").eq("id", uid).maybeSingle();
    assertOk(error);
    if (!profil) throw new Error("Profil introuvable. Collez supabase/schema.sql dans Supabase, puis recréez le compte.");
    let patient = null;
    if (profil.role === "patient") {
      const { data, error: errPatient } = await client.from("patients").select("id, identifiant").eq("user_id", uid).maybeSingle();
      assertOk(errPatient);
      patient = data;
    }
    user = {
      id: uid,
      email: sessionData.user.email,
      role: profil.role,
      nom_affichage: profil.nom_affichage,
      doit_changer_identifiants: Boolean(profil.doit_changer_identifiants),
      identifiant: patient?.identifiant || null,
      patient_id: patient?.id || null,
    };
    return user;
  }

  const { data: sessionInit } = await client.auth.getSession();
  if (sessionInit.session) await chargerProfil();

  async function avecDates(patients) {
    if (!patients.length) return [];
    const ids = patients.map((p) => p.id);
    let requete = client.from("consultations").select("patient_id, created_at, valide").in("patient_id", ids);
    if (user.role !== "medecin") requete = requete.eq("valide", true);
    const { data, error } = await requete;
    assertOk(error);
    const map = new Map();
    for (const ligne of data || []) {
      const prev = map.get(ligne.patient_id);
      if (!prev || ligne.created_at > prev) map.set(ligne.patient_id, ligne.created_at);
    }
    return patients.map((p) => ({ ...p, derniere_consultation: map.get(p.id) || null }));
  }

  return {
    local: false,
    get user() { return user; },
    async signInCaregiver(email, motDePasse) {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password: motDePasse });
      assertOk(error);
      await chargerProfil();
      if (!["medecin", "infirmier"].includes(user?.role)) {
        await client.auth.signOut();
        user = null;
        throw new Error("Cet accès est réservé à l'espace patient.");
      }
      return user;
    },
    async signUpCaregiver({ nom, email, motDePasse, role }) {
      if (!["medecin", "infirmier"].includes(role)) throw new Error("Choisissez médecin ou infirmier.");
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password: motDePasse,
        options: { data: { role, nom_affichage: nom.trim(), espace: "soignant" } },
      });
      assertOk(error);
      if (!data.session) return { confirmation: true };
      await chargerProfil();
      return { confirmation: false };
    },
    async signInPatient(identifiant, motDePasse) {
      const { error } = await client.auth.signInWithPassword({
        email: emailPatient(identifiant.trim().toLowerCase()),
        password: motDePasse,
      });
      assertOk(error);
      await chargerProfil();
      if (user?.role !== "patient") {
        await client.auth.signOut();
        user = null;
        throw new Error("Cet accès est réservé à l'espace soignant.");
      }
      return user;
    },
    async signOut() {
      await client.auth.signOut();
      user = null;
    },
    async changerMotDePasse(motDePasse) {
      exiger(user);
      const { error } = await client.auth.updateUser({ password: motDePasse });
      assertOk(error);
    },
    async changerIdentifiant(identifiant) {
      exiger(user, ["patient"]);
      const propre = identifiant.trim().toLowerCase();
      if (!identifiantValide(propre)) throw new Error("Identifiant invalide. Lettres minuscules, chiffres, points, au moins 3 caractères.");
      const email = emailPatient(propre);
      const { data, error } = await client.auth.updateUser({ email });
      assertOk(error, "Le changement d'identifiant a été refusé. Désactivez la confirmation par e-mail dans Supabase.");
      if (data.user && data.user.email !== email) {
        throw new Error("Supabase attend une confirmation par e-mail. Désactivez-la pour la démonstration, puis réessayez.");
      }
      const { error: errFiche } = await client.from("patients").update({ identifiant: propre }).eq("id", user.patient_id);
      assertOk(errFiche);
      user = { ...user, identifiant: propre, email };
    },
    async majProfil(patch) {
      exiger(user);
      const maj = {};
      if (patch.nom_affichage != null) maj.nom_affichage = String(patch.nom_affichage).trim();
      if (patch.doit_changer_identifiants != null) maj.doit_changer_identifiants = Boolean(patch.doit_changer_identifiants);
      const { error } = await client.from("profils").update(maj).eq("id", user.id);
      assertOk(error);
      user = { ...user, ...maj };
    },
    async listPatients(recherche = "") {
      exiger(user, ["medecin", "infirmier"]);
      let requete = client.from("patients").select("*").order("nom_complet");
      const q = recherche.trim().replace(/[%_]/g, "");
      if (q) requete = requete.ilike("nom_complet", `%${q}%`);
      const { data, error } = await requete;
      assertOk(error);
      return avecDates(data || []);
    },
    async getPatient(id) {
      exiger(user);
      const { data, error } = await client.from("patients").select("*").eq("id", id).maybeSingle();
      assertOk(error);
      if (!data) throw new Error("Dossier introuvable.");
      return data;
    },
    async getPatientByQr(token) {
      exiger(user, ["medecin", "infirmier"]);
      const { data, error } = await client.from("patients").select("*").eq("qr_token", token).maybeSingle();
      assertOk(error);
      if (!data) throw new Error("Aucun dossier ne correspond à ce QR code.");
      return data;
    },
    async monDossier() {
      exiger(user, ["patient"]);
      const { data, error } = await client.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      assertOk(error);
      if (!data) throw new Error("Votre fiche est introuvable. Demandez-la au médecin.");
      return data;
    },
    async createPatient(fields) {
      exiger(user, ["medecin"]);
      const nom = String(fields.nom_complet || "").trim();
      if (!nom) throw new Error("Le nom complet est obligatoire.");
      if (!["M", "F"].includes(fields.sexe)) throw new Error("Indiquez le sexe.");
      const second = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "medivoix-creation-patient",
        },
      });
      let dernier = null;
      for (let i = 0; i < 6; i += 1) {
        const identifiant = proposerIdentifiant(nom);
        const motDePasse = motDePasseProvisoire();
        const { data, error } = await second.auth.signUp({
          email: emailPatient(identifiant),
          password: motDePasse,
          options: { data: { role: "patient", nom_affichage: nom, espace: "patient" } },
        });
        if (error) {
          dernier = error;
          if (String(error.message || "").toLowerCase().includes("registered")) continue;
          assertOk(error);
        }
        const userId = data.user?.id;
        if (!userId) throw new Error("Le compte patient n'a pas pu être créé.");
        const { data: patient, error: errInsert } = await client.from("patients").insert({
          created_by: user.id,
          user_id: userId,
          identifiant,
          nom_complet: nom,
          sexe: fields.sexe,
          date_naissance: fields.date_naissance || null,
          telephone: fields.telephone || "",
          adresse: fields.adresse || "",
          groupe_sanguin: fields.groupe_sanguin || null,
          antecedents: {},
        }).select("*").single();
        if (errInsert) {
          throw new Error("Le compte a été créé mais la fiche n'a pas pu être enregistrée. Réessayez ou contactez l'administrateur.");
        }
        await second.auth.signOut();
        return { patient, identifiant, motDePasse };
      }
      assertOk(dernier, "Impossible de créer le compte patient.");
      throw new Error("Impossible de créer le compte patient.");
    },
    async updatePatient(id, fields) {
      exiger(user);
      if (user.role === "infirmier") throw new Error("Action réservée au médecin.");
      const clefs = user.role === "patient"
        ? ["telephone", "adresse", "identifiant"]
        : ["nom_complet", "sexe", "date_naissance", "telephone", "adresse", "groupe_sanguin", "antecedents"];
      const patch = {};
      for (const cle of clefs) if (cle in fields) patch[cle] = fields[cle] === "" && (cle === "date_naissance" || cle === "groupe_sanguin") ? null : fields[cle];
      const { data, error } = await client.from("patients").update(patch).eq("id", id).select("*").single();
      assertOk(error);
      return data;
    },
    async supprimerPatient(id) {
      exiger(user, ["medecin"]);
      const { error } = await client.from("patients").delete().eq("id", id);
      assertOk(error);
    },
    async regenererQr(id) {
      exiger(user, ["medecin"]);
      for (let i = 0; i < 4; i += 1) {
        const token = jeton();
        const { error } = await client.from("patients").update({ qr_token: token }).eq("id", id);
        if (!error) return token;
        if (error.code !== "23505") assertOk(error);
      }
      throw new Error("Impossible de régénérer le QR code. Réessayez.");
    },
    async listConsultations(patientId) {
      exiger(user);
      let requete = client.from("consultations").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
      if (user.role !== "medecin") requete = requete.eq("valide", true);
      const { data, error } = await requete;
      assertOk(error);
      return data || [];
    },
    async getConsultation(id) {
      exiger(user);
      const { data, error } = await client.from("consultations").select("*").eq("id", id).maybeSingle();
      assertOk(error);
      if (!data || (user.role !== "medecin" && !data.valide)) throw new Error("Consultation introuvable.");
      return data;
    },
    async saveConsultation({ id, patientId, dictee, dossier, dureeSecondes, valide, created_at }) {
      exiger(user, ["medecin"]);
      if (id) {
        const { data, error } = await client.from("consultations").update({
          dictee,
          dossier,
          duree_secondes: dureeSecondes,
          valide: Boolean(valide),
        }).eq("id", id).select("*").single();
        assertOk(error);
        return data;
      }
      const ligne = {
        patient_id: patientId,
        medecin_id: user.id,
        dictee,
        dossier,
        duree_secondes: dureeSecondes,
        valide: Boolean(valide),
      };
      if (created_at) ligne.created_at = created_at;
      const { data, error } = await client.from("consultations").insert(ligne).select("*").single();
      assertOk(error);
      return data;
    },
    async supprimerConsultation(id) {
      exiger(user, ["medecin"]);
      const actuelle = await this.getConsultation(id);
      const { error } = await client.from("consultations").delete().eq("id", id);
      assertOk(error);
      return actuelle.patient_id;
    },
    async journaliser(patientId, action) {
      exiger(user, ["medecin", "infirmier"]);
      let patient_nom = "";
      if (patientId) {
        const { data } = await client.from("patients").select("nom_complet").eq("id", patientId).maybeSingle();
        patient_nom = data?.nom_complet || "";
      }
      const { error } = await client.from("journal_acces").insert({
        user_id: user.id,
        auteur_nom: user.nom_affichage,
        role: user.role,
        patient_id: patientId || null,
        patient_nom,
        action,
      });
      assertOk(error);
    },
    async listerJournal({ patientId = "", userId = "", action = "", offset = 0, limit = 30 } = {}) {
      exiger(user, ["medecin"]);
      let requete = client.from("journal_acces").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (patientId) requete = requete.eq("patient_id", patientId);
      if (userId) requete = requete.eq("user_id", userId);
      if (action) requete = requete.eq("action", action);
      const { data, error, count } = await requete.range(offset, offset + limit - 1);
      assertOk(error);
      return { lignes: data || [], total: count || 0 };
    },
    async jetonSession() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token || "";
    },
  };
}

export async function creerPatientDemonstration() {
  const existants = await listPatients("Koffi Mensah (démo)");
  const deja = existants.find((p) => p.nom_complet === "Koffi Mensah (démo)");
  if (deja) return { patient: await getPatient(deja.id), dejaExistant: true };
  const cree = await createPatient({
    nom_complet: "Koffi Mensah (démo)",
    sexe: "M",
    date_naissance: dateNaissancePourAge(45),
    telephone: "",
    adresse: "Lomé",
    groupe_sanguin: "O+",
  });
  await updatePatient(cree.patient.id, {
    antecedents: {
      medicaux: "HTA connue",
      chirurgicaux: "Non renseigné",
      gyneco_obstetricaux: "Non renseigné",
      familiaux: "Non renseigné",
      mode_de_vie: "Non renseigné",
      allergies: "Pénicilline",
      traitements_en_cours: "Amlodipine 5 mg par jour",
    },
  });
  const quand = new Date();
  quand.setMonth(quand.getMonth() - 3);
  await saveConsultation({
    patientId: cree.patient.id,
    dictee: "Céphalées frontales depuis 4 jours, TA 150/95. Hypertendu connu sous amlodipine. Allergie à la pénicilline. Le reste de l'examen est normal.",
    dossier: dossierDemonstration(),
    dureeSecondes: 140,
    valide: true,
    created_at: quand.toISOString(),
  });
  return { ...cree, patient: await getPatient(cree.patient.id), dejaExistant: false };
}
