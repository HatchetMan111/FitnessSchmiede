import { useState } from "react";

const SEEN_KEY = "fs_wizard_seen";

const SLIDES = [
  {
    title: "Willkommen in der Schmiede",
    text: "FitnessSchmiede plant dein Training komplett lokal auf diesem Server - kein Login, keine Cloud. Ein Programm läuft über mehrere Wochen und steigert sich automatisch.",
  },
  {
    title: "Programme & Einheiten",
    text: "Jede Woche hat mehrere Einheiten (z.B. Push, Pull, Beine oder Ganzkörper-HIIT). Auf dem Dashboard siehst du immer die nächste offene Einheit, unter „Woche“ die ganze Woche im Überblick.",
  },
  {
    title: "Der Timer-Rhythmus",
    text: "Vor jeder Zeit-Übung hast du 5 Sekunden Vorbereitung, dann startet die Arbeitsphase (Glut-Orange), danach die Pause (Stahl-Blau). Bei Übungen mit festen Wiederholungen bestätigst du den Satz selbst.",
  },
  {
    title: "KI optional, alles andere lokal",
    text: "Unter „Setup“ kannst du Ollama, ChatGPT, Claude oder OpenRouter hinterlegen - z.B. für die deutsche Übersetzung der Übungsanleitungen. Ohne Anbieter funktioniert das Training trotzdem komplett offline.",
  },
  {
    title: "Training & Ernährung zusammen",
    text: "Unter „Ernährung“ hinterlegst du einmalig Gewicht, Größe und Aktivitätslevel. Daraus errechnet die App Kalorien- und Makro-Richtwerte, die automatisch zum Ziel deines aktuellen Programms passen - kein Tracking, nur eine seriöse Orientierung.",
  },
];

export function hasSeenWizard() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // localStorage blockiert: Wizard nicht bei jedem Aufruf aufdrücken
  }
}

export function markWizardSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignorieren
  }
}

export function Wizard({ open, onClose }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true" aria-label="Kurze Einführung">
      <div className="wizard-card">
        <p className="eyebrow">
          Kurze Einführung · {step + 1}/{SLIDES.length}
        </p>
        <h2>{slide.title}</h2>
        <p className="text-dim wizard-text">{slide.text}</p>
        <div className="wizard-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`wizard-dot ${i === step ? "is-active" : ""}`} />
          ))}
        </div>
        <div className="wizard-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Überspringen
          </button>
          <button className="btn btn-primary" onClick={() => (isLast ? onClose() : setStep(step + 1))}>
            {isLast ? "Los geht's" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
