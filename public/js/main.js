import { estLocal, init, signOut, utilisateurCourant } from "./store.js";
import { correspond, demarrer } from "./router.js";
import { alerte, h, squelettes } from "./ui.js";
import { libelleRole } from "./format.js";
import { speech } from "./speech.js";
import * as pages from "./pages.js";

const ecran = document.querySelector("#ecran");
const titres = {
  accueil: "Accueil",
  connexion: "Connexion soignant",
  patients: "Patients",
  nouveau: "Nouveau patient",
  patient: "Dossier patient",
  consultation: "Consultation",
  edition: "Modifier la consultation",
  dossier: "Dossier",
  scanner: "Scanner",
  journal: "Journal d'accès",
  compte: "Compte",
  qr: "QR code",
  interdit: "Accès refusé",
  introuvable: "Page introuvable",
};
let ticket = 0;

function garde(route) {
  const user = utilisateurCourant();
  if (route.name === "qr") return route;
  if (!user) {
    if (route.name === "accueil" || route.name === "connexion") return route;
    sessionStorage.setItem("medivoix.next", location.hash || "#/");
    return { name: "connexion", params: {} };
  }
  if (user.role === "patient") {
    if (route.name === "qr") return route;
    location.replace("mon-carnet.html");
    return null;
  }
  if (route.name === "accueil" || route.name === "connexion") {
    const next = sessionStorage.getItem("medivoix.next");
    sessionStorage.removeItem("medivoix.next");
    if (next && next.startsWith("#/p/") && location.hash !== next) {
      location.hash = next;
      return null;
    }
    if (location.hash !== "#/patients") {
      location.hash = "#/patients";
      return null;
    }
    return { name: "patients", params: {} };
  }
  if (route.name === "journal" && user.role !== "medecin") return { name: "interdit", params: {} };
  if (["nouveau", "consultation", "edition"].includes(route.name) && user.role !== "medecin") {
    return { name: "interdit", params: {} };
  }
  return route;
}

function entete(name) {
  const user = utilisateurCourant();
  if (!user) {
    return h("header", { class: "entete no-print" }, [
      h("div", { class: "entete-barre" }, [
        h("a", { class: "logo", href: "#/" }, "MediVoix"),
        h("span", { class: "qui" }, "Parlez, on rédige."),
      ]),
    ]);
  }
  const liens = [
    ["#/patients", "Patients", "patients"],
    ["#/scanner", "Scanner", "scanner"],
  ];
  if (user.role === "medecin") liens.push(["#/journal", "Journal", "journal"]);
  liens.push(["#/compte", "Compte", "compte"]);
  const courant = ["patient", "nouveau", "consultation", "edition", "dossier"].includes(name) ? "patients" : name;
  return h("header", { class: "entete no-print" }, [
    h("div", { class: "entete-barre" }, [
      h("a", { class: "logo", href: "#/patients" }, "MediVoix"),
      h("span", { class: "qui" }, `${user.nom_affichage || "Soignant"} · ${libelleRole(user.role)}`),
    ]),
    h("div", { class: "entete-barre" }, [
      h("nav", { class: "nav", "aria-label": "Espace soignant" }, [
        ...liens.map(([href, label, cle]) => h("a", {
          href,
          "aria-current": courant === cle ? "page" : null,
        }, label)),
        h("button", { type: "button", onclick: async () => { await signOut(); location.hash = "#/"; } }, "Déconnexion"),
      ]),
    ]),
  ]);
}

function quitter() {
  speech.stop();
  ecran.querySelectorAll("*").forEach((el) => el.dispatchEvent(new CustomEvent("medivoix-leave")));
}

async function dessiner() {
  const id = ++ticket;
  const route = garde(correspond(location.hash));
  if (!route || id !== ticket) return;
  document.title = `${titres[route.name] || "MediVoix"} — MediVoix`;
  quitter();
  ecran.replaceChildren(entete(route.name), h("main", { class: "contenu" }, [squelettes()]));
  try {
    const vue = await pages[route.name](route.params);
    if (id !== ticket) return;
    const enfants = [entete(route.name)];
    if (estLocal() && utilisateurCourant()) {
      enfants.push(h("div", { class: "bandeau-demo no-print" }, "Mode démonstration : les dossiers restent sur cet appareil. Reliez Supabase pour la clinique."));
    }
    enfants.push(h("main", { class: "contenu" }, [vue]));
    ecran.replaceChildren(...enfants);
  } catch (error) {
    if (id !== ticket) return;
    ecran.replaceChildren(entete(route.name), h("main", { class: "contenu" }, [
      alerte("Erreur", error.message || "Une erreur est survenue."),
    ]));
  }
}

await init();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
demarrer(dessiner);
