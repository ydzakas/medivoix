import { generateDossier } from "./api.js";
import {
  dossierPourEnregistrement,
  EXEMPLE_DICTEE,
  fusionnerAntecedents,
  normalizeDossier,
  normaliserAntecedents,
} from "./dossier.js";
import { ficheAcces } from "./fiche.js";
import {
  ageAns,
  formatDateHeure,
  formatDateLongue,
  formatDuree,
  GROUPES,
  libelleAction,
  libelleAge,
  libelleRole,
  libelleSexe,
  plier,
} from "./format.js";
import { logAccess } from "./journal.js";
import { mountMic } from "./mic.js";
import { lireJeton } from "./qr.js";
import { blocAntecedents, editeurDossier, lectureDossier } from "./rendu.js";
import { speech } from "./speech.js";
import {
  changerMotDePasse,
  COMPTE_DEMO,
  createPatient,
  creerPatientDemonstration,
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
  signOut,
  supprimerPatient,
  updatePatient,
  utilisateurCourant,
} from "./store.js";
import {
  alerte,
  badgeStatut,
  champ,
  confirmer,
  h,
  squelettes,
  toast,
  vide,
} from "./ui.js";

const RETOUR = "medivoix.retour";
const PAGE_JOURNAL = 30;

function role() {
  return utilisateurCourant()?.role || "";
}

function message(error) {
  return error?.message || "Opération impossible. Réessayez.";
}

function suivi() {
  let actif = true;
  window.addEventListener("medivoix-leave", () => { actif = false; }, { once: true });
  return () => actif;
}

function aller(hash) {
  if (location.hash === hash) window.dispatchEvent(new Event("hashchange"));
  else location.hash = hash;
}

function hashApresConnexion() {
  let valeur = "";
  try {
    valeur = sessionStorage.getItem(RETOUR) || "";
    sessionStorage.removeItem(RETOUR);
  } catch {
    valeur = "";
  }
  if (/^#\/[\w./%-]*$/.test(valeur) && valeur !== "#/connexion") return valeur;
  return "#/patients";
}

function monter(racine, enfants) {
  const liste = [enfants].flat(3).filter((item) => item != null && item !== false && item !== true);
  racine.replaceChildren(...liste);
  const titre = racine.querySelector("h1");
  const actif = document.activeElement;
  const hote = document.querySelector("#ecran");
  if (titre && (!actif || actif === document.body || actif === hote)) {
    titre.setAttribute("tabindex", "-1");
    titre.focus();
  }
}

function info(libelle, valeur) {
  return h("p", {}, [h("strong", {}, `${libelle} : `), valeur || "Non renseigné"]);
}

function lienPatient(id) {
  return `#/patients/${encodeURIComponent(id)}`;
}

function lienRetour(id) {
  return h("a", { class: "btn btn-secondaire no-print", href: lienPatient(id) }, "Retour au patient");
}

function selectGroupe(actuel) {
  const select = h("select");
  select.append(h("option", { value: "" }, "Non renseigné"));
  for (const groupe of GROUPES) select.append(h("option", { value: groupe }, groupe));
  select.value = GROUPES.includes(actuel) ? actuel : "";
  return select;
}

function radiosSexe(actuel) {
  const nom = `sexe-${crypto.randomUUID()}`;
  const masculin = h("input", { type: "radio", name: nom, value: "M", checked: actuel === "M" });
  const feminin = h("input", { type: "radio", name: nom, value: "F", checked: actuel === "F" });
  return {
    bloc: h("div", { class: "roles" }, [
      h("label", { class: "role" }, [masculin, "Homme"]),
      h("label", { class: "role" }, [feminin, "Femme"]),
    ]),
    valeur() {
      if (masculin.checked) return "M";
      if (feminin.checked) return "F";
      return "";
    },
  };
}

function formulaireIdentite(patient, submitLabel, onSubmit, onAnnuler) {
  const nom = h("input", { type: "text", autocomplete: "name", value: patient?.nom_complet || "" });
  const naissance = h("input", { type: "date", autocomplete: "bday", value: patient?.date_naissance || "" });
  const telephone = h("input", { type: "tel", autocomplete: "tel", value: patient?.telephone || "" });
  const adresse = h("textarea", { rows: "3", autocomplete: "street-address" });
  adresse.value = patient?.adresse || "";
  const groupe = selectGroupe(patient?.groupe_sanguin || "");
  const sexe = radiosSexe(patient?.sexe || "");
  const erreur = h("div");
  const bouton = h("button", { type: "submit", class: "btn btn-primaire" }, submitLabel);
  return h("form", {
    class: "pile",
    novalidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      void envoyer();
    },
  }, [
    champ("Nom complet", nom, "Obligatoire."),
    h("div", { class: "champ" }, [h("span", {}, "Sexe"), sexe.bloc]),
    champ("Date de naissance", naissance, "Facultative. Sert à calculer l'âge."),
    champ("Téléphone", telephone),
    champ("Adresse", adresse),
    champ("Groupe sanguin", groupe),
    erreur,
    h("div", { class: "rangee" }, [
      bouton,
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => onAnnuler?.() }, "Annuler"),
    ]),
  ]);

  async function envoyer() {
    erreur.replaceChildren();
    const fields = {
      nom_complet: nom.value.trim(),
      sexe: sexe.valeur(),
      date_naissance: naissance.value,
      telephone: telephone.value.trim(),
      adresse: adresse.value.trim(),
      groupe_sanguin: groupe.value,
    };
    if (!fields.nom_complet || !fields.sexe) {
      erreur.append(alerte("À compléter", "Le nom complet et le sexe sont obligatoires."));
      return;
    }
    bouton.disabled = true;
    try {
      await onSubmit(fields);
    } catch (error) {
      erreur.replaceChildren(alerte("Erreur", message(error)));
      bouton.disabled = false;
    }
  }
}

