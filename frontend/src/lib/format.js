// Geteilte Helfer für Views und Session-Timer.

export function mediaUrl(path) {
  return `/media/${path}`;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Schätzt die Einheitsdauer in Minuten. Spiegelt exakt die Schritt-Reihenfolge
 * des Session-Timers (buildQueue): Reps-Sätze zählen mit grober Annahme pro
 * Satz, die allerletzte Pause der letzten Übung entfällt.
 */
export function estimateMinutes(exercises) {
  let total = 0;
  exercises.forEach((e, i) => {
    for (let s = 1; s <= e.sets; s++) {
      total += e.duration_seconds ? e.duration_seconds + 5 : 40;
      const isLastSetOfLastExercise = s === e.sets && i === exercises.length - 1;
      if (!isLastSetOfLastExercise) total += e.rest_seconds;
    }
  });
  return Math.round(total / 60);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}
