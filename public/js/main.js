import { libelleRole } from "./format.js";
import * as pages from "./pages.js";
import { correspond, demarrer } from "./router.js";
import { speech } from "./speech.js";
import { estLocal, init, signOut, utilisateurCourant } from "./store.js";
import { alerte, h, squelettes, toast } from "./ui.js";

const RETOUR = "medivoix.retour";
const PUBLIQUES = new Set(["accueil", "connexion", "introuvable"]);
const RESERVE_MEDECIN = new Set(["nouveau", "consultation", "edition", "journal"]);

const TITRES = {
  accueil: "MediVoix — Parlez, on rédige.",
  connexion: "Connexion — MediVoix",
  patients: "Patients — MediVoix",
  nouveau: "Nouveau patient — MediVoix",
  patient: "Dossier patient — MediVoix",
  consultation: "Consultation — MediVoix",
  edition: "Consultation — MediVoix",
  dossier: "Dossier de consultation — MediVoix",
  scanner: "Scanner — MediVoix",
  journal: "Journal — MediVoix",
  compte: "Compte — MediVoix",
  qr: "Accès dossier — MediVoix",
  interdit: "Accès refusé — MediVoix",
  introuvable: "Page introuvable — MediVoix",
};

const ecran = document.querySelector("#ecran");

function memoriserRetour() {
  try {
    sessionStorage.setItem(RETOUR, location.hash || "#/");
  } catch {
    // Le navigateur peut refuser le stockage de session.
  }
}

function changerHash(hash) {
  if (location.hash === hash) return false;
  location.hash = hash;
  return true;
}

function routeEffective(route) {
  const user = utilisateurCourant();
  if (!user) {
    if (!PUBLIQUES.has(route.name)) {
      memoriserRetour();
      if (changerHash("#/connexion")) return null;
      return { name: "connexion", params: {} };
    }
    return route;
  }
  if (user.role === "patient") {
    if (route.name === "qr") return route;
    location.replace("/mon-carnet.html");
    return null;
  }
  if (user.role !== "medecin" && user.role !== "infirmier") {
    if (changerHash("#/connexion")) return null;
    return { name: "connexion", params: {} };
  }
  if (user.role === "infirmier" && RESERVE_MEDECIN.has(route.name)) {
    return { name: "interdit", params: {} };
  }
  if (route.name === "connexion") {
    if (changerHash("#/patients")) return null;
    return { name: "patients", params: {} };
  }
  return route;
}

function lien(href, texte, actif) {
  return h("a", { href, "aria-current": actif ? "page" : null }, texte);
}

function rubriquePatients(nom) {
  return ["patients", "patient", "nouveau", "consultation", "edition", "dossier"].includes(nom);
}

async function quitter() {
  try {
    await signOut();
  } catch (error) {
    toast(error.message || "Déconnexion impossible.", "erreur");
    return;
  }
  if (!changerHash("#/")) window.dispatchEvent(new Event("hashchange"));
}

function enteteSoignant(route) {
  const user = utilisateurCourant();
  const nom = route.name;
  const liens = [
    lien("#/patients", "Patients", rubriquePatients(nom)),
    lien("#/scanner", "Scanner", nom === "scanner"),
  ];
  if (user?.role === "medecin") liens.push(lien("#/journal", "Journal", nom === "journal"));
  liens.push(lien("#/compte", "Compte", nom === "compte"));
  liens.push(h("button", { type: "button", onclick: () => { void quitter(); } }, "Quitter"));
  return h("header", { class: "entete" }, [
    h("div", { class: "entete-barre" }, [
      h("a", { class: "logo", href: "#/patients" }, "MediVoix"),
      h("p", { class: "qui" }, `${user?.nom_affichage || "Soignant"} · ${libelleRole(user?.role)}`),
      h("nav", { class: "nav", "aria-label": "Navigation principale" }, liens),
    ]),
  ]);
}

function entetePublic(route) {
  return h("header", { class: "entete" }, [
    h("div", { class: "entete-barre" }, [
      h("a", { class: "logo", href: "#/" }, "MediVoix"),
      h("nav", { class: "nav", "aria-label": "Navigation principale" }, [
        lien("#/", "Accueil", route.name === "accueil"),
        lien("#/connexion", "Connexion", route.name === "connexion"),
        h("a", { href: "/mon-carnet.html" }, "Espace patient"),
      ]),
    ]),
  ]);
}

function enteteMinimal() {
  return h("header", { class: "entete" }, [
    h("div", { class: "entete-barre" }, [
      h("p", { class: "logo" }, "MediVoix"),
      h("nav", { class: "nav", "aria-label": "Navigation" }, [
        h("a", { href: "/mon-carnet.html" }, "Mon carnet"),
      ]),
    ]),
  ]);
}

function chrome(route) {
  if (route.name === "accueil") return null;
  const user = utilisateurCourant();
  if (!user) return entetePublic(route);
  if (user.role === "patient") return enteteMinimal();
  return enteteSoignant(route);
}

function focusTitre() {
  const titre = ecran.querySelector("h1");
  if (!titre) return;
  titre.setAttribute("tabindex", "-1");
  titre.focus();
}

function dessiner() {
  speech.stop();
  window.dispatchEvent(new Event("medivoix-leave"));
  document.querySelectorAll(".modale").forEach((noeud) => noeud.remove());
  const route = routeEffective(correspond(location.hash));
  if (!route) return;
  document.title = TITRES[route.name] || "MediVoix";
  const vue = typeof pages[route.name] === "function" ? pages[route.name] : pages.introuvable;
  let corps;
  try {
    corps = vue(route.params || {});
  } catch (error) {
    corps = alerte("Erreur", error.message || "Affichage impossible.");
  }
  const blocs = [];
  const tete = chrome(route);
  if (tete) blocs.push(tete);
  if (estLocal()) {
    blocs.push(h("p", {
      class: "bandeau-demo",
      role: "status",
    }, "Mode démonstration locale : les données restent dans ce navigateur."));
  }
  if (route.name === "accueil") blocs.push(corps);
  else blocs.push(h("main", { class: "contenu" }, [corps]));
  ecran.replaceChildren(...blocs);
  focusTitre();
}

async function demarrerApplication() {
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
  demarrer(dessiner);
}

void demarrerApplication();
