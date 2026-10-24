# MediVoix — consignes pour les agents

MediVoix est le dossier de consultation d'une seule clinique, à Lomé. Le médecin dicte, le dossier se structure, le médecin valide. Slogan : « Parlez, on rédige. »

## Pile

JavaScript vanilla dans `public/`, sans npm et sans bundler. Le modèle open-weight est Gemma 4 (`gemma-4-26b-a4b-it`) via l'API Gemini, appelé uniquement depuis `lib/gemma.js`. Le prompt vit uniquement dans `prompts/dossier.js`. Sans `GEMINI_API_KEY`, `buildDossierLocal` structure le dossier et l'interface doit dire que la source est locale.

## Commandes

- `node server.js` — sert `public/` et `POST /api/generate` sur le port 8741.
- `node scripts/check.mjs` — vérifie le structurant local, les rôles, le QR, l'extraction JSON, un appel Gemma simulé, et la charte de couleurs. Ces tests n'appellent pas le vrai modèle.

## Règles

- Français dans l'interface. Cibles tactiles d'au moins 44 px.
- Trois couleurs seulement : `#0B2A4A`, `#1E9E6A`, `#FFFFFF`. Pas de dégradé, flou, ombre, opacité ni `rgba`.
- Pas de nouvelle dépendance. Pas de secret dans le dépôt : `.env` reste ignoré, la clé ne part jamais dans le navigateur.
- Le patient ne voit que ses consultations validées. Le QR code ne contient qu'un jeton.
- Le journal est en ajout seul. Une suppression se journalise avant l'effacement.
- Terminer une tâche seulement si `node scripts/check.mjs` passe.

## Sécurité

Le mode démonstration stocke les dossiers dans le navigateur. Ce n'est pas un dossier clinique. Le journal est écrit par le client. Réinitialiser le mot de passe d'un patient depuis le navigateur exige le rôle service de Supabase : ce n'est pas implémenté.

## Compte rendu de fin de tâche

Indiquer ce qui a changé, comment le lancer, les comptes de démonstration, si Gemma ou le structurant local a servi, et le résultat de `node scripts/check.mjs`.
