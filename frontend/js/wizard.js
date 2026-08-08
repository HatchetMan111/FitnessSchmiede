const SEEN_KEY = "fs_wizard_seen";

const SLIDES = [
  {
    title: "Willkommen in der Schmiede",
    text: "FitnessSchmiede plant dein Training komplett lokal auf diesem Server - kein Login, keine Cloud. Ein Programm läuft über mehrere Wochen und steigert sich automatisch.",
  },
  {
    title: "Programme & Einheiten",
    text: "Jede Woche hat mehrere Einheiten (z.B. Push, Pull, Beine oder Ganzkörper-HIIT). Auf dem Dashboard siehst du immer die nächste offene Einheit, unter „Diese Woche ansehen“ die ganze Woche im Überblick.",
  },
  {
    title: "Der Timer-Rhythmus",
    text: "Vor jeder Zeit-Übung hast du 5 Sekunden Vorbereitung, dann startet die Arbeitsphase (Glut-Orange), danach die Pause (Stahl-Blau). Bei Übungen mit festen Wiederholungen bestätigst du den Satz selbst.",
  },
  {
    title: "KI optional, alles andere lokal",
    text: "Unter „Einstellungen“ kannst du Ollama, ChatGPT, Claude oder OpenRouter hinterlegen - z.B. für die deutsche Übersetzung der Übungsanleitungen. Ohne Anbieter funktioniert das Training trotzdem komplett offline.",
  },
];

export function maybeShowWizard(force = false) {
  if (!force && localStorage.getItem(SEEN_KEY) === "1") return;

  let step = 0;
  const overlay = document.createElement("div");
  overlay.className = "wizard-overlay";
  document.body.appendChild(overlay);

  function render() {
    const slide = SLIDES[step];
    const isLast = step === SLIDES.length - 1;
    overlay.innerHTML = `
      <div class="wizard-card">
        <p class="eyebrow">Kurze Einführung · ${step + 1}/${SLIDES.length}</p>
        <h2 style="margin:10px 0 12px">${slide.title}</h2>
        <p class="text-dim" style="line-height:1.5">${slide.text}</p>
        <div class="wizard-dots">
          ${SLIDES.map((_, i) => `<span class="wizard-dot ${i === step ? "is-active" : ""}"></span>`).join("")}
        </div>
        <div class="wizard-actions">
          <button class="btn btn-ghost" id="wizard-skip">Überspringen</button>
          <button class="btn btn-primary" id="wizard-next">${isLast ? "Los geht's" : "Weiter"}</button>
        </div>
      </div>`;

    overlay.querySelector("#wizard-skip").addEventListener("click", close);
    overlay.querySelector("#wizard-next").addEventListener("click", () => {
      if (isLast) {
        close();
      } else {
        step += 1;
        render();
      }
    });
  }

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    overlay.remove();
  }

  render();
}
