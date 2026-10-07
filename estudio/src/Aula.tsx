import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "./fontes";
import { pilha } from "./fontes";
import { Cena } from "./cenas/Cenas";
import { LAYOUT, type Formato } from "./layout";
import { Ctx } from "./pecas/contexto";
import { Legenda } from "./pecas/Legenda";
import { Fundo, Janela, Rotulo } from "./pecas/Moldura";
import { entra, FPS } from "./tempo";
import type { Plano } from "./tipos";

const Encerramento: React.FC<{ plano: Plano }> = ({ plano }) => {
  const frame = useCurrentFrame();
  const { tema } = plano;
  const p = (t: number) => entra(frame, t, FPS);
  const linha = (t: number, filhos: React.ReactNode, estilo: React.CSSProperties) => (
    <div style={{ opacity: Math.min(1, p(t) * 1.4), transform: `translateY(${(1 - p(t)) * 24}px)`, ...estilo }}>{filhos}</div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 22 }}>
      {linha(0.1, plano.convite.titulo, { fontFamily: pilha(tema.fonte_titulo), fontSize: 96, color: tema.texto })}
      {linha(0.5, plano.convite.texto, { fontFamily: pilha(tema.fonte_texto), fontSize: 40, color: tema.suave })}
      {linha(0.9, plano.convite.endereco, {
        fontFamily: pilha(tema.fonte_texto),
        fontSize: 54,
        fontWeight: 700,
        color: tema.fundo,
        background: tema.destaque,
        padding: "12px 34px",
        borderRadius: 999,
      })}
      {linha(1.3, plano.tema.marca, { fontFamily: pilha(tema.fonte_texto), fontSize: 26, color: tema.suave, marginTop: 30, letterSpacing: "0.12em", textTransform: "uppercase" })}
    </AbsoluteFill>
  );
};

export const Aula: React.FC<{ plano: Plano; formato: Formato }> = ({ plano, formato }) => {
  const { durationInFrames } = useVideoConfig();
  const L = LAYOUT[formato];
  const { janela } = L;
  const ambiente = { tema: plano.tema, formato, esc: L.escala, areaW: janela.w, areaH: janela.h };
  const fimFala = Math.round((plano.total - plano.encerramento) * FPS);
  const trilhaVolume = (f: number) =>
    interpolate(f, [0, 30, durationInFrames - 45, durationInFrames], [0, plano.trilha.volume, plano.trilha.volume, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <Ctx.Provider value={ambiente}>
      <AbsoluteFill style={{ backgroundColor: plano.tema.fundo }}>
        <Fundo />
        {plano.partes.map((parte, i) => {
          const de = Math.round(parte.inicio * FPS);
          const proxima = plano.partes[i + 1];
          const ate = proxima ? Math.round(proxima.inicio * FPS) : fimFala;
          return (
            <Sequence key={i} from={de} durationInFrames={Math.max(1, ate - de)} name={`parte ${i + 1}`}>
              <Rotulo texto={parte.rotulo} y={L.rotuloY} />
              <Janela {...janela} cabecalho={plano.cabecalho}>
                <Cena tela={parte.tela} palavras={parte.palavras} duracao={parte.duracao} />
              </Janela>
              <Audio src={staticFile(parte.audio)} />
            </Sequence>
          );
        })}
        <Legenda
          partes={plano.partes}
          destaques={plano.destaques}
          y={L.legendaY}
          fonte={L.legendaFonte}
          maxLetras={formato === "v" ? 26 : 44}
        />
        <Sequence from={fimFala} name="encerramento">
          <Encerramento plano={plano} />
        </Sequence>
        {plano.trilha.arquivo ? <Audio src={staticFile(plano.trilha.arquivo)} volume={trilhaVolume} loop /> : null}
      </AbsoluteFill>
    </Ctx.Provider>
  );
};
