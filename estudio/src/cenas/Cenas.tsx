import React from "react";
import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, Easing } from "remotion";
import { pilha } from "../fontes";
import { Chips } from "../pecas/Moldura";
import { Kicker, Titulo } from "../pecas/Titulo";
import { useAmbiente } from "../pecas/contexto";
import { agenda, entra, FPS, quando, sobe, texto } from "../tempo";
import type { Palavra, Tela, Zoom } from "../tipos";

// Os tempos de entrada abaixo são os mesmos que scripts/kit.py usa na conferência do ritmo.
// Mudou um, mude o outro (procure por "RITMO" nos dois arquivos).

type Props = { tela: Tela; palavras: Palavra[]; duracao: number };

const Palco: React.FC<{ children: React.ReactNode; centro?: boolean }> = ({ children, centro }) => {
  const { esc, formato } = useAmbiente();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: `${(formato === "v" ? 70 : 64) * esc}px ${(formato === "v" ? 56 : 84) * esc}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: centro ? "center" : "flex-start",
      }}
    >
      {children}
    </div>
  );
};

const Linha: React.FC<{ t: number; n?: number; children: React.ReactNode }> = ({ t, n, children }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  const p = entra(frame, t, FPS);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 * esc, ...sobe(p, 30) }}>
      <div
        style={{
          minWidth: 56 * esc,
          height: 56 * esc,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 35% 30%, ${tema.destaque}44, ${tema.destaque}14)`,
          border: `1.5px solid ${tema.destaque}`,
          boxShadow: `0 0 ${24 * p}px ${tema.destaque}55`,
          color: tema.destaque,
          fontFamily: pilha(tema.fonte_texto),
          fontWeight: 700,
          fontSize: 26 * esc,
          transform: `scale(${0.5 + 0.5 * p})`,
        }}
      >
        {n ?? "•"}
      </div>
      <div style={{ fontFamily: pilha(tema.fonte_texto), fontSize: 48 * esc, fontWeight: 500, color: tema.texto, lineHeight: 1.2 }}>
        {children}
      </div>
    </div>
  );
};

const Sub: React.FC<{ texto?: string; t: number; tamanho?: number }> = ({ texto: s, t, tamanho = 42 }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  if (!s) return null;
  const p = entra(frame, t, FPS);
  return (
    <div
      style={{
        marginTop: 34 * esc,
        fontFamily: pilha(tema.fonte_texto),
        fontSize: tamanho * esc,
        color: tema.suave,
        lineHeight: 1.35,
        maxWidth: 1150 * esc,
        ...sobe(p, 20),
      }}
    >
      {s}
    </div>
  );
};

const chipsDe = (tela: Tela, palavras: Palavra[]) =>
  (tela.chips || []).map((c) => ({ texto: c.texto, t: quando(palavras, c.quando) ?? 0 }));

