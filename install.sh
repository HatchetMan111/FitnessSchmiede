#!/usr/bin/env bash
#
# FitnessSchmiede – Installer für Proxmox VE
# Stil angelehnt an community-scripts.github.io/ProxmoxVE (eigenständiges
# Skript, keine externe Abhängigkeit zu deren Framework).
#
# Einmalige Installation (auf dem Proxmox-Host als root ausführen):
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/<DEIN-USER>/fitnessschmiede/main/install.sh)"
#
# Aktualisieren eines bestehenden Containers:
#   UPDATE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/<DEIN-USER>/fitnessschmiede/main/install.sh)"
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Konfiguration - per Umgebungsvariable vor dem Aufruf überschreibbar
# ---------------------------------------------------------------------------
APP_REPO_URL="${APP_REPO_URL:-https://github.com/<DEIN-USER>/fitnessschmiede.git}"  # <<< HIER ANPASSEN
DATASET_REPO_URL="${DATASET_REPO_URL:-https://github.com/hasaneyldrm/exercises-dataset.git}"

CT_HOSTNAME="${CT_HOSTNAME:-fitnessschmiede}"
CT_ID="${CT_ID:-}"                 # leer = nächste freie ID automatisch wählen
CT_DISK_GB="${CT_DISK_GB:-8}"
CT_CORES="${CT_CORES:-2}"
CT_RAM_MB="${CT_RAM_MB:-2048}"
CT_BRIDGE="${CT_BRIDGE:-vmbr0}"
CT_STORAGE="${CT_STORAGE:-local-lvm}"
CT_TEMPLATE_STORAGE="${CT_TEMPLATE_STORAGE:-local}"
OS_TEMPLATE="${OS_TEMPLATE:-debian-12-standard}"
APP_PORT="${APP_PORT:-8080}"
UPDATE="${UPDATE:-0}"

# ---------------------------------------------------------------------------
# Ausgabe-Helfer (angelehnt an den bekannten Proxmox-Skript-Stil)
# ---------------------------------------------------------------------------
YW="\033[33m"; GN="\033[1;92m"; RD="\033[01;31m"; CL="\033[m"
msg_info()  { echo -e " ${YW}➜${CL} $1"; }
msg_ok()    { echo -e " ${GN}✓${CL} $1"; }
msg_error() { echo -e " ${RD}✗${CL} $1"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    msg_error "Bitte als root auf dem Proxmox-Host ausführen."
    exit 1
  fi
}

require_pve() {
  if ! command -v pct >/dev/null 2>&1; then
    msg_error "Dieses Skript muss auf einem Proxmox-VE-Host laufen (pct nicht gefunden)."
    exit 1
  fi
}

next_ctid() {
  pvesh get /cluster/nextid
}

ensure_template() {
  local tmpl
  tmpl=$(pveam available --section system | awk '{print $2}' | grep "^${OS_TEMPLATE}" | sort -V | tail -1)
  if [[ -z "$tmpl" ]]; then
    msg_error "Kein Template gefunden, das zu '${OS_TEMPLATE}' passt."
    exit 1
  fi
  if ! pveam list "$CT_TEMPLATE_STORAGE" | grep -q "$tmpl"; then
    msg_info "Lade Template ${tmpl} herunter …"
    pveam download "$CT_TEMPLATE_STORAGE" "$tmpl"
  fi
  echo "${CT_TEMPLATE_STORAGE}:vztmpl/${tmpl}"
}

create_container() {
  local template=$1
  msg_info "Erstelle LXC-Container ${CT_ID} (${CT_HOSTNAME}) …"
  pct create "$CT_ID" "$template" \
    --hostname "$CT_HOSTNAME" \
    --cores "$CT_CORES" \
    --memory "$CT_RAM_MB" \
    --swap 512 \
    --rootfs "${CT_STORAGE}:${CT_DISK_GB}" \
    --net0 "name=eth0,bridge=${CT_BRIDGE},ip=dhcp" \
    --unprivileged 1 \
    --features nesting=1 \
    --onboot 1 >/dev/null
  pct start "$CT_ID"
  msg_ok "Container ${CT_ID} läuft"

  msg_info "Warte auf Netzwerk im Container …"
  for _ in $(seq 1 30); do
    if pct exec "$CT_ID" -- getent hosts github.com >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  msg_ok "Netzwerk verfügbar"
}

