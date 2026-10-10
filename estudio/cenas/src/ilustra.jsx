// Peças das cenas animadas: tudo com motion, no tempo da cena (a captura controla o relógio da página).
// Convenção: `em` = segundo da cena em que a peça entra (vem do b("palavra") da narração).
//
// As cores e as fontes vêm do tema da marca (kit.config.json → tema), a cada captura. O tamanho da tela vem do formato:
// deitado (h) é 1280 x 610 e em pé (v) é 800 x 907, em pontos; a captura amplia para o tamanho real da janela do vídeo.
// Peças que usam o React Bits (Orbe, FundoVivo, Contador...) caem numa versão própria, só com motion, quando o
// componente não foi baixado nesta máquina (o instalador baixa; veja src/rb.js).
import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import * as L from "lucide-react";
import { RB } from "./rb.js";

// ───────────── tema, fontes e formato ─────────────

export const C = {
  verde: "#2ee59d", verde2: "#1fb57a", fundo: "#12161a", fundo2: "#171b20", branco: "#f1f4f2", texto: "#e3e7e5", cinza: "#9aa5a0",
  cinza2: "#7d8784", cinza3: "#525b58", card: "rgba(241,244,242,.055)", borda: "rgba(241,244,242,.11)", azul: "#60a5fa",
  violeta: "#a78bfa", verdeFundo: "rgba(46,229,157,.10)", escuro: true,
};
export const F = { titulo: "Inter", texto: "Inter", pesoTitulo: 800, italico: false };
export const TELA = { h: { w: 1280, h: 610 }, v: { w: 800, h: 907 } };
export const FormatoCtx = createContext("h");
export const useFormato = () => useContext(FormatoCtx);
export const EASE = [0.22, 0.8, 0.24, 1];

const rgb = (h) => {
  const x = String(h || "#000000").replace("#", "");
  const v = x.length === 3 ? x.split("").map((c) => c + c).join("") : x.padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
};
const hex = (r) => "#" + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export const alfa = (cor, a) => `rgba(${rgb(cor).join(",")},${a})`;
export const mistura = (a, b, k) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));
const luz = (cor) => { const [r, g, b] = rgb(cor); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// Cor de texto que se lê sobre `cor` (escuro sobre claro, claro sobre escuro).
export const sobre = (cor) => (luz(cor) > 0.6 ? "#0b0d10" : "#ffffff");

export function aplicarTema(tema, formato = "h") {
  const t = tema || {};
  const janela = t.janela || C.fundo, texto = t.texto || C.branco, suave = t.suave || C.cinza, destaque = t.destaque || C.verde;
  Object.assign(C, {
    verde: destaque, verde2: t.destaque2 || mistura(destaque, "#000000", 0.25), fundo: janela, fundo2: t.fundo2 || mistura(janela, texto, 0.05),
    branco: texto, texto: mistura(texto, janela, 0.08), cinza: suave, cinza2: mistura(suave, janela, 0.25), cinza3: mistura(suave, janela, 0.55),
    card: alfa(texto, 0.055), borda: alfa(texto, 0.11), verdeFundo: alfa(destaque, 0.1), escuro: luz(janela) < 0.5,
  });
  const T = TELA[formato] || TELA.h, raiz = document.documentElement.style;
  raiz.setProperty("--w", `${T.w}px`);
  raiz.setProperty("--h", `${T.h}px`);
  raiz.setProperty("--fundo", janela);
  document.documentElement.classList.toggle("dark", C.escuro);
}

// Fontes da marca pelo Google Fonts, com os pesos que existirem (fonte de um peso só, como a Instrument Serif, não
// derruba o pedido). Devolve quando estiverem prontas (ou em 8 s, sem internet a cena sai na fonte do sistema).
export async function carregarFontes(tema) {
  const t = tema || {};
  F.titulo = t.fonte_titulo || "Inter";
  F.texto = t.fonte_texto || "Inter";
  const css = async (nome, opcoes) => {
    for (const o of opcoes) {
      try {
        const r = await fetch(`https://fonts.googleapis.com/css2?family=${nome.trim().replace(/ +/g, "+")}${o}&display=block`);
        if (r.ok) return await r.text();
      } catch (_) { /* sem internet */ }
    }
    return "";
  };
  const trabalho = (async () => {
    const [cssTitulo, cssTexto] = await Promise.all([
      css(F.titulo, [":ital,wght@0,400;0,700;0,800;1,400;1,700", ":ital,wght@0,400;1,400", ":wght@400;700;800", ":wght@400;700", ""]),
      F.texto === F.titulo ? Promise.resolve("") : css(F.texto, [":wght@400;500;600;700;800", ":wght@400;700", ""]),
    ]);
    const pesos = [...cssTitulo.matchAll(/font-weight:\s*(\d+)/g)].map((m) => +m[1]);
    F.pesoTitulo = [800, 700, 400].find((p) => pesos.includes(p)) || 400;
    F.italico = /font-style:\s*italic/.test(cssTitulo);
    const st = document.createElement("style");
    st.textContent = cssTitulo + cssTexto;
    document.head.appendChild(st);
    await Promise.all([
      ...[400, F.pesoTitulo].map((p) => document.fonts.load(`${p} 40px "${F.titulo}"`)),
      ...[400, 500, 700, 800].map((p) => document.fonts.load(`${p} 40px "${F.texto}"`)),
      ...(F.italico ? [document.fonts.load(`italic 400 40px "${F.titulo}"`)] : []),
    ]);
  })();
  return Promise.race([trabalho, new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
}

// Fonte dos títulos (ft) e do texto (fx): "peso tamanho/altura família". Fonte de título de um peso só (as serifadas de
// display, como a Instrument Serif) desenha menor: ganha 28% no tamanho para pesar o mesmo na tela.
export const escalaTitulo = () => (F.pesoTitulo === 400 ? 1.28 : 1);
export const ft = (px, peso = F.pesoTitulo, lh = 1.06) => `${peso} ${Math.round(px * escalaTitulo())}px/${lh} "${F.titulo}", system-ui, sans-serif`;
export const fx = (px, peso = 400, lh = 1.35) => `${peso} ${px}px/${lh} "${F.texto}", system-ui, sans-serif`;

export const Icone = ({ nome, size = 24, color, strokeWidth = 2, style }) => {
  const I = L[nome] || L.Circle;
  return <I size={size} color={color || C.texto} strokeWidth={strokeWidth} style={style} />;
};

// número "aleatório" que sai igual em toda captura
export const sorte = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

// ───────────── tempo ─────────────

// Monta os filhos só entre `em` e `ate` (segundos da cena). Com `reserva`, guarda o espaço antes de montar.
export function Depois({ em = 0, ate, reserva, children }) {
  const [on, setOn] = useState(em <= 0);
  const [off, setOff] = useState(false);
  useEffect(() => {
    const a = em > 0 ? setTimeout(() => setOn(true), em * 1000) : null;
    const z = ate ? setTimeout(() => setOff(true), ate * 1000) : null;
    return () => { clearTimeout(a); clearTimeout(z); };
  }, []);
  if (!on && reserva) return <span style={{ visibility: "hidden" }}>{reserva}</span>;
  return <AnimatePresence>{on && !off ? children : null}</AnimatePresence>;
}

// Quantos dos `tempos` (segundos da cena) já passaram: para listas que crescem no ritmo da fala.
export function useMarcos(tempos) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const ts = tempos.map((t, i) => setTimeout(() => setN((v) => Math.max(v, i + 1)), Math.max(0, t) * 1000));
    return () => ts.forEach(clearTimeout);
  }, []);
  return n;
}

