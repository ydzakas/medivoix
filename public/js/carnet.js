import { normaliserAntecedents, normalizeDossier } from "./dossier.js";
import {
  formatDateLongue,
  identifiantValide,
  libelleAge,
  libelleSexe,
} from "./format.js";
import { blocAntecedents } from "./rendu.js";
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
let generation = 0;

function message(error) {
  return error?.message || "Opération impossible. Réessayez.";
}

function info(libelle, valeur) {
  return h("p", {}, [h("strong", {}, `${libelle} : `), valeur || "Non renseigné"]);
}

function focusTitre() {
  const titre = ecran.querySelector("h1");
  if (!titre) return;
  titre.setAttribute("tabindex", "-1");
  titre.focus();
}

function peindre() {
  const ticket = ++generation;
  const user = utilisateurCourant();
  document.title = "Mon carnet de santé — MediVoix";
  if (user && (user.role === "medecin" || user.role === "infirmier")) {
    location.replace("/#/patients");
    return;
  }
  const blocs = [];
  if (estLocal()) {
    blocs.push(h("p", {
      class: "bandeau-demo",
      role: "status",
    }, "Mode démonstration locale : ce carnet reste dans ce navigateur."));
  }
  if (!user || user.role !== "patient") {
    blocs.push(ecranConnexion());
  } else if (user.doit_changer_identifiants) {
    blocs.push(ecranChangement(user));
  } else {
    blocs.push(coquille(user, ticket));
  }
  ecran.replaceChildren(...blocs);
  focusTitre();
}

function entete(user) {
  const bouton = (nom, texte) => h("button", {
    type: "button",
    "aria-current": vue === nom ? "page" : null,
    onclick: () => {
      vue = nom;
      peindre();
    },
  }, texte);
  return h("header", { class: "entete" }, [
    h("div", { class: "entete-barre" }, [
      h("p", { class: "logo" }, "MediVoix"),
      h("p", { class: "qui" }, user.nom_affichage || "Patient"),
      h("nav", { class: "nav", "aria-label": "Espace patient" }, [
        bouton("carnet", "Mon carnet"),
        bouton("espace", "Mon espace"),
        h("button", { type: "button", onclick: () => { void quitter(); } }, "Quitter"),
      ]),
    ]),
  ]);
}

function enteteSimple() {
  return h("header", { class: "entete" }, [
    h("div", { class: "entete-barre" }, [
      h("p", { class: "logo" }, "MediVoix"),
      h("nav", { class: "nav", "aria-label": "Espace patient" }, [
        h("button", { type: "button", onclick: () => { void quitter(); } }, "Quitter"),
      ]),
    ]),
  ]);
}

async function quitter() {
  try {
    await signOut();
  } catch (error) {
    toast(message(error), "erreur");
    return;
  }
  vue = "carnet";
  peindre();
}

function ecranConnexion() {
  const identifiant = h("input", { id: "identifiant-patient", type: "text", autocomplete: "username", autocapitalize: "none" });
  const mot = h("input", { id: "mot-de-passe-patient", type: "password", autocomplete: "current-password" });
  const erreur = h("div");
  const bouton = h("button", { type: "submit", class: "btn btn-primaire" }, "Ouvrir mon carnet");
  return h("div", {}, [
    h("header", { class: "entete" }, [
      h("div", { class: "entete-barre" }, [
        h("a", { class: "logo", href: "/" }, "MediVoix"),
        h("nav", { class: "nav", "aria-label": "Navigation" }, [
          h("a", { href: "/" }, "Accueil"),
          h("a", { href: "/#/connexion" }, "Espace soignant"),
        ]),
      ]),
    ]),
    h("main", { class: "contenu" }, [
      h("div", { class: "pile" }, [
        h("h1", {}, "Mon carnet de santé"),
        h("p", {}, "Utilisez l'identifiant et le mot de passe remis par la clinique. Aucun autre dossier n'est accessible depuis cet espace."),
        h("form", {
          class: "carte pile",
          novalidate: true,
          onsubmit: (event) => {
            event.preventDefault();
            void entrer();
          },
        }, [
          champ("Identifiant", identifiant),
          champ("Mot de passe", mot),
          erreur,
          bouton,
        ]),
      ]),
    ]),
  ]);

  async function entrer() {
    erreur.replaceChildren();
    if (!identifiant.value.trim() || !mot.value) {
      erreur.append(alerte("À compléter", "Indiquez l'identifiant et le mot de passe."));
      return;
    }
    bouton.disabled = true;
    try {
      const user = await signInPatient(identifiant.value, mot.value);
      if (user.role !== "patient") {
        location.replace("/#/patients");
        return;
      }
      vue = "carnet";
      peindre();
    } catch (error) {
      erreur.replaceChildren(alerte("Erreur", message(error)));
      bouton.disabled = false;
    }
  }
}

