const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API-Fehler ${res.status} bei ${path}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getPrograms: () => request("/programs"),
  createProgram: (payload) =>
    request("/programs", { method: "POST", body: JSON.stringify(payload) }),
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
};
