import { renderDashboard } from "./dashboard.js";
import { renderSession } from "./session.js";

const root = document.getElementById("view-root");

function navigate(path) {
  window.location.hash = path;
}

async function router() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [route, id] = hash.split("/");

  try {
    if (route === "session" && id) {
      await renderSession(root, id, navigate);
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

window.addEventListener("hashchange", router);
router();
