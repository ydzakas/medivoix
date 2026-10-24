import { EXEMPLE_DICTEE, dossierPourEnregistrement, fusionnerAntecedents, normaliserAntecedents, normalizeDossier } from "./dossier.js";
import { ficheAcces } from "./fiche.js";
import {
  GROUPES,
  ageAns,
  formatDateLongue,
  formatDuree,
  libelleAction,
  libelleAge,
  libelleRole,
  libelleSexe,
  formatDateHeure,
} from "./format.js";
import { logAccess } from "./journal.js";
import { mountMic } from "./mic.js";
import { generateDossier } from "./api.js";
import { lireJeton } from "./qr.js";
import { blocAntecedents, editeurDossier, lectureDossier } from "./rendu.js";
import {
  COMPTE_DEMO,
  changerMotDePasse,
  creerPatientDemonstration,
  createPatient,
  estLocal,
  getConsultation,
  getPatient,
  getPatientByQr,
  listConsultations,
  listPatients,
  listerJournal,
  majProfil,
  regenererQr,
  saveConsultation,
  signInCaregiver,
  signUpCaregiver,
  supprimerConsultation,
  supprimerPatient,
  updatePatient,
  utilisateurCourant,
} from "./store.js";
import { alerte, badgeStatut, champ, confirmer, h, squelettes, toast, vide } from "./ui.js";

function estMedecin() {
  return utilisateurCourant()?.role === "medecin";
}

function choix(options, valeur) {
  const el = h("select", {}, options.map(([val, label]) => h("option", { value: val }, label)));
  el.value = valeur ?? "";
  return el;
}

function pied() {
  return h("footer", { class: "pied" }, [
    h("div", { class: "pied-inner" }, [
      h("p", {}, "Aide à la rédaction. La décision reste celle du médecin."),
      h("p", {}, "MediVoix · une clinique · Lomé. Conçu par Joseph (Jo Digital)."),
      h("p", {}, "Outils : Cursor pour le code. Gemma 4 (open-weight, via l'API Gemini) pour le dossier quand la clé est présente."),
    ]),
  ]);
}

export function accueil() {
  return h("div", {}, [
    h("section", { class: "hero" }, [
      h("div", { class: "hero-inner" }, [
        h("p", { class: "marque" }, "MediVoix"),
        h("p", { class: "slogan" }, "Parlez, on rédige."),
        h("p", {}, "Le médecin dicte ce qu'il a trouvé. Le dossier se structure. La décision reste la sienne."),
      ]),
    ]),
    h("section", { class: "entrees" }, [
      h("a", { class: "entree", href: "#/connexion" }, [
        h("span", { class: "kicker" }, "Clinique"),
        h("strong", {}, "Espace soignant"),
        h("span", {}, "Médecins et infirmiers : dossiers, dictée, historique et QR code."),
      ]),
      h("a", { class: "entree entree-patient", href: "mon-carnet.html" }, [
        h("span", { class: "kicker" }, "Carnet"),
        h("strong", {}, "Espace patient"),
        h("span", {}, "Consultations validées, traitements, antécédents et allergies."),
      ]),
    ]),
    pied(),
  ]);
}