// ── capa ─────────────────────────────────────────────── RITMO: kicker 0 · título 0,15 · sub 1,2
// Luz suave que passeia atrás do texto (Capa e Frase): profundidade, não informação nova.
const Luz: React.FC<{ x?: number; y?: number }> = ({ x = 0.72, y = 0.4 }) => {
  const frame = useCurrentFrame();
  const { tema } = useAmbiente();
  const t = frame / FPS;
  return (
    <div
      style={{
        position: "absolute",
        left: `${(x + 0.05 * Math.sin(t / 3)) * 100}%`,
        top: `${(y + 0.05 * Math.cos(t / 4)) * 100}%`,
        width: 760,
        height: 760,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${tema.destaque}2a 0%, ${tema.destaque2}12 38%, transparent 68%)`,
        filter: "blur(10px)",
        pointerEvents: "none",
      }}
    />
  );
};

const Capa: React.FC<Props> = ({ tela, palavras }) => {
  if (tela.tipo !== "capa") return null;
  return (
    <Palco centro>
      <Luz />
      <Kicker texto={tela.kicker} />
      <Titulo texto={tela.titulo} tamanho={120} />
      <Sub texto={tela.sub} t={1.2} />
      <Chips chips={chipsDe(tela, palavras)} />
    </Palco>
  );
};

// ── lista ────────────────────────────────────────────── RITMO: kicker 0 · título 0,15 · itens agenda(1,0 → 78%)
const Lista: React.FC<Props> = ({ tela, palavras, duracao }) => {
  const { esc } = useAmbiente();
  if (tela.tipo !== "lista") return null;
  const ts = agenda(tela.itens, palavras, duracao);
  return (
    <Palco>
      <Kicker texto={tela.kicker} />
      <Titulo texto={tela.titulo} tamanho={88} />
      <div style={{ display: "flex", flexDirection: "column", gap: 30 * esc, marginTop: 50 * esc }}>
        {tela.itens.map((it, i) => (
          <Linha key={i} t={ts[i]} n={i + 1}>
            {texto(it)}
          </Linha>
        ))}
      </div>
      <Chips chips={chipsDe(tela, palavras)} />
    </Palco>
  );
};

// ── colunas ──────────────────────────────────────────── RITMO: título 0,15 · esq 0,6 + itens(1,0 → 45%) · dir 50% + itens(50%+0,4 → 85%)
const Colunas: React.FC<Props> = ({ tela, palavras, duracao }) => {
  const frame = useCurrentFrame();
  const { tema, esc, formato } = useAmbiente();
  if (tela.tipo !== "colunas") return null;
  const metade = duracao * 0.5;
  const tsE = agenda(tela.esquerda.itens, palavras, duracao, 1.0, 0.45);
  const tsD = agenda(tela.direita.itens, palavras, duracao, metade + 0.4, 0.85);
  const coluna = (c: typeof tela.esquerda, t0: number, ts: number[], forte: boolean) => {
    const p = entra(frame, t0, FPS);
    return (
      <div
        style={{
          flex: 1,
          borderRadius: 18,
          padding: 30 * esc,
          background: forte ? `linear-gradient(160deg, ${tema.destaque}24, ${tema.destaque}0a)` : `linear-gradient(160deg, ${tema.texto}0f, ${tema.texto}05)`,
          boxShadow: forte ? `0 0 60px ${tema.destaque}1c` : "none",
          border: `1.5px solid ${forte ? tema.destaque : tema.suave}55`,
          ...sobe(p, 30),
        }}
      >
        <div style={{ fontFamily: pilha(tema.fonte_titulo), fontSize: 60 * esc, color: forte ? tema.destaque : tema.texto, marginBottom: 22 * esc }}>
          {c.titulo}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 * esc }}>
          {c.itens.map((it, i) => {
            const q = entra(frame, ts[i], FPS);
            return (
              <div key={i} style={{ fontFamily: pilha(tema.fonte_texto), fontSize: 42 * esc, color: tema.texto, ...sobe(q, 18) }}>
                {texto(it)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <Palco>
      {tela.titulo ? <Titulo texto={tela.titulo} tamanho={70} /> : null}
      <div style={{ display: "flex", flexDirection: formato === "v" ? "column" : "row", gap: 30 * esc, marginTop: 38 * esc, flex: 1 }}>
        {coluna(tela.esquerda, 0.6, tsE, false)}
        {coluna(tela.direita, metade, tsD, true)}
      </div>
      <Chips chips={chipsDe(tela, palavras)} />
    </Palco>
  );
};

// ── fluxo ────────────────────────────────────────────── RITMO: kicker 0 · título 0,15 · passos agenda(1,0 → 80%) · nota 85%
const Fluxo: React.FC<Props> = ({ tela, palavras, duracao }) => {
  const frame = useCurrentFrame();
  const { tema, esc, formato } = useAmbiente();
  if (tela.tipo !== "fluxo") return null;
  const ts = agenda(tela.passos, palavras, duracao, 1.0, 0.8);
  const vertical = formato === "v";
  return (
    <Palco>
      <Kicker texto={tela.kicker} />
      <Titulo texto={tela.titulo} tamanho={74} />
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "stretch", gap: 18 * esc, marginTop: 56 * esc }}>
        {tela.passos.map((it, i) => {
          const p = entra(frame, ts[i], FPS);
          const seta = i < tela.passos.length - 1;
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: `${26 * esc}px ${22 * esc}px`,
                  background: `linear-gradient(160deg, ${tema.destaque}22, ${tema.destaque}08)`,
                  border: `1.5px solid ${tema.destaque}66`,
                  boxShadow: `0 18px 40px #0004, inset 0 1px 0 ${tema.texto}14`,
                  ...sobe(p, 24),
                }}
              >
                <div style={{ fontFamily: pilha(tema.fonte_texto), fontSize: 24 * esc, color: tema.destaque, fontWeight: 700, marginBottom: 10 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontFamily: pilha(tema.fonte_texto), fontSize: 38 * esc, color: tema.texto, fontWeight: 600, lineHeight: 1.2 }}>
                  {texto(it)}
                </div>
              </div>
              {seta ? (
                <div
                  style={{
                    alignSelf: "center",
                    color: tema.destaque,
                    fontSize: 40 * esc,
                    opacity: interpolate(frame, [ts[i] * FPS, ts[i] * FPS + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  }}
                >
                  {vertical ? "↓" : "→"}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <Sub texto={tela.nota} t={duracao * 0.85} tamanho={34} />
      <Chips chips={chipsDe(tela, palavras)} />
    </Palco>
  );
};

// ── frase ────────────────────────────────────────────── RITMO: kicker 0 · título 0,15 · sub max(1,6; 50%)
const Frase: React.FC<Props> = ({ tela, palavras, duracao }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  if (tela.tipo !== "frase") return null;
  const p = entra(frame, 0.05, FPS);
  return (
    <Palco centro>
      <Luz x={0.25} y={0.35} />
      <div
        style={{
          position: "absolute",
          left: 40 * esc,
          top: -40 * esc,
          fontFamily: pilha(tema.fonte_titulo),
          fontSize: 420 * esc,
          lineHeight: 1,
          color: tema.destaque,
          opacity: 0.12 * Math.min(1, p * 1.4),
          transform: `translateY(${(1 - p) * 40}px)`,
          pointerEvents: "none",
        }}
      >
        “
      </div>
      <Kicker texto={tela.kicker} />
      <Titulo texto={tela.titulo} tamanho={96} />
      <Sub texto={tela.sub} t={Math.max(1.6, duracao * 0.5)} />
      <Chips chips={chipsDe(tela, palavras)} />
    </Palco>
  );
};

// ── numero ───────────────────────────────────────────── RITMO: kicker 0 · número conta de 0,4 até 0,4+min(2,5; 40%) · legenda +0,3
const Numero: React.FC<Props> = ({ tela, palavras, duracao }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  if (tela.tipo !== "numero") return null;
  const fim = 0.4 + Math.min(2.5, duracao * 0.4);
  const alvo = parseFloat(tela.para.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  const origem = tela.de ? parseFloat(tela.de.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) : 0;
  const prefixo = tela.para.match(/^[^0-9-]*/)?.[0] ?? "";
  const sufixo = tela.para.match(/[^0-9.,]*$/)?.[0] ?? "";
  const casas = (tela.para.split(",")[1] || "").replace(/[^0-9]/g, "").length;
  const v = interpolate(frame, [0.4 * FPS, fim * FPS], [origem, alvo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const mostrado = isNaN(alvo) ? tela.para : `${prefixo}${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${sufixo}`;
  const p = entra(frame, 0.4, FPS);
  return (
    <Palco centro>
      <Kicker texto={tela.kicker} />
      <div style={{ fontFamily: pilha(tema.fonte_titulo), fontSize: 220 * esc, lineHeight: 1, color: tema.destaque, transform: `scale(${0.7 + 0.3 * p})`, transformOrigin: "left center", textShadow: `0 0 60px ${tema.destaque}55, 0 20px 50px #0006` }}>
        {mostrado}
      </div>
      <Sub texto={tela.legenda} t={fim + 0.3} tamanho={48} />
      <Chips chips={chipsDe(tela, palavras)} />
    </Palco>
  );
};

// ── video / imagem ───────────────────────────────────── a câmera só mexe no que está dentro da janela
function camera(frame: number, zooms: Zoom[] | undefined, palavras: Palavra[], duracao: number) {
  // Cada zoom leva a câmera até o foco (em ~0,8 s) e a traz de volta no "ate" (ou no fim da parte).
  let escala = 1;
  let cx = 0.5;
  let cy = 0.5;
  let luz: { x0: number; y0: number; x1: number; y1: number; k: number } | null = null;
  for (const z of zooms || []) {
    const t0 = (quando(palavras, z.quando) ?? 0) * FPS;
    const t1 = (quando(palavras, z.ate) ?? duracao) * FPS;
    const ida = interpolate(frame, [t0, t0 + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    const volta = interpolate(frame, [t1 - 18, t1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    const k = Math.min(ida, volta);
    if (k <= 0) continue;
    const [x0, y0, x1, y1] = z.foco;
    // escala que faz o foco caber inteiro, com folga de 10%
    const alvo = Math.min(1 / ((x1 - x0) * 1.1), 1 / ((y1 - y0) * 1.1), 3);
    escala = 1 + (alvo - 1) * k;
    cx = 0.5 + ((x0 + x1) / 2 - 0.5) * k;
    cy = 0.5 + ((y0 + y1) / 2 - 0.5) * k;
    // Holofote: onde o foco foi parar na tela depois do zoom. O resto escurece, para nada ficar
    // "pela metade" chamando atenção na borda (ou está inteiro na luz, ou fica no escuro).
    const m = (v: number, o: number) => o + (v - o) * escala;
    luz = { x0: m(x0, cx), y0: m(y0, cy), x1: m(x1, cx), y1: m(y1, cy), k };
  }
  return { estilo: { transform: `scale(${escala})`, transformOrigin: `${cx * 100}% ${cy * 100}%` }, luz };
}

const Midia: React.FC<Props> = ({ tela, palavras, duracao }) => {
  const frame = useCurrentFrame();
  const { tema, esc } = useAmbiente();
  if (tela.tipo !== "video" && tela.tipo !== "imagem") return null;
  const cam = camera(frame, tela.zooms, palavras, duracao);
  const src = staticFile(tela.arquivo);
  const p = entra(frame, 0.3, FPS);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <div style={{ position: "absolute", inset: 0, ...cam.estilo }}>
        {tela.tipo === "video" ? (
          <OffthreadVideo
            src={src}
            muted
            startFrom={Math.round((tela.de || 0) * FPS)}
            playbackRate={tela.velocidade || 1}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
      </div>
      {cam.luz ? (
        <div
          style={{
            position: "absolute",
            left: `${cam.luz.x0 * 100}%`,
            top: `${cam.luz.y0 * 100}%`,
            width: `${(cam.luz.x1 - cam.luz.x0) * 100}%`,
            height: `${(cam.luz.y1 - cam.luz.y0) * 100}%`,
            borderRadius: 14,
            boxShadow: `0 0 0 4000px rgba(0,0,0,${0.5 * cam.luz.k}), 0 0 0 2px ${tema.destaque}${Math.round(cam.luz.k * 200).toString(16).padStart(2, "0")}`,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {tela.legenda ? (
        <div
          style={{
            position: "absolute",
            left: 28 * esc,
            bottom: 26 * esc,
            fontFamily: pilha(tema.fonte_texto),
            fontSize: 26 * esc,
            fontWeight: 600,
            color: tema.fundo,
            background: tema.destaque,
            padding: "8px 18px",
            borderRadius: 999,
            ...sobe(p, 12),
          }}
        >
          {tela.legenda}
        </div>
      ) : null}
      <Chips chips={chipsDe(tela, palavras)} />
    </div>
  );
};

// ── animada ───────────────────────────────────────────── a cena fotografada (cenas/), do tamanho da área da janela
const Animada: React.FC<Props> = ({ tela, palavras }) => {
  const { formato } = useAmbiente();
  if (tela.tipo !== "animada" || !tela.clipes) return null;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <OffthreadVideo src={staticFile(tela.clipes[formato])} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Chips chips={chipsDe(tela, palavras)} />
    </div>
  );
};

export const Cena: React.FC<Props> = (props) => {
  switch (props.tela.tipo) {
    case "capa":
      return <Capa {...props} />;
    case "lista":
      return <Lista {...props} />;
    case "colunas":
      return <Colunas {...props} />;
    case "fluxo":
      return <Fluxo {...props} />;
    case "frase":
      return <Frase {...props} />;
    case "numero":
      return <Numero {...props} />;
    case "video":
    case "imagem":
      return <Midia {...props} />;
    case "animada":
      return <Animada {...props} />;
  }
};
