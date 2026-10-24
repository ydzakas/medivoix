import { ANTECEDENTS, APPAREILS, CONSTANTES, normalizeDossier } from "./dossier.js";
import { h } from "./ui.js";

function paragraphe(texte) {
  return h("p", {}, texte || "Non renseigné");
}

export function blocAntecedents(antecedents) {
  const data = antecedents || {};
  return h("div", { class: "pile" }, ANTECEDENTS.map(([cle, label]) => h("p", {}, [
    h("strong", {}, `${label} : `),
    data[cle] || "Non renseigné",
  ])));
}

function badgeSource(source) {
  const dicte = source === "dicte";
  return h("span", { class: dicte ? "badge badge-dicte" : "badge badge-normal" }, dicte ? "Dicté" : "Normal par défaut, à vérifier");
}

export function lectureDossier(brut) {
  const dossier = normalizeDossier(brut, { conserverAcceptation: true });
  const general = dossier.examen_general;
  return h("div", { class: "pile" }, [
    h("section", { class: "pile" }, [h("h2", {}, "Motif de consultation"), paragraphe(dossier.motif_consultation)]),
    h("section", { class: "pile" }, [h("h2", {}, "Histoire de la maladie"), paragraphe(dossier.histoire_maladie)]),
    h("section", { class: "pile" }, [h("h2", {}, "Antécédents"), blocAntecedents(dossier.antecedents)]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Examen général"),
      paragraphe(general.etat_general),
      paragraphe(`Conscience : ${general.conscience}`),
      paragraphe(`Conjonctives : ${general.conjonctives}`),
      paragraphe(`Hydratation : ${general.hydratation}`),
      h("div", { class: "grille-3" }, CONSTANTES.map(([cle, label]) => h("p", {}, [
        h("strong", {}, `${label} : `),
        general.constantes[cle],
      ]))),
    ]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Examen par appareils"),
      ...APPAREILS.map(([cle, label]) => h("div", { class: "appareil pile" }, [
        h("div", { class: "appareil-entete" }, [h("h3", {}, label), badgeSource(dossier.examen_appareils[cle].source)]),
        h("ul", { class: "liste" }, dossier.examen_appareils[cle].constat.map((ligne) => h("li", {}, ligne))),
      ])),
    ]),
    h("section", { class: "pile" }, [h("h2", {}, "Résumé syndromique"), paragraphe(dossier.resume_syndromique)]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Hypothèses diagnostiques"),
      dossier.hypotheses_diagnostiques.length
        ? h("ul", { class: "liste" }, dossier.hypotheses_diagnostiques.map((item) => h("li", {}, item)))
        : paragraphe("Aucune hypothèse retenue."),
    ]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Examens complémentaires"),
      dossier.examens_complementaires.length
        ? h("ul", { class: "liste" }, dossier.examens_complementaires.map((item) => h("li", {}, item)))
        : paragraphe("Aucun examen complémentaire noté."),
    ]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Traitement retenu"),
      dossier.traitement_suggere.length
        ? h("ul", { class: "liste" }, dossier.traitement_suggere.map((ligne) => h("li", {}, `${ligne.molecule} — ${ligne.posologie} — ${ligne.duree}`)))
        : paragraphe("Aucun traitement retenu."),
    ]),
    h("section", { class: "pile" }, [h("h2", {}, "Conduite à tenir"), paragraphe(dossier.conduite_a_tenir)]),
    h("section", { class: "pile" }, [h("h2", {}, "Résumé pour le patient"), paragraphe(dossier.resume_patient)]),
  ]);
}

function zoneTexte(valeur, onInput, rows = 4) {
  const el = h("textarea", { rows: String(rows) });
  el.value = valeur || "";
  el.addEventListener("input", () => onInput(el.value));
  return el;
}

function champTexte(valeur, onInput) {
  const el = h("input", { type: "text" });
  el.value = valeur || "";
  el.addEventListener("input", () => onInput(el.value));
  return el;
}

function listeEditable(valeurs, dessiner) {
  const bloc = h("div", { class: "pile" });
  const peindre = () => {
    bloc.replaceChildren(
      ...valeurs.map((ligne, index) => h("div", { class: "puce" }, [
        champTexte(ligne, (valeur) => { valeurs[index] = valeur; }),
        h("button", { type: "button", class: "btn btn-secondaire", onclick: () => { valeurs.splice(index, 1); peindre(); } }, "Retirer"),
      ])),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => { valeurs.push(""); peindre(); } }, "Ajouter une ligne"),
    );
    dessiner?.();
  };
  peindre();
  return bloc;
}

