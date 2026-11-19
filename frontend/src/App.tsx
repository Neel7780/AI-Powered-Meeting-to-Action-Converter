import { isSupabaseConfigured } from "./lib/supabase";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ActionPulseLanding from "./components/landing/ActionPulseLanding";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MeetingReview from "./pages/MeetingReview";
import AcceptInvite from "./pages/AcceptInvite";
import CalendarCallback from "./pages/CalendarCallback";
import GitHubCallback from "./pages/GitHubCallback";
import MeetingDetailsPage from "./pages/MeetingDetailsPage";
import SpeakerMapping from "./pages/SpeakerMapping";

function App() {
  if (!isSupabaseConfigured) return <main role="alert" className="p-8 text-white">Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable the application.</main>;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ActionPulseLanding />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-meeting" element={<Navigate to="/meetings" replace />} />
        <Route path="/invite/:token" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />
        <Route path="/calendar/callback" element={<ProtectedRoute><CalendarCallback /></ProtectedRoute>} />
        <Route path="/github/callback" element={<ProtectedRoute><GitHubCallback /></ProtectedRoute>} />
        <Route path="/settings/github" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/meetings/:id/review" element={<ProtectedRoute><MeetingReview /></ProtectedRoute>} />
        <Route path="/meetings/:id/speakers" element={<ProtectedRoute><SpeakerMapping /></ProtectedRoute>} />
        <Route path="/meetings/:id" element={<ProtectedRoute><MeetingDetailsPage /></ProtectedRoute>} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/meetings"
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
