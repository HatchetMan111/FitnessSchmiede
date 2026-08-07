import { api } from "./api.js";

const RING_RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Baut aus den Übungen einer Einheit eine flache Abfolge von Schritten:
 * - "work"  : zeitbasierter Arbeitsblock (Bodyweight/HIIT) -> automatischer Countdown
 * - "reps"  : satzbasierter Block (Geräte/Gewichte) -> manuelle Bestätigung
 * - "rest"  : Pause zwischen Sätzen/Übungen -> automatischer Countdown
 */
function buildQueue(session) {
  const queue = [];
  session.exercises.forEach((se, exerciseIndex) => {
    for (let set = 1; set <= se.sets; set++) {
      if (se.duration_seconds) {
        queue.push({
          type: "work",
          seconds: se.duration_seconds,
          exerciseIndex,
          set,
          se,
        });
      } else {
        queue.push({ type: "reps", reps: se.reps, exerciseIndex, set, se });
      }
      const isLastSetOfLastExercise =
        set === se.sets && exerciseIndex === session.exercises.length - 1;
      if (!isLastSetOfLastExercise) {
        queue.push({ type: "rest", seconds: se.rest_seconds, exerciseIndex, se });
      }
    }
  });
  return queue;
}

export async function renderSession(root, sessionId, navigate) {
  root.innerHTML = `<div class="empty-state">Lade Einheit …</div>`;
  const session = await api.getSession(sessionId);
  const queue = buildQueue(session);

  let stepIndex = 0;
  let remaining = 0;
  let intervalId = null;
  let paused = false;

  function currentStep() {
    return queue[stepIndex];
  }

  function exerciseName() {
    return currentStep().se.exercise.name;
  }

  function stopTimer() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  async function advance() {
    stopTimer();
    stepIndex += 1;
    if (stepIndex >= queue.length) {
      await api.completeSession(session.id);
      renderComplete();
      return;
    }
    render();
    if (currentStep().type !== "reps") startTimer();
  }

  function startTimer() {
    const step = currentStep();
    remaining = step.seconds;
    paused = false;
    updateRing();
    intervalId = setInterval(() => {
      if (paused) return;
      remaining -= 1;
      if (remaining <= 0) {
        advance();
      } else {
        updateRing();
      }
    }, 1000);
  }

  function updateRing() {
    const step = currentStep();
    const fraction = 1 - remaining / step.seconds;
    const offset = CIRCUMFERENCE * fraction;
    const ringEl = root.querySelector(".timer-ring-progress");
    const secondsEl = root.querySelector(".timer-seconds");
    const phaseEl = root.querySelector(".timer-phase");
    if (!ringEl) return;
    ringEl.style.strokeDashoffset = String(offset);
    ringEl.classList.toggle("is-rest", step.type === "rest");
    phaseEl.classList.toggle("is-rest", step.type === "rest");
    secondsEl.textContent = String(Math.max(remaining, 0));
  }

  function render() {
    const step = currentStep();
    const exNum = step.exerciseIndex + 1;
    const total = session.exercises.length;
    const nextEx = session.exercises[step.exerciseIndex + 1];

    if (step.type === "reps") {
      root.innerHTML = `
        <div class="session-view">
          <p class="session-progress eyebrow">Übung ${exNum} von ${total} · Satz ${step.set}/${step.se.sets}</p>
          <h2 class="exercise-name">${exerciseName()}</h2>
          <div class="timer-ring-wrap">
            <svg viewBox="0 0 260 260">
              <circle class="timer-ring-track" cx="130" cy="130" r="${RING_RADIUS}" />
            </svg>
            <div class="timer-center">
              <div class="timer-seconds mono-num">${step.reps}×</div>
              <div class="timer-phase">Wiederholungen</div>
            </div>
          </div>
          <div class="session-controls">
            <button class="btn btn-primary" id="done-btn">Satz erledigt</button>
          </div>
          ${upNextHtml(nextEx)}
        </div>`;
      root.querySelector("#done-btn").addEventListener("click", advance);
      return;
    }

    root.innerHTML = `
      <div class="session-view">
        <p class="session-progress eyebrow">Übung ${exNum} von ${total} · Satz ${step.set || ""}</p>
        <h2 class="exercise-name">${step.type === "rest" ? "Pause" : exerciseName()}</h2>
        <div class="timer-ring-wrap">
          <svg viewBox="0 0 260 260">
            <circle class="timer-ring-track" cx="130" cy="130" r="${RING_RADIUS}" />
            <circle class="timer-ring-progress" cx="130" cy="130" r="${RING_RADIUS}"
              stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="0" />
          </svg>
          <div class="timer-center">
            <div class="timer-seconds mono-num">${step.seconds}</div>
            <div class="timer-phase">${step.type === "rest" ? "Pause" : "Arbeit"}</div>
          </div>
        </div>
        <div class="session-controls">
          <button class="btn btn-ghost" id="pause-btn">Pause</button>
          <button class="btn btn-ghost" id="skip-btn">Überspringen</button>
        </div>
        ${upNextHtml(nextEx)}
      </div>`;

    root.querySelector("#skip-btn").addEventListener("click", advance);
    root.querySelector("#pause-btn").addEventListener("click", (e) => {
      paused = !paused;
      e.target.textContent = paused ? "Weiter" : "Pause";
    });
  }

  function upNextHtml(nextEx) {
    if (!nextEx) return "";
    return `
      <div class="up-next">
        <span class="eyebrow">Als Nächstes</span>
        <div class="up-next-item">
          <span>${nextEx.exercise.name}</span>
          <span class="mono-num">${nextEx.duration_seconds ? nextEx.duration_seconds + "s" : nextEx.reps + "×"}</span>
        </div>
      </div>`;
  }

  function renderComplete() {
    root.innerHTML = `
      <div class="card empty-state">
        <p class="eyebrow">Geschafft</p>
        <h2>Einheit abgeschlossen</h2>
        <p>Gut geschmiedet. Auf zur nächsten Einheit.</p>
        <button class="btn btn-primary" id="back-btn" style="margin-top:16px">Zum Dashboard</button>
      </div>`;
    root.querySelector("#back-btn").addEventListener("click", () => navigate(""));
  }

  render();
  if (currentStep().type !== "reps") startTimer();
}
