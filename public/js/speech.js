function messageErreur(code) {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "Autorisez le microphone pour dicter, ou saisissez le texte à la main.";
  }
  if (code === "audio-capture") return "Microphone introuvable. Vous pouvez saisir le texte à la main.";
  if (code === "network") return "La dictée a perdu le réseau. Vous pouvez saisir le texte à la main.";
  return "Dictée interrompue. Vous pouvez saisir le texte à la main.";
}

export function creerReconnaissance() {
  const SR = typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;
  const etat = {
    supported: Boolean(SR),
    listening: false,
    finalText: "",
    interimText: "",
    error: "",
    userStop: false,
    rec: null,
    auditeurs: new Set(),
  };

  function emettre() {
    for (const fn of etat.auditeurs) fn(snapshot());
  }

  function snapshot() {
    return {
      supported: etat.supported,
      listening: etat.listening,
      finalText: etat.finalText,
      interimText: etat.interimText,
      error: etat.error,
    };
  }

  function assurer() {
    if (etat.rec || !SR) return etat.rec;
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const text = res[0]?.transcript || "";
        if (res.isFinal) {
          const piece = text.trim();
          if (piece) etat.finalText = `${etat.finalText} ${piece}`.replace(/\s+/g, " ").trim();
        } else {
          interim += text;
        }
      }
      etat.interimText = interim.replace(/\s+/g, " ").trim();
      emettre();
    };
    rec.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      etat.error = messageErreur(event.error);
      etat.userStop = true;
      etat.listening = false;
      emettre();
    };
    rec.onend = () => {
      if (!etat.userStop && etat.listening) {
        setTimeout(() => {
          if (!etat.userStop && etat.listening) {
            try { rec.start(); } catch { /* déjà démarrée */ }
          }
        }, 200);
        return;
      }
      etat.listening = false;
      emettre();
    };
    etat.rec = rec;
    return rec;
  }

  return {
    get supported() { return etat.supported; },
    get listening() { return etat.listening; },
    get finalText() { return etat.finalText; },
    get interimText() { return etat.interimText; },
    get error() { return etat.error; },
    subscribe(fn) {
      etat.auditeurs.add(fn);
      return () => etat.auditeurs.delete(fn);
    },
    start() {
      if (!etat.supported) return;
      etat.userStop = false;
      etat.error = "";
      etat.listening = true;
      try { assurer().start(); } catch { /* InvalidStateError */ }
      emettre();
    },
    stop() {
      etat.userStop = true;
      etat.listening = false;
      etat.interimText = "";
      try { etat.rec?.stop(); } catch { /* ignore */ }
      emettre();
    },
    reset() {
      etat.finalText = "";
      etat.interimText = "";
      etat.error = "";
      emettre();
    },
    setFinalText(texte) {
      etat.finalText = String(texte || "");
      emettre();
    },
  };
}

export const speech = creerReconnaissance();
