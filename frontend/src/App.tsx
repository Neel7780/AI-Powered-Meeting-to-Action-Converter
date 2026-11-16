import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import ActionPulseLanding from "./components/landing/ActionPulseLanding";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MeetingReview from "./pages/MeetingReview";
import AcceptInvite from "./pages/AcceptInvite";
import CalendarCallback from "./pages/CalendarCallback";
import GitHubCallback from "./pages/GitHubCallback";
import SpeakerMapping from "./pages/SpeakerMapping";

/**
 * Listens for auth recovery parameters (#access_token=...&type=recovery or ?flow=reset)
 * across any incoming route and seamlessly directs users to /reset-password.
 */
function AuthRecoveryListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const pathname = window.location.pathname || "";
    if (
      pathname !== "/reset-password" &&
      (hash.includes("type=recovery") || search.includes("type=recovery") || search.includes("flow=reset"))
    ) {
      navigate(`/reset-password${search}${hash}`, { replace: true });
    }
  }, [navigate]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthRecoveryListener />
      <Routes>
        <Route path="/" element={<ActionPulseLanding />} />

        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-meeting" element={<Navigate to="/meetings" replace />} />
        <Route path="/meeting-review" element={<MeetingReview />} />
        <Route path="/invite/:token" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />
        <Route path="/calendar/callback" element={<ProtectedRoute><CalendarCallback /></ProtectedRoute>} />
        <Route path="/github/callback" element={<ProtectedRoute><GitHubCallback /></ProtectedRoute>} />
        <Route path="/settings/github" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/meetings/:id/review" element={<MeetingReview />} />
        <Route path="/meetings/:id/speakers" element={<ProtectedRoute><SpeakerMapping /></ProtectedRoute>} />
        <Route path="/meetings/:id" element={<MeetingReview />} />
        <Route path="/meeting-details" element={<Navigate to="/meetings" replace />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* /meetings — Create Meeting form embedded in Dashboard layout */}
        <Route
          path="/meetings"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* /meetings-list — Meetings list page rendered inside Dashboard layout */}
        <Route
          path="/meetings-list"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* /tasks and /kanban mount KanbanBoard inside Dashboard shell, wrapped by ProtectedRoute */}
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kanban"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/team"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/velocity"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
