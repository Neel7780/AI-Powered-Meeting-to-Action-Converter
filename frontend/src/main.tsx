import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DarkModeProvider } from "./context/DarkModeContext";
import ErrorBoundary from "./components/common/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <DarkModeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </AuthProvider>
      </DarkModeProvider>
    </ErrorBoundary>
  </StrictMode>
);