function blocFiche(resultat) {
  const morceaux = [];
  if (resultat.dejaExistant) {
    morceaux.push(h("p", {}, "Ce patient de démonstration existe déjà. Le mot de passe provisoire n'est plus affiché."));
  } else if (resultat.motDePasse) {
    morceaux.push(h("p", {}, "Remettez cette fiche au patient. Le mot de passe ne sera plus affiché."));
  }
  morceaux.push(ficheAcces({
    patient: resultat.patient,
    motDePasse: resultat.motDePasse || "",
  }));
  morceaux.push(h("a", {
    class: "btn btn-primaire",
    href: lienPatient(resultat.patient.id),
  }, "Ouvrir le dossier"));
  return morceaux;
}

async function quitterAccueil() {
  try {
    await signOut();
  } catch (error) {
    toast(message(error), "erreur");
    return;
  }
  aller("#/");
}

export function accueil() {
  const user = utilisateurCourant();
  const soignantConnecte = user && (user.role === "medecin" || user.role === "infirmier");
  return h("div", {}, [
    h("section", { class: "hero" }, [
      h("div", { class: "hero-inner" }, [
        h("p", { class: "kicker" }, "Une clinique"),
        h("h1", { class: "marque" }, "MediVoix"),
        h("p", { class: "slogan" }, "Parlez, on rédige."),
        h("p", {}, "Le médecin dicte. MediVoix rédige le dossier. Le médecin relit et valide. L'infirmier consulte les dossiers validés. Chaque patient reçoit un compte, une fiche imprimable et un QR code qui ne contient aucune donnée médicale."),
      ]),
    ]),
    h("section", { class: "entrees" }, [
      h("a", { class: "entree", href: soignantConnecte ? "#/patients" : "#/connexion" }, [
        h("span", { class: "kicker" }, "Personnel soignant"),
        h("strong", {}, soignantConnecte ? "Ouvrir les dossiers" : "Espace soignant"),
        h("span", {}, "Dicter, relire et valider. L'infirmier lit les consultations validées et scanne les QR codes."),
      ]),
      h("a", { class: "entree entree-patient", href: "/mon-carnet.html" }, [
        h("span", { class: "kicker" }, "Patients"),
        h("strong", {}, "Mon carnet"),
        h("span", {}, "Consulter les consultations validées, avec l'identifiant remis par la clinique."),
      ]),
    ]),
    soignantConnecte
      ? h("div", { class: "contenu no-print" }, [
        h("button", { type: "button", class: "btn btn-secondaire", onclick: () => { void quitterAccueil(); } }, "Quitter"),
      ])
      : null,
    h("footer", { class: "pied" }, [
      h("div", { class: "pied-inner" }, [
        h("p", {}, "Joseph (Jo Digital), Lomé."),
        h("p", {}, "Licence MIT. Une seule clinique."),
      ]),
    ]),
  ]);
}

function blocDemo(emailInput, passInput) {
  if (!estLocal()) return null;
  const { medecin, infirmier } = COMPTE_DEMO;
  const remplir = (compte) => {
    emailInput.value = compte.email;
    passInput.value = compte.motDePasse;
    emailInput.focus();
  };
  return h("section", { class: "carte pile" }, [
    h("h2", {}, "Comptes de démonstration"),
    info("Médecin", medecin.email),
    info("Mot de passe", medecin.motDePasse),
    info("Infirmier", infirmier.email),
    info("Mot de passe infirmier", infirmier.motDePasse),
    h("div", { class: "rangee" }, [
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => remplir(medecin) }, "Utiliser le compte médecin"),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => remplir(infirmier) }, "Utiliser le compte infirmier"),
    ]),
  ]);
}

export function connexion() {
  const email = h("input", { id: "email-soignant", type: "email", autocomplete: "username" });
  const mot = h("input", { id: "mot-de-passe-soignant", type: "password", autocomplete: "current-password" });
  const erreur = h("div");
  const bouton = h("button", { type: "submit", class: "btn btn-primaire" }, "Se connecter");
  const form = h("form", {
    class: "pile",
    novalidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      void entrer();
    },
  }, [
    champ("Adresse e-mail", email),
    champ("Mot de passe", mot),
    erreur,
    bouton,
  ]);

  const nom = h("input", { type: "text", autocomplete: "name" });
  const emailCreation = h("input", { type: "email", autocomplete: "off" });
  const motCreation = h("input", { type: "password", autocomplete: "new-password" });
  const erreurCreation = h("div");
  const boutonCreation = h("button", { type: "submit", class: "btn btn-secondaire" }, "Créer le compte");
  let roleChoisi = "medecin";
  const formCreation = h("form", {
    class: "pile",
    novalidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      void creer();
    },
  }, [
    champ("Nom affiché", nom),
    champ("Adresse e-mail", emailCreation),
    champ("Mot de passe", motCreation, "Au moins 8 caractères."),
    h("div", { class: "champ" }, [
      h("span", {}, "Rôle"),
      h("div", { class: "roles" }, [
        h("label", { class: "role" }, [
          h("input", { type: "radio", name: "role-creation", value: "medecin", checked: true, onchange: () => { roleChoisi = "medecin"; } }),
          "Médecin",
        ]),
        h("label", { class: "role" }, [
          h("input", { type: "radio", name: "role-creation", value: "infirmier", onchange: () => { roleChoisi = "infirmier"; } }),
          "Infirmier",
        ]),
      ]),
    ]),
    erreurCreation,
    boutonCreation,
  ]);

  async function entrer() {
    erreur.replaceChildren();
    if (!email.value.trim() || !mot.value) {
      erreur.append(alerte("À compléter", "Indiquez l'adresse e-mail et le mot de passe."));
      return;
    }
    bouton.disabled = true;
    try {
      await signInCaregiver(email.value, mot.value);
      aller(hashApresConnexion());
    } catch (error) {
      erreur.replaceChildren(alerte("Erreur", message(error)));
      bouton.disabled = false;
    }
  }

  async function creer() {
    erreurCreation.replaceChildren();
    if (!nom.value.trim() || !emailCreation.value.trim() || motCreation.value.length < 8) {
      erreurCreation.append(alerte("À compléter", "Nom, e-mail et mot de passe d'au moins 8 caractères sont obligatoires."));
      return;
    }
    boutonCreation.disabled = true;
    try {
      const resultat = await signUpCaregiver({
        nom: nom.value,
        email: emailCreation.value,
        motDePasse: motCreation.value,
        role: roleChoisi,
      });
      if (resultat.confirmation) {
        erreurCreation.append(alerte("Compte créé", "Confirmez l'adresse si Supabase le demande, puis connectez-vous."));
        boutonCreation.disabled = false;
        return;
      }
      aller("#/patients");
    } catch (error) {
      erreurCreation.replaceChildren(alerte("Erreur", message(error)));
      boutonCreation.disabled = false;
    }
  }

  return h("div", { class: "pile ecran-etroit" }, [
    h("h1", {}, "Connexion soignant"),
    h("p", {}, "Médecins et infirmiers de la clinique. Les patients ouvrent leur carnet à part."),
    blocDemo(email, mot),
    h("section", { class: "carte pile" }, [h("h2", {}, "Connexion"), form]),
    h("section", { class: "carte pile" }, [
      h("h2", {}, "Créer un compte soignant"),
      h("p", { class: "aide" }, "Pour le premier médecin ou infirmier, lorsque Supabase est configuré."),
      formCreation,
    ]),
    h("a", { class: "btn btn-secondaire", href: "/mon-carnet.html" }, "Espace patient"),
  ]);
}

