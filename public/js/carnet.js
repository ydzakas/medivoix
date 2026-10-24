import { ANTECEDENTS, normaliserAntecedents } from "./dossier.js";
import { formatDateLongue, identifiantValide, libelleAge, libelleSexe } from "./format.js";
import {
  changerIdentifiant,
  changerMotDePasse,
  estLocal,
  init,
  listConsultations,
  majProfil,
  monDossier,
  signInPatient,
  signOut,
  updatePatient,
  utilisateurCourant,
} from "./store.js";
import { alerte, champ, h, squelettes, toast, vide } from "./ui.js";

const ecran = document.querySelector("#ecran");
let vue = "carnet";

function entete() {
  const user = utilisateurCourant();
  const liens = user
    ? [
      h("button", { type: "button", onclick: () => { vue = "carnet"; dessiner(); } }, "Carnet"),
      h("button", { type: "button", onclick: () => { vue = "espace"; dessiner(); } }, "Mon espace"),
      h("button", { type: "button", onclick: async () => { await signOut(); vue = "carnet"; dessiner(); } }, "Déconnexion"),
    ]
    : [];
  return h("header", { class: "entete no-print" }, [
    h("div", { class: "entete-barre" }, [
      h("a", { class: "logo", href: "mon-carnet.html" }, "MediVoix"),
      h("span", { class: "qui" }, user ? (user.nom_affichage || "Patient") : "Mon carnet de santé"),
    ]),
    liens.length ? h("nav", { class: "nav", "aria-label": "Espace patient" }, liens) : null,
  ]);
}

function coquille(contenu) {
  const enfants = [entete()];
  if (estLocal() && utilisateurCourant()) {
    enfants.push(h("div", { class: "bandeau-demo no-print" }, "Mode démonstration : ce carnet reste sur cet appareil."));
  }
  enfants.push(h("main", { class: "contenu" }, [contenu]));
  ecran.replaceChildren(...enfants);
  ecran.focus();
}

