import { api } from "./api.js";
import { cueTick, cueGo, cueRest } from "./cues.js";

const RING_RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PREP_SECONDS = 5;

function mediaUrl(path) {
  return `/media/${path}`;
}

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

function instructionsHtml(exercise) {
  const text = exercise.instructions_de || exercise.instructions_en;
  if (!text) return "";
  return `
    <details class="instructions">
      <summary>Anleitung</summary>
      <p>${text}</p>
    </details>`;
}

// Wake Lock: verhindert, dass der Bildschirm während des Trainings einschläft.
async function acquireWakeLock() {
  try {
    return (await navigator.wakeLock?.request("screen")) || null;
  } catch {
    return null; // z.B. nicht unterstützt oder Tab im Hintergrund - kein Blocker
  }
}

export async function renderSession(root, sessionId, navigate) {
  root.innerHTML = `<div class="empty-state">Lade Einheit …</div>`;
  const session = await api.getSession(sessionId);
  const queue = buildQueue(session);

  let stepIndex = 0;
  let remaining = 0;
  let intervalId = null;
  let paused = false;
  let endTime = 0;
  let pausedRemainingMs = null;
  let wakeLock = await acquireWakeLock();

  document.addEventListener("visibilitychange", onVisibilityChange);

  async function onVisibilityChange() {
    if (document.visibilityState === "visible" && !wakeLock) {
      wakeLock = await acquireWakeLock();
    }
  }

  function currentStep() {
    return queue[stepIndex];
  }

  function stopTimer() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  async function logCompletedExercise(step) {
    // Genau einmal pro Übung loggen, wenn ihr letzter Satz fertig ist -
    // aktuell "wie geplant erledigt", ohne abweichende Ist-Werte zu erfassen.
    if (step.set !== step.se.sets) return;
    try {
      await api.logWorkout({
        session_exercise_id: step.se.id,
        actual_sets: step.se.sets,
        actual_reps: step.se.reps,
        actual_duration_seconds: step.se.duration_seconds,
      });
    } catch (err) {
      console.error("Logging fehlgeschlagen", err);
    }
  }

  async function advance() {
    const finished = currentStep();
    stopTimer();

    if (finished.type === "work" || finished.type === "reps") {
      logCompletedExercise(finished);
    }

    stepIndex += 1;
    if (stepIndex >= queue.length) {
      await api.completeSession(session.id);
      await wakeLock?.release();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderComplete();
      return;
    }

    const next = currentStep();
    if (next.type === "work") cueGo();
    else if (next.type === "rest") cueRest();

    render();
    if (["work", "rest", "prep"].includes(next.type)) startTimer();
  }

  function startTimer() {
    const step = currentStep();
    endTime = Date.now() + step.seconds * 1000;
    paused = false;
    tick();
    intervalId = setInterval(tick, 250);
  }

  // Zeitstempel- statt Zähler-basiert: bleibt auch dann korrekt, wenn der
  // Browser das Intervall im Hintergrund/gesperrten Bildschirm ausbremst.
  function tick() {
    if (paused) return;
    const step = currentStep();
    remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    updateRing();

    if (step.type === "prep" && remaining > 0 && remaining <= 3) cueTick();

    if (remaining <= 0) advance();
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
          ${instructionsHtml(exercise)}
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
          ${instructionsHtml(exercise)}
          ${upNextHtml(nextEx)}
        </div>`;
      root.querySelector("#done-btn").addEventListener("click", advance);
      return;
    }

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
        ${isRest ? "" : instructionsHtml(exercise)}
        ${upNextHtml(nextEx)}
      </div>`;

    root.querySelector("#skip-btn").addEventListener("click", advance);
    root.querySelector("#pause-btn").addEventListener("click", (e) => {
      paused = !paused;
      if (paused) {
        pausedRemainingMs = endTime - Date.now();
        e.target.textContent = "Weiter";
      } else {
        endTime = Date.now() + pausedRemainingMs;
        e.target.textContent = "Pause";
      }
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
