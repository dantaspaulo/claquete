import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { pilha } from "../fontes";
import { FPS, normalizar } from "../tempo";
import type { Parte } from "../tipos";
import { useAmbiente } from "./contexto";

type P = { p: string; ini: number; fim: number };

// Legenda palavra a palavra, fora da janela. Mostra a linha da palavra que está sendo dita;
// a palavra atual ganha fundo, e as palavras de destaque ficam na cor de destaque.
export const Legenda: React.FC<{ partes: Parte[]; destaques: string[]; y: number; fonte: number; maxLetras: number }> = ({
  partes,
  destaques,
  y,
  fonte,
  maxLetras,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { tema } = useAmbiente();
  const t = frame / FPS;
  const marcadas = useMemo(() => new Set(destaques.map(normalizar)), [destaques]);

  // Linhas montadas por parte: nunca junta o fim de uma parte com o começo da outra.
  const linhas = useMemo(() => {
    const out: P[][] = [];
    for (const parte of partes) {
      let atual: P[] = [];
      let letras = 0;
      for (const w of parte.palavras) {
        const abs = { p: w.p, ini: parte.inicio + w.ini, fim: parte.inicio + w.fim };
        if (letras + w.p.length > maxLetras && atual.length) {
          out.push(atual);
          atual = [];
          letras = 0;
        }
        atual.push(abs);
        letras += w.p.length + 1;
      }
      if (atual.length) out.push(atual);
    }
    return out;
  }, [partes, maxLetras]);

  const linha = linhas.find((l) => t >= l[0].ini - 0.05 && t <= l[l.length - 1].fim + 0.25);
  if (!linha) return null;

  return (
    <div style={{ position: "absolute", top: y, left: 60, width: width - 120, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: pilha(tema.fonte_texto),
          fontSize: fonte,
          fontWeight: 600,
          lineHeight: 1.25,
          textAlign: "center",
          color: tema.texto,
          textShadow: "0 2px 12px #000c",
        }}
      >
        {linha.map((w, i) => {
          const falando = t >= w.ini && t < w.fim + 0.06;
          const dita = t >= w.ini;
          const destaque = marcadas.has(normalizar(w.p));
          return (
            <span
              key={i}
              style={{
                padding: "0 6px",
                margin: "0 1px",
                borderRadius: 8,
                background: falando ? `${tema.destaque}40` : "transparent",
                color: destaque ? tema.destaque : tema.texto,
                opacity: dita ? 1 : 0.45,
              }}
            >
              {w.p}
            </span>
          );
        })}
      </div>
    </div>
  );
};
