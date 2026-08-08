import { api } from "./api.js";

export async function renderNutrition(root, navigate) {
  root.innerHTML = `<div class="empty-state">Lade Ernährungsdaten …</div>`;

  const [profile, activityLevels] = await Promise.all([
    api.getProfile().catch(() => null),
    api.getActivityLevels(),
  ]);

  let targets = null;
  let targetsError = null;
  if (profile) {
    try {
      targets = await api.getNutritionTargets();
    } catch (err) {
      targetsError = "Kein aktives Programm - Richtwerte erscheinen, sobald eins läuft.";
    }
  }

  root.innerHTML = `
    <a href="#/" class="back-link">← Zurück zum Dashboard</a>

    ${
      targets
        ? `
      <div class="card" style="margin-top:12px">
        <p class="eyebrow">Passend zu deinem aktuellen Ziel</p>
        <h2 style="margin:8px 0 20px">Tägliche Richtwerte</h2>
        <div class="macro-grid">
          <div class="macro-cell macro-cell--kcal">
            <div class="macro-value mono-num">${targets.calories}</div>
            <div class="macro-label">kcal / Tag</div>
          </div>
          <div class="macro-cell">
            <div class="macro-value mono-num">${targets.protein_g}g</div>
            <div class="macro-label">Protein</div>
          </div>
          <div class="macro-cell">
            <div class="macro-value mono-num">${targets.carbs_g}g</div>
            <div class="macro-label">Kohlenhydrate</div>
          </div>
          <div class="macro-cell">
            <div class="macro-value mono-num">${targets.fat_g}g</div>
            <div class="macro-label">Fett</div>
          </div>
        </div>
        <p class="text-dim" style="margin-top:16px">
          Gesamtumsatz ca. ${targets.tdee} kcal, angepasst um dein Trainingsziel.
          Reine Richtwerte - kein Tracking, keine Mahlzeiten-Erfassung.
        </p>
      </div>`
        : targetsError
          ? `<div class="card empty-state" style="margin-top:12px"><p>${targetsError}</p></div>`
          : ""
    }

    <div class="card" style="margin-top:16px">
      <p class="eyebrow">Körperdaten</p>
      <h2 style="margin:8px 0 16px">${profile ? "Profil aktualisieren" : "Einmalig einrichten"}</h2>
      <form id="profile-form">
        <div class="form-row">
          <div class="form-field">
            <label for="p-weight">Gewicht (kg)</label>
            <input class="input" id="p-weight" type="number" step="0.1" value="${profile?.weight_kg ?? 80}" required />
          </div>
          <div class="form-field">
            <label for="p-height">Größe (cm)</label>
            <input class="input" id="p-height" type="number" value="${profile?.height_cm ?? 180}" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="p-age">Alter</label>
            <input class="input" id="p-age" type="number" value="${profile?.age ?? 30}" required />
          </div>
          <div class="form-field">
            <label for="p-sex">Geschlecht</label>
            <select class="input" id="p-sex">
              <option value="male" ${profile?.sex === "male" ? "selected" : ""}>Männlich</option>
              <option value="female" ${profile?.sex === "female" ? "selected" : ""}>Weiblich</option>
            </select>
          </div>
        </div>
        <div class="form-field">
          <label for="p-activity">Aktivitätslevel (außerhalb des Trainings)</label>
          <select class="input" id="p-activity">
            ${Object.entries(activityLevels)
              .map(
                ([key, label]) =>
                  `<option value="${key}" ${(profile?.activity_level || "moderate") === key ? "selected" : ""}>${label}</option>`
              )
              .join("")}
          </select>
        </div>
        <button class="btn btn-primary" type="submit">Speichern</button>
      </form>
    </div>
  `;

  root.querySelector("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api.saveProfile({
      weight_kg: Number(root.querySelector("#p-weight").value),
      height_cm: Number(root.querySelector("#p-height").value),
      age: Number(root.querySelector("#p-age").value),
      sex: root.querySelector("#p-sex").value,
      activity_level: root.querySelector("#p-activity").value,
    });
    renderNutrition(root, navigate);
  });
}
