import { api } from "./api.js";

const GOALS = ["Kraftaufbau", "Ausdauer & Fitness", "Abnehmen", "Muskelaufbau"];
const FOCUS_OPTIONS = [
  { value: "bodyweight", label: "Bodyweight", hint: "Kein Equipment nötig" },
  { value: "equipment", label: "Geräte", hint: "Aus deiner Auswahl" },
  { value: "mixed", label: "Gemischt", hint: "Beides im Wechsel" },
];
const LEVEL_HINTS = {
  beginner: "Kurze Einheiten, viel Pause - baut sich langsam auf",
  intermediate: "Der übliche Standard-Umfang",
  advanced: "Mehr Übungen, kürzere Pausen, höheres Volumen",
};

export async function renderOnboarding(root, navigate, opts = {}) {
  const heading = opts.heading || "Neues Programm";
  const intro =
    opts.intro || "Kurz einrichten, dann übernimmt der Generator die Planung.";

  root.innerHTML = `<div class="empty-state">Lade Optionen …</div>`;
  const [equipmentGroups, fitnessLevels] = await Promise.all([
    api.getEquipmentGroups(),
    api.getFitnessLevels(),
  ]);

  root.innerHTML = `
    <div class="card">
      <p class="eyebrow">${heading}</p>
      <h2 style="margin:8px 0 20px">${intro}</h2>

      <form id="onboarding-form">
        <div class="form-field">
          <label for="f-name">Name des Programms</label>
          <input class="input" id="f-name" type="text" value="Grundlagen 8 Wochen" required />
        </div>

        <div class="form-field">
          <label for="f-goal">Ziel</label>
          <select class="input" id="f-goal">
            ${GOALS.map((g) => `<option value="${g}">${g}</option>`).join("")}
          </select>
        </div>

        <div class="form-field">
          <label>Fitness-Stand</label>
          <div class="segmented" id="f-level">
            ${Object.entries(fitnessLevels)
              .map(
                ([key, label], i) => `
              <button type="button" class="segmented-option ${key === "beginner" ? "is-active" : ""}" data-value="${key}">
                <span>${label}</span>
              </button>`
              )
              .join("")}
          </div>
          <p class="field-hint" id="level-hint">${LEVEL_HINTS.beginner}</p>
        </div>

        <div class="form-field">
          <label>Fokus</label>
          <div class="segmented" id="f-focus">
            ${FOCUS_OPTIONS.map(
              (o, i) => `
              <button type="button" class="segmented-option ${i === 2 ? "is-active" : ""}" data-value="${o.value}">
                <span>${o.label}</span>
                <small>${o.hint}</small>
              </button>`
            ).join("")}
          </div>
        </div>

        <div class="form-field" id="equipment-field">
          <label>Verfügbare Geräte <span class="text-faint">(Körpergewicht ist immer dabei)</span></label>
          <div class="pill-grid">
            ${Object.entries(equipmentGroups)
              .map(
                ([key, g]) => `
              <button type="button" class="pill" data-equip="${key}">
                ${g.label} <span class="pill-count mono-num">${g.count}</span>
              </button>`
              )
              .join("")}
          </div>
        </div>

        <div class="form-field">
          <label>Zeit pro Einheit</label>
          <div class="segmented" id="f-minutes">
            ${[10, 15, 20, 25, 30]
              .map(
                (m) => `
              <button type="button" class="segmented-option ${m === 20 ? "is-active" : ""}" data-value="${m}">
                <span>${m}</span>
                <small>min</small>
              </button>`
              )
              .join("")}
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="f-weeks">Dauer</label>
            <select class="input" id="f-weeks">
              ${[4, 6, 8, 10, 12, 16].map((w) => `<option value="${w}" ${w === 8 ? "selected" : ""}>${w} Wochen</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label for="f-days">Tage / Woche</label>
            <select class="input" id="f-days">
              ${[2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${d === 3 ? "selected" : ""}>${d} Tage</option>`).join("")}
            </select>
          </div>
        </div>

        <button class="btn btn-primary" type="submit" id="submit-btn">Programm erstellen</button>
      </form>
    </div>
    <div class="dashboard-links">
      <a href="#/settings">KI-Anbieter & Übersetzung einrichten</a>
    </div>
  `;

  let focus = "mixed";
  let level = "beginner";
  let sessionMinutes = 20;
  const selectedEquipment = new Set();

  root.querySelectorAll("#f-minutes .segmented-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      sessionMinutes = Number(btn.dataset.value);
      root.querySelectorAll("#f-minutes .segmented-option").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  root.querySelectorAll("#f-focus .segmented-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      focus = btn.dataset.value;
      root.querySelectorAll("#f-focus .segmented-option").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      root.querySelector("#equipment-field").style.display = focus === "bodyweight" ? "none" : "block";
    });
  });

  root.querySelectorAll("#f-level .segmented-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      level = btn.dataset.value;
      root.querySelectorAll("#f-level .segmented-option").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      root.querySelector("#level-hint").textContent = LEVEL_HINTS[level] || "";
    });
  });

  root.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.equip;
      if (selectedEquipment.has(key)) {
        selectedEquipment.delete(key);
        btn.classList.remove("is-active");
      } else {
        selectedEquipment.add(key);
        btn.classList.add("is-active");
      }
    });
  });

  root.querySelector("#onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = root.querySelector("#submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Erstelle Programm …";

    try {
      await api.createProgram({
        name: root.querySelector("#f-name").value,
        goal: root.querySelector("#f-goal").value,
        focus,
        fitness_level: level,
        equipment: [...selectedEquipment],
        session_minutes: sessionMinutes,
        duration_weeks: Number(root.querySelector("#f-weeks").value),
        days_per_week: Number(root.querySelector("#f-days").value),
      });
      navigate("");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (err) {
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Programm erstellen";
      root.insertAdjacentHTML(
        "beforeend",
        `<p style="color:var(--ember-glow);margin-top:12px">Erstellen fehlgeschlagen - Backend erreichbar?</p>`
      );
    }
  });
}