export function patients() {
  if (role() !== "medecin" && role() !== "infirmier") return interdit();
  const racine = h("div", { class: "pile" });
  const liste = h("div", { class: "pile", "aria-live": "polite" });
  const recherche = h("input", { type: "search", autocomplete: "off" });
  const vivant = suivi();
  let timer = 0;
  let ticket = 0;
  const boutonDemo = h("button", {
    type: "button",
    class: "btn btn-secondaire",
    onclick: () => { void demo(); },
  }, "Créer un patient de démonstration");

  monter(racine, [
    h("div", { class: "rangee" }, [
      h("h1", {}, "Patients"),
      role() === "medecin" ? h("a", { class: "btn btn-primaire", href: "#/patients/nouveau" }, "Nouveau patient") : null,
    ]),
    role() === "infirmier"
      ? h("p", { class: "aide" }, "Lecture seule : consultations validées, sans création ni modification.")
      : boutonDemo,
    h("form", {
      class: "recherche",
      onsubmit: (event) => {
        event.preventDefault();
        void charger();
      },
    }, [
      champ("Rechercher un patient", recherche, "Le nom est filtré sans tenir compte des accents."),
    ]),
    liste,
  ]);

  recherche.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void charger(); }, 250);
  });
  void charger();
  return racine;

  async function charger() {
    const n = ++ticket;
    liste.replaceChildren(squelettes());
    try {
      const rows = await listPatients(recherche.value);
      if (n !== ticket || !vivant()) return;
      if (!rows.length) {
        liste.replaceChildren(vide(
          "Aucun patient",
          recherche.value.trim()
            ? "Aucun dossier ne correspond à cette recherche."
            : "Aucun dossier n'est encore enregistré.",
        ));
        return;
      }
      liste.replaceChildren(...rows.map((patient) => h("a", { class: "carte", href: lienPatient(patient.id) }, [
        h("strong", {}, patient.nom_complet),
        h("p", {}, `${libelleSexe(patient.sexe)} · ${libelleAge(patient.date_naissance)}`),
        h("p", { class: "aide" }, patient.derniere_consultation
          ? `Dernière consultation : ${formatDateLongue(patient.derniere_consultation)}`
          : "Aucune consultation"),
      ])));
    } catch (error) {
      if (n !== ticket || !vivant()) return;
      liste.replaceChildren(alerte("Erreur", message(error)));
    }
  }

  async function demo() {
    boutonDemo.disabled = true;
    try {
      const resultat = await creerPatientDemonstration();
      if (!resultat.dejaExistant) {
        await logAccess(resultat.patient.id, "creation");
        await logAccess(resultat.patient.id, "validation");
      }
      if (!vivant()) return;
      liste.replaceChildren(
        ...blocFiche(resultat),
        h("button", { type: "button", class: "btn btn-secondaire", onclick: () => { void charger(); } }, "Retour à la liste"),
      );
    } catch (error) {
      if (vivant()) toast(message(error), "erreur");
    } finally {
      boutonDemo.disabled = false;
    }
  }
}

export function nouveau() {
  if (role() !== "medecin") return interdit();
  const racine = h("div", { class: "pile" });
  const vivant = suivi();
  monter(racine, [
    h("h1", {}, "Nouveau patient"),
    h("p", {}, "La création ouvre un compte patient, une fiche imprimable et un QR code sans donnée médicale."),
    formulaireIdentite(null, "Créer le dossier", async (fields) => {
      const cree = await createPatient(fields);
      await logAccess(cree.patient.id, "creation");
      if (!vivant()) return;
      monter(racine, [
        h("h1", {}, "Dossier créé"),
        blocFiche({ patient: cree.patient, motDePasse: cree.motDePasse }),
      ]);
    }, () => aller("#/patients")),
  ]);
  return racine;
}

