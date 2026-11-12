import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { ToastProvider } from "./components/Toast";
import { Wizard, hasSeenWizard, markWizardSeen } from "./components/Wizard";
import Dashboard from "./views/Dashboard";
import History from "./views/History";
import Nutrition from "./views/Nutrition";
import Onboarding from "./views/Onboarding";
import Session from "./views/Session";
import Settings from "./views/Settings";
import Week from "./views/Week";

function Shell() {
  const location = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  // Die Session ist die immersive Vollbild-Ansicht - ohne Topbar und Navigation.
  const isSession = location.pathname.startsWith("/session/");

  useEffect(() => {
    if (!hasSeenWizard()) setWizardOpen(true);
  }, []);

  function closeWizard() {
    markWizardSeen();
    setWizardOpen(false);
  }

  return (
    <div className={isSession ? "app-shell app-shell--bare" : "app-shell"}>
      {!isSession && (
        <header className="topbar">
          <img src="/icons/icon.svg" width="28" height="28" alt="" />
          <div className="wordmark">
            Fitness<span>Schmiede</span>
          </div>
          <button
            className="btn-icon help-btn"
            title="Kurze Einführung"
            aria-label="Kurze Einführung"
            onClick={() => setWizardOpen(true)}
          >
            ?
          </button>
        </header>
      )}

      <main className={isSession ? "main-session" : "main-view"}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session/:id" element={<Session />} />
          <Route path="/week/:programId?/:week?" element={<Week />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/history" element={<History />} />
          <Route path="/new" element={<Onboarding />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isSession && <BottomNav />}
      <Wizard open={wizardOpen} onClose={closeWizard} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ToastProvider>
  );
}
