import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SettingsWindow } from "./components/SettingsWindow";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Required root element '#root' was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
    <SettingsWindow />
  </React.StrictMode>
);
