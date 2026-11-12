import { useEffect, useState } from "react";
import { Loading, ErrorCard, BackLink } from "../components/Ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";

export default function History() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getHistory();
        if (alive) setState({ loading: false, data });
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return <Loading label="Lade Verlauf …" />;
  if (state.error) return <ErrorCard message={state.error} />;

  const data = state.data;

  return (
    <>
      <BackLink />
      <div className="card" style={{ marginTop: 12 }}>
        <p className="eyebrow">Fortschritt</p>
        <h2 className="card-title">Dein Trainingsverlauf</h2>
        <div className="stats-grid">
          <div className="stat-cell">
            <div className="stat-cell-value mono-num">{data.current_streak}</div>
            <div className="stat-cell-label">Serie</div>
          </div>
          <div className="stat-cell">
            <div className="stat-cell-value mono-num">{data.total_completed}</div>
            <div className="stat-cell-label">Insgesamt</div>
          </div>
          <div className="stat-cell">
            <div className="stat-cell-value mono-num">
              {data.this_week ? `${data.this_week.completed}/${data.this_week.total}` : "–"}
            </div>
            <div className="stat-cell-label">Diese Woche</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="eyebrow">Zuletzt erledigt</p>
        <h2 className="card-title">Letzte Einheiten</h2>
        {data.recent_sessions.length ? (
          <div className="history-list">
            {data.recent_sessions.map((s, i) => (
              <div key={`${s.id}-${s.completed_at}-${i}`} className="history-row">
                <div>
                  <div className="history-title">{s.session_type}</div>
                  <div className="history-meta">
                    {s.program_name} · Woche {s.week_number} · {s.exercise_count} Übungen
                  </div>
                </div>
                <div className="history-date mono-num">{formatDate(s.completed_at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dim">Noch keine Einheit abgeschlossen - die erste kommt hier rein.</p>
        )}
      </div>
    </>
  );
}
