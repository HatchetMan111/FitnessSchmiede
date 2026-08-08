import { renderDashboard } from "./dashboard.js";
import { renderSession } from "./session.js";
import { renderOnboarding } from "./onboarding.js";
import { renderSettings } from "./settings.js";
import { renderWeek } from "./week.js";
import { renderNutrition } from "./nutrition.js";
import { maybeShowWizard } from "./wizard.js";

const root = document.getElementById("view-root");

function navigate(path) {
  window.location.hash = path;
}

async function router() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [route, a, b] = hash.split("/");

  try {
    if (route === "session" && a) {
      await renderSession(root, a, navigate);
    } else if (route === "week" && a && b) {
      await renderWeek(root, navigate, a, b);
    } else if (route === "nutrition") {
      await renderNutrition(root, navigate);
    } else if (route === "new") {
      renderOnboarding(root, navigate, {
        heading: "Neues Programm",
        intro: "Läuft parallel zum bestehenden - das aktuelle wird dabei archiviert.",
      });
    } else if (route === "settings") {
      await renderSettings(root, navigate);
    } else {
      await renderDashboard(root, navigate);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="card empty-state">
      <p class="eyebrow">Verbindung fehlgeschlagen</p>
      <p>Backend nicht erreichbar. Läuft der Dienst?</p>
    </div>`;
  }
}

document.getElementById("help-btn")?.addEventListener("click", () => maybeShowWizard(true));

window.addEventListener("hashchange", router);
router();
maybeShowWizard();
