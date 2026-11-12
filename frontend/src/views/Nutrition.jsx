import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/Toast";
import { Loading, ErrorCard, BackLink } from "../components/Ui";
import { api } from "../lib/api";

export default function Nutrition() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true });
  const [form, setForm] = useState(null);
  const [activityLevels, setActivityLevels] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (alive) => {
      try {
        const [profile, levels] = await Promise.all([
          api.getProfile().catch(() => null),
          api.getActivityLevels(),
        ]);
        let targets = null;
        let targetsError = null;
        if (profile) {
          try {
            targets = await api.getNutritionTargets();
          } catch {
            targetsError = "Kein aktives Programm - Richtwerte erscheinen, sobald eins läuft.";
          }
        }
        if (!alive) return;
        setActivityLevels(levels);
        setState({ loading: false, targets, targetsError, hasProfile: !!profile });
        if (profile) {
          setForm({
            weight_kg: profile.weight_kg,
            height_cm: profile.height_cm,
            age: profile.age,
            sex: profile.sex,
            activity_level: profile.activity_level || "moderate",
          });
        } else {
          setForm({ weight_kg: 80, height_cm: 180, age: 30, sex: "male", activity_level: "moderate" });
        }
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message });
      }
    },
    []
  );

  useEffect(() => {
    let alive = true;
    load(alive);
    return () => {
      alive = false;
    };
  }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveProfile({
        weight_kg: Number(form.weight_kg),
        height_cm: Number(form.height_cm),
        age: Number(form.age),
        sex: form.sex,
        activity_level: form.activity_level,
      });
      toast("Profil gespeichert - Richtwerte aktualisiert.", "success");
      await load(true);
    } catch (err) {
      toast(err.message || "Speichern fehlgeschlagen", "error");
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) return <Loading label="Lade Ernährungsdaten …" />;
  if (state.error) return <ErrorCard message={state.error} />;

  const { targets, targetsError, hasProfile } = state;

  return (
    <>
      <BackLink />

      {targets ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="eyebrow">Passend zu deinem aktuellen Ziel</p>
          <h2 className="card-title">Tägliche Richtwerte</h2>
          <div className="macro-grid">
            <div className="macro-cell macro-cell--kcal">
              <div className="macro-value mono-num">{targets.calories}</div>
              <div className="macro-label">kcal / Tag</div>
            </div>
            <div className="macro-cell">
              <div className="macro-value mono-num">{targets.protein_g}g</div>
              <div className="macro-label">Protein</div>
            </div>
            <div className="macro-cell">
              <div className="macro-value mono-num">{targets.carbs_g}g</div>
              <div className="macro-label">Kohlenhydrate</div>
            </div>
            <div className="macro-cell">
              <div className="macro-value mono-num">{targets.fat_g}g</div>
              <div className="macro-label">Fett</div>
            </div>
          </div>
          <p className="text-dim macro-note">
            Gesamtumsatz ca. {targets.tdee} kcal, angepasst um dein Trainingsziel. Reine Richtwerte -
            kein Tracking, keine Mahlzeiten-Erfassung.
          </p>
        </div>
      ) : targetsError ? (
        <div className="card empty-state" style={{ marginTop: 12 }}>
          <p>{targetsError}</p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <p className="eyebrow">Körperdaten</p>
        <h2 className="card-title">{hasProfile ? "Profil aktualisieren" : "Einmalig einrichten"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-weight">Gewicht (kg)</label>
              <input
                className="input"
                id="p-weight"
                type="number"
                step="0.1"
                value={form.weight_kg}
                onChange={(e) => update("weight_kg", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-height">Größe (cm)</label>
              <input
                className="input"
                id="p-height"
                type="number"
                value={form.height_cm}
                onChange={(e) => update("height_cm", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-age">Alter</label>
              <input
                className="input"
                id="p-age"
                type="number"
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-sex">Geschlecht</label>
              <select className="input" id="p-sex" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                <option value="male">Männlich</option>
                <option value="female">Weiblich</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="p-activity">Aktivitätslevel (außerhalb des Trainings)</label>
            <select
              className="input"
              id="p-activity"
              value={form.activity_level}
              onChange={(e) => update("activity_level", e.target.value)}
            >
              {Object.entries(activityLevels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Speichere …" : "Speichern"}
          </button>
        </form>
      </div>
    </>
  );
}
