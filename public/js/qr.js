import { BLANC, MARINE } from "./format.js";

export function lireJeton(brut, origin, { strict = false } = {}) {
  const texte = String(brut || "").trim();
  if (!texte) return null;
  if (!strict && /^[A-Za-z0-9_-]{16,40}$/.test(texte)) return texte;
  try {
    const url = new URL(texte);
    if (url.origin !== origin) return null;
    const trouve = url.hash.match(/^#\/p\/([A-Za-z0-9_-]{16,40})$/);
    return trouve ? trouve[1] : null;
  } catch {
    return null;
  }
}

export function lienPatient(token) {
  const dossier = location.pathname.replace(/[^/]*$/, "");
  return `${location.origin}${dossier}#/p/${token}`;
}

export function qrDataUrl(texte) {
  if (typeof qrcode !== "function") throw new Error("Générateur de QR code indisponible.");
  const qr = qrcode(0, "M");
  qr.addData(texte);
  qr.make();
  const count = qr.getModuleCount();
  const cell = 8;
  const marge = 16;
  const taille = count * cell + marge * 2;
  const canvas = document.createElement("canvas");
  canvas.width = taille;
  canvas.height = taille;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BLANC;
  ctx.fillRect(0, 0, taille, taille);
  ctx.fillStyle = MARINE;
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) ctx.fillRect(marge + c * cell, marge + r * cell, cell, cell);
    }
  }
  return canvas.toDataURL("image/png");
}
