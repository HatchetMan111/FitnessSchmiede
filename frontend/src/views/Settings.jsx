import { useEffect, useRef, useState } from "react";
import { Loading, ErrorCard, BackLink } from "../components/Ui";
import { useToast } from "../components/Toast";
import { api } from "../lib/api";

const PROVIDER_LABELS = {
  ollama: "Ollama (lokal)",
  chatgpt: "ChatGPT",
  claude: "Claude",
  openrouter: "OpenRouter",
};

const STALL_POLLS = 6; // 6 × 4s ohne Fortschritt => Job stockt vermutlich

export default function Settings() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true });
  const [providers, setProviders] = useState([]);
  const [presets, setPresets] = useState({});
  const [translationStatus, setTranslationStatus] = useState(null);
  const [translating, setTranslating] = useState(false);

  // Formular: Anbieter hinzufügen
  const [presetKey, setPresetKey] = useState(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const stallRef = useRef({ last: null, count: 0 });
  // Trackt, ob der Nutzer das Label selbst editiert hat - der Preset-Name
  // darf die Eingabe dann nicht mehr überschreiben.
  const nameDirtyRef = useRef(false);

  // Preset-Wechsel befüllt Label und Key-Feld mit Vorschlagswerten.
  useEffect(() => {
    if (presetKey) {
      if (!nameDirtyRef.current) setName(PROVIDER_LABELS[presetKey] || presetKey);
      setApiKey("");
    }
  }, [presetKey]);

  async function reload(alive) {
    const [providerList, presetList, status] = await Promise.all([
      api.getProviders(),
      api.getProviderPresets(),
      api.getTranslationStatus(),
    ]);
    if (!alive) return;
    setProviders(providerList);
    setPresets(presetList);
    setTranslationStatus(status);
    setPresetKey((k) => k ?? Object.keys(presetList)[0] ?? null);
    setState({ loading: false });
  }

  useEffect(() => {
    let alive = true;
    reload(alive).catch((err) => {
      if (alive) setState({ loading: false, error: err.message });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Live-Status des Übersetzungs-Jobs; bricht ab, wenn der Zähler
  // mehrere Polls in Folge nicht sinkt (Job fehlgeschlagen/stockend).
  useEffect(() => {
    if (!translating) return;
    const interval = setInterval(async () => {
      try {
        const status = await api.getTranslationStatus();
        setTranslationStatus(status);
        const stall = stallRef.current;
        if (stall.last === status.untranslated) stall.count += 1;
        else stall.count = 0;
        stall.last = status.untranslated;

        if (status.untranslated === 0) {
          setTranslating(false);
          toast("Übersetzung abgeschlossen - alle Übungen sind auf Deutsch.", "success");
        } else if (stall.count >= STALL_POLLS) {
          setTranslating(false);
          toast("Übersetzung scheint zu stocken - bitte erneut starten.", "error");
        }
      } catch {
        // kurzzeitige Aussetzer ignorieren
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [translating, toast]);

  if (state.loading) return <Loading label="Lade Einstellungen …" />;
  if (state.error) return <ErrorCard message={state.error} />;

  const preset = presetKey ? presets[presetKey] : null;
  const untranslated = translationStatus?.untranslated ?? null;

  async function handleProviderSubmit(e) {
    e.preventDefault();
    if (!preset) return;
    try {
      await api.createProvider({
        name,
        provider_type: preset.provider_type,
        base_url: preset.base_url,
        default_model: preset.default_model,
        api_key: apiKey || null,
        is_default: isDefault,
      });
      toast(`${name || presetKey} gespeichert.`, "success");
      setApiKey("");
      await reload(true);
    } catch (err) {
      toast(err.message || "Speichern fehlgeschlagen", "error");
    }
  }

  async function handleDelete(p) {
    if (!window.confirm(`Anbieter "${p.name}" entfernen?`)) return;
    try {
      await api.deleteProvider(p.id);
      toast("Anbieter entfernt.", "success");
      await reload(true);
    } catch (err) {
      toast(err.message || "Löschen fehlgeschlagen", "error");
    }
  }

  async function handleTranslate() {
    try {
      await api.triggerTranslation();
      stallRef.current = { last: null, count: 0 };
      setTranslating(true);
      toast("Übersetzung läuft im Hintergrund …", "info");
    } catch (err) {
      toast(err.message || "Übersetzung konnte nicht gestartet werden", "error");
    }
  }

  function applyPreset(key) {
    nameDirtyRef.current = false;
    setPresetKey(key);
  }

  const translateButtonLabel = providers.length
    ? translating
      ? "Läuft im Hintergrund …"
      : untranslated === 0
        ? "Fertig übersetzt"
        : "Übersetzung starten"
    : "Erst Anbieter hinterlegen";

  return (
    <>
      <BackLink />

      <div className="card" style={{ marginTop: 12 }}>
        <p className="eyebrow">KI-Anbieter</p>
        <h2 className="card-title">Verbindungen</h2>

        <div className="provider-list">
          {providers.length ? (
            providers.map((p) => (
              <div key={p.id} className="provider-row">
                <div>
                  <strong>{p.name}</strong>
                  <div className="provider-meta mono-num">
                    {p.base_url} · {p.default_model}
                  </div>
                </div>
                <div className="provider-row-actions">
                  {p.is_default && <span className="badge">Standard</span>}
                  <button className="btn-icon" title="Entfernen" aria-label="Anbieter entfernen" onClick={() => handleDelete(p)}>
                    ✕
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-dim">
              Noch kein Anbieter hinterlegt. Ohne Anbieter bleiben die Übungsanleitungen auf Englisch.
            </p>
          )}
        </div>

        <form onSubmit={handleProviderSubmit} className="provider-form">
          <div className="form-field">
            <label htmlFor="p-preset">Anbieter</label>
            <select className="input" id="p-preset" value={presetKey ?? ""} onChange={(e) => applyPreset(e.target.value)}>
              {Object.keys(presets).map((key) => (
                <option key={key} value={key}>
                  {PROVIDER_LABELS[key] || key}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="p-name">Label</label>
            <input
              className="input"
              id="p-name"
              type="text"
              value={name}
              onChange={(e) => {
                nameDirtyRef.current = true;
                setName(e.target.value);
              }}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="p-key">API-Key</label>
            <input
              className="input"
              id="p-key"
              type="password"
              placeholder={preset?.needs_key ? "erforderlich" : "nicht nötig bei Ollama"}
              required={preset?.needs_key ?? false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Als Standard verwenden
          </label>
          <button className="btn btn-primary" type="submit">
            Anbieter speichern
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="eyebrow">Übungsanleitungen</p>
        <h2 className="card-title">Deutsche Übersetzung</h2>
        <p className="text-dim" style={{ marginBottom: 16 }}>
          {untranslated === 0
            ? "Alle Übungen sind übersetzt."
            : untranslated != null
              ? `${untranslated} von 1324 Übungen noch nicht übersetzt.`
              : "Status wird geladen …"}
        </p>
        <button
          className="btn btn-primary"
          onClick={handleTranslate}
          disabled={!providers.length || translating || untranslated === 0}
        >
          {translateButtonLabel}
        </button>
      </div>
    </>
  );
}
