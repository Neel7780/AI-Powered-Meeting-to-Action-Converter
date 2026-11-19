import { createContext } from "react";

// Portalled dialogs inherit this value even when mounted outside the dashboard DOM.
export const DashboardLightContext = createContext(false);