const DESLOC = { baixo: { y: 26 }, cima: { y: -26 }, esq: { x: -36 }, dir: { x: 36 }, zoom: { scale: 0.55 }, nada: {} };
// Entra no segundo `em`, deslizando de `de`. `mola` = entrada com mola (para ícones e selos).
export function Surge({ em = 0, de = "baixo", dur = 0.6, mola, style, className, children, sai }) {
  const t = mola ? { delay: em, type: "spring", stiffness: 260, damping: 16 } : { delay: em, duration: dur, ease: EASE };
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, ...DESLOC[de] }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.35 } }} transition={t}>
      {sai !== undefined ? <motion.div animate={{ opacity: [1, 1, 0] }} transition={{ duration: sai, times: [0, 0.9, 1] }}>{children}</motion.div> : children}
    </motion.div>
  );
}

// ───────────── texto ─────────────

export function Kicker({ texto, em = 0.1 }) {
  return (
    <Surge em={em} de="esq" style={{ alignSelf: "flex-start", display: "table", font: fx(16, 800, 1.2), letterSpacing: ".1em", textTransform: "uppercase",
      color: sobre(C.verde), background: C.verde, padding: "6px 13px", borderRadius: 9, marginBottom: 16 }}>
      {texto}
    </Surge>
  );
}

const pedacos = (texto) => {
  const palavras = [];
  texto.split(/(\*[^*]+\*)/).filter(Boolean).forEach((p) => {
    const verde = p.startsWith("*");
    (verde ? p.slice(1, -1) : p).trim().split(/\s+/).filter(Boolean).forEach((w) => {
      if (/^[,.;:!?]+$/.test(w) && palavras.length) palavras[palavras.length - 1].w += w;
      else palavras.push({ w, verde });
    });
  });
  return palavras;
};

// Título com a palavra *entre asteriscos* no destaque: entra palavra a palavra, desfocando para nítido.
export function Titulo({ texto, em = 0.3, size = 54, style }) {
  return (
    <h1 style={{ margin: 0, font: ft(size), letterSpacing: "-.015em", color: C.branco, ...style }}>
      {pedacos(texto).map((x, i) => (
        <motion.span key={i} style={{ display: "inline-block", marginRight: "0.24em", color: x.verde ? C.verde : C.branco, fontStyle: x.verde && F.italico ? "italic" : "normal" }}
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: em + i * 0.07, duration: 0.6, ease: EASE }}>{x.w}</motion.span>
      ))}
    </h1>
  );
}

// Mesmo título, com o texto animado do React Bits quando ele estiver baixado (o StaggeredText do Pro ou o BlurText grátis).
export function TituloRB({ texto, em = 0.3, size = 54, style }) {
  const Pro = RB["staggered-text"], Blur = RB.BlurText;
  if (!Pro && !Blur) return <Titulo texto={texto} em={em} size={size} style={style} />;
  const partes = texto.split(/(\*[^*]+\*)/).filter(Boolean);
  let atraso = em;
  return (
    <h1 style={{ margin: 0, font: ft(size), letterSpacing: "-.015em", color: C.branco, ...style }}>
      {partes.map((p, k) => {
        const verde = p.startsWith("*"), t = (verde ? p.slice(1, -1) : p).trim(), inicio = atraso;
        atraso += t.split(/\s+/).length * 0.07;
        const cor = { color: verde ? C.verde : C.branco, fontStyle: verde && F.italico ? "italic" : "normal" };
        return (
          <span key={k} style={{ ...cor, display: "inline" }}>
            <Depois em={inicio} reserva={t}>
              {Pro ? <Pro key="t" as="span" text={t} segmentBy="words" delay={70} duration={0.6} direction="bottom" blur />
                : <Blur key="t" text={t} delay={70} animateBy="words" direction="bottom" className="inline-flex flex-wrap" />}
            </Depois>
            {k < partes.length - 1 ? " " : ""}
          </span>
        );
      })}
      <style>{`h1 .staggered-text, h1 p{display:inline-flex !important;flex-wrap:wrap;margin:0}`}</style>
    </h1>
  );
}

// Texto de apoio que entra palavra a palavra.
export function Texto({ children, em = 0, size = 24, cor, style }) {
  const st = { font: fx(size, 400, 1.35), color: cor || C.cinza, margin: 0, ...style };
  if (typeof children !== "string") return <Surge em={em} style={st}>{children}</Surge>;
  return (
    <p style={st}>
      {children.split(/\s+/).map((w, i) => (
        <motion.span key={i} style={{ display: "inline-block", marginRight: "0.28em" }} initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: em + i * 0.045, duration: 0.5, ease: EASE }}>{w}</motion.span>
      ))}
    </p>
  );
}

// Texto que aparece letra a letra (resposta "escrevendo").
export function Escreve({ texto, em = 0, dur = 1.2 }) {
  return (
    <span>{texto.split("").map((ch, i) => (
      <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: em + (i / texto.length) * dur, duration: 0.01 }}>{ch}</motion.span>
    ))}</span>
  );
}

// Digitando de verdade, com cursor: o TextType do React Bits quando baixado; senão, o Escreve com cursor.
export function Digita({ texto, em = 0, velocidade = 38, style }) {
  const TT = RB.TextType;
  return (
    <span style={{ font: fx(26, 500), color: C.branco, ...style }}>
      <Depois em={em} reserva={texto}>
        {TT ? <TT key="tt" as="span" text={texto} typingSpeed={velocidade} loop={false} showCursor cursorCharacter="▍" startOnVisible={false} />
          : <span key="es"><Escreve texto={texto} dur={(texto.length * velocidade) / 1000} /><motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>▍</motion.span></span>}
      </Depois>
    </span>
  );
}

