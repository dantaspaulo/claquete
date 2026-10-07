import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as instrument } from "@remotion/google-fonts/InstrumentSerif";

// Carregadas antes do primeiro quadro. Outra fonte: troque aqui e no kit.config.json.
inter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });
instrument("normal", { subsets: ["latin", "latin-ext"] });
instrument("italic", { subsets: ["latin", "latin-ext"] });

export const pilha = (nome: string) => `"${nome}", "Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
