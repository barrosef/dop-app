// Wiring the BFF has to happen BEFORE any request: this import has side
// effects only (customFetch's base, token and active account).
import "./lib/platform/backend";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
