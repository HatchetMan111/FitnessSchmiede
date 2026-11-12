import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Segmented } from "../components/Segmented";
import { Loading, ErrorCard, BackLink } from "../components/Ui";
import { useToast } from "../components/Toast";
import { api } from "../lib/api";

const GOALS = ["Kraftaufbau", "Ausdauer & Fitness", "Abnehmen", "Muskelaufbau"];
const FOCUS_OPTIONS = [
  { value: "bodyweight", label: "Bodyweight", hint: "Kein Equipment nötig" },
  { value: "equipment", label: "Geräte", hint: "Aus deiner Auswahl" },
  { value: "mixed", label: "Gemischt", hint: "Beides im Wechsel" },
];
const LEVEL_HINTS = {
  beginner: "Kurze Einheiten, viel Pause - baut sich langsam auf",
  intermediate: "Der übliche Standard-Umfang",
  advanced: "Mehr Übungen, kürzere Pausen, höheres Volumen",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();

  const [meta, setMeta] = useState(null); // { equipmentGroups, fitnessLevels }
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("Grundlagen 8 Wochen");
  const [goal, setGoal] = useState(GOALS[0]);
  const [level, setLevel] = useState("beginner");
  const [focus, setFocus] = useState("mixed");
  const [minutes, setMinutes] = useState(20);
  const [weeks, setWeeks] = useState(8);
  const [days, setDays] = useState(3);
  const [equipment, setEquipment] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [equipmentGroups, fitnessLevels] = await Promise.all([
          api.getEquipmentGroups(),
          api.getFitnessLevels(),
        ]);
        if (alive) setMeta({ equipmentGroups, fitnessLevels });
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function toggleEquipment(key) {
    setEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createProgram({
        name,
        goal,
        focus,
        fitness_level: level,
        equipment: [...equipment],
        session_minutes: minutes,
        duration_weeks: Number(weeks),
        days_per_week: Number(days),
      });
      toast("Programm erstellt - dein Plan ist fertig!", "success");
      navigate("/");
    } catch (err) {
      toast(err.message || "Erstellen fehlgeschlagen", "error");
      setSubmitting(false);
    }
  }

  if (error) return <ErrorCard message={error} />;
  if (!meta) return <Loading label="Lade Optionen …" />;

  const { equipmentGroups, fitnessLevels } = meta;

  return (
    <>
      <BackLink />
      <div className="card" style={{ marginTop: 12 }}>
        <p className="eyebrow">Neues Programm</p>
        <h2 className="card-title">Kurz einrichten, dann übernimmt der Generator die Planung.</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="f-name">Name des Programms</label>
            <input
              className="input"
              id="f-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="f-goal">Ziel</label>
            <select className="input" id="f-goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Fitness-Stand</label>
            <Segmented
              options={Object.entries(fitnessLevels).map(([key, label]) => ({ value: key, label }))}
              value={level}
              onChange={setLevel}
            />
            <p className="field-hint">{LEVEL_HINTS[level] || ""}</p>
          </div>

          <div className="form-field">
            <label>Fokus</label>
            <Segmented options={FOCUS_OPTIONS} value={focus} onChange={setFocus} columns={3} />
          </div>

          {focus !== "bodyweight" && (
            <div className="form-field">
              <label>
                Verfügbare Geräte <span className="text-faint">(Körpergewicht ist immer dabei)</span>
              </label>
              <div className="pill-grid">
                {Object.entries(equipmentGroups).map(([key, g]) => (
                  <button
                    key={key}
                    type="button"
                    className={`pill ${equipment.has(key) ? "is-active" : ""}`}
                    onClick={() => toggleEquipment(key)}
                  >
                    {g.label} <span className="pill-count mono-num">{g.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-field">
            <label>Zeit pro Einheit</label>
            <Segmented
              options={[10, 15, 20, 25, 30].map((m) => ({ value: m, label: m, hint: "min" }))}
              value={minutes}
              onChange={setMinutes}
              columns={5}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="f-weeks">Dauer</label>
              <select className="input" id="f-weeks" value={weeks} onChange={(e) => setWeeks(e.target.value)}>
                {[4, 6, 8, 10, 12, 16].map((w) => (
                  <option key={w} value={w}>
                    {w} Wochen
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="f-days">Tage / Woche</label>
              <select className="input" id="f-days" value={days} onChange={(e) => setDays(e.target.value)}>
                {[2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {d} Tage
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Erstelle Programm …" : "Programm erstellen"}
          </button>
        </form>
      </div>

      <div className="dashboard-links">
        <Link to="/settings">KI-Anbieter & Übersetzung einrichten</Link>
      </div>
    </>
  );
}
