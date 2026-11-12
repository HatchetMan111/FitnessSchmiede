const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    // FastAPI liefert Fehler Details als {"detail": "..."} - die deutsche
    // Meldung aus dem Backend soll beim Nutzer ankommen, nicht nur ein Statuscode.
    let message = `API-Fehler ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail)) {
        message = data.detail.map((d) => d.msg).filter(Boolean).join(", ");
      }
    } catch {
      // Keine JSON-Antwort - Statuscode-Meldung bleibt
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getPrograms: () => request("/programs"),
  createProgram: (payload) =>
    request("/programs", { method: "POST", body: JSON.stringify(payload) }),
  getEquipmentGroups: () => request("/programs/meta/equipment-groups"),
  getFitnessLevels: () => request("/programs/meta/fitness-levels"),
  getProgramSessions: (programId) => request(`/programs/${programId}/sessions`),
  getSession: (sessionId) => request(`/sessions/${sessionId}`),
  completeSession: (sessionId) =>
    request(`/sessions/${sessionId}/complete`, { method: "POST" }),
  logWorkout: (payload) =>
    request("/sessions/logs", { method: "POST", body: JSON.stringify(payload) }),

  getProviderPresets: () => request("/settings/ai-provider-presets"),
  getProviders: () => request("/settings/ai-providers"),
  createProvider: (payload) =>
    request("/settings/ai-providers", { method: "POST", body: JSON.stringify(payload) }),
  deleteProvider: (id) => request(`/settings/ai-providers/${id}`, { method: "DELETE" }),
  getTranslationStatus: () => request("/settings/translation-status"),
  triggerTranslation: () =>
    request("/settings/translate-exercises", { method: "POST" }),

  getProfile: () => request("/profile"),
  saveProfile: (payload) => request("/profile", { method: "POST", body: JSON.stringify(payload) }),
  getActivityLevels: () => request("/nutrition/activity-levels"),
  getNutritionTargets: () => request("/nutrition/targets"),

  getHistory: () => request("/history"),
};