export function connexion() {
  const erreur = h("div");
  const email = h("input", { type: "email", autocomplete: "username", required: "true" });
  const mot = h("input", { type: "password", autocomplete: "current-password", required: "true", minlength: "8" });
  const nom = h("input", { type: "text", autocomplete: "name" });
  const emailCreation = h("input", { type: "email", autocomplete: "username" });
  const motCreation = h("input", { type: "password", autocomplete: "new-password", minlength: "8" });
  let role = "medecin";
  const formulaire = h("form", { class: "pile" }, [
    champ("Adresse e-mail", email),
    champ("Mot de passe", mot),
    erreur,
    h("button", { class: "btn btn-primaire btn-bloc", type: "submit" }, "Se connecter"),
  ]);
  formulaire.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    try {
      await signInCaregiver(email.value, mot.value);
      location.hash = "#/patients";
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  const creation = h("form", { class: "pile" }, [
    champ("Nom affiché", nom),
    champ("Adresse e-mail", emailCreation),
    champ("Mot de passe", motCreation, "8 caractères minimum."),
    h("div", { class: "roles" }, [
      h("label", { class: "role" }, [h("input", { type: "radio", name: "role", value: "medecin", checked: true, onchange: () => { role = "medecin"; } }), "Médecin"]),
      h("label", { class: "role" }, [h("input", { type: "radio", name: "role", value: "infirmier", onchange: () => { role = "infirmier"; } }), "Infirmier"]),
    ]),
    h("button", { class: "btn btn-succes btn-bloc", type: "submit" }, "Créer le compte"),
  ]);
  creation.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    if (motCreation.value.length < 8) {
      erreur.replaceChildren(alerte("À compléter", "Le mot de passe doit contenir au moins 8 caractères."));
      return;
    }
    try {
      const resultat = await signUpCaregiver({
        nom: nom.value,
        email: emailCreation.value,
        motDePasse: motCreation.value,
        role,
      });
      if (resultat.confirmation) {
        erreur.replaceChildren(alerte("À compléter", "Compte créé. Si la confirmation par e-mail est active, confirmez-la puis connectez-vous. Pour la démonstration, désactivez-la dans Supabase."));
        return;
      }
      location.hash = "#/patients";
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  creation.hidden = true;
  const boutonConnexion = h("button", { type: "button", class: "btn btn-primaire" }, "Connexion");
  const boutonCreation = h("button", { type: "button", class: "btn btn-secondaire" }, "Créer un compte");
  boutonConnexion.addEventListener("click", () => {
    formulaire.hidden = false;
    creation.hidden = true;
  });
  boutonCreation.addEventListener("click", () => {
    formulaire.hidden = true;
    creation.hidden = false;
  });
  return h("div", { class: "pile" }, [
    h("h1", {}, "Espace soignant"),
    h("p", {}, "Médecins et infirmiers de la clinique."),
    h("div", { class: "rangee" }, [boutonConnexion, boutonCreation]),
    formulaire,
    creation,
    estLocal() ? h("div", { class: "carte pile" }, [
      h("h2", {}, "Comptes de démonstration"),
      h("p", {}, `Médecin : ${COMPTE_DEMO.medecin.email} · ${COMPTE_DEMO.medecin.motDePasse}`),
      h("p", {}, `Infirmier : ${COMPTE_DEMO.infirmier.email} · ${COMPTE_DEMO.infirmier.motDePasse}`),
    ]) : h("p", { class: "aide" }, "Première mise en service : exécutez supabase/schema.sql, puis créez le compte du médecin."),
    h("a", { href: "#/" }, "Retour à l'accueil"),
  ]);
}

export async function patients() {
  const liste = h("div", { class: "pile" });
  const recherche = h("input", { type: "search", placeholder: "Nom du patient" });
  let timer = null;
  async function charger(q = "") {
    liste.replaceChildren(squelettes(3));
    try {
      const rows = await listPatients(q);
      if (!rows.length) {
        liste.replaceChildren(vide(
          q ? "Aucun résultat" : "Aucun patient",
          q ? `Aucun patient ne correspond à « ${q} ».` : "Créez la première fiche. Le compte et le QR code sont générés ensemble.",
        ));
        return;
      }
      liste.replaceChildren(...rows.map((p) => h("a", { class: "carte", href: `#/patients/${p.id}` }, [
        h("strong", {}, p.nom_complet),
        h("p", {}, `${libelleAge(p.date_naissance)} · ${libelleSexe(p.sexe)}`),
        h("p", { class: "aide" }, p.derniere_consultation
          ? `Dernière consultation : ${formatDateLongue(p.derniere_consultation)}`
          : "Aucune consultation"),
      ])));
    } catch (e) {
      liste.replaceChildren(alerte("Erreur", e.message));
    }
  }
  recherche.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => charger(recherche.value), 250);
  });
  const actions = h("div", { class: "rangee" });
  if (estMedecin()) {
    actions.append(
      h("a", { class: "btn btn-primaire", href: "#/patients/nouveau" }, "Nouveau patient"),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: creerDemo }, "Créer un patient de démonstration"),
    );
  }
  const zone = h("div");
  async function creerDemo() {
    zone.replaceChildren(squelettes(2));
    try {
      const resultat = await creerPatientDemonstration();
      if (!resultat.dejaExistant) {
        await logAccess(resultat.patient.id, "creation");
        await logAccess(resultat.patient.id, "validation");
      }
      zone.replaceChildren(
        resultat.dejaExistant
          ? alerte("À compléter", "Le patient de démonstration existe déjà. Le mot de passe provisoire ne peut plus être affiché.")
          : ficheAcces({ patient: resultat.patient, motDePasse: resultat.motDePasse }),
        h("a", { class: "btn btn-primaire", href: `#/patients/${resultat.patient.id}` }, "Ouvrir la fiche"),
      );
      charger(recherche.value);
    } catch (e) {
      zone.replaceChildren(alerte("Erreur", e.message));
    }
  }
  await charger();
  return h("div", { class: "pile" }, [
    h("h1", {}, "Patients"),
    champ("Rechercher un patient", recherche),
    actions,
    liste,
    zone,
  ]);
}

