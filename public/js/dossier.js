export const APPAREILS = [
  ["cardiovasculaire", "Cardiovasculaire"],
  ["respiratoire", "Respiratoire"],
  ["digestif", "Digestif"],
  ["urinaire", "Urinaire"],
  ["neurologique", "Neurologique"],
  ["locomoteur", "Locomoteur"],
  ["cutane", "Cutané"],
  ["ganglionnaire", "Ganglionnaire"],
  ["orl", "ORL"],
  ["ophtalmologique", "Ophtalmologique"],
];

export const ANTECEDENTS = [
  ["medicaux", "Médicaux"],
  ["chirurgicaux", "Chirurgicaux"],
  ["gyneco_obstetricaux", "Gynéco-obstétricaux"],
  ["familiaux", "Familiaux"],
  ["mode_de_vie", "Mode de vie"],
  ["allergies", "Allergies"],
  ["traitements_en_cours", "Traitements en cours"],
];

export const CONSTANTES = [
  ["ta", "TA"],
  ["fc", "FC"],
  ["fr", "FR"],
  ["temperature", "Température"],
  ["spo2", "SpO2"],
  ["poids", "Poids"],
];

export const EXEMPLE_DICTEE = "Patient de 45 ans, céphalées frontales depuis 3 jours, sans vomissement ni trouble visuel. TA 160 sur 100. Le reste de l'examen est normal.";

const NORMAUX = {
  cardiovasculaire: [
    "Pas de douleur thoracique ni de palpitation signalée",
    "BDC réguliers, pas de souffle perçu",
    "Pouls périphériques perçus, pas d'OMI, pas de turgescence jugulaire",
    "Mollets souples",
  ],
  respiratoire: [
    "Thorax symétrique, ampliation conservée",
    "Vibrations vocales transmises de façon symétrique",
    "Sonorité claire à la percussion",
    "MV conservé des deux champs, pas de bruit surajouté",
  ],
  digestif: [
    "Abdomen souple, dépressible, indolore",
    "Pas de défense ni de contracture",
    "Pas d'hépatomégalie ni de splénomégalie perçue",
    "Bruits hydro-aériques présents",
  ],
  urinaire: [
    "Fosses lombaires libres et indolores",
    "Pas de dysurie ni de brûlure mictionnelle signalée",
    "Pas de globe vésical",
    "Signe de Giordano négatif",
  ],
  neurologique: [
    "Conscience claire, patient orienté",
    "Pas de déficit moteur ni sensitif décrit",
    "ROT présents et symétriques",
    "Pas de raideur de nuque, pas de signe de localisation",
  ],
  locomoteur: [
    "Articulations libres et indolores",
    "Pas de déformation ni de signe inflammatoire local",
    "Rachis indolore à la palpation",
    "Pas de boiterie signalée",
  ],
  cutane: [
    "Téguments chauds, coloration habituelle",
    "Pas d'éruption ni de lésion décrite",
    "Pas de purpura, pas d'ictère",
    "Turgescence cutanée conservée",
  ],
  ganglionnaire: [
    "Pas d'adénopathie cervicale, axillaire ni inguinale perçue",
    "Aires ganglionnaires libres et indolores",
  ],
  orl: [
    "Pas d'otalgie signalée",
    "Gorge non inflammatoire à l'inspection",
    "Pas d'odynophagie décrite",
    "Pas de rhinorrhée signalée",
  ],
  ophtalmologique: [
    "Conjonctives colorées",
    "Pupilles symétriques et réactives",
    "Pas de rougeur ni de sécrétion signalée",
    "Pas de trouble visuel décrit",
  ],
};

const CLES = {
  cardiovasculaire: [/cœur|coeur|cardia|souffle|\bomi\b|œd[èe]me|oedeme|palpitation|douleur thorac|\bbdc\b|\bta\b|tension/i],
  respiratoire: [/poumon|respirat|toux|dyspn|murmure|sibilant|cr[ée]pitant|tirage/i],
  digestif: [/abdomen|abdominal|diarrh|vomiss|foie|\brate\b|h[ée]pat|spl[ée]no|naus/i],
  urinaire: [/urin|miction|lombaire|dysurie|br[ûu]lure|globe/i],
  neurologique: [/neuro|c[ée]phal|vertige|d[ée]ficit|convuls|raideur/i],
  locomoteur: [/articulation|boiter|rachis|traumat|fracture|genou/i],
  cutane: [/peau|cutan|[ée]ruption|prurit|l[ée]sion cutan|plaie/i],
  ganglionnaire: [/ganglion|ad[ée]nopath/i],
  orl: [/\borl\b|gorge|oreille|otalg|rhin|sinus|odynophag/i],
  ophtalmologique: [/œil|oeil|ophtalmo|visuel|vision|conjonctiv/i],
};

