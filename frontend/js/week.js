import { api } from "./api.js";

function mediaUrl(path) {
  return `/media/${path}`;
}

function estMinutes(session) {
  const total = session.exercises.reduce(
    (sum, e) => sum + e.sets * ((e.duration_seconds ? e.duration_seconds + 5 : 40) + e.rest_seconds),
    0
  );
  return Math.round(total / 60);
}

export async function renderWeek(root, navigate, programId, weekNumber) {
  root.innerHTML = `<div class="empty-state">Lade Woche …</div>`;

  const sessions = await api.getProgramSessions(programId);
  const week = Number(weekNumber);
  const weekSessions = sessions.filter((s) => s.week_number === week).sort((a, b) => a.day_number - b.day_number);

  if (!weekSessions.length) {
    root.innerHTML = `<div class="card empty-state"><p>Keine Woche gefunden.</p></div>`;
    return;
  }

  const doneCount = weekSessions.filter((s) => s.completed).length;

  root.innerHTML = `
    <a href="#/" class="back-link">← Zurück zum Dashboard</a>
    <div class="card" style="margin-top:12px">
      <p class="eyebrow">Woche ${String(week).padStart(2, "0")} · ${doneCount}/${weekSessions.length} erledigt</p>
      <h2 style="margin:8px 0 4px">Was diese Woche ansteht</h2>
      <p class="text-dim" style="margin:0 0 20px">Reihenfolge ist nur ein Vorschlag - auch mehrere Einheiten an einem Tag sind kein Problem.</p>
      <div class="week-days">
        ${weekSessions
          .map(
            (s) => `
          <div class="week-day ${s.completed ? "is-done" : ""}">
            <div class="week-day-header">
              <div>
                <div class="week-day-title">Einheit ${s.day_number} · ${s.session_type}</div>
                <div class="week-day-meta mono-num">${s.exercises.length} Übungen · ~${estMinutes(s)} min</div>
              </div>
              ${s.completed ? '<span class="badge">Erledigt</span>' : `<button class="btn-icon-text" data-start="${s.id}">Start</button>`}
            </div>
            <div class="week-day-thumbs">
              ${s.exercises
                .slice(0, 6)
                .map((se) => `<img class="week-thumb" src="${mediaUrl(se.exercise.image_path)}" alt="${se.exercise.name}" title="${se.exercise.name}" />`)
                .join("")}
            </div>
          </div>`
          )
          .join("")}
      </div>
    </div>`;

  root.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(`session/${btn.dataset.start}`));
  });
}
