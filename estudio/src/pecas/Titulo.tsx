import React from "react";
import { useCurrentFrame } from "remotion";
import { entra, FPS } from "../tempo";
import { pilha } from "../fontes";
import { useAmbiente } from "./contexto";

// Título com o trecho entre *asteriscos* em destaque. Entra palavra a palavra a partir de `aPartir`.
export const Titulo: React.FC<{ texto: string; tamanho: number; aPartir?: number; alinhar?: "left" | "center" }> = ({
  texto,
  tamanho,
  aPartir = 0.15,
  alinhar = "left",
}) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  const pedacos = texto.split("*");
  let i = 0;
  return (
    <div
      style={{
        fontFamily: pilha(tema.fonte_titulo),
        fontSize: tamanho * esc,
        lineHeight: 1.05,
        color: tema.texto,
        textAlign: alinhar,
        letterSpacing: "-0.01em",
      }}
    >
      {pedacos.map((pedaco, k) =>
        pedaco
          .split(/(\s+)/)
          .filter((w) => w.length)
          .map((w, j) => {
            if (/^\s+$/.test(w)) return <span key={`${k}-${j}`}>{w}</span>;
            const p = entra(frame, aPartir + i++ * 0.07, FPS);
            const destaque = k % 2 === 1;
            return (
              <span
                key={`${k}-${j}`}
                style={{
                  display: "inline-block",
                  opacity: Math.min(1, p * 1.3),
                  transform: `translateY(${(1 - p) * 0.35 * tamanho * esc}px)`,
                  color: destaque ? tema.destaque : tema.texto,
                  fontStyle: destaque ? "italic" : "normal",
                }}
              >
                {w}
              </span>
            );
          }),
      )}
    </div>
  );
};

export const Kicker: React.FC<{ texto?: string; aPartir?: number }> = ({ texto, aPartir = 0 }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  if (!texto) return null;
  const p = entra(frame, aPartir, FPS);
  return (
    <div
      style={{
        fontFamily: pilha(tema.fonte_texto),
        fontSize: 22 * esc,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: tema.destaque,
        opacity: Math.min(1, p * 1.5),
        transform: `translateX(${(1 - p) * -24}px)`,
        marginBottom: 18 * esc,
      }}
    >
      {texto}
    </div>
  );
};