export function patient(params) {
  if (role() !== "medecin" && role() !== "infirmier") return interdit();
  if (!params?.id) return introuvable();
  const racine = h("div", { class: "pile" });
  const vivant = suivi();
  let fiche = null;
  let consultations = [];
  let editer = false;
  let montrerFiche = false;
  let trace = false;
  racine.append(squelettes());
  void charger();
  return racine;

  async function charger() {
    try {
      fiche = await getPatient(params.id);
      if (!trace) {
        trace = true;
        await logAccess(fiche.id, "consultation");
      }
      consultations = await listConsultations(fiche.id);
      if (!vivant()) return;
      peindre();
    } catch (error) {
      if (!vivant()) return;
      monter(racine, [alerte("Erreur", message(error)), h("a", { class: "btn btn-secondaire", href: "#/patients" }, "Retour aux patients")]);
    }
  }

  function peindre() {
    const medecin = role() === "medecin";
    const atcd = normaliserAntecedents(fiche.antecedents);
    const actions = [];
    if (medecin) {
      actions.push(h("a", { class: "btn btn-primaire", href: `${lienPatient(fiche.id)}/consultation` }, "Nouvelle consultation"));
      actions.push(h("button", { type: "button", class: "btn btn-secondaire no-print", onclick: () => { editer = !editer; peindre(); } }, editer ? "Fermer la modification" : "Modifier l'identité"));
      actions.push(h("button", { type: "button", class: "btn btn-secondaire no-print", onclick: () => { montrerFiche = !montrerFiche; peindre(); } }, montrerFiche ? "Masquer la fiche" : "Fiche d'accès"));
      actions.push(h("button", { type: "button", class: "btn btn-secondaire no-print", onclick: () => { void regenerer(); } }, "Régénérer le QR code"));
      actions.push(h("button", { type: "button", class: "btn btn-danger no-print", onclick: () => { void supprimer(); } }, "Supprimer le dossier"));
      actions.push(h("a", { class: "btn btn-secondaire no-print", href: "#/journal" }, "Journal des accès"));
    }
    actions.push(h("button", { type: "button", class: "btn btn-secondaire no-print", onclick: () => window.print() }, "Imprimer"));

    monter(racine, [
      h("h1", {}, fiche.nom_complet),
      h("div", { class: "meta" }, [
        h("span", { class: "badge" }, libelleSexe(fiche.sexe)),
        h("span", { class: "badge" }, libelleAge(fiche.date_naissance)),
        fiche.groupe_sanguin ? h("span", { class: "badge" }, fiche.groupe_sanguin) : null,
      ]),
      h("div", { class: "rangee no-print" }, actions),
      editer && medecin
        ? formulaireIdentite(fiche, "Enregistrer l'identité", async (fields) => {
          await updatePatient(fiche.id, fields);
          await logAccess(fiche.id, "modification");
          editer = false;
          toast("Identité enregistrée.", "succes");
          await charger();
        }, () => { editer = false; peindre(); })
        : null,
      montrerFiche && medecin ? ficheAcces({ patient: fiche, motDePasse: "" }) : null,
      h("section", { class: "carte carte-forte pile" }, [
        h("h2", {}, "Allergies"),
        h("p", {}, atcd.allergies),
      ]),
      h("section", { class: "pile" }, [
        h("h2", {}, "Identité"),
        info("Date de naissance", fiche.date_naissance ? formatDateLongue(fiche.date_naissance) : ""),
        info("Téléphone", fiche.telephone),
        info("Adresse", fiche.adresse),
        medecin ? info("Identifiant patient", fiche.identifiant) : null,
      ]),
      h("section", { class: "pile" }, [
        h("h2", {}, "Antécédents"),
        blocAntecedents(atcd),
      ]),
      h("section", { class: "pile" }, [
        h("h2", {}, "Consultations"),
        consultations.length
          ? consultations.map((item) => carteConsultation(item, medecin))
          : vide("Aucune consultation", medecin
            ? "Dictez une première consultation pour ce dossier."
            : "Aucune consultation validée n'est disponible."),
      ]),
    ]);
  }

  function carteConsultation(item, medecin) {
    const motif = item.dossier?.motif_consultation || "Consultation";
    const lire = item.valide
      ? `#/patients/${encodeURIComponent(fiche.id)}/dossier/${encodeURIComponent(item.id)}`
      : `#/patients/${encodeURIComponent(fiche.id)}/consultation/${encodeURIComponent(item.id)}`;
    return h("article", { class: "carte pile" }, [
      h("div", { class: "rangee" }, [
        h("strong", {}, formatDateLongue(item.created_at) || "Consultation"),
        badgeStatut(Boolean(item.valide)),
      ]),
      h("p", {}, motif),
      h("div", { class: "rangee no-print" }, [
        h("a", { class: "btn btn-secondaire", href: lire }, item.valide ? "Lire" : "Reprendre"),
        medecin && item.valide
          ? h("a", { class: "btn btn-secondaire", href: `#/patients/${encodeURIComponent(fiche.id)}/consultation/${encodeURIComponent(item.id)}` }, "Modifier")
          : null,
      ]),
    ]);
  }

  async function regenerer() {
    const ok = await confirmer({
      titre: "Régénérer le QR code",
      message: "L'ancienne fiche imprimée ne permettra plus d'ouvrir ce dossier.",
      confirmer: "Régénérer",
      danger: true,
    });
    if (!ok || !vivant()) return;
    try {
      const token = await regenererQr(fiche.id);
      fiche = { ...fiche, qr_token: token };
      await logAccess(fiche.id, "modification");
      montrerFiche = true;
      if (!vivant()) return;
      peindre();
      toast("QR code régénéré.", "succes");
    } catch (error) {
      if (vivant()) toast(message(error), "erreur");
    }
  }

  async function supprimer() {
    const ok = await confirmer({
      titre: "Supprimer le dossier",
      message: "Le dossier, les consultations et le compte patient seront supprimés. Le journal conservera la trace.",
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok || !vivant()) return;
    try {
      await logAccess(fiche.id, "suppression");
      await supprimerPatient(fiche.id);
      aller("#/patients");
    } catch (error) {
      if (vivant()) toast(message(error), "erreur");
    }
  }
}

export function consultation(params) {
  if (role() !== "medecin") return interdit();
  if (!params?.id) return introuvable();
  const racine = h("div", { class: "pile avec-barre" });
  const vivant = suivi();
  racine.append(squelettes());
  void charger();
  return racine;

  async function charger() {
    try {
      const personne = await getPatient(params.id);
      let existante = null;
      if (params.cid) {
        existante = await getConsultation(params.cid);
        if (existante.patient_id !== personne.id) throw new Error("Consultation introuvable.");
      }
      await logAccess(personne.id, "consultation");
      if (!vivant()) return;
      monterEditeur(personne, existante);
    } catch (error) {
      if (!vivant()) return;
      monter(racine, [alerte("Erreur", message(error)), lienRetour(params.id)]);
    }
  }

  function monterEditeur(personne, existante) {
    speech.reset();
    let dossier = existante?.dossier
      ? normalizeDossier(existante.dossier, { conserverAcceptation: true })
      : null;
    let identifiantConsultation = existante?.id || "";
    const dureeBase = Number(existante?.duree_secondes) || 0;
    const zoneDictee = h("div");
    const micro = mountMic(zoneDictee, {});
    window.addEventListener("medivoix-leave", () => micro.destroy(), { once: true });
    if (existante?.dictee) micro.setText(existante.dictee);
    const zoneManquants = h("div");
    const zoneEditeur = h("div", { class: "pile" });
    const zoneSource = h("p", { class: "aide" }, "Seules les lignes cochées « Retenir » seront enregistrées.");
    const erreur = h("div");
    const brouillon = h("button", {
      type: "button",
      class: "btn btn-secondaire",
      disabled: !dossier,
      onclick: () => { void enregistrer(false); },
    }, "Enregistrer le brouillon");
    const valider = h("button", {
      type: "button",
      class: "btn btn-succes",
      disabled: !dossier,
      onclick: () => { void enregistrer(true); },
    }, "Valider la consultation");
    const boutonGenerer = h("button", {
      type: "button",
      class: "btn btn-primaire",
      onclick: () => { void generer(); },
    }, "Rédiger le dossier");
    const boutonSupprimer = h("button", {
      type: "button",
      class: "btn btn-danger no-print",
      hidden: !identifiantConsultation,
      onclick: () => { void supprimer(); },
    }, "Supprimer la consultation");

    if (dossier) peindreDossier(dossier, "enregistrée");

    monter(racine, [
      h("h1", {}, existante ? "Reprendre la consultation" : "Nouvelle consultation"),
      h("p", {}, `${personne.nom_complet} · ${libelleSexe(personne.sexe)} · ${libelleAge(personne.date_naissance)}`),
      h("div", { class: "rangee" }, [lienRetour(personne.id), boutonSupprimer]),
      h("section", { class: "pile" }, [
        h("h2", {}, "Dictée"),
        estLocal()
          ? h("p", { class: "aide" }, "Sans clé GEMINI_API_KEY, ce serveur fait une structuration locale.")
          : h("p", { class: "aide" }, "La dictée est transmise à la rédaction de la clinique, puis relue ici."),
        zoneDictee,
        h("div", { class: "rangee" }, [
          h("button", {
            type: "button",
            class: "btn btn-secondaire",
            onclick: () => micro.setText(EXEMPLE_DICTEE),
          }, "Insérer l'exemple de dictée"),
          boutonGenerer,
        ]),
      ]),
      erreur,
      zoneSource,
      zoneManquants,
      zoneEditeur,
      h("div", { class: "barre-fixe" }, [brouillon, valider]),
    ]);

    function peindreDossier(valeur, source) {
      dossier = valeur;
      brouillon.disabled = false;
      valider.disabled = false;
      zoneEditeur.replaceChildren(editeurDossier(dossier));
      zoneManquants.replaceChildren(
        ...(dossier.elements_manquants.length ? [alerte("À compléter", dossier.elements_manquants)] : []),
      );
      const precision = source === "local"
        ? "Clé absente : structuration locale. Relisez chaque ligne avant de valider."
        : source === "gemma"
          ? "Rédigé par Gemma. Relisez chaque ligne avant de valider."
          : source === "enregistrée"
            ? "Dossier déjà enregistré. Relisez-le avant de valider."
            : "Proposition générée. Relisez chaque ligne avant de valider.";
      zoneSource.textContent = `Seules les lignes cochées « Retenir » seront enregistrées. ${precision}`;
    }

    function dureeActuelle() {
      const debut = micro.getStartedAt();
      if (!debut) return dureeBase;
      return dureeBase + Math.round((Date.now() - debut) / 1000);
    }

    async function generer() {
      const texte = micro.getText().trim();
      if (!texte) {
        erreur.replaceChildren(alerte("À compléter", "La dictée est vide."));
        return;
      }
      if (texte.length > 6000) {
        erreur.replaceChildren(alerte("À compléter", "La dictée dépasse 6000 caractères."));
        return;
      }
      if (dossier) {
        const ok = await confirmer({
          titre: "Régénérer le dossier",
          message: "La proposition actuelle sera remplacée. Les cases cochées seront perdues.",
          confirmer: "Régénérer",
        });
        if (!ok || !vivant()) return;
      }
      erreur.replaceChildren();
      boutonGenerer.disabled = true;
      boutonGenerer.textContent = "Rédaction en cours…";
      try {
        const resultat = await generateDossier(texte, {
          age: ageAns(personne.date_naissance),
          sexe: personne.sexe,
          sex: personne.sexe,
        }, normaliserAntecedents(personne.antecedents));
        if (!vivant()) return;
        peindreDossier(normalizeDossier(resultat.dossier), resultat.source || "ia");
        toast("Dossier proposé. Relisez-le avant de valider.", "succes");
      } catch (error) {
        if (vivant()) erreur.replaceChildren(alerte("Erreur", message(error)));
      } finally {
        boutonGenerer.disabled = false;
        boutonGenerer.textContent = "Rédiger le dossier";
      }
    }

    async function enregistrer(valide) {
      if (!dossier || !vivant()) return;
      micro.stop();
      if (valide && dossier.elements_manquants.length) {
        const n = dossier.elements_manquants.length;
        const ok = await confirmer({
          titre: "Éléments manquants",
          message: n > 1
            ? `${n} éléments restent à compléter. Valider quand même ?`
            : "Un élément reste à compléter. Valider quand même ?",
          confirmer: "Valider quand même",
        });
        if (!ok || !vivant()) return;
      }
      brouillon.disabled = true;
      valider.disabled = true;
      try {
        const propre = dossierPourEnregistrement(dossier);
        const row = await saveConsultation({
          id: identifiantConsultation || undefined,
          patientId: personne.id,
          dictee: micro.getText().trim(),
          dossier: propre,
          dureeSecondes: dureeActuelle(),
          valide,
        });
        identifiantConsultation = row.id;
        boutonSupprimer.hidden = false;
        if (valide) {
          const fusion = fusionnerAntecedents(personne.antecedents, propre.antecedents);
          await updatePatient(personne.id, { antecedents: fusion });
          personne.antecedents = fusion;
          await logAccess(personne.id, "validation");
          if (!vivant()) return;
          toast("Consultation validée.", "succes");
          aller(`#/patients/${encodeURIComponent(personne.id)}/dossier/${encodeURIComponent(row.id)}`);
          return;
        }
        await logAccess(personne.id, "modification");
        const url = `#/patients/${encodeURIComponent(personne.id)}/consultation/${encodeURIComponent(row.id)}`;
        if (location.hash !== url) history.replaceState(null, "", url);
        document.title = "Consultation — MediVoix";
        if (vivant()) toast(`Brouillon enregistré (${formatDuree(dureeActuelle())}).`, "succes");
      } catch (error) {
        if (vivant()) erreur.replaceChildren(alerte("Erreur", message(error)));
      } finally {
        if (vivant() && dossier) {
          brouillon.disabled = false;
          valider.disabled = false;
        }
      }
    }

    async function supprimer() {
      if (!identifiantConsultation) return;
      const ok = await confirmer({
        titre: "Supprimer la consultation",
        message: "Cette dictée et ce dossier seront retirés.",
        confirmer: "Supprimer",
        danger: true,
      });
      if (!ok || !vivant()) return;
      try {
        await logAccess(personne.id, "suppression");
        await supprimerConsultation(identifiantConsultation);
        aller(lienPatient(personne.id));
      } catch (error) {
        if (vivant()) erreur.replaceChildren(alerte("Erreur", message(error)));
      }
    }
  }
}

export function edition(params) {
  return consultation(params);
}

export function dossier(params) {
  if (role() !== "medecin" && role() !== "infirmier") return interdit();
  if (!params?.id || !params?.cid) return introuvable();
  const racine = h("div", { class: "pile" });
  const vivant = suivi();
  racine.append(squelettes());
  void charger();
  return racine;

  async function charger() {
    try {
      const [personne, item] = await Promise.all([
        getPatient(params.id),
        getConsultation(params.cid),
      ]);
      if (item.patient_id !== personne.id) throw new Error("Consultation introuvable.");
      await logAccess(personne.id, "consultation");
      if (!vivant()) return;
      const contenu = normalizeDossier(item.dossier, { conserverAcceptation: true });
      const medecin = role() === "medecin";
      monter(racine, [
        h("div", { class: "rangee" }, [
          h("h1", {}, contenu.motif_consultation || "Consultation"),
          badgeStatut(Boolean(item.valide)),
        ]),
        h("p", {}, `${personne.nom_complet} · ${formatDateLongue(item.created_at)} · ${formatDuree(item.duree_secondes)}`),
        h("div", { class: "rangee no-print" }, [
          lienRetour(personne.id),
          h("button", { type: "button", class: "btn btn-secondaire", onclick: () => window.print() }, "Imprimer"),
          medecin
            ? h("a", { class: "btn btn-secondaire", href: `#/patients/${encodeURIComponent(personne.id)}/consultation/${encodeURIComponent(item.id)}` }, "Modifier")
            : null,
          medecin
            ? h("button", { type: "button", class: "btn btn-danger", onclick: () => { void supprimer(personne, item); } }, "Supprimer")
            : null,
        ]),
        contenu.elements_manquants.length ? alerte("À compléter", contenu.elements_manquants) : null,
        lectureDossier(contenu),
        h("section", { class: "pile" }, [
          h("h2", {}, "Dictée d'origine"),
          h("p", {}, item.dictee || "Non renseignée"),
        ]),
      ]);
    } catch (error) {
      if (!vivant()) return;
      monter(racine, [alerte("Erreur", message(error)), lienRetour(params.id)]);
    }
  }

  async function supprimer(personne, item) {
    const ok = await confirmer({
      titre: "Supprimer la consultation",
      message: "Cette dictée et ce dossier seront retirés.",
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok || !vivant()) return;
    try {
      await logAccess(personne.id, "suppression");
      await supprimerConsultation(item.id);
      aller(lienPatient(personne.id));
    } catch (error) {
      if (vivant()) toast(message(error), "erreur");
    }
  }
}

export function scanner() {
  if (role() !== "medecin" && role() !== "infirmier") return interdit();
  const video = h("video", {
    muted: true,
    autoplay: true,
    playsinline: true,
    "aria-label": "Aperçu de la caméra pour le QR code",
  });
  video.muted = true;
  video.playsInline = true;
  const statut = h("p", { class: "aide", "aria-live": "polite" }, "Aucune image n'est enregistrée. Le QR code ne contient pas de donnée médicale.");
  const saisie = h("input", { id: "saisie-jeton", type: "text", autocomplete: "off", spellcheck: "false" });
  const erreur = h("div");
  const canvas = document.createElement("canvas");
  let stream = null;
  let timer = 0;
  let actif = false;
  let lecture = false;
  let detecteur = null;
  if (typeof globalThis.BarcodeDetector === "function") {
    try {
      detecteur = new globalThis.BarcodeDetector({ formats: ["qr_code"] });
    } catch {
      detecteur = null;
    }
  }

  function arreter() {
    actif = false;
    clearInterval(timer);
    timer = 0;
    if (stream) {
      for (const piste of stream.getTracks()) piste.stop();
      stream = null;
    }
  }

  function quitter() {
    arreter();
    window.removeEventListener("pagehide", arreter);
  }

  window.addEventListener("medivoix-leave", quitter, { once: true });
  window.addEventListener("pagehide", arreter);

  async function activer() {
    if (!navigator.mediaDevices?.getUserMedia) {
      statut.textContent = "Caméra indisponible sur ce navigateur. Collez le lien ou le jeton.";
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
      if (!document.body.contains(video)) {
        for (const piste of flux.getTracks()) piste.stop();
        return;
      }
      arreter();
      stream = flux;
      actif = true;
      video.srcObject = stream;
      await video.play();
      statut.textContent = "Caméra active. Présentez le QR code de la fiche.";
      timer = window.setInterval(() => { void tic(); }, 250);
    } catch {
      statut.textContent = "Caméra indisponible. Autorisez-la, ou collez le lien du QR code.";
    }
  }

  async function lireCode() {
    if (video.readyState < 2 || !video.videoWidth) return "";
    if (detecteur) {
      const codes = await detecteur.detect(video);
      return codes?.[0]?.rawValue || "";
    }
    if (typeof globalThis.jsQR !== "function") return "";
    const largeur = Math.min(video.videoWidth, 640);
    const hauteur = Math.max(1, Math.round(video.videoHeight * (largeur / video.videoWidth)));
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, largeur, hauteur);
    const image = ctx.getImageData(0, 0, largeur, hauteur);
    return globalThis.jsQR(image.data, largeur, hauteur)?.data || "";
  }

  async function tic() {
    if (!actif || lecture) return;
    lecture = true;
    try {
      const valeur = await lireCode();
      if (!actif || !valeur) return;
      const token = lireJeton(valeur, location.origin, { strict: true });
      if (!token) {
        statut.textContent = "Ce QR code ne correspond pas à un dossier MediVoix de cette clinique.";
        return;
      }
      arreter();
      aller(`#/p/${token}`);
    } catch {
      // Cette image ne contient pas de QR lisible.
    } finally {
      lecture = false;
    }
  }

  return h("div", { class: "pile" }, [
    h("h1", {}, "Scanner un QR code"),
    h("p", {}, "Réservé au personnel soignant connecté. Le lien ne transporte qu'un jeton, jamais le dossier."),
    h("div", { class: "cadre-video" }, [video]),
    statut,
    h("button", { type: "button", class: "btn btn-primaire", onclick: () => { void activer(); } }, "Activer la caméra"),
    h("form", {
      class: "pile",
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        const token = lireJeton(saisie.value, location.origin, { strict: false });
        if (!token) {
          erreur.replaceChildren(alerte("QR code inutilisable", "Collez le lien complet du QR code, ou le jeton de 16 à 40 caractères."));
          return;
        }
        arreter();
        aller(`#/p/${token}`);
      },
    }, [
      champ("Lien ou jeton", saisie, "Secours si la caméra n'est pas disponible."),
      erreur,
      h("button", { type: "submit", class: "btn btn-secondaire" }, "Ouvrir le dossier"),
    ]),
  ]);
}