// Brilho que passa pelo texto (ShinyText do React Bits; senão, um degradê que corre).
export function TextoBrilho({ texto, em = 0, size = 30, peso = 700, style }) {
  const Shiny = RB.ShinyText;
  const st = { font: fx(size, peso, 1.2), ...style };
  return (
    <Surge em={em} style={st}>
      {Shiny ? <Shiny text={texto} color={C.cinza} shineColor={C.branco} speed={2.2} />
        : <motion.span style={{ backgroundImage: `linear-gradient(110deg, ${C.cinza} 35%, ${C.branco} 50%, ${C.cinza} 65%)`, backgroundSize: "250% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          animate={{ backgroundPosition: ["120% 0%", "-20% 0%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}>{texto}</motion.span>}
    </Surge>
  );
}

// Texto em degradê que anda (GradientText do React Bits; senão, degradê nas cores da marca, andando).
export function TextoGradiente({ texto, em = 0, size = 64, style }) {
  const G = RB.GradientText;
  const cores = [C.verde, C.verde2, C.branco, C.verde];
  const st = { font: ft(size), ...style };
  return (
    <Surge em={em} de="zoom" style={st}>
      {G ? <G colors={cores} animationSpeed={4}>{texto}</G>
        : <motion.span style={{ backgroundImage: `linear-gradient(90deg, ${cores.join(", ")})`, backgroundSize: "300% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%"] }} transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "linear" }}>{texto}</motion.span>}
    </Surge>
  );
}

// Palavras que se revezam no mesmo lugar (RotatingText do React Bits; senão, a Placa).
export function Gira({ textos, em = 0, intervalo = 1.2, size = 40, style }) {
  const R = RB.RotatingText;
  if (!R) return <Placa valores={textos} em={em} passo={intervalo} size={size} cor={C.verde} style={style} />;
  return (
    <Surge em={em} style={{ font: ft(size), color: sobre(C.verde), ...style }}>
      <R texts={textos} rotationInterval={intervalo * 1000} loop={false} staggerDuration={0.025} staggerFrom="last"
        mainClassName="inline-flex overflow-hidden rounded-xl px-4 py-1" splitLevelClassName="overflow-hidden"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "-120%" }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
        style={{ background: C.verde }} />
    </Surge>
  );
}

// Número que conta até o valor (CountUp do React Bits; senão, a mesma contagem com motion).
export function Contador({ de = 0, para, em = 0, dur = 1.6, prefixo = "", sufixo = "", size = 120, cor, separador = ".", style }) {
  const CU = RB.CountUp;
  const st = { font: ft(size, F.pesoTitulo, 1), color: cor || C.verde, letterSpacing: "-.03em", textShadow: `0 16px 50px ${alfa(cor || C.verde, 0.25)}`, ...style };
  return (
    <Surge em={em} de="zoom" style={st}>
      {prefixo}
      {CU ? <CU from={de} to={para} duration={dur} separator={separador} /> : <ContaSozinho de={de} para={para} dur={dur} separador={separador} />}
      {sufixo}
    </Surge>
  );
}
function ContaSozinho({ de, para, dur, separador }) {
  const v = useMotionValue(de);
  const txt = useTransform(v, (x) => Math.round(x).toLocaleString("pt-BR").replace(/\./g, separador));
  useEffect(() => { const c = animate(v, para, { duration: dur, ease: [0.16, 1, 0.3, 1] }); return () => c.stop(); }, []);
  return <motion.span>{txt}</motion.span>;
}

// Palavras que trocam com rastro de velocidade (SpeedingText do React Bits Pro; senão, o Gira).
export function TextoVeloz({ palavras, em = 0, intervalo = 0.6, size = 36, style }) {
  const S = RB["speeding-text"];
  if (!S) return <Gira textos={palavras} em={em} intervalo={intervalo} size={size} style={style} />;
  return (
    <Surge em={em} style={style}>
      <S words={palavras} interval={intervalo * 1000} swapDuration={200} travel={70} fontSize={size} fontWeight={800} italic={false} textColor={C.verde} align="left" startOnView={false} />
    </Surge>
  );
}

// ───────────── caixas, balões e peças ─────────────

export function Cartao({ children, style, brilho, em, de = "baixo" }) {
  const box = { background: brilho ? C.verdeFundo : C.card, border: `1px solid ${brilho ? alfa(C.verde, 0.5) : C.borda}`, borderRadius: 20, padding: 20,
    boxShadow: C.escuro ? "0 20px 50px rgba(0,0,0,.25)" : "0 18px 40px rgba(0,0,0,.08)", ...style };
  if (em === undefined) return <div style={box}>{children}</div>;
  return <Surge em={em} de={de} style={box}>{children}</Surge>;
}

export function Pilula({ icone, texto, em = 0, cor, fundo, style }) {
  const c = cor || C.verde;
  return (
    <Surge em={em} mola style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: fundo || alfa(c, 0.12),
      border: `1px solid ${alfa(c, 0.35)}`, font: fx(19, 700, 1.1), color: c, whiteSpace: "nowrap", ...style }}>
      {icone && <Icone nome={icone} size={21} color={c} />}{texto}
    </Surge>
  );
}

// Avatar de especialista: círculo com ícone, anel que pulsa quando está trabalhando.
export function Agente({ icone, rotulo, cor, em = 0, size = 74, ativo, style }) {
  const c = cor || C.verde;
  return (
    <Surge em={em} mola style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, ...style }}>
      <div style={{ position: "relative", width: size, height: size }}>
        {ativo && <motion.div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${c}` }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 1.6, repeat: Infinity, delay: em }} />}
        <div style={{ width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${alfa(c, 0.33)}, ${alfa(c, 0.09)} 60%, ${C.card})`,
          border: `2px solid ${alfa(c, 0.66)}`, display: "grid", placeItems: "center" }}>
          <Icone nome={icone} size={size * 0.46} color={C.branco} />
        </div>
      </div>
      {rotulo && <div style={{ font: fx(17, 700, 1.2), color: C.texto, whiteSpace: "nowrap" }}>{rotulo}</div>}
    </Surge>
  );
}

// Folha de documento com linhas que se escrevem uma a uma. `marcas` = índices das linhas destacadas.
export function Documento({ em = 0, largura = 230, linhas = 9, titulo, marcas = [], corMarca, escreve = 0.09, icone = "FileText", style, rodape }) {
  return (
    <Surge em={em} de="baixo" style={{ width: largura, background: "#f6f7f8", borderRadius: 14, padding: "18px 18px 20px", boxShadow: "0 24px 60px rgba(0,0,0,.35)", ...style }}>
      {titulo && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, font: fx(17, 800, 1.2), color: "#1d2329" }}>
        <Icone nome={icone} size={18} color="#1d2329" />{titulo}</div>}
      {Array.from({ length: linhas }).map((_, i) => {
        const marca = marcas.includes(i), larg = [100, 92, 97, 84, 95, 70, 98, 88, 76, 93, 81, 90][i % 12];
        return (
          <div key={i} style={{ position: "relative", height: 9, marginBottom: 9, borderRadius: 5, background: "rgba(29,35,41,.08)", width: `${larg}%`, overflow: "hidden" }}>
            <motion.div style={{ position: "absolute", inset: 0, borderRadius: 5, background: marca ? corMarca || C.verde : "rgba(29,35,41,.42)", transformOrigin: "left" }}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: em + 0.2 + i * escreve, duration: 0.35 }} />
          </div>
        );
      })}
      {rodape}
    </Surge>
  );
}

