import { api } from "./api.js";

function providerLabel(preset) {
  return {
    ollama: "Ollama (lokal)",
    chatgpt: "ChatGPT",
    claude: "Claude",
    openrouter: "OpenRouter",
  };
}

export async function renderSettings(root, navigate) {
  root.innerHTML = `<div class="empty-state">Lade Einstellungen …</div>`;

  const [providers, presets, translationStatus] = await Promise.all([
    api.getProviders(),
    api.getProviderPresets(),
    api.getTranslationStatus(),
  ]);

  const labels = providerLabel();

  root.innerHTML = `
    <a href="#/" class="back-link">← Zurück zum Dashboard</a>

    <div class="card" style="margin-top:12px">
      <p class="eyebrow">KI-Anbieter</p>
      <h2 style="margin:8px 0 16px">Verbindungen</h2>

      <div id="provider-list">
        ${
          providers.length
            ? providers
                .map(
                  (p) => `
              <div class="provider-row">
                <div>
                  <strong>${p.name}</strong>
                  <div class="provider-meta mono-num">${p.base_url} · ${p.default_model}</div>
                </div>
                <div class="provider-row-actions">
                  ${p.is_default ? '<span class="badge">Standard</span>' : ""}
                  <button class="btn-icon" data-delete="${p.id}" title="Entfernen">✕</button>
                </div>
              </div>`
                )
                .join("")
            : `<p class="text-dim">Noch kein Anbieter hinterlegt. Ohne Anbieter bleiben die Übungsanleitungen auf Englisch.</p>`
        }
      </div>

      <form id="provider-form" style="margin-top:20px">
        <div class="form-field">
          <label for="p-preset">Anbieter</label>
          <select class="input" id="p-preset">
            ${Object.keys(presets)
              .map((key) => `<option value="${key}">${labels[key] || key}</option>`)
              .join("")}
          </select>
        </div>
        <div class="form-field">
          <label for="p-name">Label</label>
          <input class="input" id="p-name" type="text" value="Ollama (lokal)" />
        </div>
        <div class="form-field" id="key-field">
          <label for="p-key">API-Key</label>
          <input class="input" id="p-key" type="password" placeholder="nicht nötig bei Ollama" />
        </div>
        <label class="checkbox-row">
          <input type="checkbox" id="p-default" checked />
          Als Standard verwenden
        </label>
        <button class="btn btn-primary" type="submit">Anbieter speichern</button>
      </form>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="eyebrow">Übungsanleitungen</p>
      <h2 style="margin:8px 0 8px">Deutsche Übersetzung</h2>
      <p class="text-dim" id="translation-status" style="margin-bottom:16px">
        ${translationStatus.untranslated} von 1324 Übungen noch nicht übersetzt.
      </p>
      <button class="btn btn-primary" id="translate-btn" ${providers.length ? "" : "disabled"}>
        ${providers.length ? "Übersetzung starten" : "Erst Anbieter hinterlegen"}
      </button>
    </div>
  `;

  // Preset-Auswahl füllt Vorschlagswerte
  const presetSelect = root.querySelector("#p-preset");
  const nameInput = root.querySelector("#p-name");
  const keyInput = root.querySelector("#p-key");

  function applyPreset() {
    const preset = presets[presetSelect.value];
    nameInput.value = labels[presetSelect.value] || presetSelect.value;
    keyInput.placeholder = preset.needs_key ? "erforderlich" : "nicht nötig bei Ollama";
    keyInput.required = preset.needs_key;
  }
  presetSelect.addEventListener("change", applyPreset);
  applyPreset();

  root.querySelector("#provider-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const preset = presets[presetSelect.value];
    await api.createProvider({
      name: nameInput.value,
      provider_type: preset.provider_type,
      base_url: preset.base_url,
      default_model: preset.default_model,
      api_key: keyInput.value || null,
      is_default: root.querySelector("#p-default").checked,
    });
    renderSettings(root, navigate);
  });

  root.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.deleteProvider(btn.dataset.delete);
      renderSettings(root, navigate);
    });
  });

  root.querySelector("#translate-btn")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Läuft im Hintergrund …";
    await api.triggerTranslation();
    pollTranslationStatus(root);
  });
}

function pollTranslationStatus(root) {
  const el = root.querySelector("#translation-status");
  const interval = setInterval(async () => {
    const status = await api.getTranslationStatus();
    if (!el.isConnected) {
      clearInterval(interval);
      return;
    }
    el.textContent = `${status.untranslated} von 1324 Übungen noch nicht übersetzt.`;
    if (status.untranslated === 0) {
      clearInterval(interval);
      const btn = root.querySelector("#translate-btn");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Fertig übersetzt";
      }
    }
  }, 4000);
}
