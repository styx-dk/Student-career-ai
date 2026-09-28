import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Documents } from "./pages/Documents";
import { Jobs } from "./pages/Jobs";
import { lazy, Suspense } from "react";
import { Planner } from "./pages/Planner";
import { Resumes } from "./pages/Resumes";
import { Settings } from "./pages/Settings";
import { Spinner } from "./components/UI";
import { CareerProfile } from "./pages/CareerProfile";
import { CareerPlanning } from "./pages/CareerPlanning";
const Forecast = lazy(() =>
  import("./pages/Forecast").then((module) => ({ default: module.Forecast })),
);
function Protected() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <div className="center">
        <Spinner />
      </div>
    );
  return session ? <Layout /> : <Navigate to="/auth" replace />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<Protected />}>
        <Route path="/profile" element={<CareerProfile />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/repository"
          element={<Navigate to="/profile?tab=experience" replace />}
        />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:documentId" element={<Documents />} />
        <Route path="/planning" element={<CareerPlanning />}>
          <Route index element={<Navigate to="roles" replace />} />
          <Route path="roles" element={<Jobs />} />
          <Route path="actions" element={<Planner />} />
          <Route
            path="trends"
            element={
              <Suspense fallback={<Spinner />}>
                <Forecast />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="/jobs"
          element={<Navigate to="/planning/roles" replace />}
        />
        <Route
          path="/forecast"
          element={<Navigate to="/planning/trends" replace />}
        />
        <Route
          path="/planner"
          element={<Navigate to="/planning/actions" replace />}
        />
        <Route path="/resumes" element={<Resumes />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