export function nouveau() {
  const nom = h("input", { type: "text", required: "true" });
  const sexe = choix([["", "Choisir"], ["M", "Homme"], ["F", "Femme"]], "");
  const date = h("input", { type: "date" });
  const telephone = h("input", { type: "tel" });
  const adresse = h("input", { type: "text" });
  const groupe = choix([["", "Non renseigné"], ...GROUPES.map((g) => [g, g])], "");
  const erreur = h("div");
  const zone = h("div");
  const form = h("form", { class: "pile" }, [
    champ("Nom complet", nom),
    champ("Sexe", sexe),
    champ("Date de naissance", date),
    champ("Téléphone", telephone),
    champ("Adresse", adresse),
    champ("Groupe sanguin", groupe),
    erreur,
    h("button", { class: "btn btn-succes btn-bloc", type: "submit" }, "Créer la fiche et le compte"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    if (!nom.value.trim() || !sexe.value) {
      erreur.replaceChildren(alerte("À compléter", "Le nom et le sexe sont obligatoires."));
      return;
    }
    if (date.value && date.value > new Date().toISOString().slice(0, 10)) {
      erreur.replaceChildren(alerte("Erreur", "La date de naissance est dans le futur."));
      return;
    }
    try {
      const cree = await createPatient({
        nom_complet: nom.value,
        sexe: sexe.value,
        date_naissance: date.value,
        telephone: telephone.value,
        adresse: adresse.value,
        groupe_sanguin: groupe.value,
      });
      await logAccess(cree.patient.id, "creation");
      form.remove();
      zone.replaceChildren(
        ficheAcces({ patient: { ...cree.patient, identifiant: cree.identifiant }, motDePasse: cree.motDePasse }),
        h("a", { class: "btn btn-primaire", href: `#/patients/${cree.patient.id}` }, "Ouvrir la fiche"),
      );
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  return h("div", { class: "pile" }, [
    h("h1", {}, "Nouveau patient"),
    h("p", {}, "Le compte, le mot de passe provisoire et le QR code sont créés en même temps."),
    form,
    zone,
  ]);
}

export async function patient({ id }) {
  const p = await getPatient(id);
  await logAccess(id, "consultation");
  const consultations = await listConsultations(id);
  const zone = h("div", { class: "pile" });
  const actions = h("div", { class: "rangee no-print" });
  if (estMedecin()) {
    actions.append(
      h("a", { class: "btn btn-succes", href: `#/patients/${id}/consultation` }, "Nouvelle consultation"),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => zone.replaceChildren(formulaire()) }, "Modifier"),
      h("button", { type: "button", class: "btn btn-danger", onclick: supprimer }, "Supprimer"),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => zone.replaceChildren(ficheAcces({ patient: p })) }, "Réimprimer la fiche d'accès"),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: nouveauQr }, "Régénérer le QR code"),
    );
  }
  function formulaire() {
    const nom = h("input", { type: "text" });
    nom.value = p.nom_complet;
    const sexe = choix([["M", "Homme"], ["F", "Femme"]], p.sexe);
    const date = h("input", { type: "date" });
    date.value = p.date_naissance || "";
    const telephone = h("input", { type: "tel" });
    telephone.value = p.telephone || "";
    const adresse = h("input", { type: "text" });
    adresse.value = p.adresse || "";
    const groupe = choix([["", "Non renseigné"], ...GROUPES.map((g) => [g, g])], p.groupe_sanguin || "");
    const form = h("form", { class: "carte pile" }, [
      h("h2", {}, "Modifier la fiche"),
      champ("Nom complet", nom),
      champ("Sexe", sexe),
      champ("Date de naissance", date),
      champ("Téléphone", telephone),
      champ("Adresse", adresse),
      champ("Groupe sanguin", groupe),
      h("div", { class: "rangee" }, [
        h("button", { class: "btn btn-primaire", type: "submit" }, "Enregistrer"),
        h("button", { class: "btn btn-secondaire", type: "button", onclick: () => zone.replaceChildren() }, "Annuler"),
      ]),
    ]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updatePatient(id, {
        nom_complet: nom.value,
        sexe: sexe.value,
        date_naissance: date.value,
        telephone: telephone.value,
        adresse: adresse.value,
        groupe_sanguin: groupe.value,
      });
      await logAccess(id, "modification");
      toast("Fiche mise à jour.", "succes");
      location.reload();
    });
    return form;
  }
  async function supprimer() {
    const ok = await confirmer({
      titre: "Supprimer ce dossier ?",
      message: "La fiche et les consultations seront supprimées. Cette action est tracée.",
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await logAccess(id, "suppression");
    await supprimerPatient(id);
    toast("Dossier supprimé.", "succes");
    location.hash = "#/patients";
  }
  async function nouveauQr() {
    const ok = await confirmer({
      titre: "Régénérer le QR code ?",
      message: "L'ancien QR code ne fonctionnera plus.",
      confirmer: "Régénérer",
    });
    if (!ok) return;
    const token = await regenererQr(id);
    await logAccess(id, "modification");
    p.qr_token = token;
    zone.replaceChildren(ficheAcces({ patient: p }));
  }
  const derniere = consultations[0];
  let journal = null;
  if (estMedecin()) {
    const data = await listerJournal({ patientId: id, limit: 20 });
    journal = h("section", { class: "pile" }, [
      h("h2", {}, "Journal d'accès"),
      data.lignes.length ? tableauJournal(data.lignes) : h("p", {}, "Aucun accès enregistré."),
      h("a", { href: "#/journal" }, "Tout le journal"),
    ]);
  }
  return h("div", { class: "pile" }, [
    h("p", { class: "print-only" }, "MediVoix — Dossier patient"),
    h("h1", {}, p.nom_complet),
    h("div", { class: "meta" }, [
      h("span", { class: "badge" }, libelleAge(p.date_naissance)),
      h("span", { class: "badge" }, libelleSexe(p.sexe)),
      h("span", { class: "badge" }, p.groupe_sanguin || "Groupe non renseigné"),
    ]),
    h("p", {}, [p.telephone, p.adresse].filter(Boolean).join(" · ") || "Coordonnées non renseignées"),
    actions,
    zone,
    h("section", { class: "carte pile" }, [h("h2", {}, "Antécédents"), blocAntecedents(p.antecedents)]),
    derniere ? h("a", { class: "carte carte-vert", href: `#/patients/${id}/dossier/${derniere.id}` }, [
      h("h2", {}, "Dernière consultation"),
      h("p", {}, formatDateLongue(derniere.created_at)),
      h("p", {}, derniere.dossier?.motif_consultation || "Motif non renseigné"),
      badgeStatut(derniere.valide),
    ]) : null,
    h("section", { class: "pile" }, [
      h("h2", {}, "Consultations"),
      consultations.length ? h("div", { class: "pile" }, consultations.map((c) => h("a", { class: "carte", href: `#/patients/${id}/dossier/${c.id}` }, [
        h("strong", {}, formatDateLongue(c.created_at)),
        h("p", {}, c.dossier?.motif_consultation || "Motif non renseigné"),
        badgeStatut(c.valide),
      ]))) : vide("Aucune consultation", "Le dossier clinique commencera à la première dictée."),
    ]),
    journal,
  ]);
}

function tableauJournal(lignes) {
  return h("div", { class: "table-scroll" }, [
    h("table", {}, [
      h("thead", {}, [h("tr", {}, ["Date et heure", "Utilisateur", "Rôle", "Patient", "Action"].map((t) => h("th", {}, t)))]),
      h("tbody", {}, lignes.map((l) => h("tr", {}, [
        h("td", {}, formatDateHeure(l.created_at)),
        h("td", {}, l.auteur_nom || "Compte supprimé"),
        h("td", {}, libelleRole(l.role)),
        h("td", {}, l.patient_nom || "Patient supprimé"),
        h("td", {}, libelleAction(l.action)),
      ]))),
    ]),
  ]);
}

export function consultation(params) {
  return ecranConsultation(params);
}
export function edition(params) {
  return ecranConsultation(params);
}

async function ecranConsultation({ id, cid }) {
  const p = await getPatient(id);
  const existante = cid ? await getConsultation(cid) : null;
  const age = ageAns(p.date_naissance);
  let dossier = existante?.dossier ? normalizeDossier(existante.dossier, { conserverAcceptation: true }) : null;
  let source = null;
  let micro = null;
  let debutForce = existante ? Date.now() : null;
  const etape = h("div", { class: "pile" });
  const barre = h("div", { class: "barre-fixe no-print" });
  const root = h("div", { class: "pile avec-barre" });
  const micHost = h("div");

  function debut() {
    return micro?.getStartedAt() || debutForce;
  }

  function monterDictee() {
    barre.replaceChildren();
    etape.replaceChildren(
      h("details", {}, [
        h("summary", {}, "Antécédents connus"),
        blocAntecedents(normaliserAntecedents(p.antecedents)),
      ]),
      h("p", { class: "aide" }, "Dictez uniquement ce que vous avez trouvé. Les systèmes non mentionnés seront pré-remplis normaux."),
      micHost,
      h("div", { class: "rangee" }, [
        h("button", { type: "button", class: "btn btn-primaire", onclick: generer }, "Générer le dossier"),
        h("button", { type: "button", class: "btn btn-secondaire", onclick: () => micro?.setText(EXEMPLE_DICTEE) }, "Insérer un exemple"),
      ]),
    );
    if (!micro) micro = mountMic(micHost);
    else micHost.replaceChildren();
    if (!micHost.childElementCount) micro = mountMic(micHost);
    if (existante?.dictee && !micro.getText()) micro.setText(existante.dictee);
  }

  async function generer() {
    micro?.stop();
    await new Promise((r) => setTimeout(r, 300));
    const texte = micro?.getText().trim() || "";
    if (!texte) {
      etape.append(alerte("À compléter", "Dictez ou saisissez le texte avant de générer."));
      return;
    }
    etape.replaceChildren(squelettes(6), h("p", {}, "Rédaction du dossier en cours…"));
    try {
      const resultat = await generateDossier(texte, { age, sex: p.sexe }, normaliserAntecedents(p.antecedents));
      dossier = normalizeDossier(resultat.dossier, { conserverAcceptation: true });
      source = resultat.source || null;
      montrerDossier(texte);
    } catch (e) {
      etape.replaceChildren(
        alerte("Erreur", e.message || "Génération impossible, réessayez."),
        h("div", { class: "rangee" }, [
          h("button", { type: "button", class: "btn btn-primaire", onclick: generer }, "Réessayer"),
          h("button", { type: "button", class: "btn btn-secondaire", onclick: monterDictee }, "Revenir à la dictée"),
        ]),
      );
    }
  }

  function montrerDossier(texte) {
    const notes = [];
    if (source === "gemma") {
      notes.push(h("div", { class: "carte carte-vert" }, [
        h("strong", {}, "Gemma 4"),
        h("p", {}, "Proposition rédigée par le modèle open-weight. Relisez chaque ligne. Rien n'est prescrit sans votre validation."),
      ]));
    }
    if (source === "local") {
      notes.push(h("div", { class: "carte carte-forte" }, [
        h("strong", {}, "Relisez le dossier"),
        h("p", {}, "Structuration locale : la clé Gemma 4 est absente. Vérifiez chaque ligne avant de valider."),
      ]));
    }
    if (dossier.elements_manquants?.length) notes.push(alerte("À compléter", dossier.elements_manquants));
    barre.replaceChildren(
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => enregistrer(false, texte) }, "Enregistrer en brouillon"),
      h("button", { type: "button", class: "btn btn-succes", onclick: () => enregistrer(true, texte) }, "Valider le dossier"),
    );
    etape.replaceChildren(
      ...notes,
      h("p", { class: "chrono", id: "chrono-redaction" }, ""),
      editeurDossier(dossier),
      h("button", { type: "button", class: "btn btn-secondaire no-print", onclick: monterDictee }, "Revenir à la dictée"),
    );
  }

  async function enregistrer(valide, texte) {
    const start = debut();
    const session = start ? Math.round((Date.now() - start) / 1000) : 0;
    const duree = (existante?.duree_secondes || 0) + session;
    const pret = dossierPourEnregistrement(dossier);
    const ligne = await saveConsultation({
      id: existante?.id,
      patientId: id,
      dictee: texte || micro?.getText() || existante?.dictee || "",
      dossier: pret,
      dureeSecondes: duree,
      valide,
    });
    if (valide) {
      await updatePatient(id, { antecedents: fusionnerAntecedents(p.antecedents, pret.antecedents) });
      await logAccess(id, "validation");
      barre.remove();
      root.classList.remove("avec-barre");
      etape.replaceChildren(
        h("p", { class: "succes-duree" }, `Dossier complété en ${formatDuree(duree)}`),
        h("p", {}, "La décision enregistrée est la vôtre."),
        h("div", { class: "rangee" }, [
          h("a", { class: "btn btn-primaire", href: `#/patients/${id}/dossier/${ligne.id}` }, "Voir le dossier"),
          h("a", { class: "btn btn-secondaire", href: "#/patients" }, "Retour aux patients"),
        ]),
      );
      return;
    }
    await logAccess(id, "modification");
    toast("Brouillon enregistré.", "succes");
    location.hash = `#/patients/${id}/dossier/${ligne.id}`;
  }

  root.addEventListener("medivoix-leave", () => micro?.destroy());
  root.append(
    h("h1", {}, existante ? "Reprendre la consultation" : "Nouvelle consultation"),
    h("p", {}, `${p.nom_complet} · ${libelleAge(p.date_naissance)} · ${libelleSexe(p.sexe)}`),
    etape,
    barre,
  );
  if (dossier) montrerDossier(existante.dictee || "");
  else monterDictee();
  const minuteur = setInterval(() => {
    const noeud = root.querySelector("#chrono-redaction");
    const start = debut();
    if (noeud && start) noeud.textContent = `Rédaction : ${formatDuree(Math.round((Date.now() - start) / 1000))}`;
  }, 500);
  root.addEventListener("medivoix-leave", () => clearInterval(minuteur));
  return root;
}