export function journal() {
  if (role() !== "medecin") return interdit();
  const racine = h("div", { class: "pile" });
  const liste = h("div");
  const recherche = h("input", { type: "search", autocomplete: "off" });
  const action = selectAction("");
  const vivant = suivi();
  let offset = 0;
  let ticket = 0;

  monter(racine, [
    h("h1", {}, "Journal des accès"),
    h("p", { class: "aide" }, "Les plus récentes d'abord. La recherche porte sur le nom du patient et du soignant, dans la page affichée."),
    h("form", {
      class: "pile",
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        offset = 0;
        void charger();
      },
    }, [
      h("div", { class: "grille-2" }, [
        champ("Action", action),
        champ("Patient ou soignant", recherche),
      ]),
      h("button", { type: "submit", class: "btn btn-secondaire" }, "Filtrer"),
    ]),
    liste,
  ]);
  action.addEventListener("change", () => {
    offset = 0;
    void charger();
  });
  void charger();
  return racine;

  async function charger() {
    const n = ++ticket;
    liste.replaceChildren(squelettes());
    try {
      const data = await listerJournal({ action: action.value, offset, limit: PAGE_JOURNAL });
      if (n !== ticket || !vivant()) return;
      const q = plier(recherche.value.trim());
      const lignes = data.lignes.filter((ligne) => !q || plier(`${ligne.patient_nom} ${ligne.auteur_nom}`).includes(q));
      const total = data.total || 0;
      const debut = total === 0 ? 0 : offset + 1;
      const fin = Math.min(offset + data.lignes.length, total);
      const suite = [];
      suite.push(h("p", {}, total ? `${debut}–${fin} sur ${total}` : "Aucune trace"));
      if (!lignes.length) {
        suite.push(vide("Aucune trace", "Aucune ligne ne correspond à ces critères."));
      } else {
        suite.push(h("div", { class: "table-scroll" }, [
          h("table", {}, [
            h("thead", {}, [
              h("tr", {}, ["Date", "Soignant", "Rôle", "Patient", "Action"].map((titre) => h("th", { scope: "col" }, titre))),
            ]),
            h("tbody", {}, lignes.map((ligne) => h("tr", {}, [
              h("td", {}, formatDateHeure(ligne.created_at)),
              h("td", {}, ligne.auteur_nom || "Non renseigné"),
              h("td", {}, libelleRole(ligne.role)),
              h("td", {}, ligne.patient_nom || "Non renseigné"),
              h("td", {}, libelleAction(ligne.action)),
            ]))),
          ]),
        ]));
      }
      suite.push(h("div", { class: "rangee" }, [
        h("button", {
          type: "button",
          class: "btn btn-secondaire",
          disabled: offset === 0,
          onclick: () => { offset = Math.max(0, offset - PAGE_JOURNAL); void charger(); },
        }, "Page précédente"),
        h("button", {
          type: "button",
          class: "btn btn-secondaire",
          disabled: offset + PAGE_JOURNAL >= total,
          onclick: () => { offset += PAGE_JOURNAL; void charger(); },
        }, "Page suivante"),
      ]));
      liste.replaceChildren(...suite);
    } catch (error) {
      if (n !== ticket || !vivant()) return;
      liste.replaceChildren(alerte("Erreur", message(error)));
    }
  }
}

