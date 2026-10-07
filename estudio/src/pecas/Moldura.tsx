import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { pilha } from "../fontes";
import { BARRA } from "../layout";
import { entra, FPS } from "../tempo";
import { useAmbiente } from "./contexto";

// Fundo vivo: manchas de luz que andam devagar (nunca é uma imagem parada).
export const Fundo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { tema } = useAmbiente();
  const t = frame / FPS;
  const a = { x: 0.2 + 0.08 * Math.sin(t / 5), y: 0.25 + 0.06 * Math.cos(t / 6) };
  const b = { x: 0.82 + 0.07 * Math.cos(t / 7), y: 0.78 + 0.05 * Math.sin(t / 4.5) };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at ${a.x * 100}% ${a.y * 100}%, ${tema.destaque2}33 0%, transparent 42%),
          radial-gradient(circle at ${b.x * 100}% ${b.y * 100}%, ${tema.destaque}22 0%, transparent 38%),
          linear-gradient(160deg, ${tema.fundo2} 0%, ${tema.fundo} 70%)`,
        width,
        height,
      }}
    />
  );
};

// A janela onde a cena acontece, com barra e o cabeçalho da aula.
export const Janela: React.FC<{ x: number; y: number; w: number; h: number; cabecalho: string; children: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  cabecalho,
  children,
}) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  const p = entra(frame, 0, FPS, true);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 22,
        background: tema.janela,
        boxShadow: `0 40px 120px #000a, 0 0 0 1px ${tema.destaque}26`,
        overflow: "hidden",
        opacity: p,
        transform: `scale(${0.96 + 0.04 * p})`,
      }}
    >
      <div
        style={{
          height: BARRA,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 20px",
          borderBottom: `1px solid ${tema.destaque}1f`,
          background: `${tema.fundo2}cc`,
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.85 }} />
        ))}
        <div
          style={{
            marginLeft: 14,
            fontFamily: pilha(tema.fonte_texto),
            fontSize: 17 * Math.max(esc, 0.9),
            color: tema.suave,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {cabecalho}
        </div>
      </div>
      <div style={{ position: "absolute", top: BARRA, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

// Etiqueta acima da janela: muda a cada parte.
export const Rotulo: React.FC<{ texto?: string; y: number }> = ({ texto, y }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { tema, esc } = useAmbiente();
  if (!texto) return null;
  const p = entra(frame, 0.05, FPS);
  return (
    <div style={{ position: "absolute", top: y, left: 0, width, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: pilha(tema.fonte_texto),
          fontSize: 24 * Math.max(esc, 1),
          fontWeight: 600,
          color: tema.fundo,
          background: tema.destaque,
          padding: "8px 22px",
          borderRadius: 999,
          opacity: Math.min(1, p * 1.4),
          transform: `translateY(${(1 - p) * -16}px) scale(${0.9 + 0.1 * p})`,
        }}
      >
        {texto}
      </div>
    </div>
  );
};

// Fichas que entram na palavra dita: o jeito mais simples de pôr algo novo na tela a cada poucos segundos.
export const Chips: React.FC<{ chips: { texto: string; t: number }[] }> = ({ chips }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  if (!chips.length) return null;
  return (
    <div style={{ position: "absolute", left: 56 * esc, right: 56 * esc, bottom: 40 * esc, display: "flex", gap: 14, flexWrap: "wrap" }}>
      {chips.map((c, i) => {
        const p = entra(frame, c.t, FPS);
        return (
          <div
            key={i}
            style={{
              fontFamily: pilha(tema.fonte_texto),
              fontSize: 30 * esc,
              fontWeight: 600,
              color: tema.texto,
              border: `1.5px solid ${tema.destaque}88`,
              background: `${tema.destaque}1f`,
              padding: "10px 22px",
              borderRadius: 999,
              opacity: Math.min(1, p * 1.5),
              transform: `scale(${0.6 + 0.4 * p})`,
            }}
          >
            {c.texto}
          </div>
        );
      })}
    </div>
  );
};
