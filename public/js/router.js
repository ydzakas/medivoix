const ROUTES = [
  { name: "edition", re: /^#\/patients\/([^/]+)\/consultation\/([^/]+)$/, keys: ["id", "cid"] },
  { name: "consultation", re: /^#\/patients\/([^/]+)\/consultation$/, keys: ["id"] },
  { name: "dossier", re: /^#\/patients\/([^/]+)\/dossier\/([^/]+)$/, keys: ["id", "cid"] },
  { name: "nouveau", re: /^#\/patients\/nouveau$/ },
  { name: "patient", re: /^#\/patients\/([^/]+)$/, keys: ["id"] },
  { name: "patients", re: /^#\/patients$/ },
  { name: "scanner", re: /^#\/scanner$/ },
  { name: "journal", re: /^#\/journal$/ },
  { name: "compte", re: /^#\/compte$/ },
  { name: "connexion", re: /^#\/connexion$/ },
  { name: "qr", re: /^#\/p\/([^/]+)$/, keys: ["token"] },
  { name: "accueil", re: /^#\/?$/ },
];

export function correspond(hash) {
  const valeur = hash && hash !== "#" ? hash : "#/";
  for (const route of ROUTES) {
    const trouve = valeur.match(route.re);
    if (!trouve) continue;
    const params = {};
    (route.keys || []).forEach((cle, index) => {
      params[cle] = decodeURIComponent(trouve[index + 1]);
    });
    return { name: route.name, params };
  }
  return { name: "introuvable", params: {} };
}

export function demarrer(dessiner) {
  window.addEventListener("hashchange", () => { dessiner(); });
  dessiner();
}
