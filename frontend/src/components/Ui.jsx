import { Link } from "react-router-dom";

/** Lade-/Fehler-/Leerzustände, die jede View gemeinsam nutzt. */

export function Loading({ label = "Lade …" }) {
  return (
    <div className="empty-state">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorCard({ message, hint = "Backend nicht erreichbar. Läuft der Dienst?" }) {
  return (
    <div className="card empty-state">
      <p className="eyebrow">Verbindung fehlgeschlagen</p>
      <p>{hint}</p>
      {message ? <p className="text-faint">{message}</p> : null}
    </div>
  );
}

export function BackLink() {
  return (
    <Link className="back-link" to="/">
      ← Zurück zum Dashboard
    </Link>
  );
}