function selectAction(actuel) {
  const select = h("select");
  select.append(h("option", { value: "" }, "Toutes les actions"));
  for (const cle of ["consultation", "scan", "creation", "modification", "validation", "suppression"]) {
    select.append(h("option", { value: cle }, libelleAction(cle)));
  }
  select.value = actuel;
  return select;
}

export function compte() {
  const user = utilisateurCourant();
  if (!user || (user.role !== "medecin" && user.role !== "infirmier")) return interdit();
  const nom = h("input", { type: "text", autocomplete: "name", value: user.nom_affichage || "" });
  const erreurNom = h("div");
  const boutonNom = h("button", { type: "submit", class: "btn btn-primaire" }, "Enregistrer le nom");
  const nouveau = h("input", { type: "password", autocomplete: "new-password" });
  const confirmation = h("input", { type: "password", autocomplete: "new-password" });
  const erreurMot = h("div");
  const boutonMot = h("button", { type: "submit", class: "btn btn-primaire" }, "Changer le mot de passe");

  return h("div", { class: "pile" }, [
    h("h1", {}, "Compte"),
    info("Rôle", libelleRole(user.role)),
    info("E-mail", user.email),
    h("form", {
      class: "carte pile",
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        void sauverNom();
      },
    }, [
      h("h2", {}, "Nom affiché"),
      champ("Nom", nom),
      erreurNom,
      boutonNom,
    ]),
    h("form", {
      class: "carte pile",
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        void sauverMot();
      },
    }, [
      h("h2", {}, "Mot de passe"),
      champ("Nouveau mot de passe", nouveau, "Au moins 8 caractères. La session ouverte confirme qu'il s'agit de vous."),
      champ("Confirmation", confirmation),
      erreurMot,
      boutonMot,
    ]),
  ]);

  async function sauverNom() {
    erreurNom.replaceChildren();
    const valeur = nom.value.trim();
    if (!valeur) {
      erreurNom.append(alerte("À compléter", "Le nom affiché est obligatoire."));
      return;
    }
    boutonNom.disabled = true;
    try {
      await majProfil({ nom_affichage: valeur });
      toast("Nom mis à jour.", "succes");
      aller("#/compte");
    } catch (error) {
      erreurNom.replaceChildren(alerte("Erreur", message(error)));
      boutonNom.disabled = false;
    }
  }

  async function sauverMot() {
    erreurMot.replaceChildren();
    if (nouveau.value.length < 8) {
      erreurMot.append(alerte("À compléter", "Le mot de passe doit contenir au moins 8 caractères."));
      return;
    }
    if (nouveau.value !== confirmation.value) {
      erreurMot.append(alerte("À compléter", "Les deux mots de passe ne correspondent pas."));
      return;
    }
    boutonMot.disabled = true;
    try {
      await changerMotDePasse(nouveau.value);
      nouveau.value = "";
      confirmation.value = "";
      toast("Mot de passe mis à jour.", "succes");
      boutonMot.disabled = false;
    } catch (error) {
      erreurMot.replaceChildren(alerte("Erreur", message(error)));
      boutonMot.disabled = false;
    }
  }
}