function ecranChangement(user) {
  const identifiant = h("input", {
    id: "nouvel-identifiant",
    type: "text",
    autocomplete: "username",
    autocapitalize: "none",
    spellcheck: "false",
  });
  const mot = h("input", { id: "nouveau-mot-de-passe", type: "password", autocomplete: "new-password" });
  const confirmation = h("input", { type: "password", autocomplete: "new-password" });
  const erreur = h("div");
  const bouton = h("button", { type: "submit", class: "btn btn-primaire" }, "Enregistrer mes identifiants");
  return h("div", {}, [
    enteteSimple(),
    h("main", { class: "contenu" }, [
      h("form", {
        class: "pile",
        novalidate: true,
        onsubmit: (event) => {
          event.preventDefault();
          void enregistrer();
        },
      }, [
        h("h1", {}, "Choisissez vos identifiants"),
        h("p", {}, "Pour protéger votre carnet, remplacez l'identifiant et le mot de passe provisoires avant de continuer."),
        info("Identifiant actuel", user.identifiant),
        champ("Nouvel identifiant", identifiant, "Lettres minuscules, chiffres et points. Au moins 3 caractères, différent de l'identifiant provisoire."),
        champ("Nouveau mot de passe", mot, "Au moins 8 caractères."),
        champ("Confirmation", confirmation),
        erreur,
        bouton,
      ]),
    ]),
  ]);

  async function enregistrer() {
    erreur.replaceChildren();
    const propre = identifiant.value.trim().toLowerCase();
    if (!identifiantValide(propre)) {
      erreur.append(alerte("À compléter", "Identifiant invalide. Lettres minuscules, chiffres, points, au moins 3 caractères."));
      return;
    }
    if (user.identifiant && propre === user.identifiant) {
      erreur.append(alerte("À compléter", "Choisissez un identifiant différent de celui qui vous a été remis."));
      return;
    }
    if (mot.value.length < 8) {
      erreur.append(alerte("À compléter", "Le mot de passe doit contenir au moins 8 caractères."));
      return;
    }
    if (mot.value !== confirmation.value) {
      erreur.append(alerte("À compléter", "Les deux mots de passe ne correspondent pas."));
      return;
    }
    bouton.disabled = true;
    try {
      await changerIdentifiant(propre);
      await changerMotDePasse(mot.value);
      await majProfil({ doit_changer_identifiants: false });
      toast("Identifiants mis à jour.", "succes");
      vue = "carnet";
      peindre();
    } catch (error) {
      erreur.replaceChildren(alerte("Erreur", message(error)));
      bouton.disabled = false;
    }
  }
}

function coquille(user, ticket) {
  return h("div", {}, [
    entete(user),
    h("main", { class: "contenu" }, [
      vue === "espace" ? espace(user, ticket) : carnet(ticket),
    ]),
  ]);
}

