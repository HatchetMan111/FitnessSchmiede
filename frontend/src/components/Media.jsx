import { useState } from "react";
import { mediaUrl } from "../lib/format";

/**
 * Übungs-Bild mit Gif → Standbild → Platzhalter-Fallbackkette.
 * Ersetzt den früheren inline-onerror-Snippet.
 */
export function ExerciseImage({ exercise, size = "large", className = "" }) {
  const [stage, setStage] = useState("gif"); // gif → image → missing
  if (stage === "missing") {
    return <div className={`exercise-media exercise-media--${size} exercise-media--missing ${className}`} />;
  }
  const src = stage === "gif" ? mediaUrl(exercise.gif_path) : mediaUrl(exercise.image_path);
  return (
    <div className={`exercise-media exercise-media--${size} ${className}`}>
      <img
        src={src}
        alt={exercise.name}
        loading="lazy"
        onError={() => setStage(stage === "gif" ? "image" : "missing")}
      />
    </div>
  );
}

/** Kleines Standbild als Thumbnail (Wochen- und Next-up-Ansicht). */
export function Thumb({ exercise, className = "week-thumb" }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <img
      className={className}
      src={mediaUrl(exercise.image_path)}
      alt={exercise.name}
      title={exercise.name}
      loading="lazy"
      onError={() => setHidden(true)}
    />
  );
}
