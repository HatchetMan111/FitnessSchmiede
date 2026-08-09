import { api } from "./api.js";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export async function renderHistory(root, navigate) {
  root.innerHTML = `<div class="empty-state">Lade Verlauf …</div>`;

  const data = await api.getHistory();

  root.innerHTML = `
    <a href="#/" class="back-link">← Zurück zum Dashboard</a>

    <div class="card" style="margin-top:12px">
      <p class="eyebrow">Fortschritt</p>
      <h2 style="margin:8px 0 20px">Dein Trainingsverlauf</h2>
      <div class="stats-grid">
        <div class="stat-cell">
          <div class="stat-cell-value mono-num">${data.current_streak}</div>
          <div class="stat-cell-label">Serie</div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell-value mono-num">${data.total_completed}</div>
          <div class="stat-cell-label">Insgesamt</div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell-value mono-num">${data.this_week ? `${data.this_week.completed}/${data.this_week.total}` : "–"}</div>
          <div class="stat-cell-label">Diese Woche</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="eyebrow">Zuletzt erledigt</p>
      <h2 style="margin:8px 0 16px">Letzte Einheiten</h2>
      ${
        data.recent_sessions.length
          ? `<div class="history-list">
              ${data.recent_sessions
                .map(
                  (s) => `
                <div class="history-row">
                  <div>
                    <div class="history-title">${s.session_type}</div>
                    <div class="history-meta">${s.program_name} · Woche ${s.week_number} · ${s.exercise_count} Übungen</div>
                  </div>
                  <div class="history-date mono-num">${formatDate(s.completed_at)}</div>
                </div>`
                )
                .join("")}
            </div>`
          : `<p class="text-dim">Noch keine Einheit abgeschlossen - die erste kommt hier rein.</p>`
      }
    </div>
  `;
}