function ecranConnexion() {
  const identifiant = h("input", { type: "text", autocomplete: "username", required: "true", autocapitalize: "none" });
  const mot = h("input", { type: "password", autocomplete: "current-password", required: "true" });
  const erreur = h("div");
  const form = h("form", { class: "pile" }, [
    champ("Identifiant", identifiant, "Celui imprimé sur votre fiche d'accès."),
    champ("Mot de passe", mot),
    erreur,
    h("button", { class: "btn btn-primaire btn-bloc", type: "submit" }, "Ouvrir mon carnet"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    try {
      await signInPatient(identifiant.value, mot.value);
      vue = "carnet";
      dessiner();
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  return h("div", { class: "pile" }, [
    h("h1", {}, "Mon carnet de santé"),
    h("p", {}, "Vous ne voyez que les consultations que le médecin a validées."),
    form,
    h("p", {}, [h("a", { href: "index.html" }, "Retour à l'accueil")]),
  ]);
}

function ecranChangement() {
  const user = utilisateurCourant();
  const identifiant = h("input", { type: "text", autocomplete: "username", autocapitalize: "none" });
  identifiant.value = user.identifiant || "";
  const mot = h("input", { type: "password", autocomplete: "new-password", minlength: "8", required: "true" });
  const confirmation = h("input", { type: "password", autocomplete: "new-password", minlength: "8", required: "true" });
  const erreur = h("div");
  const form = h("form", { class: "pile" }, [
    champ("Nouvel identifiant", identifiant, "Lettres minuscules, chiffres et points. Laissez le vôtre si vous le gardez."),
    champ("Nouveau mot de passe", mot, "8 caractères minimum."),
    champ("Confirmer le mot de passe", confirmation),
    erreur,
    h("button", { class: "btn btn-succes btn-bloc", type: "submit" }, "Enregistrer mes accès"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    const propre = identifiant.value.trim().toLowerCase();
    if (mot.value.length < 8) {
      erreur.replaceChildren(alerte("À compléter", "Le mot de passe doit contenir au moins 8 caractères."));
      return;
    }
    if (mot.value !== confirmation.value) {
      erreur.replaceChildren(alerte("À compléter", "Les deux mots de passe ne correspondent pas."));
      return;
    }
    if (propre && !identifiantValide(propre)) {
      erreur.replaceChildren(alerte("À compléter", "Identifiant invalide. Lettres minuscules, chiffres, points, au moins 3 caractères."));
      return;
    }
    try {
      await changerMotDePasse(mot.value);
      if (propre && propre !== user.identifiant) await changerIdentifiant(propre);
      await majProfil({ doit_changer_identifiants: false });
      toast("Accès mis à jour.", "succes");
      vue = "carnet";
      dessiner();
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  return h("div", { class: "pile" }, [
    h("h1", {}, "Choisissez vos accès"),
    h("p", {}, "Le mot de passe remis par la clinique est provisoire. Changez-le avant d'ouvrir le carnet."),
    form,
  ]);
}

function ligneAntecedent(label, valeur) {
  return h("p", {}, [h("strong", {}, `${label} : `), valeur || "Non renseigné"]);
}

function consultationPatient(ligne) {
  const dossier = ligne.dossier || {};
  const traitements = Array.isArray(dossier.traitement_suggere) ? dossier.traitement_suggere : [];
  const examens = Array.isArray(dossier.examens_complementaires) ? dossier.examens_complementaires : [];
  return h("article", { class: "carte pile" }, [
    h("h2", {}, formatDateLongue(ligne.created_at) || "Consultation"),
    ligneAntecedent("Motif", dossier.motif_consultation),
    h("p", {}, dossier.resume_patient || "Le médecin n'a pas laissé de résumé pour le patient."),
    h("h3", {}, "Traitement retenu"),
    traitements.length
      ? h("ul", { class: "liste" }, traitements.map((t) => h("li", {}, `${t.molecule} — ${t.posologie} — ${t.duree}`)))
      : h("p", {}, "Aucun médicament retenu."),
    h("h3", {}, "Examens"),
    examens.length
      ? h("ul", { class: "liste" }, examens.map((item) => h("li", {}, item)))
      : h("p", {}, "Aucun examen complémentaire noté."),
    h("h3", {}, "Conduite à tenir"),
    h("p", {}, dossier.conduite_a_tenir || "Non renseigné"),
  ]);
}

function ecranEspace(patient) {
  const user = utilisateurCourant();
  const nom = h("input", { type: "text", autocomplete: "name" });
  nom.value = user.nom_affichage || "";
  const telephone = h("input", { type: "tel", autocomplete: "tel" });
  telephone.value = patient.telephone || "";
  const adresse = h("textarea", { rows: "3" });
  adresse.value = patient.adresse || "";
  const identifiant = h("input", { type: "text", autocomplete: "username", autocapitalize: "none" });
  identifiant.value = patient.identifiant || user.identifiant || "";
  const mot = h("input", { type: "password", autocomplete: "new-password", minlength: "8" });
  const confirmation = h("input", { type: "password", autocomplete: "new-password", minlength: "8" });
  const erreur = h("div");
  const form = h("form", { class: "pile" }, [
    champ("Nom affiché", nom),
    champ("Téléphone", telephone),
    champ("Adresse", adresse),
    champ("Identifiant", identifiant),
    champ("Nouveau mot de passe", mot, "Laissez vide pour ne pas le changer. 8 caractères minimum."),
    champ("Confirmer le mot de passe", confirmation),
    erreur,
    h("button", { class: "btn btn-primaire", type: "submit" }, "Enregistrer"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    erreur.replaceChildren();
    const propre = identifiant.value.trim().toLowerCase();
    if (!identifiantValide(propre)) {
      erreur.replaceChildren(alerte("À compléter", "Identifiant invalide. Lettres minuscules, chiffres, points, au moins 3 caractères."));
      return;
    }
    if (mot.value || confirmation.value) {
      if (mot.value.length < 8) {
        erreur.replaceChildren(alerte("À compléter", "Le mot de passe doit contenir au moins 8 caractères."));
        return;
      }
      if (mot.value !== confirmation.value) {
        erreur.replaceChildren(alerte("À compléter", "Les deux mots de passe ne correspondent pas."));
        return;
      }
    }
    try {
      await majProfil({ nom_affichage: nom.value });
      await updatePatient(patient.id, { telephone: telephone.value.trim(), adresse: adresse.value.trim() });
      if (propre !== (patient.identifiant || "").toLowerCase()) await changerIdentifiant(propre);
      if (mot.value) await changerMotDePasse(mot.value);
      toast("Espace mis à jour.", "succes");
      mot.value = "";
      confirmation.value = "";
      dessiner();
    } catch (e) {
      erreur.replaceChildren(alerte("Erreur", e.message));
    }
  });
  return h("div", { class: "pile" }, [
    h("h1", {}, "Mon espace"),
    h("p", {}, "Vous pouvez changer votre nom affiché, votre téléphone, votre adresse, votre identifiant et votre mot de passe."),
    form,
  ]);
}

function carnet(patient, consultations) {
  const atcd = normaliserAntecedents(patient.antecedents);
  return h("div", { class: "pile" }, [
    h("h1", {}, "Mon carnet de santé"),
    h("section", { class: "carte pile" }, [
      h("h2", {}, patient.nom_complet),
      h("p", {}, `${libelleAge(patient.date_naissance)} · ${libelleSexe(patient.sexe)} · Groupe ${patient.groupe_sanguin || "non renseigné"}`),
      h("p", {}, `Identifiant : ${patient.identifiant}`),
      h("p", {}, `Téléphone : ${patient.telephone || "Non renseigné"}`),
      h("p", {}, `Adresse : ${patient.adresse || "Non renseignée"}`),
    ]),
    h("section", { class: "carte carte-forte pile" }, [
      h("h2", {}, "Allergies"),
      h("p", {}, atcd.allergies || "Non renseigné"),
    ]),
    h("section", { class: "carte pile" }, [
      h("h2", {}, "Antécédents"),
      ...ANTECEDENTS.filter(([cle]) => cle !== "allergies").map(([cle, label]) => ligneAntecedent(label, atcd[cle])),
    ]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Consultations validées"),
      consultations.length
        ? consultations.map(consultationPatient)
        : vide("Aucune consultation validée", "Dès que le médecin valide un dossier, il apparaît ici."),
    ]),
  ]);
}

async function dessiner() {
  const user = utilisateurCourant();
  if (user && user.role !== "patient") {
    location.replace("index.html#/patients");
    return;
  }
  if (!user) {
    document.title = "Connexion — MediVoix";
    coquille(ecranConnexion());
    return;
  }
  if (user.doit_changer_identifiants) {
    document.title = "Choisir mes accès — MediVoix";
    coquille(ecranChangement());
    return;
  }
  document.title = vue === "espace" ? "Mon espace — MediVoix" : "Mon carnet de santé — MediVoix";
  coquille(squelettes());
  try {
    const patient = await monDossier();
    if (vue === "espace") {
      coquille(ecranEspace(patient));
      return;
    }
    const consultations = await listConsultations(patient.id);
    coquille(carnet(patient, consultations));
  } catch (e) {
    coquille(alerte("Erreur", e.message || "Impossible d'ouvrir le carnet."));
  }
}

await init();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
dessiner();
