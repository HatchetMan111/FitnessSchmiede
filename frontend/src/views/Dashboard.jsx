import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loading, ErrorCard } from "../components/Ui";
import { api } from "../lib/api";
import { estimateMinutes, pad2 } from "../lib/format";

function findNextSession(sessions) {
  return sessions.find((s) => !s.completed) || null;
}

function weekTrack(sessions, currentWeek) {
  const weeks = [...new Set(sessions.map((s) => s.week_number))].sort((a, b) => a - b);
  return weeks.map((w) => {
    const weekSessions = sessions.filter((s) => s.week_number === w);
    const done = weekSessions.every((s) => s.completed);
    const cls = done ? "is-done" : w === currentWeek ? "is-current" : "";
    return (
      <span key={w} className={`week-tag ${cls}`}>
        W{pad2(w)}
      </span>
    );
  });
}

// Zeigt die Einheiten DIESER Woche als Punkte - unabhängig vom Kalendertag,
// da an einem Tag auch mehrere Einheiten absolviert werden können.
function weekDots(sessions, currentWeek, nextSessionId) {
  const weekSessions = sessions
    .filter((s) => s.week_number === currentWeek)
    .sort((a, b) => a.day_number - b.day_number);
  return weekSessions.map((s) => {
    let cls = "is-pending";
    if (s.completed) cls = "is-done";
    else if (s.id === nextSessionId) cls = "is-next";
    return <span key={s.id} className={`week-dot ${cls}`} title={`Einheit ${s.day_number}: ${s.session_type}`} />;
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const programs = await api.getPrograms();
        const active = programs.find((p) => p.status === "active");

        if (!active) {
          // Der Backend-Fix setzt abgeschlossene Programme auf status="completed" -
          // die Abschluss-Info bleibt so auch nach der letzten Einheit sichtbar.
          const completed = programs.find((p) => p.status === "completed");
          if (alive) setState({ loading: false, program: null, completedName: completed?.name ?? null });
          return;
        }

        const [sessions, targets] = await Promise.all([
          api.getProgramSessions(active.id),
          api.getNutritionTargets().catch(() => null),
        ]);
        const next = findNextSession(sessions);
        if (alive) setState({ loading: false, program: active, sessions, next, targets });
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return <Loading label="Lade dein Programm …" />;
  if (state.error) return <ErrorCard message={state.error} />;

  const { program, sessions, next, targets } = state;

  if (!program) {
    return (
      <>
        <div className="card empty-state">
          <p className="eyebrow">{state.completedName ? `"${state.completedName}" abgeschlossen` : "Kein aktives Programm"}</p>
          <h2>{state.completedName ? "Stark! Zeit für das nächste Programm." : "Leg direkt hier deinen ersten Trainingsplan an."}</h2>
          <Link className="btn btn-primary" to="/new" style={{ marginTop: 16 }}>
            Programm erstellen
          </Link>
        </div>
        <div className="dashboard-links">
          <Link to="/settings">KI-Anbieter & Übersetzung einrichten</Link>
        </div>
      </>
    );
  }

  if (!next) {
    // Selten erreichbar (Backend markiert vollständige Programme als "completed"),
    // aber als Sicherheitsnetz vorhanden.
    return (
      <div className="card empty-state">
        <p className="eyebrow">Geschafft</p>
        <h2>Alle Einheiten von "{program.name}" sind erledigt.</h2>
        <Link className="btn btn-primary" to="/new" style={{ marginTop: 16 }}>
          Nächstes Programm
        </Link>
      </div>
    );
  }

  const weekSessionCount = sessions.filter((s) => s.week_number === next.week_number).length;

  return (
    <>
      <div className="hero-card">
        <p className="eyebrow">
          Woche {pad2(next.week_number)} von {program.duration_weeks} · {program.name}
        </p>
        <h2>{next.session_type}</h2>
        <p className="hero-subline">
          Einheit {next.day_number} von {weekSessionCount} diese Woche
        </p>
        <div className="hero-meta">
          <div>
            <div className="stat-value mono-num">{next.exercises.length}</div>
            <div className="stat-label">Übungen</div>
          </div>
          <div>
            <div className="stat-value mono-num">~{estimateMinutes(next.exercises)}</div>
            <div className="stat-label">Minuten</div>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/session/${next.id}`)}>
          Einheit starten
        </button>
        <div className="week-dots">{weekDots(sessions, next.week_number, next.id)}</div>
        <div className="week-track">{weekTrack(sessions, next.week_number)}</div>
      </div>

      {targets ? (
        <Link to="/nutrition" className="nutrition-strip">
          <span className="nutrition-strip-item">
            <strong className="mono-num">{targets.calories}</strong> kcal
          </span>
          <span className="nutrition-strip-item">
            <strong className="mono-num">{targets.protein_g}g</strong> Protein
          </span>
          <span className="nutrition-strip-item">
            <strong className="mono-num">{targets.carbs_g}g</strong> Kohlenhydrate
          </span>
          <span className="nutrition-strip-item">
            <strong className="mono-num">{targets.fat_g}g</strong> Fett
          </span>
        </Link>
      ) : (
        <Link to="/nutrition" className="nutrition-strip nutrition-strip--empty">
          Ernährungs-Richtwerte passend zu deinem Ziel einrichten →
        </Link>
      )}

      <div className="dashboard-links">
        <Link to={`/week/${program.id}/${next.week_number}`}>Diese Woche</Link>
        <Link to="/history">Fortschritt</Link>
        <Link to="/new">Neues Programm</Link>
        <Link to="/settings">Einstellungen</Link>
      </div>
    </>
  );
}