export function Balao({ de = "voce", em = 0, children, largura, style }) {
  const ia = de === "ia";
  return (
    <Surge em={em} de={ia ? "esq" : "dir"} style={{ alignSelf: ia ? "flex-start" : "flex-end", maxWidth: largura || "82%", display: "flex", gap: 10, alignItems: "flex-start", ...style }}>
      {ia && <div style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", background: C.verde, display: "grid", placeItems: "center" }}><Icone nome="Sparkles" size={18} color={sobre(C.verde)} /></div>}
      <div style={{ padding: "12px 16px", borderRadius: 16, borderTopLeftRadius: ia ? 4 : 16, borderTopRightRadius: ia ? 16 : 4, font: fx(22, 400, 1.35),
        color: ia ? C.texto : "#1d2329", background: ia ? alfa(C.branco, 0.08) : "#e8ecef", border: ia ? `1px solid ${C.borda}` : "none" }}>{children}</div>
    </Surge>
  );
}

export function Digitando({ em = 0, ate }) {
  return (
    <Depois em={em} ate={ate}>
      <motion.div key="dig" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", gap: 6, padding: "14px 18px", borderRadius: 16, background: alfa(C.branco, 0.08), alignSelf: "flex-start", marginLeft: 44 }}>
        {[0, 1, 2].map((i) => <motion.span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: C.cinza }} animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />)}
      </motion.div>
    </Depois>
  );
}

// Cronômetro com ponteiro girando. `voltasPorSeg` = velocidade do ponteiro.
export function Cronometro({ em = 0, size = 120, cor, voltasPorSeg = 1, rotulo, style }) {
  const c = cor || C.verde;
  return (
    <Surge em={em} mola style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...style }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="54" r="40" fill={C.card} stroke={c} strokeWidth="5" />
          <rect x="44" y="4" width="12" height="9" rx="3" fill={c} />
          {Array.from({ length: 12 }).map((_, k) => <line key={k} x1="50" y1="18" x2="50" y2="23" stroke={C.cinza2} strokeWidth="2" transform={`rotate(${k * 30} 50 54)`} />)}
        </svg>
        <motion.div style={{ position: "absolute", left: "50%", top: "54%", width: 4, height: size * 0.34, marginLeft: -2, background: C.branco, borderRadius: 2, transformOrigin: "50% 100%", translateY: "-100%" }}
          animate={{ rotate: 360 }} transition={{ duration: 1 / voltasPorSeg, repeat: Infinity, ease: "linear", delay: em }} />
      </div>
      {rotulo && <div style={{ font: fx(22, 700, 1.2), color: c }}>{rotulo}</div>}
    </Surge>
  );
}

// Tecla que afunda nos segundos de `apertos`.
export function Tecla({ texto, em = 0, apertos = [], style }) {
  const d = apertos.length ? apertos[apertos.length - 1] - em + 0.3 : 0;
  return (
    <Surge em={em} mola style={style}>
      <motion.div style={{ minWidth: 70, padding: "12px 16px", borderRadius: 12, background: "linear-gradient(#2a3036,#1d2227)", border: `1px solid ${C.borda}`,
        boxShadow: "0 6px 0 #0a0c0e", font: fx(24, 800, 1), color: "#f4f6f8", textAlign: "center" }}
        animate={apertos.length ? { y: apertos.flatMap(() => [0, 5, 0]) } : {}}
        transition={apertos.length ? { duration: d, times: apertos.flatMap((t) => [(t - em) / d, (t - em + 0.1) / d, (t - em + 0.25) / d]).map((x) => Math.min(1, Math.max(0, x))), delay: em } : {}}>
        {texto}
      </motion.div>
    </Surge>
  );
}

// Assinatura desenhada à mão (o traço se desenha entre `em` e `em + dur`).
export function Assinatura({ em = 0, dur = 1.4, cor = "#1d2329", largura = 220 }) {
  return (
    <svg width={largura} height={largura * 0.36} viewBox="0 0 220 80" fill="none">
      <motion.path d="M6 58 C 22 20, 34 18, 30 52 S 52 70, 60 40 S 74 20, 78 46 S 96 66, 104 38 C 110 20, 122 22, 118 50 S 140 64, 150 42 S 170 30, 176 48 S 198 56, 214 30"
        stroke={cor} strokeWidth="3.2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: em, duration: dur, ease: "easeInOut" }} />
    </svg>
  );
}

// Carimbo que bate (cai girando e "quica").
export function Carimbo({ texto, em = 0, cor, rot = -12, style }) {
  const c = cor || C.verde;
  return (
    <motion.div style={{ position: "absolute", padding: "8px 18px", border: `4px solid ${c}`, borderRadius: 10, font: fx(30, 800, 1), letterSpacing: ".1em", color: c, rotate: rot, ...style }}
      initial={{ opacity: 0, scale: 2.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: em, type: "spring", stiffness: 420, damping: 18 }}>{texto}</motion.div>
  );
}