export async function dossier({ id, cid }) {
  const p = await getPatient(id);
  const c = await getConsultation(cid);
  await logAccess(id, "consultation");
  const actions = h("div", { class: "rangee no-print" });
  actions.append(h("button", { type: "button", class: "btn btn-secondaire", onclick: () => window.print() }, "Imprimer"));
  if (estMedecin()) {
    actions.append(
      h("a", { class: "btn btn-primaire", href: `#/patients/${id}/consultation/${cid}` }, "Modifier"),
      h("button", { type: "button", class: "btn btn-danger", onclick: async () => {
        const ok = await confirmer({
          titre: "Supprimer cette consultation ?",
          message: "La suppression est tracée dans le journal.",
          confirmer: "Supprimer",
          danger: true,
        });
        if (!ok) return;
        await logAccess(id, "suppression");
        await supprimerConsultation(cid);
        location.hash = `#/patients/${id}`;
      } }, "Supprimer"),
    );
  }
  return h("div", { class: "pile feuille" }, [
    h("p", { class: "print-only" }, "MediVoix — Dossier médical"),
    h("h1", {}, p.nom_complet),
    h("div", { class: "meta" }, [
      badgeStatut(c.valide),
      h("span", {}, formatDateLongue(c.created_at)),
      h("span", {}, `Rédigé en ${formatDuree(c.duree_secondes)}`),
    ]),
    actions,
    lectureDossier(c.dossier),
  ]);
}

