import { api } from "./api.js";

const RING_RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PREP_SECONDS = 5;

function mediaUrl(path) {
  return `/media/${path}`;
}

/**
 * Baut aus den Übungen einer Einheit eine flache Abfolge von Schritten:
 * - "prep"  : 5s Vorbereitung vor jedem zeitbasierten Intervall, zeigt die
 *             kommende Übung, damit man sich in Position bringen kann
 * - "work"  : zeitbasierter Arbeitsblock (Bodyweight/HIIT) -> Countdown
 * - "reps"  : satzbasierter Block (Geräte/Gewichte) -> manuelle Bestätigung,
 *             kein Timerdruck, Bild bleibt trotzdem sichtbar
 * - "rest"  : Pause zwischen Sätzen/Übungen -> Countdown
 */
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
        queue.push({ type: "rest", seconds: se.rest_seconds, exerciseIndex, se });
      }
    }
  });
  return queue;
}

function exerciseMediaHtml(exercise, size = "large") {
  const gif = mediaUrl(exercise.gif_path);
  const fallback = mediaUrl(exercise.image_path);
  return `
    <div class="exercise-media exercise-media--${size}">
      <img src="${gif}" alt="${exercise.name}"
        onerror="if(this.src.indexOf('${exercise.gif_path}')!==-1){this.src='${fallback}';}else{this.style.display='none';this.parentElement.classList.add('exercise-media--missing');}" />
    </div>`;
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
    if (["work", "rest", "prep"].includes(currentStep().type)) startTimer();
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
    const prepEl = root.querySelector("#prep-num");
    if (prepEl) prepEl.textContent = String(Math.max(remaining, 0));
    if (!ringEl) return;
    ringEl.style.strokeDashoffset = String(offset);
    ringEl.classList.toggle("is-rest", step.type === "rest");
    if (secondsEl) secondsEl.textContent = String(Math.max(remaining, 0));
  }

  function render() {
    const step = currentStep();
    const exNum = step.exerciseIndex + 1;
    const total = session.exercises.length;
    const nextEx = session.exercises[step.exerciseIndex + 1];
    const exercise = step.se.exercise;

    if (step.type === "prep") {
      root.innerHTML = `
        <div class="session-view">
          <p class="session-progress eyebrow">Gleich geht's los · Übung ${exNum} von ${total}</p>
          <h2 class="exercise-name">${exercise.name}</h2>
          <div class="prep-wrap">
            ${exerciseMediaHtml(exercise, "large")}
            <div class="prep-countdown mono-num" id="prep-num">${step.seconds}</div>
          </div>
          <p class="timer-phase">Bereit machen …</p>
        </div>`;
      return;
    }

    if (step.type === "reps") {
      root.innerHTML = `
        <div class="session-view">
          <p class="session-progress eyebrow">Übung ${exNum} von ${total} · Satz ${step.set}/${step.se.sets}</p>
          <h2 class="exercise-name">${exercise.name}</h2>
          ${exerciseMediaHtml(exercise, "large")}
          <div class="reps-badge mono-num">${step.reps}×</div>
          <div class="session-controls">
            <button class="btn btn-primary" id="done-btn">Satz erledigt</button>
          </div>
          ${upNextHtml(nextEx)}
        </div>`;
      root.querySelector("#done-btn").addEventListener("click", advance);
      return;
    }

    // work oder rest
    const isRest = step.type === "rest";
    root.innerHTML = `
      <div class="session-view">
        <p class="session-progress eyebrow">Übung ${exNum} von ${total} · Satz ${step.set || ""}</p>
        <h2 class="exercise-name">${isRest ? "Pause" : exercise.name}</h2>
        ${isRest ? "" : exerciseMediaHtml(exercise, "small")}
        <div class="timer-ring-wrap ${isRest ? "" : "timer-ring-wrap--with-media"}">
          <svg viewBox="0 0 260 260">
            <circle class="timer-ring-track" cx="130" cy="130" r="${RING_RADIUS}" />
            <circle class="timer-ring-progress ${isRest ? "is-rest" : ""}" cx="130" cy="130" r="${RING_RADIUS}"
              stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="0" />
          </svg>
          <div class="timer-center">
            <div class="timer-seconds mono-num">${step.seconds}</div>
            <div class="timer-phase ${isRest ? "is-rest" : ""}">${isRest ? "Pause" : "Arbeit"}</div>
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
          <img class="up-next-thumb" src="${mediaUrl(nextEx.exercise.image_path)}" alt="" />
          <span class="up-next-name">${nextEx.exercise.name}</span>
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
  if (["work", "rest", "prep"].includes(currentStep().type)) startTimer();
}
