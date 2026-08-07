import { api } from "./api.js";

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

export async function renderDashboard(root, navigate) {
  root.innerHTML = `<div class="empty-state">Lade dein Programm …</div>`;

  const programs = await api.getPrograms();
  const active = programs.find((p) => p.status === "active");

  if (!active) {
    root.innerHTML = `
      <div class="card empty-state">
        <p class="eyebrow">Kein aktives Programm</p>
        <p>Lege über die API einen Trainingsplan an, dann erscheint deine
        nächste Einheit hier.</p>
      </div>`;
    return;
  }

  const sessions = await api.getProgramSessions(active.id);
  const next = findNextSession(sessions);

  if (!next) {
    root.innerHTML = `
      <div class="card empty-state">
        <p class="eyebrow">${active.name}</p>
        <p>Programm abgeschlossen – stark! Zeit für ein neues.</p>
      </div>`;
    return;
  }

  const exerciseCount = next.exercises.length;
  const estMinutes = Math.round(
    next.exercises.reduce(
      (sum, e) => sum + e.sets * ((e.duration_seconds || 40) + e.rest_seconds),
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
  `;

  root.querySelector("#start-btn").addEventListener("click", () => navigate(`session/${next.id}`));
}