function carnet(ticket) {
  const racine = h("div", { class: "pile" });
  racine.append(h("h1", {}, "Mon carnet"), squelettes());
  void charger();
  return racine;

  async function charger() {
    try {
      const fiche = await monDossier();
      if (ticket !== generation) return;
      const consultations = (await listConsultations(fiche.id)).filter((item) => item.valide);
      if (ticket !== generation) return;
      const atcd = normaliserAntecedents(fiche.antecedents);
      racine.replaceChildren(
        h("div", { class: "rangee" }, [
          h("h1", {}, "Mon carnet"),
          h("button", { type: "button", class: "btn btn-secondaire no-print", onclick: () => window.print() }, "Imprimer"),
        ]),
        h("p", {}, "Seules les consultations validées par le médecin apparaissent ici."),
        h("section", { class: "pile" }, [
          h("h2", {}, "Identité"),
          info("Nom", fiche.nom_complet),
          info("Sexe", libelleSexe(fiche.sexe)),
          info("Âge", libelleAge(fiche.date_naissance)),
          info("Date de naissance", fiche.date_naissance ? formatDateLongue(fiche.date_naissance) : ""),
          info("Groupe sanguin", fiche.groupe_sanguin),
          info("Téléphone", fiche.telephone),
          info("Adresse", fiche.adresse),
        ]),
        h("section", { class: "carte carte-forte pile" }, [
          h("h2", {}, "Allergies"),
          h("p", {}, atcd.allergies),
        ]),
        h("section", { class: "carte pile" }, [
          h("h2", {}, "Traitements en cours"),
          h("p", {}, atcd.traitements_en_cours),
        ]),
        h("section", { class: "pile" }, [
          h("h2", {}, "Antécédents"),
          blocAntecedents(atcd),
        ]),
        h("section", { class: "pile" }, [
          h("h2", {}, "Consultations"),
          consultations.length
            ? consultations.map((item) => consultationVisible(item))
            : vide("Aucune consultation validée", "Quand le médecin valide une consultation, elle apparaît ici."),
        ]),
      );
      focusTitre();
    } catch (error) {
      if (ticket !== generation) return;
      racine.replaceChildren(alerte("Erreur", message(error)));
    }
  }
}

function consultationVisible(item) {
  const dossier = normalizeDossier(item.dossier, { conserverAcceptation: true });
  const traitements = dossier.traitement_suggere.filter((ligne) => ligne.molecule);
  return h("article", { class: "carte pile" }, [
    h("h3", {}, formatDateLongue(item.created_at) || "Consultation"),
    h("p", {}, [h("strong", {}, "Motif : "), dossier.motif_consultation]),
    h("p", {}, [h("strong", {}, "Résumé : "), dossier.resume_patient]),
    h("div", { class: "pile" }, [
      h("p", {}, h("strong", {}, "Traitements retenus")),
      traitements.length
        ? h("ul", { class: "liste" }, traitements.map((ligne) => h("li", {}, `${ligne.molecule} — ${ligne.posologie} — ${ligne.duree}`)))
        : h("p", {}, "Aucun traitement retenu."),
    ]),
    h("div", { class: "pile" }, [
      h("p", {}, h("strong", {}, "Examens")),
      dossier.examens_complementaires.length
        ? h("ul", { class: "liste" }, dossier.examens_complementaires.map((ligne) => h("li", {}, ligne)))
        : h("p", {}, "Aucun examen noté."),
    ]),
    h("p", {}, [h("strong", {}, "Conduite à tenir : "), dossier.conduite_a_tenir]),
  ]);
}

