import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExerciseImage, Thumb } from "../components/Media";
import { Loading, ErrorCard } from "../components/Ui";
import { api } from "../lib/api";
import { cueGo, cueRest, cueTick } from "../lib/cues";
import { randomQuote } from "../lib/quotes";

const RING_RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PREP_SECONDS = 5;

function buildQueue(session) {
  const queue = [];
  session.exercises.forEach((se, exerciseIndex) => {
    for (let set = 1; set <= se.sets; set++) {
      if (se.duration_seconds) {
        queue.push({ type: "prep", seconds: PREP_SECONDS, exerciseIndex, set, se });
        queue.push({ type: "work", seconds: se.duration_seconds, exerciseIndex, set, se });
      } else {
        queue.push({ type: "reps", reps: se.reps, exerciseIndex, set, se });
      }
      const isLastSetOfLastExercise =
        set === se.sets && exerciseIndex === session.exercises.length - 1;
      if (!isLastSetOfLastExercise) {
        // set mitführen: die Pause folgt auf genau diesen Satz - die Kopfzeile
        // zeigt ihn an ("Satz 2/4"), damit die Pause einzuordnen ist.
        queue.push({ type: "rest", seconds: se.rest_seconds, exerciseIndex, set, se });
      }
    }
  });
  return queue;
}