export function qr(params) {
  const user = utilisateurCourant();
  if (!user) {
    try { sessionStorage.setItem(RETOUR, location.hash || "#/"); } catch { /* stockage indisponible */ }
    aller("#/connexion");
    return h("p", {}, "Connexion requise.");
  }
  if (user.role === "patient") {
    return h("div", { class: "pile" }, [
      h("h1", {}, "Accès réservé"),
      alerte("Accès réservé", "Accès réservé au personnel soignant."),
    ]);
  }
  if (user.role !== "medecin" && user.role !== "infirmier") return interdit();
  const racine = h("div", { class: "pile" });
  const vivant = suivi();
  racine.append(squelettes(2));
  void resoudre();
  return racine;

  async function resoudre() {
    try {
      const personne = await getPatientByQr(params.token);
      await logAccess(personne.id, "scan");
      if (!vivant()) return;
      aller(lienPatient(personne.id));
    } catch (error) {
      if (!vivant()) return;
      monter(racine, [alerte("Erreur", message(error))]);
    }
  }
}

export function interdit() {
  return h("div", { class: "pile" }, [
    h("h1", {}, "Accès refusé"),
    alerte("Accès refusé", "Cette action n'est pas autorisée pour votre rôle."),
    h("a", { class: "btn btn-primaire", href: "#/patients" }, "Retour aux patients"),
  ]);
}

export function introuvable() {
  return h("div", { class: "pile" }, [
    h("h1", {}, "Page introuvable"),
    h("p", {}, "Cette adresse ne correspond à aucune page."),
    h("a", { class: "btn btn-primaire", href: "#/" }, "Retour à l'accueil"),
  ]);
}
