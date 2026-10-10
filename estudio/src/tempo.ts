import { spring } from "remotion";
import type { Item, Palavra } from "./tipos";

export const FPS = 30;

export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Segundo em que a fala diz a palavra. "palavra#2" = segunda vez que ela aparece.
// O kit.py já recusou, antes do render, palavra que a fala não tem.
export function quando(palavras: Palavra[], marca?: string): number | undefined {
  if (!marca) return undefined;
  const [alvo, vezTxt] = marca.split("#");
  const vez = Number(vezTxt || 1);
  const n = normalizar(alvo);
  let achadas = 0;
  for (const w of palavras) {
    if (normalizar(w.p) === n && ++achadas === vez) return w.ini;
  }
  return undefined;
}

// Momento de entrada de cada item: o "quando" dele, ou espalhado por igual na fala.
export function agenda(itens: (string | Item)[], palavras: Palavra[], duracao: number, inicio = 1.0, fimFracao = 0.78): number[] {
  const fim = Math.max(inicio + 0.5, duracao * fimFracao);
  const passo = itens.length > 1 ? (fim - inicio) / (itens.length - 1) : 0;
  return itens.map((it, i) => {
    const marca = typeof it === "string" ? undefined : it.quando;
    return quando(palavras, marca) ?? inicio + passo * i;
  });
}

export const texto = (it: string | Item) => (typeof it === "string" ? it : it.texto);

// 0 → 1 com mola, começando no segundo dado.
export function entra(frame: number, segundo: number, fps = FPS, suave = false) {
  return spring({
    frame: frame - Math.round(segundo * fps),
    fps,
    config: suave ? { damping: 200 } : { damping: 16, stiffness: 120, mass: 0.7 },
  });
}

export function sobe(p: number, distancia = 28) {
  return { opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * distancia}px)`, filter: `blur(${Math.max(0, (1 - p) * 8).toFixed(2)}px)` };
}
