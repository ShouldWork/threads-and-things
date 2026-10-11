import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyTheme, savedTheme } from "./lib/theme";
applyTheme(savedTheme());
import { startPwa } from "./lib/pwa";
startPwa();
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