export function editeurDossier(dossier) {
  const racine = h("div", { class: "pile" });
  const general = dossier.examen_general;
  racine.append(
    h("section", { class: "pile" }, [h("h2", {}, "Motif de consultation"), zoneTexte(dossier.motif_consultation, (v) => { dossier.motif_consultation = v; }, 2)]),
    h("section", { class: "pile" }, [h("h2", {}, "Histoire de la maladie"), zoneTexte(dossier.histoire_maladie, (v) => { dossier.histoire_maladie = v; })]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Antécédents"),
      ...ANTECEDENTS.map(([cle, label]) => h("label", { class: "champ" }, [
        h("span", {}, label),
        zoneTexte(dossier.antecedents[cle], (v) => { dossier.antecedents[cle] = v; }, 2),
      ])),
    ]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Examen général"),
      h("label", { class: "champ" }, [h("span", {}, "État général"), champTexte(general.etat_general, (v) => { general.etat_general = v; })]),
      h("label", { class: "champ" }, [h("span", {}, "Conscience"), champTexte(general.conscience, (v) => { general.conscience = v; })]),
      h("label", { class: "champ" }, [h("span", {}, "Conjonctives"), champTexte(general.conjonctives, (v) => { general.conjonctives = v; })]),
      h("label", { class: "champ" }, [h("span", {}, "Hydratation"), champTexte(general.hydratation, (v) => { general.hydratation = v; })]),
      h("div", { class: "grille-3" }, CONSTANTES.map(([cle, label]) => h("label", { class: "champ" }, [
        h("span", {}, label),
        champTexte(general.constantes[cle], (v) => { general.constantes[cle] = v; }),
      ]))),
    ]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Examen par appareils"),
      ...APPAREILS.map(([cle, label]) => blocAppareil(dossier.examen_appareils[cle], label)),
    ]),
    h("section", { class: "pile" }, [h("h2", {}, "Résumé syndromique"), zoneTexte(dossier.resume_syndromique, (v) => { dossier.resume_syndromique = v; })]),
    h("section", { class: "pile" }, [h("h2", {}, "Hypothèses diagnostiques"), listeEditable(dossier.hypotheses_diagnostiques)]),
    h("section", { class: "pile" }, [h("h2", {}, "Examens complémentaires"), listeEditable(dossier.examens_complementaires)]),
    h("section", { class: "pile" }, [
      h("h2", {}, "Traitement suggéré"),
      h("p", { class: "aide" }, "Suggestion à valider par le médecin. Les lignes non cochées ne seront pas enregistrées."),
      tableauTraitement(dossier),
    ]),
    h("section", { class: "pile" }, [h("h2", {}, "Conduite à tenir"), zoneTexte(dossier.conduite_a_tenir, (v) => { dossier.conduite_a_tenir = v; })]),
    h("section", { class: "pile" }, [h("h2", {}, "Résumé pour le patient"), zoneTexte(dossier.resume_patient, (v) => { dossier.resume_patient = v; })]),
  );
  return racine;
}

function blocAppareil(appareil, label) {
  const badge = badgeSource(appareil.source);
  function paint() {
    const dicte = appareil.source === "dicte";
    badge.className = dicte ? "badge badge-dicte" : "badge badge-normal";
    badge.textContent = dicte ? "Dicté" : "Normal par défaut, à vérifier";
  }
  const liste = h("div", { class: "pile" });
  function draw() {
    liste.replaceChildren(...appareil.constat.map((ligne, index) => {
      const input = champTexte(ligne, (valeur) => {
        appareil.constat[index] = valeur;
        appareil.source = "dicte";
        paint();
      });
      return h("div", { class: "puce" }, [
        input,
        h("button", { type: "button", class: "btn btn-secondaire", onclick: () => {
          appareil.constat.splice(index, 1);
          appareil.source = "dicte";
          paint();
          draw();
        } }, "Retirer"),
      ]);
    }));
  }
  draw();
  return h("div", { class: "appareil pile" }, [
    h("div", { class: "appareil-entete" }, [h("h3", {}, label), badge]),
    liste,
    h("button", { type: "button", class: "btn btn-secondaire", onclick: () => {
      appareil.constat.push("");
      appareil.source = "dicte";
      paint();
      draw();
    } }, "Ajouter une ligne"),
  ]);
}

function tableauTraitement(dossier) {
  const bloc = h("div", { class: "pile" });
  const peindre = () => {
    bloc.replaceChildren(...dossier.traitement_suggere.map((ligne, index) => h("div", { class: "carte pile" }, [
      h("label", { class: "champ" }, [h("span", {}, "Molécule"), champTexte(ligne.molecule, (v) => { ligne.molecule = v; })]),
      h("div", { class: "grille-2" }, [
        h("label", { class: "champ" }, [h("span", {}, "Posologie"), champTexte(ligne.posologie, (v) => { ligne.posologie = v; })]),
        h("label", { class: "champ" }, [h("span", {}, "Durée"), champTexte(ligne.duree, (v) => { ligne.duree = v; })]),
      ]),
      h("label", { class: "role" }, [
        h("input", { type: "checkbox", checked: ligne.accepte, onchange: (e) => { ligne.accepte = e.target.checked; } }),
        "Retenir",
      ]),
      h("button", { type: "button", class: "btn btn-secondaire", onclick: () => { dossier.traitement_suggere.splice(index, 1); peindre(); } }, "Retirer la ligne"),
    ])));
    bloc.append(h("button", { type: "button", class: "btn btn-secondaire", onclick: () => {
      dossier.traitement_suggere.push({ molecule: "", posologie: "", duree: "", accepte: false });
      peindre();
    } }, "Ajouter un traitement"));
  };
  peindre();
  return bloc;
}