provision_app() {
  msg_info "Installiere Systempakete (python3, git) im Container …"
  pct exec "$CT_ID" -- bash -c "
    set -e
    apt-get update -qq
    apt-get install -y -qq python3 python3-venv python3-pip git >/dev/null
  "
  msg_ok "Systempakete installiert"

  msg_info "Klone FitnessSchmiede-Code …"
  pct exec "$CT_ID" -- bash -c "
    set -e
    mkdir -p /opt/fitnessschmiede
    if [ -d /opt/fitnessschmiede/app/.git ]; then
      git -C /opt/fitnessschmiede/app pull --ff-only
    else
      git clone --depth 1 '${APP_REPO_URL}' /opt/fitnessschmiede/app
    fi
  "
  msg_ok "App-Code liegt in /opt/fitnessschmiede/app"

  msg_info "Klone Übungs-Datensatz (Bilder/GIFs, © Gym visual) …"
  pct exec "$CT_ID" -- bash -c "
    set -e
    mkdir -p /opt/fitnessschmiede/data
    if [ -d /opt/fitnessschmiede/data/exercises-dataset/.git ]; then
      git -C /opt/fitnessschmiede/data/exercises-dataset pull --ff-only
    else
      git clone --depth 1 '${DATASET_REPO_URL}' /opt/fitnessschmiede/data/exercises-dataset
    fi
  "
  msg_ok "Übungs-Datensatz liegt in /opt/fitnessschmiede/data/exercises-dataset"

  msg_info "Richte Python-Umgebung ein und importiere Übungen …"
  pct exec "$CT_ID" -- bash -c "
    set -e
    cd /opt/fitnessschmiede/app/backend
    python3 -m venv /opt/fitnessschmiede/venv
    /opt/fitnessschmiede/venv/bin/pip install -q --upgrade pip
    /opt/fitnessschmiede/venv/bin/pip install -q -r requirements.txt
    DB_PATH=/opt/fitnessschmiede/data/fitnessschmiede.db \
      /opt/fitnessschmiede/venv/bin/python scripts/import_exercises.py /opt/fitnessschmiede/data/exercises-dataset
  "
  msg_ok "Übungen importiert"

  msg_info "Richte systemd-Dienst ein …"
  pct exec "$CT_ID" -- bash -c "
    cat > /etc/systemd/system/fitnessschmiede.service <<'UNIT'
[Unit]
Description=FitnessSchmiede
After=network.target

[Service]
Type=simple
Environment=DB_PATH=/opt/fitnessschmiede/data/fitnessschmiede.db
Environment=DATASET_DIR=/opt/fitnessschmiede/data/exercises-dataset
Environment=FRONTEND_DIST=/opt/fitnessschmiede/app/frontend
WorkingDirectory=/opt/fitnessschmiede/app/backend
ExecStart=/opt/fitnessschmiede/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT}
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable --now fitnessschmiede >/dev/null
  "
  msg_ok "Dienst gestartet"
}

update_existing() {
  msg_info "Suche bestehenden Container '${CT_HOSTNAME}' …"
  CT_ID=$(pct list | awk -v h="$CT_HOSTNAME" '$0 ~ h {print $1}' | head -1)
  if [[ -z "$CT_ID" ]]; then
    msg_error "Kein Container mit Hostname '${CT_HOSTNAME}' gefunden."
    exit 1
  fi
  msg_ok "Gefunden: Container ${CT_ID}"
  provision_app
  pct exec "$CT_ID" -- systemctl restart fitnessschmiede
  msg_ok "Aktualisiert und neu gestartet"
}

main() {
  require_root
  require_pve

  if [[ "$UPDATE" == "1" ]]; then
    update_existing
  else
    CT_ID="${CT_ID:-$(next_ctid)}"
    template=$(ensure_template)
    create_container "$template"
    provision_app
  fi

  local ip
  ip=$(pct exec "$CT_ID" -- hostname -I | awk '{print $1}')
  echo
  msg_ok "FitnessSchmiede läuft: http://${ip}:${APP_PORT}"
  echo "   (nur im lokalen Netz erreichbar, kein Login nötig)"
}

main
