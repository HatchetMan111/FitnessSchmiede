# FitnessSchmiede – Technischer Plan

Referenzdokument für Architektur, Entscheidungen und offene Punkte.

## 1. Zielbild

Self-hosted Trainings-App für den Eigenbedarf: läuft in einem einzelnen
Proxmox-LXC-Container, generiert mehrwöchige Trainingspläne aus einem lokalen
Übungsdatensatz, zeigt Timer-geführte Einheiten wie bei bekannten
HIIT-Apps – aber ohne Cloud-Anbindung, Login oder Tracking durch Dritte.

## 2. Architektur

```
Browser/Smartphone (LAN) --> FastAPI (systemd, Port 8080) --> SQLite-Datei
                                     |
                                     +--> statische Frontend-Dateien (PWA)
                                     +--> /media (Übungsbilder & GIFs, lokal geklont)
                                     +--> optional: KI-Anbieter (Ollama/ChatGPT/Claude/OpenRouter)
```

- **Ein LXC-Container**, natives Debian 12, kein Docker.
- **Ein Prozess** (uvicorn/FastAPI) liefert API, Medien und Frontend-Dateien
  gemeinsam aus – kein separater Webserver nötig.
- **SQLite** als einzelne Datei unter `/opt/fitnessschmiede/data/`.
- **Kein Login**, nur im lokalen Netz erreichbar (siehe Entscheidung Runde 2).

## 3. Datenmodell

| Tabelle            | Zweck                                                        |
|---------------------|---------------------------------------------------------------|
| `exercises`         | Aus dem Dataset importiert, inkl. `instructions_de` (nullable, wird durch Übersetzungs-Job gefüllt) |
| `programs`           | Ein mehrwöchiges Trainingsprogramm (Ziel, Fokus, Dauer)      |
| `program_sessions`   | Eine Einheit innerhalb des Programms (Woche/Tag/Typ)          |
| `session_exercises`  | Übungen einer Einheit inkl. Sätzen/Wiederholungen/Zeiten      |
| `workout_logs`       | Tatsächlich absolvierte Sätze (Basis für spätere Auswertung)  |
| `ai_providers`       | Optionale KI-Anbindungen (Name, Typ, URL, Key, Modell)        |

Details siehe `backend/app/models.py`.

## 4. Trainingsplan-Generator (regelbasiert)

`backend/app/plan_generator.py` – läuft komplett offline, keine KI nötig.

- Pro Fokus (`bodyweight` / `equipment` / `mixed`) gibt es rotierende
  Einheitentypen (z.B. "Push", "Ganzkörper HIIT") mit zugehörigen
  Dataset-Kategorien.
- Bodyweight-/HIIT-Einheiten sind **zeitbasiert** (`duration_seconds`) →
  Frontend zeigt den Countdown-Ring.
- Geräte-/Kraft-Einheiten sind **satzbasiert** (`sets` × `reps`) → Frontend
  zeigt eine manuelle "Satz erledigt"-Bestätigung.
- Progression über die Wochen: Arbeitszeit/Wiederholungen steigen linear,
  jede 4. Woche ist eine Deload-Woche (−30% Volumen).
- Getestet gegen den echten Datensatz (1.324 Übungen) – siehe Beispielausgabe
  weiter unten.

**Bekannte Einschränkung:** Das Dataset unterscheidet nicht zwischen
Kraftübung, Cardio-Übung und Dehnung/Mobility innerhalb einer Kategorie. Die
aktuelle Zirkel-Auswahl kann daher vereinzelt Dehnübungen in ein HIIT-Zirkel
mischen. Sinnvolle Lösung für später: einmaliger KI-gestützter
Klassifizierungs-Durchlauf (wie die Übersetzung) oder eine kuratierte
Ausschlussliste.

## 5. KI-Anbindung

Zwei Adapter statt vier, weil sich die Anbieter im Anfrageformat
überschneiden (siehe `backend/app/ai/`):

| Adapter                  | Deckt ab                          |
|---------------------------|------------------------------------|
| `openai_compatible.py`    | Ollama (lokal), ChatGPT/OpenAI, OpenRouter |
| `anthropic_native.py`     | Claude direkt (Anthropic Messages API)     |

Presets für die künftige Einstellungsseite liegen in `ai/factory.py`
(`PROVIDER_PRESETS`). Ein weiterer OpenAI-kompatibler Anbieter lässt sich rein
über die Datenbank (`ai_providers`-Tabelle) ergänzen, ganz ohne Code-Änderung.

**Verwendungszweck aktuell:** einmalige Übersetzung der Übungsanleitungen
ins Deutsche (`ai/translate.py`). Adaptives Coaching (KI kommentiert/passt
den regelbasierten Plan an) ist als Erweiterung vorgesehen, aber noch nicht
implementiert.

## 5a. Ernährung (Richtwerte, kein Tracking)

`backend/app/nutrition.py` – bewusst kein Ernährungstagebuch, sondern eine
seriöse Ausgangsgröße, die Training und Ernährung sichtbar zusammenbringt:

- Einmaliges Profil (Gewicht, Größe, Alter, Geschlecht, Aktivitätslevel) in
  `user_profile` (Singleton, `id=1`).
- Grundumsatz über die Mifflin-St-Jeor-Formel, Gesamtumsatz über einen
  Aktivitätsfaktor.
