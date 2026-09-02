// A ligação com o BFF precisa acontecer ANTES de qualquer requisição: este
// import só tem efeitos colaterais (base, token e conta ativa do customFetch).
import "./lib/platform/backend";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
