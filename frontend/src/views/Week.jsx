import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Thumb } from "../components/Media";
import { Loading, ErrorCard, BackLink } from "../components/Ui";
import { api } from "../lib/api";
import { estimateMinutes, pad2 } from "../lib/format";

/**
 * Wochenansicht. `/week/current` löst automatisch auf: aktives Programm und
 * die Woche der nächsten offenen Einheit. Mit Pfeilen kann zwischen den
 * Wochen des Programms geblättert werden.
 */
export default function Week() {
  const { programId, week: weekParam } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let pid = Number(programId);
        if (Number.isNaN(pid) || pid <= 0) {
          // /week/current: aktives Programm auflösen, sonst Startseite
          const programs = await api.getPrograms();
          const active = programs.find((p) => p.status === "active");
          if (!alive) return;
          if (!active) {
            setState({ loading: false, empty: true });
            return;
          }
          pid = active.id;
        }

        const sessionsByProgram = await api.getProgramSessions(pid);
        const weeks = [...new Set(sessionsByProgram.map((s) => s.week_number))].sort((a, b) => a - b);

        const wanted = Number(weekParam);
        const week = weeks.includes(wanted)
          ? wanted
          : sessionsByProgram.find((s) => !s.completed)?.week_number ?? weeks[0];

        if (!weeks.length || week == null) {
          if (alive) setState({ loading: false, empty: true });
          return;
        }
        if (alive) setState({ loading: false, sessions: sessionsByProgram, weeks, week, programId: pid });
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [programId, weekParam]);

  if (state.loading) return <Loading label="Lade Woche …" />;
  if (state.error) return <ErrorCard message={state.error} />;
  if (state.empty)
    return (
      <>
        <BackLink />
        <div className="card empty-state" style={{ marginTop: 12 }}>
          <p>Kein aktives Programm - erstelle zuerst eines.</p>
        </div>
      </>
    );

  const { sessions, weeks, week, programId: pid } = state;
  const weekIdx = weeks.indexOf(week);
  const weekSessions = sessions
    .filter((s) => s.week_number === week)
    .sort((a, b) => a.day_number - b.day_number);
  const doneCount = weekSessions.filter((s) => s.completed).length;

  function gotoWeek(w) {
    navigate(`/week/${pid}/${w}`);
  }

  return (
    <>
      <BackLink />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="week-nav-row">
          <button
            className="btn-icon"
            aria-label="Vorherige Woche"
            disabled={weekIdx <= 0}
            onClick={() => gotoWeek(weeks[weekIdx - 1])}
          >
            ‹
          </button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <p className="eyebrow">
              Woche {pad2(week)} · {doneCount}/{weekSessions.length} erledigt
            </p>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              Was diese Woche ansteht
            </h2>
          </div>
          <button
            className="btn-icon"
            aria-label="Nächste Woche"
            disabled={weekIdx >= weeks.length - 1}
            onClick={() => gotoWeek(weeks[weekIdx + 1])}
          >
            ›
          </button>
        </div>
        <p className="text-dim week-hint">
          Reihenfolge ist nur ein Vorschlag - auch mehrere Einheiten an einem Tag sind kein Problem.
        </p>

        <div className="week-days">
          {weekSessions.map((s) => (
            <div key={s.id} className={`week-day ${s.completed ? "is-done" : ""}`}>
              <div className="week-day-header">
                <div>
                  <div className="week-day-title">
                    Einheit {s.day_number} · {s.session_type}
                  </div>
                  <div className="week-day-meta mono-num">
                    {s.exercises.length} Übungen · ~{estimateMinutes(s.exercises)} min
                  </div>
                </div>
                {s.completed ? (
                  <span className="badge">Erledigt</span>
                ) : (
                  <button className="btn-icon-text" onClick={() => navigate(`/session/${s.id}`)}>
                    Start
                  </button>
                )}
              </div>
              <div className="week-day-thumbs">
                {s.exercises.slice(0, 6).map((se) => (
                  <Thumb key={se.id} exercise={se.exercise} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
