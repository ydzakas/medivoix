import { h, icone } from "./ui.js";
import { speech } from "./speech.js";

export function mountMic(conteneur, { onText } = {}) {
  let startedAt = null;
  let minuteur = null;
  let desabonner = null;
  const libelle = h("p", { class: "aide" }, "Appuyer pour dicter");
  const chrono = h("p", { class: "chrono" }, "00:00");
  const interim = h("p", { class: "interim", "aria-live": "polite" });
  const zone = h("textarea", { rows: "8", "aria-label": "Texte dicté" });
  const bouton = h("button", { type: "button", class: "micro", "aria-pressed": "false" }, [icone("micro")]);

  function marquer() {
    if (!startedAt) startedAt = Date.now();
  }

  function afficherChrono() {
    if (!startedAt) {
      chrono.textContent = "00:00";
      return;
    }
    const total = Math.floor((Date.now() - startedAt) / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    chrono.textContent = `${m}:${s}`;
  }

  const erreur = h("p", { class: "aide" });

  function peindre() {
    bouton.classList.toggle("ecoute", speech.listening);
    bouton.setAttribute("aria-pressed", speech.listening ? "true" : "false");
    bouton.setAttribute("aria-label", speech.listening ? "Écoute en cours, appuyer pour arrêter" : "Appuyer pour dicter");
    libelle.textContent = speech.listening ? "Écoute en cours… appuyer pour arrêter" : "Appuyer pour dicter";
    interim.textContent = speech.interimText ? `En cours de reconnaissance : ${speech.interimText}` : "";
    erreur.textContent = speech.error || "";
    if (zone.value !== speech.finalText) {
      const aLaFin = document.activeElement !== zone || zone.selectionStart === zone.value.length;
      if (aLaFin) {
        zone.value = speech.finalText;
        if (document.activeElement === zone) zone.selectionStart = zone.selectionEnd = zone.value.length;
      }
    }
  }

  zone.addEventListener("input", () => {
    marquer();
    speech.setFinalText(zone.value);
    onText?.(zone.value);
  });

  bouton.addEventListener("click", () => {
    if (!speech.supported) return;
    if (speech.listening) speech.stop();
    else {
      marquer();
      speech.start();
    }
    peindre();
  });

  const bloc = h("div", { class: "pile" }, [
    speech.supported
      ? h("div", { class: "micro-bloc" }, [bouton, libelle, chrono])
      : h("p", { class: "aide" }, "Dictée non disponible sur ce navigateur, utilisez Chrome. Vous pouvez saisir le texte à la main."),
    zone,
    speech.supported ? interim : null,
    erreur,
  ]);

  desabonner = speech.subscribe(() => {
    peindre();
    onText?.(zone.value);
  });
  minuteur = setInterval(afficherChrono, 250);
  conteneur.replaceChildren(bloc);

  return {
    getText: () => zone.value,
    setText(texte) {
      marquer();
      zone.value = texte;
      speech.setFinalText(texte);
      onText?.(texte);
    },
    getStartedAt: () => startedAt,
    mark: marquer,
    stop: () => speech.stop(),
    destroy() {
      speech.stop();
      desabonner?.();
      clearInterval(minuteur);
    },
  };
}
