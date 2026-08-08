let audioCtx = null;

function getCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/** Kurzer Synthesizer-Ton, keine externe Audiodatei nötig. */
export function beep(freq = 880, durationMs = 150, volume = 0.15) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio evtl. vom Browser blockiert - Vibration reicht als Fallback
  }
}

export function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export function cueTick() {
  beep(660, 80, 0.08);
  vibrate(40);
}

export function cueGo() {
  beep(1046, 220, 0.18);
  vibrate([80, 40, 120]);
}

export function cueRest() {
  beep(440, 200, 0.12);
  vibrate(60);
}
