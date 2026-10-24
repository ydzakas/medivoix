const SVG = "http://www.w3.org/2000/svg";
const TRACES = {
  alerte: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v7h-2V7h2zm0 9v2h-2v-2h2z",
  micro: "M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-3.1A7 7 0 0019 11h-2z",
  croix: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z",
};

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(attrs || {})) {
    if (valeur == null || valeur === false) continue;
    if (cle === "class") el.className = valeur;
    else if (cle.startsWith("on") && typeof valeur === "function") {
      el.addEventListener(cle.slice(2).toLowerCase(), valeur);
    } else if (cle === "value") el.value = valeur;
    else if (cle === "checked" || cle === "disabled" || cle === "readOnly") el[cle] = Boolean(valeur);
    else el.setAttribute(cle, valeur === true ? "" : String(valeur));
  }
  ajouter(el, children);
  return el;
}

function ajouter(el, children) {
  const liste = Array.isArray(children) ? children : [children];
  for (const enfant of liste) {
    if (enfant == null || enfant === false) continue;
    if (Array.isArray(enfant)) ajouter(el, enfant);
    else el.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

export function icone(nom) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icone");
  const chemin = document.createElementNS(SVG, "path");
  chemin.setAttribute("fill", "currentColor");
  chemin.setAttribute("d", TRACES[nom] || TRACES.alerte);
  svg.append(chemin);
  return svg;
}

export function champ(libelle, controle, aide) {
  return h("label", { class: "champ" }, [
    h("span", {}, libelle),
    controle,
    aide ? h("small", { class: "aide" }, aide) : null,
  ]);
}

export function alerte(titre, contenu) {
  const corps = Array.isArray(contenu)
    ? h("ul", {}, contenu.map((item) => h("li", {}, item)))
    : h("p", {}, contenu);
  return h("div", { class: "alerte", role: "alert" }, [
    icone("alerte"),
    h("div", {}, [h("strong", {}, titre), corps]),
  ]);
}

export function vide(titre, texte) {
  return h("div", { class: "carte vide" }, [h("h2", {}, titre), h("p", { class: "aide" }, texte)]);
}

export function squelettes(nombre = 4) {
  return h("div", { class: "squelettes", role: "status", "aria-label": "Chargement" }, [
    h("p", { class: "aide" }, "Chargement…"),
    ...Array.from({ length: nombre }, () => h("div", { class: "skel" }, [h("span")])),
  ]);
}

let zoneToasts;

function zone() {
  if (!zoneToasts) {
    zoneToasts = h("div", { class: "toasts", "aria-live": "polite" });
    document.body.append(zoneToasts);
  }
  return zoneToasts;
}

export function toast(message, type = "info") {
  const noeud = h("button", { type: "button", class: `toast toast-${type}` }, [
    h("strong", {}, type === "erreur" ? "Erreur" : type === "succes" ? "Fait" : "Information"),
    h("span", {}, message),
  ]);
  noeud.addEventListener("click", () => noeud.remove());
  zone().append(noeud);
  setTimeout(() => noeud.remove(), 4500);
}

export function confirmer({ titre, message, confirmer: libelle = "Confirmer", danger = false }) {
  return new Promise((resoudre) => {
    const fermer = (valeur) => {
      couche.remove();
      resoudre(valeur);
    };
    const couche = h("div", { class: "modale", role: "dialog", "aria-modal": "true" }, [
      h("div", { class: "carte pile" }, [
        h("h2", {}, titre),
        h("p", {}, message),
        h("div", { class: "rangee" }, [
          h("button", { type: "button", class: "btn btn-secondaire", onclick: () => fermer(false) }, "Annuler"),
          h("button", {
            type: "button",
            class: danger ? "btn btn-danger" : "btn btn-primaire",
            onclick: () => fermer(true),
          }, [danger ? icone("alerte") : null, libelle]),
        ]),
      ]),
    ]);
    document.body.append(couche);
    couche.querySelector("button")?.focus();
  });
}

export function badgeStatut(valide) {
  return h("span", { class: valide ? "badge badge-valide" : "badge badge-brouillon" }, valide ? "Validé" : "Brouillon");
}