// Linha de lista que entra e ganha o visto (ou o X) no segundo `marca`.
export function Item({ em, marca, texto, icone, ok = true, cor, style }) {
  const c = cor || C.verde;
  return (
    <Surge em={em} de="dir" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.borda}`, ...style }}>
      {icone && <Icone nome={icone} size={24} color={c} />}
      <span style={{ font: fx(22, 500, 1.25), color: C.texto, flex: 1 }}>{texto}</span>
      {marca !== undefined && <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: marca, type: "spring", stiffness: 420, damping: 15 }}>
        <Icone nome={ok ? "CircleCheck" : "CircleX"} size={26} color={ok ? C.verde : C.cinza} strokeWidth={2.4} /></motion.span>}
    </Surge>
  );
}

// Lista que entra item a item (o AnimatedList do React Bits Pro, se baixado; senão, Item por Item).
export function ListaViva({ itens, tempos, altura = 360, style }) {
  const P = RB["animated-list"];
  if (P) {
    return (
      <div style={{ height: altura, ...style }}>
        <P items={itens.map((t, i) => ({ id: String(i), content: t }))} autoAddDelay={0} startFrom="top" animationType="blur" enterFrom="right" fadeEdges={false} itemGap={12} height={altura}
          renderItem={(it) => <Item em={0} texto={it.content} icone="Check" />} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, ...style }}>
      {itens.map((t, i) => <Item key={i} em={tempos ? tempos[i] : 0.3 + i * 0.5} texto={t} icone="Check" />)}
    </div>
  );
}

// Palavra GIGANTE que bate na tela e sai (quebra o padrão).
export function Palavrao({ texto, em, ate, cor, size = 160, x = "50%", y = "50%", icone, rot = 0 }) {
  const c = cor || C.verde;
  return (
    <Depois em={em} ate={ate}>
      <motion.div key={texto} style={{ position: "absolute", left: x, top: y, translateX: "-50%", translateY: "-50%", zIndex: 40, display: "flex", alignItems: "center", gap: 24,
        font: ft(size, F.pesoTitulo, 1), color: c, letterSpacing: "-.02em", textShadow: "0 20px 60px rgba(0,0,0,.45)", whiteSpace: "nowrap", rotate: rot }}
        initial={{ scale: 2.6, opacity: 0, filter: "blur(24px)" }} animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        exit={{ scale: 0.4, opacity: 0, filter: "blur(16px)", transition: { duration: 0.3 } }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
        {icone && <Icone nome={icone} size={size * 0.8} color={c} strokeWidth={2.4} />}{texto}
      </motion.div>
    </Depois>
  );
}

// Valores que viram como placa de aeroporto (ano 2022 → 2026, contadores).
export function Placa({ valores, em = 0, passo = 0.35, size = 160, cor, style }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const ts = valores.slice(1).map((_, k) => setTimeout(() => setI(k + 1), (em + passo * (k + 1)) * 1000));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <Surge em={em} de="zoom" style={{ position: "relative", height: size * 1.05, perspective: 800, ...style }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={valores[i]} style={{ font: ft(size, F.pesoTitulo, 1), color: cor || C.branco, letterSpacing: "-.03em", transformOrigin: "50% 50%" }}
          initial={{ rotateX: -95, opacity: 0, y: -20 }} animate={{ rotateX: 0, opacity: 1, y: 0 }} exit={{ rotateX: 95, opacity: 0, y: 20 }} transition={{ duration: 0.22 }}>
          {valores[i]}
        </motion.div>
      </AnimatePresence>
    </Surge>
  );
}

// Texto que se decifra (letras embaralhadas até assentar).
export function Decifra({ texto, em = 0, dur = 0.8, style }) {
  const [n, setN] = useState(-1);
  useEffect(() => {
    const ts = [setTimeout(() => setN(0), em * 1000)];
    const passos = 16;
    for (let k = 1; k <= passos; k++) ts.push(setTimeout(() => setN(k / passos), (em + (dur * k) / passos) * 1000));
    return () => ts.forEach(clearTimeout);
  }, []);
  if (n < 0) return <span style={{ visibility: "hidden", ...style }}>{texto}</span>;
  const sinais = "§#%&@*?!0123456789ABCDEFXYZ";
  const vis = texto.split("").map((ch, k) => (ch === " " || k / texto.length < n ? ch : sinais[Math.floor(sorte(k * 7 + Math.round(n * 16)) * sinais.length)])).join("");
  return <span style={style}>{vis}</span>;
}

// Número grande de passo ("1", "2"...), que gira ao entrar.
export function NumeroGrande({ n, em = 0, cor, size = 150, style }) {
  const c = cor || C.verde;
  return (
    <motion.div style={{ position: "absolute", font: ft(size, F.pesoTitulo, 1), color: c, letterSpacing: "-.04em", textShadow: `0 16px 50px ${alfa(c, 0.25)}`, ...style }}
      initial={{ opacity: 0, scale: 2.4, rotate: -25, filter: "blur(18px)" }} animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }} transition={{ delay: em, type: "spring", stiffness: 260, damping: 18 }}>{n}</motion.div>
  );
}

// ───────────── efeitos ─────────────

// Explosão de partículas a partir de um ponto.
export function Explosao({ em, n = 16, cor, raio = 170, x = "50%", y = "50%", tamanho = 10 }) {
  const c = cor || C.verde;
  return (
    <Depois em={em} ate={em + 1.3}>
      <div key="ex" style={{ position: "absolute", left: x, top: y, zIndex: 35 }}>
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2 + sorte(i) * 0.5, r = raio * (0.6 + sorte(i + 9) * 0.6);
          return <motion.div key={i} style={{ position: "absolute", width: tamanho, height: tamanho, borderRadius: i % 3 ? "50%" : 2, background: i % 4 === 1 ? C.branco : c, marginLeft: -tamanho / 2, marginTop: -tamanho / 2 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: 0, scale: 0.3, rotate: 180 }} transition={{ duration: 0.9 + sorte(i + 3) * 0.3, ease: "easeOut" }} />;
        })}
      </div>
    </Depois>
  );
}

// Objetos que caem do alto e quicam no chão (`chao` em px a partir do topo).
export function Chuva({ em, n = 20, largura = 500, chao = 260, passo = 0.04, render }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: largura, height: chao }}>
      {Array.from({ length: n }).map((_, i) => {
        const x = sorte(i + 1) * (largura - 40), alvo = chao - 40 - Math.floor(i / Math.max(1, Math.floor(largura / 44))) * 34;
        return <motion.div key={i} style={{ position: "absolute", left: x, top: 0 }} initial={{ y: -420 - sorte(i + 5) * 200, opacity: 0, rotate: (sorte(i) - 0.5) * 90 }}
          animate={{ y: [null, alvo, alvo - 26, alvo], opacity: 1, rotate: (sorte(i + 2) - 0.5) * 24 }}
          transition={{ delay: em + i * passo, duration: 0.75, times: [0, 0.6, 0.8, 1], ease: "easeIn" }}>{render(i)}</motion.div>;
      })}
    </div>
  );
}

// Flutuar de leve, sem parar (vida, não informação: não conta como novidade na tela).
export function Flutua({ children, amp = 6, dur = 3.2, atraso = 0, style }) {
  return <motion.div style={style} animate={{ y: [0, -amp, 0, amp, 0] }} transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: atraso }}>{children}</motion.div>;
}

// Faixas de velocidade atravessando a tela.
export function Velocidade({ em, dur = 0.9, n = 9, cor }) {
  const c = cor || alfa(C.verde, 0.55);
  return (
    <Depois em={em} ate={em + dur + 0.6}>
      <div key="vel" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 30, pointerEvents: "none" }}>
        {Array.from({ length: n }).map((_, i) => (
          <motion.div key={i} style={{ position: "absolute", top: `${8 + sorte(i) * 84}%`, height: 3 + sorte(i + 4) * 4, width: 220 + sorte(i + 7) * 260, borderRadius: 4, background: `linear-gradient(90deg, transparent, ${c})` }}
            initial={{ x: -600 }} animate={{ x: 1500 }} transition={{ delay: sorte(i + 2) * dur * 0.6, duration: 0.45 + sorte(i + 1) * 0.3, ease: "linear" }} />
        ))}
      </div>
    </Depois>
  );
}

// Linha que se desenha entre dois pontos (com bolinhas correndo depois de desenhada).
export function Fio({ x1, y1, x2, y2, em, cor, corre = true }) {
  const c = cor || alfa(C.verde, 0.55), comp = Math.hypot(x2 - x1, y2 - y1);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width="1" height="1">
      <motion.line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: em, duration: 0.5 }} />
      {corre && [0, 1].map((k) => <motion.circle key={k} r="4.5" fill={C.verde} initial={{ cx: x1, cy: y1, opacity: 0 }} animate={{ cx: [x1, x2], cy: [y1, y2], opacity: [0, 1, 1, 0] }}
        transition={{ delay: em + 0.5 + k * 0.6, duration: Math.max(0.6, comp / 260), repeat: Infinity, repeatDelay: 0.6, ease: "linear" }} />)}
    </svg>
  );
}

// Holofote: escurece tudo e abre um círculo de luz que cresce.
export function Holofote({ em = 0, ate, x = "50%", y = "50%" }) {
  return (
    <Depois em={em} ate={ate}>
      <motion.div key="hol" style={{ position: "absolute", inset: 0, zIndex: 25, pointerEvents: "none" }} exit={{ opacity: 0, transition: { duration: 0.5 } }}
        initial={{ background: `radial-gradient(circle at ${x} ${y}, transparent 0px, ${alfa(C.fundo, 0.94)} 40px)` }}
        animate={{ background: `radial-gradient(circle at ${x} ${y}, transparent 260px, ${alfa(C.fundo, 0.82)} 420px)` }} transition={{ duration: 1.1, ease: "easeOut" }} />
    </Depois>
  );
}

export const Abs = ({ x, y, w, h, children, style }) => <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>;

// Anel tracejado que se desenha em volta de (x, y) e depois gira devagar.
export function Anel({ x, y, r = 150, em = 0, cor, gira = true }) {
  return (
    <motion.svg style={{ position: "absolute", left: x - r - 6, top: y - r - 6, overflow: "visible", zIndex: 2 }} width={2 * r + 12} height={2 * r + 12}
      animate={gira ? { rotate: 360 } : {}} transition={gira ? { duration: 24, repeat: Infinity, ease: "linear", delay: em } : {}}>
      <motion.circle cx={r + 6} cy={r + 6} r={r} fill="none" stroke={cor || C.verde} strokeWidth="3" strokeDasharray="10 9" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.85 }} transition={{ delay: em, duration: 0.9, ease: "easeInOut" }} />
    </motion.svg>
  );
}

// Selo redondo com ícone e rótulo que entra com mola (etapa, peça, ferramenta).
export function Selo({ x, y, icone, rotulo, em = 0, cor, size = 76, marca, embaixo = true }) {
  const c = cor || C.verde;
  return (
    <motion.div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, zIndex: 4 }}
      initial={{ scale: 0, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: em, type: "spring", stiffness: 300, damping: 15 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: C.fundo2, border: `2px solid ${c}`, display: "grid", placeItems: "center", boxShadow: `0 10px 30px rgba(0,0,0,.3), 0 0 24px ${alfa(c, 0.2)}` }}>
        <Icone nome={icone} size={size * 0.46} color={c} />
      </div>
      {marca !== undefined && <motion.div style={{ position: "absolute", right: -8, top: -8 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: marca, type: "spring", stiffness: 420, damping: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.verde, display: "grid", placeItems: "center" }}><Icone nome="Check" size={20} color={sobre(C.verde)} strokeWidth={3} /></div></motion.div>}
      {rotulo && <div style={{ position: "absolute", left: "50%", top: embaixo ? size + 10 : -34, transform: "translateX(-50%)", whiteSpace: "nowrap", font: fx(18, 700, 1.2), color: C.texto, textAlign: "center" }}>{rotulo}</div>}
    </motion.div>
  );
}

// ───────────── React Bits: esferas, fundos e globo ─────────────

const matiz = (cor) => {
  const [r, g, b] = rgb(cor).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

// Esfera de energia viva no centro (x, y): o AgenticBall do Pro, o Orb grátis, ou um degradê que gira. O Orb nasce roxo
// (matiz ~275) e o `hue` dele gira a cor para trás: 275 menos o matiz do destaque leva a esfera para a cor da marca.
export function Orbe({ x, y, size = 200, em = 0, pulsos = [], rotulo, style }) {
  const Pro = RB["agentic-ball"], Orb = RB.Orb;
  const d = pulsos.length ? pulsos[pulsos.length - 1] + 0.6 : 0;
  let miolo;
  if (Pro) miolo = <Pro width={size} height={size} zoom={1.04} speed={0.9} complexity={4} hueRotation={1.75} saturation={0.95} brightness={1.7} color="#ffffff" backgroundColor={C.fundo} />;
  else if (Orb) miolo = <div style={{ width: size, height: size }}><Orb hue={(275 - matiz(C.verde) + 360) % 360} hoverIntensity={0.3} rotateOnHover={false} forceHoverState backgroundColor={C.fundo} /></div>;
  else miolo = (
    <motion.div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(from 0deg, ${C.verde}, ${C.verde2}, ${C.azul}, ${C.verde})`, filter: "blur(2px)" }}
      animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
      <div style={{ position: "absolute", inset: size * 0.12, borderRadius: "50%", background: `radial-gradient(circle at 40% 35%, ${alfa("#ffffff", 0.55)}, ${alfa(C.fundo, 0.2)} 60%)` }} />
    </motion.div>
  );
  return (
    <motion.div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, zIndex: 3, ...style }}
      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: em, type: "spring", stiffness: 200, damping: 15 }}>
      <motion.div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", position: "relative", boxShadow: `0 0 ${size * 0.4}px ${alfa(C.verde, 0.38)}, 0 0 ${size * 0.12}px ${alfa(C.verde, 0.6)}` }}
        animate={pulsos.length ? { scale: [1, ...pulsos.flatMap(() => [1, 1.22, 1])] } : {}}
        transition={pulsos.length ? { duration: d, times: [0, ...pulsos.flatMap((t) => [Math.max(0, t - 0.05) / d, (t + 0.18) / d, (t + 0.55) / d])].map((v) => Math.min(1, v)), ease: "easeOut" } : {}}>
        {miolo}
      </motion.div>
      {rotulo && <Surge em={em + 0.4} style={{ position: "absolute", left: "50%", top: size + 12, translateX: "-50%", whiteSpace: "nowrap", font: fx(20, 700, 1.2), color: C.texto }}>{rotulo}</Surge>}
    </motion.div>
  );
}

