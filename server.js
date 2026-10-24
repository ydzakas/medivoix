import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossierLocal } from "./public/js/dossier.js";
import { genererAvecGemma } from "./lib/gemma.js";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.env.PORT || 8741);

function chargerEnv() {
  const fichier = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env");
  if (!fs.existsSync(fichier)) return;
  for (const ligne of fs.readFileSync(fichier, "utf8").split("\n")) {
    const trouve = ligne.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!trouve || process.env[trouve[1]]) continue;
    process.env[trouve[1]] = trouve[2].trim().replace(/^["']|["']$/g, "");
  }
}

chargerEnv();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const entetes = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "microphone=(self), camera=(self)",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Cache-Control": "no-cache",
};

function json(res, body, status = 200) {
  res.writeHead(status, { ...entetes, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function lireCorps(req) {
  const morceaux = [];
  for await (const morceau of req) morceaux.push(morceau);
  return JSON.parse(Buffer.concat(morceaux).toString("utf8"));
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const corps = await lireCorps(req);
      const dictation = String(corps?.dictation || "").trim();
      if (!dictation) return json(res, { error: "La dictée est vide." }, 400);
      if (dictation.length > 6000) return json(res, { error: "La dictée dépasse 6000 caractères." }, 400);
      const cle = process.env.GEMINI_API_KEY;
      if (cle) {
        const dossier = await genererAvecGemma({
          dictation,
          patient: corps.patient,
          antecedents: corps.antecedents,
          apiKey: cle,
        });
        return json(res, { dossier, source: "gemma" });
      }
      return json(res, {
        dossier: buildDossierLocal({ dictation, patient: corps.patient, antecedents: corps.antecedents }),
        source: "local",
      });
    } catch {
      return json(res, { error: "Génération impossible, réessayez." }, 502);
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, entetes);
    res.end("Méthode refusée");
    return;
  }

  let chemin = decodeURIComponent(url.pathname);
  if (chemin === "/") chemin = "/index.html";
  const fichier = path.normalize(path.join(racine, chemin));
  if (!fichier.startsWith(racine)) {
    res.writeHead(403, entetes);
    res.end("Interdit");
    return;
  }
  fs.readFile(fichier, (erreur, data) => {
    if (erreur) {
      res.writeHead(404, { ...entetes, "Content-Type": "text/plain; charset=utf-8" });
      res.end("Introuvable");
      return;
    }
    const ext = path.extname(fichier);
    res.writeHead(200, { ...entetes, "Content-Type": types[ext] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serveur.listen(port, "0.0.0.0");
}

export { serveur };