function espace(user, ticket) {
  const racine = h("div", { class: "pile" });
  racine.append(h("h1", {}, "Mon espace"), squelettes());
  void charger();
  return racine;

  async function charger() {
    try {
      const fiche = await monDossier();
      if (ticket !== generation) return;
      racine.replaceChildren(formulaire(fiche));
      focusTitre();
    } catch (error) {
      if (ticket !== generation) return;
      racine.replaceChildren(alerte("Erreur", message(error)));
    }
  }

  function formulaire(fiche) {
    const nom = h("input", { type: "text", autocomplete: "name", value: user.nom_affichage || "" });
    const telephone = h("input", { type: "tel", autocomplete: "tel", value: fiche.telephone || "" });
    const adresse = h("textarea", { rows: "3", autocomplete: "street-address" });
    adresse.value = fiche.adresse || "";
    const identifiant = h("input", {
      type: "text",
      autocomplete: "username",
      autocapitalize: "none",
      spellcheck: "false",
      value: user.identifiant || "",
    });
    const erreur = h("div");
    const bouton = h("button", { type: "submit", class: "btn btn-primaire" }, "Enregistrer");
    const mot = h("input", { id: "mot-de-passe-espace", type: "password", autocomplete: "new-password" });
    const confirmation = h("input", { type: "password", autocomplete: "new-password" });
    const erreurMot = h("div");
    const boutonMot = h("button", { type: "submit", class: "btn btn-primaire" }, "Changer le mot de passe");
    return h("div", { class: "pile" }, [
      h("h1", {}, "Mon espace"),
      h("form", {
        class: "carte pile",
        novalidate: true,
        onsubmit: (event) => {
          event.preventDefault();
          void sauver();
        },
      }, [
        h("h2", {}, "Coordonnées"),
        champ("Nom affiché", nom),
        champ("Téléphone", telephone),
        champ("Adresse", adresse),
        champ("Identifiant", identifiant, "Lettres minuscules, chiffres et points. Au moins 3 caractères."),
        erreur,
        bouton,
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
        champ("Nouveau mot de passe", mot, "Au moins 8 caractères."),
        champ("Confirmation", confirmation),
        erreurMot,
        boutonMot,
      ]),
    ]);

    async function sauver() {
      erreur.replaceChildren();
      const nomPropre = nom.value.trim();
      const identifiantPropre = identifiant.value.trim().toLowerCase();
      if (!nomPropre) {
        erreur.append(alerte("À compléter", "Le nom affiché est obligatoire."));
        return;
      }
      if (!identifiantValide(identifiantPropre)) {
        erreur.append(alerte("À compléter", "Identifiant invalide. Lettres minuscules, chiffres, points, au moins 3 caractères."));
        return;
      }
      bouton.disabled = true;
      try {
        if (identifiantPropre !== (utilisateurCourant().identifiant || "")) {
          await changerIdentifiant(identifiantPropre);
        }
        await majProfil({ nom_affichage: nomPropre });
        await updatePatient(fiche.id, {
          telephone: telephone.value.trim(),
          adresse: adresse.value.trim(),
        });
        toast("Coordonnées enregistrées.", "succes");
        peindre();
      } catch (error) {
        erreur.replaceChildren(alerte("Erreur", message(error)));
        bouton.disabled = false;
      }
    }

    async function sauverMot() {
      erreurMot.replaceChildren();
      if (mot.value.length < 8) {
        erreurMot.append(alerte("À compléter", "Le mot de passe doit contenir au moins 8 caractères."));
        return;
      }
      if (mot.value !== confirmation.value) {
        erreurMot.append(alerte("À compléter", "Les deux mots de passe ne correspondent pas."));
        return;
      }
      boutonMot.disabled = true;
      try {
        await changerMotDePasse(mot.value);
        mot.value = "";
        confirmation.value = "";
        toast("Mot de passe mis à jour.", "succes");
        boutonMot.disabled = false;
      } catch (error) {
        erreurMot.replaceChildren(alerte("Erreur", message(error)));
        boutonMot.disabled = false;
      }
    }
  }
}

async function demarrer() {
  ecran.replaceChildren(squelettes());
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  try {
    await init();
  } catch (error) {
    ecran.replaceChildren(alerte("Erreur", error.message || "Démarrage impossible."));
    return;
  }
  peindre();
}

void demarrer();