// Fundo vivo atrás da cena inteira: "aurora", "particulas" ou "feixes" (do React Bits). Sem o componente, fica só a
// Moldura, que já se mexe. `forca` = opacidade (0 a 1).
export function FundoVivo({ tipo = "aurora", forca = 0.55 }) {
  const { w, h } = TELA[useFormato()] || TELA.h;
  let el = null;
  if (tipo === "aurora" && RB.Aurora) el = <RB.Aurora colorStops={[C.verde2, C.verde, C.azul]} amplitude={1.0} blend={0.6} speed={0.8} />;
  if (tipo === "particulas" && RB.Particles) el = <RB.Particles particleColors={[C.verde, C.branco, C.verde2]} particleCount={220} particleSpread={10} speed={0.12} particleBaseSize={90} moveParticlesOnHover={false} alphaParticles disableRotation={false} />;
  if (tipo === "feixes" && RB.Beams) el = <RB.Beams beamWidth={2} beamHeight={15} beamNumber={12} lightColor={C.verde} speed={2} noiseIntensity={1.6} scale={0.2} rotation={30} />;
  if (!el) return null;
  return <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, opacity: forca, zIndex: 0, pointerEvents: "none" }}>{el}</div>;
}

// Globo girando com arcos (o Globe do React Bits Pro, que usa o globe.gl baixado pelo instalador). Sem ele: um anel.
export function Globo({ x, y, size = 420, em = 0 }) {
  const G = RB.globe;
  return (
    <Surge em={em} de="zoom" style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      {G ? <G width={size} height={size} primaryColor={C.verde} neutralColor={C.cinza2} globeColor={C.fundo2} atmosphereColor={C.verde} interactive={false} autoRotateSpeed={1.6} arcCount={10} arcInterval={300} arcAnimationDuration={1400} enableZoom={false} />
        : <><Anel x={size / 2} y={size / 2} r={size * 0.42} /><Anel x={size / 2} y={size / 2} r={size * 0.3} /><Icone nome="Globe" size={size * 0.4} color={C.verde} style={{ position: "absolute", left: size * 0.3, top: size * 0.3 }} /></>}
    </Surge>
  );
}

