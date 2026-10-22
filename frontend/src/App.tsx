import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ActionPulseLanding from "./components/landing/ActionPulseLanding";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MeetingReview from "./pages/MeetingReview";
import MeetingDetailsPage from "./pages/MeetingDetailsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ActionPulseLanding />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-meeting" element={<Navigate to="/meetings" replace />} />
        <Route path="/meeting-review" element={<MeetingReview />} />
        <Route path="/meetings/:id/review" element={<MeetingReview />} />
        <Route path="/meeting-details" element={<MeetingDetailsPage />} />
        <Route path="/meetings/:id" element={<MeetingDetailsPage />} />
        <Route path="/meetings/design-sprint-review" element={<MeetingDetailsPage />} />

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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;