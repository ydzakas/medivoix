# MediVoix

Parlez, on rédige. Le médecin dicte l'examen, Gemma 4 propose le dossier, et rien n'entre dans le carnet tant que le médecin n'a pas validé. Une clinique, à Lomé. Auteur : Joseph (Jo Digital).

Le modèle qui rédige est **Gemma 4** (`gemma-4-26b-a4b-it`), un modèle à poids ouverts, appelé via l'API Gemini. Sans clé, un structurant local prend le relais et l'écran le dit clairement. Ce secours permet de montrer le parcours pendant le hackathon ; la voie prévue pour la clinique est Gemma 4.

## Lancer

```bash
node server.js
```

Ouvrir http://127.0.0.1:8741 . Aucun `npm install` : le projet n'a pas de dépendance.

Copier `.env.example` vers `.env` pour brancher Gemma 4. Laisser `GEMINI_API_KEY` vide garde le structurant local. Ne commitez jamais `.env`.

Vérifier sans réseau ni clé :

```bash
node scripts/check.mjs
```

## Comptes de démonstration

Tant que Supabase n'est pas configuré, les dossiers restent dans le navigateur.

| Rôle | Identifiant | Mot de passe |
| --- | --- | --- |
| Médecin | medecin@clinique.medivoix.app | CliniqueDemo1 |
| Infirmier | infirmier@clinique.medivoix.app | CliniqueDemo1 |

Sur la liste des patients, « Créer un patient de démonstration » ajoute Koffi Mensah (démo), 45 ans, groupe O+, HTA, allergie à la pénicilline, amlodipine, et une consultation validée il y a trois mois. Le mot de passe du patient s'affiche une seule fois.

## Parcours

1. Le médecin crée la fiche. L'application propose un identifiant et un mot de passe provisoire, à imprimer. Le QR code ne contient qu'un jeton.
2. Il dicte. « Insérer un exemple » colle une céphalée avec TA 160/100.
3. « Générer le dossier » interroge Gemma 4 si la clé est présente, sinon le structurant local. Le bandeau nomme la source.
4. Le médecin coche les lignes de traitement à retenir, puis valide. Les antécédents connus sont fusionnés, jamais effacés.
5. L'infirmier lit les dossiers validés et scanne le QR code. Il ne dicte pas.
6. Le patient ouvre `mon-carnet.html`, change son mot de passe provisoire, puis voit ses consultations validées.

## Supabase

1. Créer un projet vide.
2. Coller `supabase/schema.sql` dans l'éditeur SQL.
3. Désactiver la confirmation d'e-mail (Authentication → Providers → Email), sinon la création du compte patient depuis le navigateur échoue.
4. Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `public/js/config.js` pour le navigateur, et les mêmes valeurs dans `.env` si le serveur doit les connaître.

Le médecin ne peut pas réinitialiser le mot de passe d'un patient depuis l'application : cela demande la clé service, qui ne doit pas être dans le navigateur. Cette réinitialisation se fait dans le tableau de bord Supabase.

## Gemma 4, Cloudflare, GitHub Pages

- Machine locale : `node server.js` lit `GEMINI_API_KEY` et appelle `gemma-4-26b-a4b-it`. La dictée n'est pas journalisée.
- Cloudflare Pages, optionnel : pas de commande de build, dossier de sortie `public`, liaison Workers AI `AI`. Le fichier `functions/api/generate.js` utilise alors Llama (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) avec le même prompt, réservé aux médecins connectés. Ne pas y mettre `GEMINI_API_KEY`.
- GitHub Pages : Settings → Pages → Source : GitHub Actions. Le workflow `.github/workflows/deploy.yml` publie `public/` à chaque push sur `main`. Ce site statique n'a pas la clé : la génération retombe sur le structurant local.

## Sécurité, dites clairement

- Trois couleurs : marine `#0B2A4A`, vert `#1E9E6A`, blanc `#FFFFFF`. Le micro qui écoute est vert, parce que le rouge est hors charte.
- Le mode démonstration n'est pas un dossier clinique : les données sont dans le navigateur, et les mots de passe y sont seulement empreints pour ne pas rester en clair.
- Le journal est écrit par le client. Il garde le nom même après suppression.
- Le QR code d'un autre site est refusé. Un patient qui scanne un dossier ne voit pas les données médicales.
- Ce n'est pas un chiffrement de bout en bout.

## Équipe et outils

Joseph (Jo Digital), Lomé. Licence MIT, voir `LICENSE`.

Assistants de code utilisés : Cursor, pour écrire et relire le dépôt pendant le Hacktoberfest Hack Day Lomé × Python Togo (24 octobre 2026). Le modèle open-weight au cœur du produit est Gemma 4. Les consignes des agents sont dans `AGENTS.md`. Le produit, la charte et l'architecture sont dans `docs/`.
