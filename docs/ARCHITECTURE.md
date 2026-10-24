# Architecture

```
public/            interface soignant (index.html) et carnet (mon-carnet.html)
public/js/         modules du navigateur, sans outil de build
prompts/dossier.js seul endroit du prompt
lib/gemma.js       seul appel au modèle Gemma 4
lib/extraire.js    extraction du JSON
server.js          fichiers statiques + POST /api/generate
functions/api/     secours Cloudflare (Llama), même prompt
supabase/schema.sql  à coller une fois dans un projet vide
```

`POST /api/generate` appelle Gemma 4 si `GEMINI_API_KEY` est présente, sinon il renvoie `{ dossier, source: "local" }`. Le navigateur n'envoie la dictée qu'à cette route du même site. La clé n'est pas embarquée dans `public/`.

GitHub Pages publie seulement `public/`. Sur ce site statique, `/api/generate` répond 404 et l'écran retombe sur le structurant local, annoncé comme tel.

Supabase (Auth + RLS) est optionnel. Tant que `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont vides dans `public/js/config.js`, les comptes de démonstration vivent dans `localStorage`.