export function scanner() {
  const root = h("div", { class: "pile" });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  const message = h("p", { class: "aide" }, "Placez le QR code de la fiche d'accès dans le cadre.");
  const manuel = h("input", { class: "saisie", "aria-label": "Lien ou jeton" });
  const camera = h("div", { class: "cadre-video" }, [video]);
  let stream = null;
  let timer = null;
  let fini = false;
  let detecteur = null;
  try {
    if ("BarcodeDetector" in window) detecteur = new BarcodeDetector({ formats: ["qr_code"] });
  } catch { detecteur = null; }
  const toile = document.createElement("canvas");

  function stop() {
    fini = true;
    if (timer) cancelAnimationFrame(timer);
    stream?.getTracks().forEach((piste) => piste.stop());
    stream = null;
  }

  function traiter(brut, strict) {
    const token = lireJeton(brut, location.origin, { strict });
    if (!token) {
      message.textContent = "Ce contenu n'est pas un QR code MediVoix. Seul le QR code d'une fiche d'accès est reconnu.";
      return false;
    }
    stop();
    location.hash = `#/p/${token}`;
    return true;
  }

  async function boucle() {
    if (fini || video.readyState < 2) {
      timer = requestAnimationFrame(boucle);
      return;
    }
    try {
      if (detecteur) {
        const codes = await detecteur.detect(video);
        if (codes[0]?.rawValue && traiter(codes[0].rawValue, true)) return;
      } else if (window.jsQR && video.videoWidth) {
        toile.width = video.videoWidth;
        toile.height = video.videoHeight;
        const ctx = toile.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0);
        const image = ctx.getImageData(0, 0, toile.width, toile.height);
        const code = window.jsQR(image.data, toile.width, toile.height, { inversionAttempts: "dontInvert" });
        if (code?.data && traiter(code.data, true)) return;
      }
    } catch { /* image pas prête */ }
    timer = requestAnimationFrame(boucle);
  }

  root.addEventListener("medivoix-leave", stop);
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then((flux) => {
      stream = flux;
      video.srcObject = flux;
      return video.play();
    })
    .then(() => boucle())
    .catch(() => {
      camera.replaceChildren(alerte("Erreur", "Caméra indisponible. Autorisez-la, ou collez le lien du QR code."));
    });

  const form = h("form", { class: "pile" }, [
    champ("Saisie de secours", manuel, "Collez le lien complet ou seulement le jeton."),
    h("button", { class: "btn btn-primaire", type: "submit" }, "Ouvrir"),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    traiter(manuel.value, false);
  });
  root.append(h("h1", {}, "Scanner un QR code"), message, camera, form);
  return root;
}

