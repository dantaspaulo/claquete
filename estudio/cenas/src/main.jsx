import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { carregarFontes } from "./ilustra.jsx";
import "./index.css";

window.addEventListener("error", (e) => { window.__erro = String(e.message || e); });
window.addEventListener("unhandledrejection", (e) => { window.__erro = String((e.reason && e.reason.message) || e.reason); });
// As fontes da marca vêm do Google Fonts antes de a cena começar (a captura espera window.__fontes).
window.__fontes = carregarFontes((window.__CENA__ || {}).tema);
createRoot(document.getElementById("root")).render(<App />);
