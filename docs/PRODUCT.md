# Produit

MediVoix sert une clinique. Le médecin dicte l'examen, une proposition de dossier se rédige, et rien n'est versé au carnet tant que le médecin n'a pas validé.

## Rôles

- Médecin : patients, dictée, validation, journal, fiche d'accès et QR code.
- Infirmier : lecture des consultations validées et scan du QR code.
- Patient : son propre carnet validé, après avoir remplacé le mot de passe provisoire. Il peut changer son téléphone, son adresse, son nom affiché et son identifiant.

## Ce que le patient voit

Identité, allergies, antécédents, traitements en cours, puis chaque consultation validée : date, motif, résumé qui lui est destiné, traitements retenus, examens et conduite à tenir. Les brouillons restent invisibles.

## QR code

Le code ouvre `#/p/` suivi d'un jeton aléatoire. Il ne contient ni nom ni donnée médicale. Une personne non connectée est renvoyée vers la connexion. Un patient qui ouvre le code d'un autre dossier ne voit aucune donnée.

## Limite assumée

Une clinique, pas un réseau. Le mode sans Supabase sert à la démonstration sur un seul appareil.
