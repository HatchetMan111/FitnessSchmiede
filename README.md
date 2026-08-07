# FitnessSchmiede

Selbstgehostete Trainings-App: generiert mehrwöchige Trainingspläne aus einem
lokalen Übungsdatensatz, läuft komplett offline in einem Proxmox-LXC-Container.
Keine Cloud, kein Login, kein Tracking.

## Installation auf Proxmox

Auf dem Proxmox-Host als root ausführen:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/HatchetMan111/FitnessSchmiede/main/install.sh)"
```

Das Skript legt einen unprivilegierten Debian-12-LXC-Container an, installiert
Python nativ (kein Docker), klont diesen Code sowie den Übungsdatensatz und
startet den Dienst über systemd. Am Ende wird die erreichbare Adresse
angezeigt, z.B. `http://192.168.1.50:8080`.

Standardwerte (Cores, RAM, Disk, Netzwerk-Bridge, Container-ID, Port) lassen
sich vor dem Aufruf per Umgebungsvariable überschreiben - siehe Kopf von
[`install.sh`](./install.sh).

**Update eines bestehenden Containers:**

```bash
UPDATE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/HatchetMan111/FitnessSchmiede/main/install.sh)"
```

## Architektur

- **Backend:** Python + FastAPI, SQLite (eine Datei, kein separater DB-Prozess)
- **Frontend:** PWA aus reinem HTML/CSS/JS, kein Build-Schritt nötig - lässt
  sich auf dem Smartphone-Homescreen installieren und läuft dank Service
  Worker auch ohne WLAN weiter, sobald eine Einheit einmal geladen wurde
- **Übungsdaten:** [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
  (1.324 Übungen, MIT-lizenzierte Metadaten; Bilder/GIFs © Gym visual, siehe
  Lizenzhinweis im Dataset-Repo)
- **KI-Anbindung (optional):** zwei Adapter decken vier Anbieter ab -
  OpenAI-kompatibel für Ollama/ChatGPT/OpenRouter, nativ für Claude
  (siehe `backend/app/ai/`)

Ausführliche Architektur- und Entscheidungs-Dokumentation: [`docs/technical-plan.md`](./docs/technical-plan.md)

## Lokale Entwicklung (ohne Proxmox)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Übungsdatensatz einmalig klonen
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset.git ../dataset

DB_PATH=./data/fitnessschmiede.db \
  python scripts/import_exercises.py ../dataset

DB_PATH=./data/fitnessschmiede.db \
DATASET_DIR=../dataset \
FRONTEND_DIST=../frontend \
  uvicorn app.main:app --reload --port 8080
```

Danach `http://localhost:8080` öffnen.

## Ersten Trainingsplan anlegen

Aktuell per API (eine Einstellungsseite dafür ist der nächste Ausbauschritt,
siehe `docs/technical-plan.md`):

```bash
curl -X POST http://localhost:8080/api/programs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grundlagen 8 Wochen",
    "goal": "Kraftaufbau",
    "focus": "mixed",
    "duration_weeks": 8,
    "days_per_week": 3
  }'
```

`focus` ist `bodyweight`, `equipment` oder `mixed`. Danach zeigt das
Dashboard automatisch die nächste offene Einheit.

## KI-Anbieter hinterlegen (optional)

Ebenfalls aktuell per API:

```bash
curl -X POST http://localhost:8080/api/settings/ai-providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lokales Ollama",
    "provider_type": "openai_compatible",
    "base_url": "http://localhost:11434/v1",
    "default_model": "llama3.1",
    "is_default": true
  }'

curl -X POST http://localhost:8080/api/settings/translate-exercises
```

Der Übersetzungs-Job läuft im Hintergrund und übersetzt die 1.324
Übungsanleitungen einmalig ins Deutsche - bereits übersetzte Einträge werden
bei erneutem Aufruf übersprungen.

## Lizenzhinweis Übungsdaten

Der Code des Datensatzes steht unter MIT. Die Bilder/GIFs sind laut
Dataset-Repo © Gym visual und dort "mit Erlaubnis" für die ursprüngliche App
weiterverteilt. Für den rein privaten, nicht-öffentlichen Betrieb dieser App
ist das unkritisch - bei öffentlicher Bereitstellung lohnt ein Blick in die
Nutzungsbedingungen von Gym visual.
