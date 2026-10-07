// Onde fica cada coisa nos dois formatos. A legenda fica FORA da janela, e o rótulo acima dela:
// a câmera só mexe no que está dentro da janela, então nunca corta texto de apoio.
export type Formato = "h" | "v";

export const TAMANHO: Record<Formato, { w: number; h: number }> = {
  h: { w: 1920, h: 1080 },
  v: { w: 1080, h: 1920 },
};

export const LAYOUT = {
  h: { janela: { x: 200, y: 150, w: 1520, h: 770 }, rotuloY: 82, legendaY: 948, legendaFonte: 40, escala: 1 },
  v: { janela: { x: 40, y: 290, w: 1000, h: 1180 }, rotuloY: 205, legendaY: 1520, legendaFonte: 58, escala: 1 },
} as const;

export const BARRA = 46; // altura da barra da janela