function texteOu(valeur, defaut) {
  if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
  if (typeof valeur === "number" && Number.isFinite(valeur)) return String(valeur);
  return defaut;
}

function tableauTexte(valeur) {
  if (Array.isArray(valeur)) {
    return valeur.map((item) => (typeof item === "string" ? item.trim() : item == null ? "" : String(item))).filter(Boolean);
  }
  if (typeof valeur === "string" && valeur.trim()) return [valeur.trim()];
  return [];
}

export function antecedentsVides() {
  return Object.fromEntries(ANTECEDENTS.map(([cle]) => [cle, "Non renseigné"]));
}

export function normaliserAntecedents(valeur) {
  const base = antecedentsVides();
  const source = valeur && typeof valeur === "object" ? valeur : {};
  for (const [cle] of ANTECEDENTS) base[cle] = texteOu(source[cle], "Non renseigné");
  return base;
}

export function fusionnerTexte(precedent, ajout) {
  const p = (precedent || "").trim();
  const a = (ajout || "").trim();
  if (!a) return p || "Non renseigné";
  if (!p || /^non renseign[ée]$/i.test(p)) return a;
  if (p.toLowerCase().includes(a.toLowerCase())) return p;
  return `${p} ; ${a}`;
}

export function fusionnerAntecedents(anciens, nouveaux) {
  const a = normaliserAntecedents(anciens);
  const b = normaliserAntecedents(nouveaux);
  const sortie = {};
  for (const [cle] of ANTECEDENTS) {
    sortie[cle] = !b[cle] || /^non renseign[ée]$/i.test(b[cle]) ? a[cle] : fusionnerTexte(a[cle], b[cle]);
  }
  return sortie;
}

export function normalizeDossier(brut, options = {}) {
  const source = brut && typeof brut === "object" ? brut : {};
  const general = source.examen_general && typeof source.examen_general === "object" ? source.examen_general : {};
  const constantes = general.constantes && typeof general.constantes === "object" ? general.constantes : {};
  const appareilsSource = source.examen_appareils && typeof source.examen_appareils === "object" ? source.examen_appareils : {};
  const examen_appareils = {};
  for (const [cle] of APPAREILS) {
    const item = appareilsSource[cle] && typeof appareilsSource[cle] === "object" ? appareilsSource[cle] : {};
    const constat = tableauTexte(item.constat);
    examen_appareils[cle] = {
      constat: constat.length ? constat : [...NORMAUX[cle]],
      source: item.source === "dicte" ? "dicte" : "normal_par_defaut",
    };
  }
  const traitements = Array.isArray(source.traitement_suggere) ? source.traitement_suggere : [];
  return {
    motif_consultation: texteOu(source.motif_consultation, "Non renseigné"),
    histoire_maladie: texteOu(source.histoire_maladie, "Non renseigné"),
    antecedents: normaliserAntecedents(source.antecedents),
    examen_general: {
      etat_general: texteOu(general.etat_general, "Non renseigné"),
      conscience: texteOu(general.conscience, "Non renseigné"),
      conjonctives: texteOu(general.conjonctives, "Non renseigné"),
      hydratation: texteOu(general.hydratation, "Non renseigné"),
      constantes: {
        ta: texteOu(constantes.ta, "Non mesuré"),
        fc: texteOu(constantes.fc, "Non mesuré"),
        fr: texteOu(constantes.fr, "Non mesuré"),
        temperature: texteOu(constantes.temperature, "Non mesuré"),
        spo2: texteOu(constantes.spo2, "Non mesuré"),
        poids: texteOu(constantes.poids, "Non mesuré"),
      },
    },
    examen_appareils,
    resume_syndromique: texteOu(source.resume_syndromique, "Non renseigné"),
    hypotheses_diagnostiques: tableauTexte(source.hypotheses_diagnostiques),
    examens_complementaires: tableauTexte(source.examens_complementaires),
    traitement_suggere: traitements.map((ligne) => ({
      molecule: texteOu(ligne?.molecule, ""),
      posologie: texteOu(ligne?.posologie, ""),
      duree: texteOu(ligne?.duree, ""),
      accepte: options.conserverAcceptation ? Boolean(ligne?.accepte) : false,
    })).filter((ligne) => ligne.molecule),
    conduite_a_tenir: texteOu(source.conduite_a_tenir, "Non renseigné"),
    elements_manquants: tableauTexte(source.elements_manquants),
    resume_patient: texteOu(source.resume_patient, "Non renseigné"),
  };
}

