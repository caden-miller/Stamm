import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAppStore } from "./store";
import { useTheme } from "./hooks/useTheme";
import Layout from "./pages/Layout";
import DashboardPage from "./pages/DashboardPage";
import ExplorerPage from "./pages/ExplorerPage";
import PeoplePage from "./pages/PeoplePage";
import PersonPage from "./pages/PersonPage";
import ConflictsPage from "./pages/ConflictsPage";
import AncestryPage from "./pages/AncestryPage";
import LocationsPage from "./pages/LocationsPage";

export default function App() {
  const initialize = useAppStore((s) => s.initialize);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  useTheme(); // Apply theme on <html> before anything renders

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized && loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: "var(--gold)" }}>
              <svg width="32" height="32" viewBox="0 0 36 36" fill="#fff" xmlns="http://www.w3.org/2000/svg">
                <path d="M30.6,11.7C29.2,5.8,24,1.7,18,1.7c-7.2,0-13,5.8-13,13c0,6.8,5.3,12.4,12,12.9v5c0,0.6,0.4,1,1,1s1-0.4,1-1v-5v-2V22 c0,0,0,0,0-0.1v-3.6l4.7-4.7c0.4-0.4,0.4-1,0-1.4c-0.4-0.4-1-0.4-1.4,0L19,15.6v-3l-3.3-3.3c-0.4-0.4-1-0.4-1.4,0 c-0.4,0.4-0.4,1,0,1.4l2.7,2.7v6.2l-3.8-3.8c-0.4-0.4-1-0.4-1.4,0c-0.4,0.4-0.4,1,0,1.4l5.2,5.2v3.2c-5.6-0.5-10-5.2-10-10.9 c0-6.1,4.9-11,11-11s11,4.9,11,11c0,4.9-3.3,9.2-8,10.6v2.1C28,25.7,32.3,18.7,30.6,11.7z" />
              </svg>
            </div>
          </div>
          <h1
            className="text-3xl font-light tracking-wide mb-3"
            style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
          >
            Stamm
          </h1>
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading your family history...
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="explore" element={<ExplorerPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="people/:personId" element={<PersonPage />} />
          <Route path="conflicts" element={<ConflictsPage />} />
          <Route path="ancestry" element={<AncestryPage />} />
          <Route path="locations" element={<LocationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
