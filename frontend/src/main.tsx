import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { logger } from "./utils/logger";
import { transportLog, initLogTransport } from "./utils/logTransport";

// Initialize logger transport
logger.setTransport(transportLog);
initLogTransport();

// Log application startup
logger.info("Application starting", {
  version: import.meta.env.VITE_APP_VERSION || "1.0.0",
  environment: import.meta.env.MODE,
  buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
