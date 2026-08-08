import { api } from "./api.js";
import { renderOnboarding } from "./onboarding.js";

function findNextSession(sessions) {
  return sessions.find((s) => !s.completed) || null;
}

function weekTrack(sessions, currentWeek) {
  const weeks = [...new Set(sessions.map((s) => s.week_number))].sort((a, b) => a - b);
  return weeks
    .map((w) => {
      const weekSessions = sessions.filter((s) => s.week_number === w);
      const done = weekSessions.every((s) => s.completed);
      const cls = done ? "is-done" : w === currentWeek ? "is-current" : "";
      return `<span class="week-tag ${cls}">W${String(w).padStart(2, "0")}</span>`;
    })
    .join("");
}

async function nutritionStripHtml() {
  try {
    const targets = await api.getNutritionTargets();
    return `
      <a href="#/nutrition" class="nutrition-strip">
        <span class="nutrition-strip-item"><strong>${targets.calories}</strong> kcal</span>
        <span class="nutrition-strip-item"><strong>${targets.protein_g}g</strong> Protein</span>
        <span class="nutrition-strip-item"><strong>${targets.carbs_g}g</strong> Kohlenhydrate</span>
        <span class="nutrition-strip-item"><strong>${targets.fat_g}g</strong> Fett</span>
      </a>`;
  } catch {
    return `
      <a href="#/nutrition" class="nutrition-strip nutrition-strip--empty">
        Ernährungs-Richtwerte passend zu deinem Ziel einrichten →
      </a>`;
  }
}

export async function renderDashboard(root, navigate) {
  root.innerHTML = `<div class="empty-state">Lade dein Programm …</div>`;

  const programs = await api.getPrograms();
  const active = programs.find((p) => p.status === "active");

  if (!active) {
    renderOnboarding(root, navigate, {
      heading: "Kein aktives Programm",
      intro: "Leg direkt hier deinen ersten Trainingsplan an.",
    });
    return;
  }

  const sessions = await api.getProgramSessions(active.id);
  const next = findNextSession(sessions);

  if (!next) {
    renderOnboarding(root, navigate, {
      heading: `"${active.name}" abgeschlossen`,
      intro: "Stark! Zeit für das nächste Programm.",
    });
    return;
  }

  const exerciseCount = next.exercises.length;
  const estMinutes = Math.round(
    next.exercises.reduce(
      (sum, e) => sum + e.sets * ((e.duration_seconds ? e.duration_seconds + 5 : 40) + e.rest_seconds),
      0
    ) / 60
  );

  root.innerHTML = `
    <div class="hero-card">
      <p class="eyebrow">Woche ${String(next.week_number).padStart(2, "0")} · Tag ${next.day_number} · ${active.name}</p>
      <h2>${next.session_type}</h2>
      <div class="hero-meta">
        <div>
          <div class="stat-value mono-num">${exerciseCount}</div>
          <div class="stat-label">Übungen</div>
        </div>
        <div>
          <div class="stat-value mono-num">~${estMinutes}</div>
          <div class="stat-label">Minuten</div>
        </div>
      </div>
      <button class="btn btn-primary" id="start-btn">Einheit starten</button>
      <div class="week-track">${weekTrack(sessions, next.week_number)}</div>
    </div>

    ${await nutritionStripHtml()}

    <div class="dashboard-links">
      <a href="#/week/${active.id}/${next.week_number}">Diese Woche ansehen</a>
      <a href="#/new">Neues Programm</a>
      <a href="#/settings">Einstellungen</a>
    </div>
  `;

  root.querySelector("#start-btn").addEventListener("click", () => navigate(`session/${next.id}`));
}
