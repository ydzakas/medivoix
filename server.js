import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossierLocal } from "./public/js/dossier.js";

const PORT = 8741;
const HOTE = "0.0.0.0";
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public");
const TAILLE_MAX = 100_000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
};

const SECURITE = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "microphone=(self), camera=(self)",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Cache-Control": "no-cache",
};

function envoyer(res, status, corps, type = "text/plain; charset=utf-8", extra = {}) {
  const tampon = Buffer.from(corps);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": tampon.length,
    ...SECURITE,
    ...extra,
  });
  res.end(tampon);
}

function envoyerJson(res, status, objet) {
  envoyer(res, status, JSON.stringify(objet), "application/json; charset=utf-8");
}

function cibleDe(pathname) {
  let relatif;
  try {
    relatif = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (relatif === "/") return path.join(RACINE, "index.html");
  relatif = relatif.replace(/^\/+/, "");
  if (!relatif || relatif.includes("\0")) return null;
  const cible = path.resolve(RACINE, relatif);
  if (cible !== RACINE && !cible.startsWith(`${RACINE}${path.sep}`)) return null;
  return cible;
}

function lireCorps(req) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    let taille = 0;
    req.on("data", (morceau) => {
      taille += morceau.length;
      if (taille > TAILLE_MAX) {
        reject(Object.assign(new Error("trop gros"), { code: "taille" }));
        req.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    req.on("end", () => resolve(Buffer.concat(morceaux).toString("utf8")));
    req.on("error", reject);
  });
}

async function generer(req, res) {
  if (req.method !== "POST") {
    envoyerJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }
  let texte;
  try {
    texte = await lireCorps(req);
  } catch (error) {
    const status = error.code === "taille" ? 413 : 400;
    envoyerJson(res, status, { error: "Requête illisible." });
    return;
  }
  let corps;
  try {
    corps = texte ? JSON.parse(texte) : {};
  } catch {
    envoyerJson(res, 400, { error: "Requête illisible." });
    return;
  }
  const dictation = String(corps?.dictation || "").trim();
  if (!dictation) {
    envoyerJson(res, 400, { error: "La dictée est vide." });
    return;
  }
  if (dictation.length > 6000) {
    envoyerJson(res, 400, { error: "La dictée dépasse 6000 caractères." });
    return;
  }
  try {
    const dossier = buildDossierLocal({
      dictation,
      patient: corps.patient || {},
      antecedents: corps.antecedents || {},
    });
    envoyerJson(res, 200, { dossier, source: "local" });
  } catch {
    envoyerJson(res, 500, { error: "Génération impossible, réessayez." });
  }
}

async function fichier(req, res, pathname) {
  const cible = cibleDe(pathname);
  if (!cible) {
    envoyer(res, 404, "Page introuvable.");
    return;
  }
  let stat;
  try {
    stat = await fs.stat(cible);
  } catch {
    envoyer(res, 404, "Page introuvable.");
    return;
  }
  if (!stat.isFile()) {
    envoyer(res, 404, "Page introuvable.");
    return;
  }
  const type = TYPES[path.extname(cible).toLowerCase()] || "application/octet-stream";
  const contenu = await fs.readFile(cible);
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": contenu.length,
    ...SECURITE,
  });
  if (req.method === "HEAD") res.end();
  else res.end(contenu);
}

const serveur = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/generate") {
    void generer(req, res);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    envoyer(res, 405, "Méthode non autorisée.");
    return;
  }
  void fichier(req, res, url.pathname).catch(() => {
    if (!res.headersSent) envoyer(res, 500, "Erreur interne.");
    else res.end();
  });
});

serveur.listen(PORT, HOTE, () => {
  console.log(`MediVoix écoute sur http://127.0.0.1:${PORT}`);
});
