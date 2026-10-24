# MediVoix

Parlez, on rédige.

MediVoix est l'application d'une clinique. Le médecin dicte ce qu'il a trouvé, un dossier structuré est rédigé, puis le médecin le relit et le valide. L'infirmier consulte en lecture seule les dossiers et les consultations validées, et peut scanner un QR code. Chaque patient reçoit un compte, une fiche d'accès imprimable et un QR code. Ce QR code ne contient aucune donnée médicale : seulement l'origine du site et un lien `/#/p/<jeton>`. Une personne extérieure ne peut pas ouvrir le dossier. Chaque accès est inscrit dans un journal.

Une seule clinique. Auteur : Joseph (Jo Digital), Lomé. Licence MIT.

## Lancer

Aucun `npm install`. Node.js 20 ou plus récent suffit.

```bash
node server.js
```

Ouvrir [http://127.0.0.1:8741](http://127.0.0.1:8741). Le serveur écoute sur `0.0.0.0:8741`. L'espace patient est sur [http://127.0.0.1:8741/mon-carnet.html](http://127.0.0.1:8741/mon-carnet.html).

Contrôles :

```bash
node scripts/check.mjs
```

## Comptes de démonstration

Visibles sur l'écran de connexion uniquement en mode local.

| Rôle | Identifiant | Mot de passe |
| --- | --- | --- |
| Médecin | `medecin@clinique.medivoix.app` | `CliniqueDemo1` |
| Infirmier | `infirmier@clinique.medivoix.app` | `CliniqueDemo1` |

Le patient n'a pas de compte fixe. Le médecin crée un dossier, ou clique sur **Créer un patient de démonstration**. L'identifiant et le mot de passe provisoire s'affichent une seule fois sur la fiche. À la première connexion, le patient doit les changer. L'infirmier ne peut ni créer, ni modifier, ni dicter.

## Mode local et mode clinique

`public/js/config.js` est livré avec `SUPABASE_URL` et `SUPABASE_ANON_KEY` vides. L'application travaille alors dans le navigateur (`localStorage`) et `POST /api/generate` répond avec le rédacteur local (`buildDossierLocal`). Ce n'est pas un modèle distant : la dictée n'est pas journalisée par le serveur de développement.

Pour la clinique :

1. Créer un projet Supabase vide.
2. Coller `supabase/schema.sql` dans l'éditeur SQL et l'exécuter une fois.
3. Pour une démonstration, désactiver la confirmation par e-mail dans Authentication.
4. Copier l'URL du projet et la clé **anon** publique dans `public/js/config.js`. Ne jamais y mettre la clé `service_role`.
5. Créer le premier médecin avec **Créer un compte soignant**.
6. Déployer le site sur Cloudflare Pages pour que la dictée passe par Workers AI.

En mode Supabase, la génération distante vérifie le jeton du médecin puis appelle le binding `AI`. Si cet appel n'est pas disponible, la rédaction échoue : le repli local du navigateur ne s'applique que lorsque l'URL Supabase est vide.

## Cloudflare

Aucun build, aucune installation.

- Projet Pages, préconfiguration **None**.
- Commande de build : vide.
- Répertoire de sortie : `public`.
- `functions/api/generate.js` est la Pages Function `POST /api/generate`.
- Variables : `SUPABASE_URL` et `SUPABASE_ANON_KEY`, les mêmes valeurs que dans `public/js/config.js`.
- Liaison Workers AI nommée `AI`.
- `wrangler.toml` indique le modèle et `compatibility_date`.

## Limites de sécurité

- Le QR code porte uniquement `origine/#/p/<jeton>`. Sans session médecin ou infirmier, l'accès est refusé et aucune donnée médicale n'est affichée.
- Un patient ne voit ni les brouillons, ni les autres dossiers. Un infirmier ne voit que les consultations validées.
- Le journal est en ajout seulement : consultation, scan, création, modification, validation, suppression.
- La Row Level Security de `supabase/schema.sql` est la barrière côté base. La clé anon est publique par conception ; la clé `service_role` ne doit jamais être dans le navigateur ni dans ce dépôt.
- Le mode local conserve les dossiers dans le navigateur. Il sert à la démonstration, pas à une clinique réelle.
- Réinitialiser le mot de passe d'un patient, lorsqu'il l'a perdu, se fait dans le tableau de bord Supabase (Authentication → Users). L'application ne le fait pas : elle n'a pas de clé d'administration.