export function dossierPourEnregistrement(dossier) {
  const copie = normalizeDossier(dossier, { conserverAcceptation: true });
  copie.traitement_suggere = copie.traitement_suggere.filter((ligne) => ligne.accepte);
  return copie;
}

function clauses(texte) {
  return String(texte || "")
    .split(/[\n;.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function joindre(liste) {
  if (liste.length <= 1) return liste[0] || "";
  return `${liste.slice(0, -1).join(", ")} et ${liste.at(-1)}`;
}

function renseigne(valeur) {
  const s = String(valeur || "").trim().toLowerCase();
  return Boolean(s) && s !== "non renseigné" && s !== "non renseigne";
}

function extraireTA(texte) {
  const m = texte.match(/(?:ta|tension(?:\s+art[ée]rielle)?)\s*(?:[àa]|de|:)?\s*(\d{2,3})\s*(?:\/|sur)\s*(\d{2,3})/i);
  if (!m) return null;
  return { texte: `${m[1]}/${m[2]} mmHg`, sys: Number(m[1]), dia: Number(m[2]) };
}

function extraireNombre(texte, expression, unite) {
  const m = texte.match(expression);
  if (!m) return "";
  return `${m[1].replace(",", ".")} ${unite}`.trim();
}

function motifDe(dictation) {
  const table = [
    [/c[ée]phal[ée]es?/, "Céphalées"],
    [/fi[èe]vre/, "Fièvre"],
    [/toux/, "Toux"],
    [/douleur thoracique/, "Douleur thoracique"],
    [/douleur abdominale/, "Douleur abdominale"],
    [/dyspn[ée]e|dyspnee/, "Dyspnée"],
    [/diarrh/, "Diarrhée"],
    [/vomissement/, "Vomissements"],
    [/vertige/, "Vertiges"],
    [/palud/, "Paludisme évoqué"],
    [/plaie|traumatisme/, "Traumatisme"],
  ];
  const trouves = table.filter(([re]) => re.test(dictation)).map(([, label]) => label);
  if (trouves.length) return trouves.slice(0, 3).join(", ");
  const premiere = clauses(dictation)[0];
  if (!premiere) return "Motif non précisé dans la dictée";
  return premiere.length > 90 ? `${premiere.slice(0, 87)}…` : premiere;
}

function completerAntecedents(connus, dictation) {
  const base = normaliserAntecedents(connus);
  let allergies = base.allergies;
  if (/pas d['’ ]allergie|aucune allergie|sans allergie connue/i.test(dictation)) {
    allergies = fusionnerTexte(allergies, "Pas d'allergie connue");
  }
  const allergie = dictation.match(/allergi(?:e|que)s?\s+(?:[àa]|au|aux)\s+([^.;]+)/i);
  if (allergie) allergies = fusionnerTexte(allergies, allergie[1].trim());
  let traitements = base.traitements_en_cours;
  const enCours = dictation.match(/traitements?\s+en\s+cours\s*:?\s*([^.;]+)/i);
  if (enCours) traitements = fusionnerTexte(traitements, enCours[1].trim());
  const sous = dictation.match(/(?:sous|prend|trait[ée] par)\s+([^.;]+)/i);
  if (sous) traitements = fusionnerTexte(traitements, sous[1].trim());
  let medicaux = base.medicaux;
  if (/\bhta\b|hypertend/i.test(dictation)) medicaux = fusionnerTexte(medicaux, "HTA");
  if (/diab[èe]t/i.test(dictation)) medicaux = fusionnerTexte(medicaux, "Diabète");
  const atcd = dictation.match(/ant[ée]c[ée]dents?\s+(?:de|d')\s*([^.;]+)/i);
  if (atcd) medicaux = fusionnerTexte(medicaux, atcd[1].trim());
  return { ...base, allergies, traitements_en_cours: traitements, medicaux };
}

function appareilDepuis(cle, dictation) {
  const hits = clauses(dictation).filter((c) => CLES[cle].some((re) => re.test(c)));
  if (!hits.length) return { constat: [...NORMAUX[cle]], source: "normal_par_defaut" };
  const constat = [...hits];
  for (const ligne of NORMAUX[cle]) {
    if (constat.length >= hits.length + 2) break;
    constat.push(ligne);
  }
  return { constat, source: "dicte" };
}

function allergique(blob, mots) {
  const texte = blob.toLowerCase();
  return mots.some((mot) => texte.includes(mot));
}

function profilPatient(patient) {
  const sexe = patient?.sex || patient?.sexe || "";
  const femme = sexe === "F" || /^f/i.test(String(sexe));
  const ageBrut = patient?.age;
  const age = Number.isFinite(Number(ageBrut)) ? Number(ageBrut) : null;
  return {
    femme,
    age,
    qui: femme ? "une patiente" : "un patient",
    ageTexte: age == null ? "âge non précisé" : `${age} ans`,
  };
}

export function buildDossierLocal({ dictation, patient, antecedents }) {
  const texte = String(dictation || "").trim();
  const profil = profilPatient(patient);
  const ta = extraireTA(texte);
  const fc = extraireNombre(texte, /(?:fc|fr[ée]quence cardiaque|pouls)\s*(?:[àa]|de|:)?\s*(\d{2,3})/i, "/min");
  const fr = extraireNombre(texte, /(?:fr[ée]quence respiratoire)\s*(?:[àa]|de|:)?\s*(\d{1,2})/i, "/min");
  const temperature = extraireNombre(texte, /(?:temp[ée]rature|t°)\s*(?:[àa]|de|:)?\s*(\d{2}(?:[.,]\d)?)/i, "°C");
  const spo2 = extraireNombre(texte, /(?:spo2|saturation)\s*(?:[àa]|de|:)?\s*(\d{2,3})\s*%?/i, "%");
  const poids = extraireNombre(texte, /poids\s*(?:de|[àa]|:)?\s*(\d{1,3}(?:[.,]\d)?)\s*(?:kg)?/i, "kg");
  const taHaute = Boolean(ta && (ta.sys >= 140 || ta.dia >= 90));
  const atcd = completerAntecedents(antecedents, texte);
  const examen_appareils = {};
  for (const [cle] of APPAREILS) examen_appareils[cle] = appareilDepuis(cle, texte);
  const syndromes = [];
  if (/c[ée]phal/i.test(texte)) syndromes.push("un syndrome céphalalgique");
  if (taHaute) syndromes.push("une élévation tensionnelle");
  if (/fi[èe]vre|f[ée]brile/i.test(texte)) syndromes.push("un syndrome fébrile");
  if (/toux|dyspn/i.test(texte)) syndromes.push("un syndrome respiratoire");
  if (/douleur abdominale|diarrh/i.test(texte)) syndromes.push("un syndrome digestif");
  if (/palud/i.test(texte)) syndromes.push("un tableau de paludisme évoqué par le médecin");
  if (!syndromes.length) syndromes.push("les éléments cliniques dictés");
  const hypotheses = [];
  if (/c[ée]phal/i.test(texte) && taHaute) {
    hypotheses.push("Hypothèse : poussée hypertensive");
    hypotheses.push("Hypothèse différentielle : céphalée de tension");
  } else if (/c[ée]phal/i.test(texte)) {
    hypotheses.push("Hypothèse : céphalée de tension");
    hypotheses.push("Hypothèse différentielle : céphalée secondaire, à préciser");
  } else if (taHaute) {
    hypotheses.push("Hypothèse : élévation tensionnelle à confirmer par une nouvelle mesure");
  }
  if (/palud/i.test(texte)) hypotheses.push("Hypothèse : paludisme, à confirmer selon le protocole du centre");
  if (/fi[èe]vre/i.test(texte) && /toux/i.test(texte)) hypotheses.push("Hypothèse : infection respiratoire, nature à préciser");
  const blobAllergie = `${atcd.allergies} ${texte}`;
  const suggestions = [];
  const prescrit = texte.match(/(?:je prescris|prescription|traitement propos[ée])\s*:?\s*([^.]+)/i);
  if (prescrit) {
    suggestions.push({ molecule: prescrit[1].trim(), posologie: "Selon la dictée", duree: "Non précisée", accepte: false });
  }
  const douleur = /c[ée]phal|douleur|fi[èe]vre/i.test(texte);
  if (hypotheses.length && douleur && !allergique(blobAllergie, ["paracétamol", "paracetamol", "doliprane"])) {
    const enfant = profil.age != null && profil.age < 15;
    suggestions.push({
      molecule: "Paracétamol",
      posologie: enfant ? "15 mg/kg par prise, à calculer selon le poids" : "1 g per os, 3 fois par jour",
      duree: enfant ? "Selon l'évolution, à confirmer" : "3 jours",
      accepte: false,
    });
  }
  const traitement = suggestions.filter((ligne) => {
    const mol = ligne.molecule.toLowerCase();
    if (allergique(blobAllergie, ["pénicilline", "penicilline", "amoxicilline", "ampicilline"]) && /pénicilline|penicilline|amoxicilline|ampicilline|augmentin/.test(mol)) {
      return false;
    }
    if (allergique(blobAllergie, ["paracétamol", "paracetamol"]) && /parac[ée]tamol|paracetamol/.test(mol)) return false;
    if ((taHaute || /hypertend|\bhta\b/i.test(blobAllergie)) && /ibuprof|ains|aspirine|diclof/.test(mol)) return false;
    return true;
  });
  const conduite = [];
  if (taHaute) conduite.push("Contrôler la tension artérielle à distance. Ne pas introduire de nouvel antihypertenseur sur une seule mesure, sauf décision du médecin.");
  if (/c[ée]phal/i.test(texte)) conduite.push("Consulter en urgence en cas de céphalée brutale, de déficit neurologique, de vomissements ou de trouble visuel.");
  if (/p[ée]nicilline|penicilline/i.test(blobAllergie)) conduite.push("Allergie à la pénicilline : ne pas prescrire de pénicilline ni d'aminopénicilline.");
  if (!conduite.length) conduite.push("Surveillance clinique. Reconsulter si les symptômes s'aggravent.");
  const manquants = [];
  if (!renseigne(atcd.allergies)) manquants.push("Allergies non renseignées.");
  if (!renseigne(atcd.medicaux)) manquants.push("Antécédents médicaux non renseignés.");
  if (!renseigne(atcd.traitements_en_cours)) manquants.push("Traitements en cours non renseignés.");
  if (!ta) manquants.push("TA non mesurée.");
  if (!fc) manquants.push("FC non mesurée.");
  if (!fr) manquants.push("FR non mesurée.");
  if (!temperature) manquants.push("Température non mesurée.");
  if (!spo2) manquants.push("SpO2 non mesurée.");
  if (!poids) manquants.push("Poids non mesuré.");
  if (!/depuis|jour|semaine|heure/i.test(texte)) manquants.push("Durée d'évolution non précisée.");
  if (profil.femme && profil.age != null && profil.age >= 15 && profil.age <= 50) {
    manquants.push("Écarter une grossesse avant toute prescription.");
  }
  const examens = clauses(texte).filter((c) => /bilan|nfs|\bcrp\b|goutte [ée]paisse|\btdr\b|radio|\becg\b|[ée]chographie|glyc[ée]mie/i.test(c));
  const motif = motifDe(texte);
  const phrases = [
    `Vous avez consulté pour : ${motif.toLowerCase()}.`,
    ta ? `La tension artérielle notée est ${ta.texte}.` : "Les constantes n'ont pas toutes été mesurées.",
    "Ce qui n'a pas été dicté a été prérempli comme normal et doit être vérifié par le médecin.",
    traitement.length
      ? "Un traitement a été proposé. Il ne sera suivi que si le médecin le retient."
      : "Aucun médicament n'a été proposé automatiquement.",
    "Revenez plus tôt si votre état s'aggrave.",
  ];
  return normalizeDossier({
    motif_consultation: motif,
    histoire_maladie: texte || "Non renseigné",
    antecedents: atcd,
    examen_general: {
      etat_general: /alt[ée]ration de l'[ée]tat g[ée]n[ée]ral|\bAEG\b/i.test(texte)
        ? "Altération de l'état général signalée dans la dictée"
        : "État général conservé",
      conscience: /inconscient|obnubil/i.test(texte) ? "Trouble de conscience signalé dans la dictée" : "Conscience normale, patient orienté",
      conjonctives: /p[âa]leur|conjonctives p[âa]les/i.test(texte) ? "Pâleur signalée dans la dictée" : "Conjonctives colorées",
      hydratation: /d[ée]shydrat/i.test(texte) ? "Déshydratation signalée dans la dictée" : "Bien hydraté",
      constantes: {
        ta: ta?.texte || "Non mesuré",
        fc: fc || "Non mesuré",
        fr: fr || "Non mesuré",
        temperature: temperature || "Non mesuré",
        spo2: spo2 || "Non mesuré",
        poids: poids || "Non mesuré",
      },
    },
    examen_appareils,
    resume_syndromique: `Au total, il s'agit d'${profil.qui} de ${profil.ageTexte} qui présente ${joindre(syndromes)}.`,
    hypotheses_diagnostiques: hypotheses.slice(0, 3),
    examens_complementaires: examens,
    traitement_suggere: traitement,
    conduite_a_tenir: conduite.join(" "),
    elements_manquants: manquants,
    resume_patient: phrases.join(" "),
  });
}

export function dossierDemonstration() {
  const examen_appareils = {};
  for (const [cle] of APPAREILS) {
    if (cle === "cardiovasculaire") {
      examen_appareils[cle] = {
        constat: ["Tension artérielle élevée à 150/95 mmHg", "BDC réguliers, pas de souffle perçu", "Pas d'OMI"],
        source: "dicte",
      };
    } else if (cle === "neurologique") {
      examen_appareils[cle] = {
        constat: ["Céphalées frontales signalées", "Pas de déficit neurologique décrit", "Pas de raideur de nuque signalée"],
        source: "dicte",
      };
    } else {
      examen_appareils[cle] = { constat: [...NORMAUX[cle]], source: "normal_par_defaut" };
    }
  }
  return normalizeDossier({
    motif_consultation: "Céphalées",
    histoire_maladie: "Céphalées frontales depuis 4 jours, d'intensité modérée, sans vomissement ni trouble visuel. Patient hypertendu connu.",
    antecedents: {
      medicaux: "HTA connue",
      allergies: "Pénicilline",
      traitements_en_cours: "Amlodipine 5 mg par jour",
    },
    examen_general: {
      etat_general: "État général conservé",
      conscience: "Conscience normale, patient orienté",
      conjonctives: "Conjonctives colorées",
      hydratation: "Bien hydraté",
      constantes: { ta: "150/95 mmHg" },
    },
    examen_appareils,
    resume_syndromique: "Au total, il s'agit d'un patient de 45 ans qui présente un syndrome céphalalgique et une élévation tensionnelle.",
    hypotheses_diagnostiques: ["Hypothèse : poussée hypertensive", "Hypothèse différentielle : céphalée de tension"],
    examens_complementaires: [],
    traitement_suggere: [{ molecule: "Paracétamol", posologie: "1 g per os, 3 fois par jour", duree: "3 jours", accepte: true }],
    conduite_a_tenir: "Poursuite de l'amlodipine. Contrôle de la tension artérielle à distance. Consulter en urgence si céphalée brutale, déficit, vomissements ou trouble visuel. Ne pas administrer de pénicilline.",
    elements_manquants: ["Température non mesurée.", "Poids non mesuré.", "FC non mesurée."],
    resume_patient: "Vous avez consulté pour des maux de tête depuis quelques jours. La tension artérielle était élevée. Le médecin a poursuivi votre traitement habituel et a retenu du paracétamol. Le reste de l'examen n'a pas montré d'anomalie signalée. Revenez plus tôt si la douleur devient brutale, si vous vomissez ou si vous sentez une faiblesse.",
  }, { conserverAcceptation: true });
}
