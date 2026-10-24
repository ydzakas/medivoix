# MediVoix — instructions pour Copilot

## Produit
MediVoix est l'application d'UNE clinique pour ses médecins, ses infirmiers et ses patients. Le médecin dicte à la voix ce qu'il a trouvé, l'IA génère le dossier médical complet, le médecin relit et valide. Quand le médecin crée un patient, un compte patient (identifiant + mot de passe provisoire) et un QR code sont créés en même temps. À sa première connexion, le patient est obligé de changer ses identifiants, puis consulte son carnet de santé. Les médecins et infirmiers connectés peuvent scanner le QR code d'un patient pour voir son historique et ses antécédents ; toute personne extérieure est bloquée. Chaque accès à un dossier est tracé dans un journal. Slogan : "Parlez, on rédige."
Une seule clinique. Pas de multi-cliniques, pas d'administrateur général. Hackathon de 2 heures, développeur solo : parcours qui marche de bout en bout, simple, interface très professionnelle.

## Contraintes techniques ABSOLUES
- HTML, CSS et JavaScript pur (modules ES natifs). AUCUN npm, AUCUN bundler, AUCUNE étape de build, AUCUN TypeScript, AUCUN framework.
- Le site est dans le dossier public/. Chaque page se charge directement dans le navigateur.
- Bibliothèques tierces : uniquement des fichiers uniques déposés dans public/vendor/ (supabase-js version UMD, un générateur de QR code). Pas de CDN dans le code applicatif.
- Navigation monopage par ancres (#/patients, #/patients/ID, ...).
- Fonction serveur : functions/api/generate.js (Cloudflare Pages Function en JavaScript). IA : binding Workers AI nommé AI.
- Base et connexion : Supabase (PostgreSQL, Auth, Row Level Security).
- Aucune clé secrète dans le dépôt. Seules l'URL et la clé "anon" publique de Supabase peuvent apparaître côté navigateur.

## Langue
Toute l'interface est en français. Libellés courts, vocabulaire médical exact, abréviations hospitalières standard (TA, FC, FR, SpO2, BDC, MV, OMI, ATCD).

## Design (très professionnel et fluide) — charte à TROIS couleurs pleines
Couleurs, et seulement celles-ci : bleu marine #0B2A4A, vert médical #1E9E6A, blanc #FFFFFF. Variables CSS --marine, --vert, --blanc ; aucune autre couleur dans tout le code (pas de gris, pas d'ambre, pas de rouge).
Aplats uniquement : AUCUN dégradé, AUCUN flou (pas de blur, pas de backdrop-filter), AUCUNE transparence (pas de rgba, pas d'opacity), AUCUNE ombre portée. La hiérarchie vient de la taille, de la graisse et de bordures de 1 à 2 px en marine ou vert.
Statuts : "Dicté" = fond marine texte blanc ; "Normal par défaut, à vérifier" = contour vert fond blanc ; "Brouillon" = contour marine fond blanc ; "Validé" = fond vert texte blanc. Alertes et erreurs : encadré à bordure marine de 2 px avec icône et libellé explicite ("Erreur", "À compléter"), jamais une autre couleur.
Police Inter avec repli sur la police système. Grille de 8 px, coins arrondis 12 px, transitions de 150 à 200 ms, grandes zones tactiles (44 px minimum), états de chargement par squelettes (aplats), focus clavier visibles (contour vert de 2 px). Mobile-first, puis grand écran.

## Rôles
- medecin : voit et gère les patients et consultations de la clinique, dicte, génère, valide, supprime, scanne les QR codes, lit le journal d'accès.
- infirmier : lecture seule des patients et de leurs consultations validées (historique, antécédents), scanne les QR codes ; aucune création, modification ni suppression.
- patient : lecture seule de sa fiche et de ses consultations validées ; peut changer ses identifiants, ses coordonnées et son nom d'affichage.
Le QR code d'un patient ne contient AUCUNE donnée médicale : seulement un lien avec un jeton aléatoire. Seuls un médecin ou un infirmier connecté peut l'exploiter ; sinon, accès bloqué.

## Forme du dossier généré par l'IA (JSON)
{
  motif_consultation, histoire_maladie,
  antecedents: { medicaux, chirurgicaux, gyneco_obstetricaux, familiaux, mode_de_vie, allergies, traitements_en_cours },
  examen_general: { etat_general, conscience, conjonctives, hydratation, constantes: { ta, fc, fr, temperature, spo2, poids } },
  examen_appareils: { cardiovasculaire | respiratoire | digestif | urinaire | neurologique | locomoteur | cutane | ganglionnaire | orl | ophtalmologique : { constat: [string], source: "dicte" | "normal_par_defaut" } },
  resume_syndromique, hypotheses_diagnostiques: [string], examens_complementaires: [string],
  traitement_suggere: [{ molecule, posologie, duree, accepte: boolean }],
  conduite_a_tenir, elements_manquants: [string], resume_patient
}

## Sécurité
- Row Level Security sur toutes les tables.
- Toute requête vers /api/generate envoie le jeton de session en en-tête Authorization: Bearer.
- Ne jamais afficher un traitement comme prescrit sans validation explicite du médecin.
- Les parties "normal par défaut" ont toujours un badge visible.
- Journal d'accès : chaque consultation de dossier, scan de QR code, création, modification, validation et suppression est enregistrée via logAccess(patientId, action) (js/journal.js). Le journal est en ajout seulement.
- Échapper tout texte affiché (pas d'innerHTML avec des données non échappées).

## Qualité
JavaScript clair, fonctions courtes, gestion explicite des états chargement / erreur / vide, pas de commentaires superflus.