- Kalorien-/Protein-Anpassung anhand des **Ziels des aktuell aktiven
  Programms** (`Kraftaufbau`/`Muskelaufbau` → Überschuss + hohes Protein,
  `Abnehmen` → Defizit + weiterhin hohes Protein, `Ausdauer & Fitness` →
  Erhaltung). Wechselt das Trainingsziel, ändern sich die Richtwerte beim
  nächsten Aufruf automatisch mit.
- Im Dashboard als kompakter Streifen unter der nächsten Einheit sichtbar,
  volle Aufschlüsselung unter `#/nutrition`.

## 6. Frontend

Bewusst **kein Framework, kein Build-Schritt** – reines HTML/CSS/JS, vom
Backend direkt als statische Dateien ausgeliefert. Vorteil: Der Proxmox-
Container braucht kein Node.js, nur Python. PWA-Manifest + Service Worker
sorgen dafür, dass eine einmal geladene Einheit auch ohne WLAN im
Trainingsraum weiterläuft.

**Design-Richtung:** Schmiede-Thema statt generischer Fitness-App-Optik –
gedecktes, warmes Dunkel als Hintergrund, Glut-Orange für Arbeitsphasen,
Stahl-Blau für Pausen. Zahlen (Timer, Sätze) in Monospace wie eine
mechanische Anzeige. Signatur-Element: der Timer-Ring, der beim Countdown
von Glut- zu Stahlfarbe wechselt – Aufheizen/Abschrecken als sichtbarer
Trainingsrhythmus.

**Bereits gebaut:** Dashboard (nächste offene Einheit, Wochen-Fortschritt),
Trainings-Einheit mit Countdown-Timer/Satz-Zähler und automatischem
Session-Abschluss.

**Bekannte, akzeptierte Einschränkung:** Service Worker (Offline-Cache) und
die Wake-Lock-API (Bildschirm bleibt während des Trainings an) benötigen
einen Secure Context (HTTPS oder `localhost`). Die App läuft bewusst über
einfaches HTTP im LAN, ohne Reverse Proxy/Zertifikat - Einfachheit hat hier
Vorrang. Beide Features sind im Code vorhanden und fallen ohne Fehler still
zurück, aktivieren sich auf dem Standard-Setup aber nicht. Falls das später
doch gebraucht wird: lokales HTTPS z.B. über Caddy mit selbstsigniertem
Zertifikat oder mkcert wäre der nächste Schritt, bewusst nicht Teil des
aktuellen Installers.

**Noch nicht gebaut** (nächste Ausbauschritte):
- Einstellungsseite (KI-Anbieter anlegen, Übersetzung anstoßen) – aktuell nur per API nutzbar
- Programm-Erstellung als UI (aktuell nur per API) – z.B. kurzer Onboarding-Dialog
- Übungs-Bibliothek zum Stöbern/Filtern
- Erfassung von Gewicht/RPE beim Krafttraining (Datenmodell ist bereits vorbereitet: `workout_logs`)
- Fortschritts-Ansicht (Streak, absolvierte Einheiten, Verlauf)

## 7. Install-Skript

`install.sh` folgt dem Proxmox-Community-Scripts-Muster (Status-Ausgaben,
Umgebungsvariablen für alle Kernwerte, `UPDATE=1` für Re-Provisionierung),
ist aber ein eigenständiges Skript ohne Abhängigkeit zu deren Framework.

Ablauf: `pct create` → warten auf Netzwerk → Python/git installieren → Code
und Übungsdatensatz klonen → venv + Abhängigkeiten → Übungen importieren →
systemd-Service anlegen und starten.

**Wichtiger Hinweis:** Das Skript ist gegen die dokumentierten
`pct`/`pveam`-Befehle geschrieben, konnte in dieser Umgebung aber nicht gegen
einen echten Proxmox-Host getestet werden (keine Proxmox-Instanz verfügbar).
Backend, Datenimport und Frontend-Auslieferung selbst sind getestet (siehe
Abschnitt 8). Vor dem produktiven Einsatz einmal auf einem Test-Host
durchlaufen lassen.

## 8. Was bereits getestet ist

Gegen den echten Datensatz (nicht nur Beispieldaten):

- Import aller 1.324 Übungen in SQLite ✓
- Plan-Generator erzeugt reale, sinnvolle 8-Wochen-Pläne mit Progression und
  Deload-Wochen ✓
- API end-to-end: Programm erstellen → Sessions abrufen → Einheit
  abschließen ✓
- Frontend-Dateien werden vom Backend korrekt ausgeliefert ✓
- Medien-Mount-Pfade stimmen mit der Dataset-Struktur überein (Test mit
  echten Bild-/GIF-Dateien steht noch aus, da der volle Datensatz-Clone
  mit Bildern in dieser Umgebung nicht heruntergeladen wurde)

## 9. Nächste Schritte (Vorschlag)

1. GitHub-Repo anlegen, diesen Code pushen, `APP_REPO_URL` in `install.sh`
   und `README.md` auf die echte URL setzen
2. `install.sh` einmal gegen einen echten Proxmox-Host testen
3. Einstellungsseite bauen (KI-Anbieter, Übersetzung anstoßen)
4. Programm-Erstellung als kurzer Onboarding-Dialog im Frontend
5. Gewichts-/RPE-Erfassung für Krafteinheiten ergänzen