export async function journal() {
  const patients = await listPatients("");
  const filtrePatient = choix([["", "Tous les patients"], ...patients.map((p) => [p.id, p.nom_complet])], "");
  const filtreAction = choix([
    ["", "Toutes les actions"],
    ["consultation", "Consultation"],
    ["scan", "Scan du QR code"],
    ["creation", "Création"],
    ["modification", "Modification"],
    ["validation", "Validation"],
    ["suppression", "Suppression"],
  ], "");
  const zone = h("div");
  const piedPage = h("div", { class: "rangee" });
  let page = 0;
  const taille = 30;
  async function charger() {
    zone.replaceChildren(squelettes(3));
    const data = await listerJournal({
      patientId: filtrePatient.value,
      action: filtreAction.value,
      offset: page * taille,
      limit: taille,
    });
    zone.replaceChildren(data.lignes.length ? tableauJournal(data.lignes) : vide("Journal vide", "Aucun accès ne correspond à ces filtres."));
    piedPage.replaceChildren(
      h("button", { type: "button", class: "btn btn-secondaire", disabled: page === 0, onclick: () => { page -= 1; charger(); } }, "Page précédente"),
      h("span", {}, `Page ${page + 1}`),
      h("button", { type: "button", class: "btn btn-secondaire", disabled: (page + 1) * taille >= data.total, onclick: () => { page += 1; charger(); } }, "Page suivante"),
    );
  }
  filtrePatient.addEventListener("change", () => { page = 0; charger(); });
  filtreAction.addEventListener("change", () => { page = 0; charger(); });
  await charger();
  return h("div", { class: "pile" }, [
    h("h1", {}, "Journal d'accès"),
    h("p", {}, "Qui a lu quoi, et quand. Ajout seulement : rien ne se modifie ni ne se supprime ici."),
    h("div", { class: "grille-2" }, [
      champ("Patient", filtrePatient),
      champ("Action", filtreAction),
    ]),
    zone,
    piedPage,
  ]);
}