function Ring({ remaining, total, kind }) {
  const fraction = total > 0 ? Math.min(1, 1 - remaining / total) : 0;
  const offset = CIRCUMFERENCE * fraction;
  return (
    <div className="timer-ring-wrap">
      <svg viewBox="0 0 260 260" role="img" aria-label={`Timer ${remaining} Sekunden`}>
        <circle className="timer-ring-track" cx="130" cy="130" r={RING_RADIUS} />
        <circle
          className={`timer-ring-progress ${kind === "rest" ? "is-rest" : ""}`}
          cx="130"
          cy="130"
          r={RING_RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="timer-center">
        <div className="timer-seconds mono-num">{Math.max(remaining, 0)}</div>
        <div className={`timer-phase ${kind === "rest" ? "is-rest" : ""}`}>
          {kind === "rest" ? "Pause" : "Arbeit"}
        </div>
      </div>
    </div>
  );
}

function Instructions({ exercise }) {
  const text = exercise.instructions_de || exercise.instructions_en;
  if (!text) return null;
  return (
    <details className="instructions">
      <summary>Anleitung</summary>
      <p>{text}</p>
    </details>
  );
}

function UpNext({ exercises, exerciseIndex }) {
  const nextEx = exercises[exerciseIndex + 1];
  if (!nextEx) return null;
  return (
    <div className="up-next">
      <span className="eyebrow">Als Nächstes</span>
      <div className="up-next-item">
        <Thumb exercise={nextEx.exercise} className="up-next-thumb" />
        <span className="up-next-name">{nextEx.exercise.name}</span>
        <span className="mono-num">
          {nextEx.duration_seconds ? `${nextEx.duration_seconds}s` : `${nextEx.reps}×`}
        </span>
      </div>
    </div>
  );
}

export default function Session() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [finished, setFinished] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [quote, setQuote] = useState(randomQuote);

  const queueRef = useRef([]);
  const stepIndexRef = useRef(0);
  const intervalRef = useRef(null);
  const endTimeRef = useRef(0);
  const pausedRef = useRef(false);
  const pausedRemainingRef = useRef(null);
  const sessionRef = useRef(null);
  const advanceRef = useRef(() => {});

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const startTimer = useCallback(
    (index) => {
      const step = queueRef.current[index];
      if (!step || step.seconds == null) return;
      endTimeRef.current = Date.now() + step.seconds * 1000;
      pausedRef.current = false;
      pausedRemainingRef.current = null;
      setPaused(false);
      stopTimer();
      intervalRef.current = setInterval(() => {
        if (pausedRef.current) return;
        const rem = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setRemaining(rem);
        if (step.type === "prep" && rem > 0 && rem <= 3) cueTick();
        if (rem <= 0) advanceRef.current();
      }, 250);
    },
    [stopTimer]
  );

  function logCompletedExercise(step) {
    // Genau einmal pro Übung loggen, wenn ihr letzter Satz fertig ist -
    // aktuell "wie geplant erledigt", ohne abweichende Ist-Werte zu erfassen.
    if (step.set !== step.se.sets) return;
    api
      .logWorkout({
        session_exercise_id: step.se.id,
        actual_sets: step.se.sets,
        actual_reps: step.se.reps,
        actual_duration_seconds: step.se.duration_seconds,
      })
      .catch((err) => console.error("Logging fehlgeschlagen", err));
  }

  const advance = useCallback(async () => {
    stopTimer();
    const queue = queueRef.current;
    const idx = stepIndexRef.current;
    const finishedStep = queue[idx];
    if (!finishedStep) return;

    if (finishedStep.type === "work" || finishedStep.type === "reps") {
      logCompletedExercise(finishedStep);
    }

    const nextIdx = idx + 1;
    if (nextIdx >= queue.length) {
      try {
        await api.completeSession(sessionRef.current.id);
      } catch (err) {
        console.error("Abschluss fehlgeschlagen", err);
      }
      setFinished(true);
      return;
    }

    stepIndexRef.current = nextIdx;
    setStepIndex(nextIdx);

    const next = queue[nextIdx];
    if (next.type === "rest") {
      cueRest();
      setQuote(randomQuote());
    } else if (next.type === "work" || next.type === "reps") {
      cueGo();
    }

    if (["work", "rest", "prep"].includes(next.type)) startTimer(nextIdx);
    else setRemaining(0);
  }, [startTimer, stopTimer]);

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  // Session laden + Timer starten
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getSession(id);
        if (!alive) return;
        if (!data.exercises.length) {
          setSession(data);
          return;
        }
        sessionRef.current = data;
        queueRef.current = buildQueue(data);
        setSession(data);
        const first = queueRef.current[0];
        if (["work", "rest", "prep"].includes(first.type)) startTimer(0);
        else setRemaining(0);
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
      stopTimer();
    };
  }, [id, startTimer, stopTimer]);

  // Zeitstempel-basiert statt Zähler: bleibt korrekt, wenn der Browser das
  // Intervall im Hintergrund/gesperrten Bildschirm ausbremst.
  // Wake Lock: verhindert, dass der Bildschirm während des Trainings einschläft.
  useEffect(() => {
    let lock = null;
    async function acquire() {
      try {
        lock = (await navigator.wakeLock?.request("screen")) || null;
      } catch {
        // nicht unterstützt oder Tab im Hintergrund - kein Blocker
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !lock) acquire();
    }
    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (lock) lock.release().catch(() => {});
    };
  }, []);

  function togglePause() {
    if (pausedRef.current) {
      endTimeRef.current = Date.now() + (pausedRemainingRef.current ?? 0);
      pausedRef.current = false;
      setPaused(false);
    } else {
      pausedRemainingRef.current = endTimeRef.current - Date.now();
      pausedRef.current = true;
      setPaused(true);
    }
  }

  function leave() {
    navigate("/");
  }

  // Inline-Bestätigung statt window.confirm: blockiert den Renderer nicht und
  // passt zum Look der App. Ohne Fortschritt direkt verlassen.
  function requestLeave() {
    if (stepIndexRef.current > 0 && !finished) setConfirmLeave(true);
    else leave();
  }

  if (error) return <ErrorCard message={error} />;
  if (!session) return <Loading label="Lade Einheit …" />;

  if (!session.exercises.length) {
    return (
      <div className="session-view session-view--centered">
        <div className="card empty-state">
          <p className="eyebrow">Keine Übungen gefunden</p>
          <p>
            Diese Einheit ist leer - vermutlich eine sehr enge Geräte-Auswahl bei einem älteren
            Programm. Neues Programm anlegen behebt das.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            Zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="session-view session-view--centered">
        <div className="card empty-state">
          <p className="eyebrow">Geschafft</p>
          <h2>Einheit abgeschlossen</h2>
          <p className="quote">„{randomQuote()}“</p>
          <button className="btn btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            Zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  const queue = queueRef.current;
  const step = queue[stepIndex];
  if (!step) return null;

  const exercise = step.se.exercise;
  const exNum = step.exerciseIndex + 1;
  const total = session.exercises.length;
  const progress = Math.round((stepIndex / queue.length) * 100);

  return (
    <div className="session-view">
      {confirmLeave && (
        <div className="wizard-overlay" role="dialog" aria-modal="true" aria-label="Einheit verlassen?">
          <div className="wizard-card">
            <p className="eyebrow">Einheit verlassen?</p>
            <h2>Schon fertig?</h2>
            <p className="text-dim wizard-text">
              Bereits abgeschlossene Übungen bleiben gespeichert.
            </p>
            <div className="wizard-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmLeave(false)}>
                Weiter trainieren
              </button>
              <button className="btn btn-primary" onClick={leave}>
                Verlassen
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="session-topbar">
        <button className="btn-icon" aria-label="Einheit verlassen" onClick={requestLeave}>
          ✕
        </button>
        <div className="session-progressbar" aria-hidden>
          <div className="session-progressbar-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="session-progress mono-num">
          {Math.min(exNum, total)}/{total}
        </span>
      </div>

      {step.type === "prep" && (
        <>
          <p className="session-progress eyebrow">Gleich geht's los · Übung {exNum} von {total}</p>
          <h2 className="exercise-name">{exercise.name}</h2>
          <div className="prep-wrap">
            <ExerciseImage exercise={exercise} size="large" />
            <div className="prep-countdown mono-num">{Math.max(remaining, 0)}</div>
          </div>
          <p className="timer-phase">Bereit machen …</p>
          <div className="session-controls">
            <button className="btn btn-ghost" onClick={() => advanceRef.current()}>
              Vorbereitung überspringen
            </button>
          </div>
          <Instructions exercise={exercise} />
        </>
      )}

      {step.type === "reps" && (
        <>
          <p className="session-progress eyebrow">
            Übung {exNum} von {total} · Satz {step.set}/{step.se.sets}
          </p>
          <h2 className="exercise-name">{exercise.name}</h2>
          <ExerciseImage exercise={exercise} size="large" />
          <div className="reps-badge mono-num">{step.reps}×</div>
          <div className="session-controls">
            <button className="btn btn-primary btn-lg" onClick={() => advanceRef.current()}>
              Satz erledigt
            </button>
          </div>
          <Instructions exercise={exercise} />
          <UpNext exercises={session.exercises} exerciseIndex={step.exerciseIndex} />
        </>
      )}

      {(step.type === "work" || step.type === "rest") && (
        <>
          <p className="session-progress eyebrow">
            Übung {exNum} von {total} · Satz {step.set}/{step.se.sets}
          </p>
          <h2 className="exercise-name">{step.type === "rest" ? "Pause" : exercise.name}</h2>
          {step.type === "work" && <ExerciseImage exercise={exercise} size="small" />}
          <Ring
            remaining={remaining}
            total={step.seconds}
            kind={step.type === "rest" ? "rest" : "work"}
          />
          {step.type === "rest" && <p className="quote">„{quote}“</p>}
          <div className="session-controls">
            <button className="btn btn-ghost" onClick={togglePause}>
              {paused ? "Weiter" : "Pause"}
            </button>
            <button className="btn btn-ghost" onClick={() => advanceRef.current()}>
              Überspringen
            </button>
          </div>
          {step.type === "work" && <Instructions exercise={exercise} />}
          <UpNext exercises={session.exercises} exerciseIndex={step.exerciseIndex} />
        </>
      )}
    </div>
  );
}
