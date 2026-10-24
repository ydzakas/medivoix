import { h, toast } from "./ui.js";
import { lienPatient, qrDataUrl } from "./qr.js";

function ligne(libelle, valeur) {
  return h("p", {}, [h("strong", {}, `${libelle} : `), valeur || "Non renseigné"]);
}

export function ficheAcces({ patient, motDePasse }) {
  const lien = lienPatient(patient.qr_token);
  let visuel;
  try {
    visuel = h("img", {
      src: qrDataUrl(lien),
      alt: "QR code réservé au personnel soignant",
      width: "240",
      height: "240",
    });
  } catch (error) {
    visuel = h("p", {}, error.message || "QR code indisponible.");
  }
  return h("article", { class: "carte pile" }, [
    h("p", { class: "print-only" }, "MediVoix — Fiche d'accès patient"),
    h("h2", {}, "Fiche d'accès patient"),
    ligne("Patient", patient.nom_complet),
    ligne("Identifiant", patient.identifiant),
    motDePasse
      ? ligne("Mot de passe provisoire", motDePasse)
      : h("p", {}, "Le mot de passe provisoire a déjà été remis. Il n'est plus affiché."),
    ligne("Espace patient", `${location.origin}/mon-carnet.html`),
    h("div", { class: "fiche-qr" }, [visuel]),
    h("p", { class: "aide" }, lien),
    h("p", {}, "Au premier accès, le patient devra changer ses identifiants. Le QR code est réservé au personnel soignant."),
    h("div", { class: "rangee no-print" }, [
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => window.print() }, "Imprimer"),
      h("button", {
        type: "button",
        class: "btn btn-secondaire",
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(patient.identifiant || "");
            toast("Identifiant copié.", "succes");
          } catch {
            toast("Copie impossible. Notez l'identifiant à l'écran.", "erreur");
          }
        },
      }, "Copier l'identifiant"),
    ]),
  ]);
}