export function compte() {
  const user = utilisateurCourant();
  const nom = h("input", { type: "text" });
  nom.value = user.nom_affichage || "";
  const mot = h("input", { type: "password", minlength: "8", autocomplete: "new-password" });
  const erreur = h("div");
  const form = h("form", { class: "pile" }, [
    champ("Nom affiché", nom),
    champ("Nouveau mot de passe", mot, "Laissez vide pour ne pas le changer. 8 caractères minimum."),
    erreur,
    h("button", { class: "btn btn-primaire", type: "submit" }, "Enregistrer"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    try {
      await majProfil({ nom_affichage: nom.value });
      if (mot.value) {
        if (mot.value.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
        await changerMotDePasse(mot.value);
      }
      toast("Compte mis à jour.", "succes");
      mot.value = "";
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  return h("div", { class: "pile" }, [
    h("h1", {}, "Mon compte"),
    h("p", {}, `${libelleRole(user.role)} · ${user.email}`),
    form,
  ]);
}

export async function qr({ token }) {
  const user = utilisateurCourant();
  if (!user) {
    sessionStorage.setItem("medivoix.next", `#/p/${token}`);
    location.hash = "#/connexion";
    return h("p", {}, "Redirection vers la connexion…");
  }
  if (user.role === "patient") {
    return h("div", { class: "pile" }, [
      h("h1", {}, "Accès réservé au personnel soignant"),
      h("p", {}, "Ce QR code ne peut être ouvert que par un médecin ou un infirmier connecté."),
      h("a", { class: "btn btn-primaire", href: "mon-carnet.html" }, "Retour à mon carnet"),
    ]);
  }
  try {
    const p = await getPatientByQr(token);
    await logAccess(p.id, "scan");
    location.hash = `#/patients/${p.id}`;
    return h("p", {}, "Ouverture du dossier…");
  } catch (e) {
    return alerte("Erreur", e.message);
  }
}

export function interdit() {
  return alerte("Erreur", "Cette page est réservée à un autre rôle.");
}

export function introuvable() {
  return h("div", { class: "pile" }, [
    vide("Page introuvable", "Ce lien ne correspond à aucun écran de MediVoix."),
    h("a", { class: "btn btn-primaire", href: "#/" }, "Retour à l'accueil"),
  ]);
}