// ───────────── moldura, câmera e cena ─────────────

function PontosDeFundo({ w, h }) {
  return (
    <motion.svg width={w + 120} height={h + 100} style={{ position: "absolute", left: -60, top: -50, opacity: 0.35 }} animate={{ x: [0, -24], y: [0, -12] }} transition={{ duration: 20, ease: "linear" }}>
      <defs>
        <pattern id="pts" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill={alfa(C.branco, 0.18)} /></pattern>
        <radialGradient id="msk"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
        <mask id="m"><rect width={w + 120} height={h + 100} fill="url(#msk)" /></mask>
      </defs>
      <rect width={w + 120} height={h + 100} fill="url(#pts)" mask="url(#m)" />
    </motion.svg>
  );
}

// Fundo comum a todas as cenas, com luzes que passeiam devagar (a tela nunca fica morta). O conteúdo some nos últimos
// 0,25 s, para a troca de cena ficar suave.
export function Moldura({ dur, children }) {
  const { w, h } = TELA[useFormato()] || TELA.h;
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", font: fx(20), color: C.texto,
      background: `radial-gradient(${w * 0.7}px ${h * 0.85}px at 92% -10%, ${alfa(C.verde, 0.16)}, transparent 62%), radial-gradient(${w * 0.6}px ${h * 0.8}px at -8% 112%, ${alfa(C.verde, 0.08)}, transparent 60%), ${C.fundo}` }}>
      <PontosDeFundo w={w} h={h} />
      <motion.div style={{ position: "absolute", width: w * 0.4, height: w * 0.4, borderRadius: "50%", background: `radial-gradient(circle, ${alfa(C.verde, 0.1)}, transparent 70%)`, left: w * 0.55, top: -h * 0.25 }}
        animate={{ x: [0, -w * 0.2, -w * 0.06, 0], y: [0, h * 0.2, h * 0.42, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div style={{ position: "absolute", width: w * 0.36, height: w * 0.36, borderRadius: "50%", background: `radial-gradient(circle, ${alfa(C.azul, 0.07)}, transparent 70%)`, left: -w * 0.1, top: h * 0.55 }}
        animate={{ x: [0, w * 0.23, w * 0.11, 0], y: [0, -h * 0.23, -h * 0.06, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
      {children && (
        <motion.div style={{ position: "absolute", inset: 0 }} animate={dur ? { opacity: [1, 1, 0] } : {}} transition={dur ? { duration: dur, times: [0, Math.max(0, (dur - 0.25) / dur), 1], ease: "linear" } : {}}>
          {children}
        </motion.div>
      )}
    </div>
  );
}

// Tamanho da área da câmera, para posicionar as peças (as coordenadas dentro da <Cena> são da área, a partir de 0,0).
export const AreaCtx = createContext({ w: 780, h: 610 });
export const useArea = () => useContext(AreaCtx);

// Câmera da área. `quadros` = [[segundo, {s, foco, r}, duração da ida]]: entre um e outro ela fica parada. Todo zoom
// declara um `foco` [x0, y0, x1, y1] (coordenadas da área) que precisa caber INTEIRO: a câmera centraliza nele, limita
// o zoom para ele não sair, e o resto escurece (holofote). Zoom sem foco derruba a captura. `tremores` = segundos de
// impacto (a tela treme).
export function Camera({ quadros = [], tremores = [], area, children }) {
  if (!area) throw new Error("câmera sem área: use <Cena>");
  const W = area[2] - area[0], H = area[3] - area[1], M = 18, cx = W / 2, cy = H / 2;
  const ajusta = (alvo) => {
    let { s = 1, x = 0, y = 0, foco } = alvo;
    if (s > 1.001 || x || y || foco) {
      if (!foco) throw new Error(`câmera: zoom ou panorâmica sem foco (${JSON.stringify(alvo)})`);
      const smax = Math.min((W - 2 * M) / (foco[2] - foco[0]), (H - 2 * M) / (foco[3] - foco[1]));
      s = Math.min(s, smax);
      x = -s * ((foco[0] + foco[2]) / 2 - cx); y = -s * ((foco[1] + foco[3]) / 2 - cy);
      const lx = M - cx - s * (foco[0] - cx), hx = W - M - cx - s * (foco[2] - cx), ly = M - cy - s * (foco[1] - cy), hy = H - M - cy - s * (foco[3] - cy);
      x = Math.min(Math.max(x, lx), hx); y = Math.min(Math.max(y, ly), hy);
      const bx0 = cx - s * cx + x, bx1 = cx + s * (W - cx) + x, by0 = cy - s * cy + y, by1 = cy + s * (H - cy) + y;
      if (bx0 > 0) x -= bx0; if (bx1 < W) x += W - bx1; if (by0 > 0) y -= by0; if (by1 < H) y += H - by1;
    }
    return { s, x, y, r: alvo.r ?? 0 };
  };
  const pts = [{ t: 0, s: 1, x: 0, y: 0, r: 0, foco: null }], eases = [];
  let atual = { s: 1, x: 0, y: 0, r: 0, foco: null };
  [...quadros].sort((a, b) => a[0] - b[0]).forEach(([t, alvo, d = 0.9]) => {
    const ultimo = pts[pts.length - 1];
    if (t > ultimo.t + 0.01) { pts.push({ ...atual, t }); eases.push("linear"); }
    atual = { ...ajusta(alvo), foco: (alvo.s ?? 1) > 1.001 ? alvo.foco : null };
    pts.push({ ...atual, t: Math.max(t, ultimo.t) + d }); eases.push([0.65, 0, 0.35, 1]);
  });
  const fim = Math.max(pts[pts.length - 1].t, 0.01), vals = (k) => pts.map((p) => p[k]), times = pts.map((p) => p.t / fim);
  const buraco = (p) => {
    if (!p.foco) return null;
    const X = (v) => cx + p.s * (v - cx) + p.x, Y = (v) => cy + p.s * (v - cy) + p.y, f = p.foco, P = 16;
    return [Math.max(0, X(f[0]) - P), Math.max(0, Y(f[1]) - P), Math.min(W, X(f[2]) + P), Math.min(H, Y(f[3]) + P)];
  };
  const furos = pts.map(buraco);
  const furosCheios = furos.map((h) => h || [-70, -70, W + 70, H + 70]);
  // a guarda de cortes (capturar.cjs) lê onde a câmera está parada e o furo do holofote em cada parada
  useEffect(() => {
    const paradas = eases.map((e, k) => (e === "linear" ? [pts[k].t, pts[k + 1].t, furos[k]] : null)).filter(Boolean);
    paradas.push([pts[pts.length - 1].t, 1e9, furos[pts.length - 1]]);
    window.__camera = { t0: performance.now(), area: [0, 0, W, H], paradas, tremores };
  }, []);
  const tx = [0], tt = [0];
  tremores.forEach((t) => { [[0, 0], [0.04, -16], [0.1, 13], [0.17, -9], [0.25, 6], [0.34, -3], [0.45, 0]].forEach(([d, v]) => { tt.push(t + d); tx.push(v); }); });
  const fimT = Math.max(tt[tt.length - 1], 0.01);
  return (
    <div data-area="" style={{ position: "absolute", left: area[0], top: area[1], width: W, height: H, overflow: "hidden" }}>
      <AreaCtx.Provider value={{ w: W, h: H }}>
        <motion.div style={{ position: "absolute", inset: 0 }} animate={tremores.length ? { x: tx } : {}} transition={tremores.length ? { duration: fimT, times: tt.map((t) => t / fimT), ease: "linear" } : {}}>
          <motion.div style={{ position: "absolute", inset: 0, transformOrigin: `${cx}px ${cy}px` }}
            animate={pts.length > 1 ? { scale: vals("s"), x: vals("x"), y: vals("y"), rotate: vals("r") } : {}}
            transition={pts.length > 1 ? { duration: fim, times, ease: eases } : {}}>
            {children}
          </motion.div>
        </motion.div>
      </AreaCtx.Provider>
      {furos.some(Boolean) && <motion.div data-livre="" style={{ position: "absolute", borderRadius: 26, boxShadow: `0 0 46px 2400px ${alfa(C.fundo, 0.93)}`, pointerEvents: "none", zIndex: 50 }}
        initial={{ opacity: 0, left: furosCheios[0][0], top: furosCheios[0][1], width: furosCheios[0][2] - furosCheios[0][0], height: furosCheios[0][3] - furosCheios[0][1] }}
        animate={{ opacity: furos.map((h) => (h ? 1 : 0)), left: furosCheios.map((h) => h[0]), top: furosCheios.map((h) => h[1]), width: furosCheios.map((h) => h[2] - h[0]), height: furosCheios.map((h) => h[3] - h[1]) }}
        transition={{ duration: fim, times, ease: eases }} />}
    </div>
  );
}

// Onde fica a área da câmera em cada formato. Deitado: texto à esquerda e área à direita (ou, com `cheia`, título em
// cima e área embaixo na largura toda). Em pé: texto em cima e área embaixo, sempre.
export function areaDaCena(formato, cheia, alturaTexto) {
  const T = TELA[formato] || TELA.h;
  if (formato === "v") return [0, alturaTexto ?? 300, T.w, T.h];
  return cheia ? [0, alturaTexto ?? 180, T.w, T.h] : [490, 0, T.w, T.h];
}

// A cena: o texto (rótulo, título, apoio) fica FIXO, fora da câmera, e nunca é cortado; a ilustração vai nos filhos,
// em coordenadas da área (useArea() dá a largura e a altura). `lado` = o que mais entra na coluna do texto.
// `fundo` = "aurora" | "particulas" | "feixes" (React Bits, quando baixado).
export function Cena({ kicker, titulo, texto, kickerEm = 0.1, tituloEm = 0.25, textoEm, tamanho, quadros = [], tremores = [], cheia, larguraTexto = 420, alturaTexto, lado, fundo, animado, children }) {
  const formato = useFormato();
  const area = areaDaCena(formato, cheia, alturaTexto);
  const pe = formato === "v", topo = pe || cheia;
  const T = animado ? TituloRB : Titulo;
  return (
    <>
      {fundo && <FundoVivo tipo={fundo} />}
      <div style={{ position: "absolute", left: pe ? 40 : 44, top: topo ? 38 : 0, width: pe ? 720 : cheia ? 1190 : larguraTexto, height: topo ? undefined : TELA.h.h,
        display: "flex", flexDirection: "column", justifyContent: topo ? "flex-start" : "center", zIndex: 5 }}>
        {kicker && <Kicker texto={kicker} em={kickerEm} />}
        {titulo && <T texto={titulo} em={tituloEm} size={tamanho || (pe ? 46 : cheia ? 52 : 48)} />}
        {texto && <Texto em={textoEm ?? tituloEm + 0.8} size={pe ? 22 : 22} style={{ marginTop: 14 }}>{texto}</Texto>}
        {lado && <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>{lado}</div>}
      </div>
      <Camera area={area} quadros={quadros} tremores={tremores}>{children}</Camera>
    </>
  );
}
