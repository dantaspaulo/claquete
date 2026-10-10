// Fotografa as cenas animadas QUADRO A QUADRO, com o relógio da página controlado (Playwright clock): cada quadro é
// exatamente 1/fps segundo depois do anterior, por mais que a foto demore. Assim motion, GSAP, setInterval, WebGL e
// animação de CSS (sincronizada pelo document.getAnimations) andam no tempo da narração, e o vídeo sai igual toda vez.
// Quem chama é o scripts/kit.py cenas <id>; à mão:
//   node cenas/capturar.cjs <entrada.json>
// entrada: { url, saida, fps, formatos: ["h","v"], cenas: [{ n, aula, componente, dur, palavras, tema }], previa? }
//   → <saida>/cena-NN-h.mp4 e cena-NN-v.mp4, no tamanho da área de dentro da janela do vídeo.
// Recusa (sai 1): erro na página (console, exceção, cena que não existe, palavra que a narração não diz) e quadro vazio.
// Sai 3 quando algo fica cortado pela metade na borda da câmera (a guarda de cortes).
// CLAQUETE_CHROMIUM=<caminho> usa um Chrome que já existe na máquina (senão, o do Playwright).
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require(require.resolve("playwright", { paths: [path.join(__dirname, ".."), __dirname] }));

// Tamanho da cena em pontos (o que o ilustra.jsx desenha) e o tamanho real da área de dentro da janela do vídeo
// (src/layout.ts: a janela menos a barra de cima).
const FORMATOS = {
  h: { w: 1280, h: 610, W: 1520, H: 724 },
  v: { w: 800, h: 907, W: 1000, H: 1134 },
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Recusa: apaga os quadros soltos (milhares de JPEG) e sai. Só peça cortada na borda da câmera sai com 3.
async function recusar(b, quadros, nome, componente, erros, cortes) {
  fs.rmSync(quadros, { recursive: true, force: true });
  console.error(`${nome} (${componente}): ${cortes ? "CORTES" : "RECUSADA"}\n  ` + [...new Set(erros)].slice(0, 8).join("\n  "));
  await b.close();
  process.exit(cortes ? 3 : 1);
}
const luz = (h) => { const v = String(h).replace("#", "").padEnd(6, "0"); const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// acompanha a guarda de cortes: o que fica cortado por meio segundo seguido (câmera parada) vira problema
function vigia() {
  const vivos = new Map(), achados = new Map();
  return {
    async olhar(p, t) {
      const cs = await p.evaluate(() => (window.__cortes ? window.__cortes() : []));
      const agora = new Set();
      for (const c of cs || []) {
        agora.add(c.id);
        const v = vivos.get(c.id) || { de: t, nome: c.nome, f: c.f };
        v.ate = t; v.f = Math.min(v.f, c.f); vivos.set(c.id, v);
        if (v.ate - v.de >= 0.45 && !achados.has(c.id)) achados.set(c.id, v);
      }
      for (const id of [...vivos.keys()]) if (!agora.has(id)) vivos.delete(id);
    },
    problemas: () => [...achados.values()].map((v) => `cortado na borda da câmera: ${v.nome} (só ${v.f}% à vista) desde ${v.de.toFixed(1)} s`),
  };
}

// Roda dentro da página, antes de tudo: os dados da cena, o motion sem a animação do navegador (cai no laço de quadros,
// que o relógio controla) e a guarda de cortes.
function preparar(dados) {
  window.__CENA__ = dados;
  delete Element.prototype.animate;
  window.__ceder = () => new Promise((r) => { const ch = new MessageChannel(); let k = 0; ch.port1.onmessage = () => (++k < 4 ? ch.port2.postMessage(0) : r()); ch.port2.postMessage(0); });
  // GUARDA DE CORTES: com a câmera parada, nenhum texto, ícone, desenho ou caixa visível pode aparecer pela metade na
  // borda da área da câmera (nem na borda do holofote, quando há zoom). Devolve os cortados agora; null = câmera andando.
  window.__gidN = 0;
  window.__cortes = () => {
    const cam = window.__camera, area = document.querySelector("[data-area]");
    if (!cam || !area) return [];
    const t = (performance.now() - cam.t0) / 1000;
    if ((cam.tremores || []).some((x) => t >= x - 0.02 && t <= x + 0.5)) return null;
    const p = cam.paradas.find(([a, b]) => t >= a + 0.05 && t <= b - 0.02);
    if (!p) return null;
    const R = area.getBoundingClientRect(), ox = R.left - cam.area[0], oy = R.top - cam.area[1];
    let J = [R.left, R.top, R.right, R.bottom];
    if (p[2]) J = [Math.max(J[0], p[2][0] + ox), Math.max(J[1], p[2][1] + oy), Math.min(J[2], p[2][2] + ox), Math.min(J[3], p[2][3] + oy)];
    const memo = new Map();
    const opac = (el) => {
      if (!el || el === area) return 1;
      if (memo.has(el)) return memo.get(el);
      const cs = getComputedStyle(el);
      const o = cs.display === "none" || cs.visibility === "hidden" ? 0 : parseFloat(cs.opacity) * opac(el.parentElement);
      memo.set(el, o);
      return o;
    };
    const fora = [], grande = R.width * R.height * 0.6;
    for (const el of area.querySelectorAll("*")) {
      let nome = null;
      if (el instanceof SVGElement) { if (el.tagName === "svg" && el.classList.contains("lucide")) nome = "ícone " + ([...el.classList].find((c) => c.startsWith("lucide-")) || ""); }
      else if (el.tagName === "CANVAS") nome = "desenho";
      else {
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
        if (txt) nome = '"' + txt.slice(0, 40) + '"';
        else {
          const cs = getComputedStyle(el);
          if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none" || (cs.borderTopStyle !== "none" && parseFloat(cs.borderTopWidth) > 0)) nome = "caixa";
        }
      }
      if (!nome || el.closest("[data-livre]")) continue;
      const r = el.getBoundingClientRect(), ar = r.width * r.height;
      if (ar < 16 || ar > grande || (nome === "caixa" && (r.width < 40 || r.height < 40))) continue;
      if ((nome === "caixa" || nome === "desenho") && (r.width > J[2] - J[0] || r.height > J[3] - J[1])) continue;
      const iw = Math.max(0, Math.min(r.right, J[2]) - Math.max(r.left, J[0])), ih = Math.max(0, Math.min(r.bottom, J[3]) - Math.max(r.top, J[1]));
      const f = (iw * ih) / ar;
      if (f > 0.04 && f < 0.96 && opac(el) > 0.25) { el.__gid = el.__gid || ++window.__gidN; fora.push({ id: el.__gid, nome, f: Math.round(f * 100) }); }
    }
    return fora;
  };
  window.__sincCss = () => {
    const agora = performance.now();
    for (const a of document.getAnimations()) {
      if (a.__ini === undefined) { a.__ini = agora; try { a.pause(); } catch (_) {} }
      try { a.currentTime = agora - a.__ini; } catch (_) {}
    }
  };
}

(async () => {
  const e = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), fps = e.fps || 30;
  fs.mkdirSync(e.saida, { recursive: true });
  let b;
  try {
    b = await chromium.launch({
      executablePath: process.env.CLAQUETE_CHROMIUM || undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--force-color-profile=srgb"],
    });
  } catch (x) {
    console.error(`não consegui abrir o navegador do Playwright: ${x.message.split("\n")[0]}\nNo estúdio: npx playwright install chromium`);
    process.exit(1);
  }
  let cortadas = 0;
  for (const cena of e.cenas) {
    for (const formato of e.formatos || ["h", "v"]) {
      const F = FORMATOS[formato], t0 = Date.now(), nome = `cena-${String(cena.n).padStart(2, "0")}-${formato}`, quadros = path.join(e.saida, `.${nome}`);
      fs.rmSync(quadros, { recursive: true, force: true });
      fs.mkdirSync(quadros, { recursive: true });
      const escuro = luz((cena.tema || {}).janela || "#12161a") < 0.5;
      const ctx = await b.newContext({ viewport: { width: F.w, height: F.h }, deviceScaleFactor: F.W / F.w, colorScheme: escuro ? "dark" : "light" });
      const p = await ctx.newPage(), erros = [];
      p.on("pageerror", (x) => erros.push("exceção: " + x.message));
      p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) erros.push("console: " + m.text().slice(0, 200)); });
      p.on("response", (r) => { if (r.status() >= 400 && !/favicon\.ico$|fonts\.googleapis/.test(r.url())) erros.push(`arquivo ${r.status()}: ${r.url()}`); });
      await p.addInitScript(preparar, { ...cena, formato });
      await p.clock.install({ time: 0 });
      await p.goto(e.url, { waitUntil: "load", timeout: 60000 });
      for (let k = 0; k < 200 && !(await p.evaluate(() => window.__pronto === true)); k++) await dormir(50);
      // as fontes vêm da internet (o relógio ainda anda até o pauseAt)
      await p.evaluate(() => window.__fontes);
      const agora = await p.evaluate(() => Date.now());
      await p.clock.pauseAt(agora + 50);
      await p.evaluate(() => window.__comecar());
      await p.evaluate(() => window.__ceder());
      const guarda = vigia();
      if (e.previa) {
        // fotos de algumas frações da cena e a guarda de cortes de 0,1 em 0,1 s, para conferir o desenho antes da captura
        const fotos = new Map(e.previa.map((f) => [Math.round(f * cena.dur * 1000), f]));
        const passos = [...new Set([...Array.from({ length: Math.floor(cena.dur * 10) + 1 }, (_, k) => k * 100), ...fotos.keys()])].sort((x, y) => x - y);
        let t = 0;
        for (const alvo of passos) {
          if (alvo > t) { await p.clock.runFor(alvo - t); t = alvo; }
          await p.evaluate(async () => { window.__sincCss(); await window.__ceder(); });
          await guarda.olhar(p, t / 1000);
          if (fotos.has(alvo)) await p.screenshot({ path: path.join(e.saida, `previa-${nome}-${String(Math.round(fotos.get(alvo) * 100)).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85 });
        }
        const erro = await p.evaluate(() => window.__erro || null);
        if (erro) erros.push("cena: " + erro);
        await ctx.close();
        fs.rmSync(quadros, { recursive: true, force: true });
        if (erros.length) await recusar(b, quadros, nome, cena.componente, erros, false);
        const cortes = guarda.problemas();
        if (cortes.length) { cortadas++; console.error(`${nome} ${cena.componente}: CORTES\n  ` + cortes.slice(0, 8).join("\n  ")); }
        else console.log(`${nome} ${cena.componente}: prévia em ${((Date.now() - t0) / 1000).toFixed(0)} s, sem cortes`);
        continue;
      }
      const n = Math.ceil(cena.dur * fps) + 2;
      let cortes = false;
      for (let i = 0; i < n; i++) {
        if (i) await p.clock.runFor(1000 / fps);
        await p.evaluate(async () => { window.__sincCss(); await window.__ceder(); });
        await p.screenshot({ path: path.join(quadros, `q${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 93 });
        if (i % 3 === 0) { await guarda.olhar(p, i / fps); for (const x of guarda.problemas()) { erros.push(x); cortes = true; } }
        if (i === 0 || i === Math.floor(n / 2)) {
          const erro = await p.evaluate(() => window.__erro || null);
          if (erro) erros.push("cena: " + erro);
        }
        if (erros.length) break;
      }
      await ctx.close();
      if (erros.length) await recusar(b, quadros, nome, cena.componente, erros, cortes && erros.every((x) => x.startsWith("cortado")));
      const mp4 = path.join(e.saida, `${nome}.mp4`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(fps), "-i", path.join(quadros, "q%05d.jpg"), "-vf", `scale=${F.W}:${F.H}:flags=lanczos`,
        "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
      // quadro vazio (a cena não desenhou nada além do fundo) a 60% da cena: recusa
      const meio = path.join(quadros, `q${String(Math.floor(n * 0.6)).padStart(5, "0")}.jpg`);
      const tam = fs.statSync(meio).size, minimo = Math.round(14000 * (F.W * F.H) / (1520 * 724));
      fs.rmSync(quadros, { recursive: true, force: true });
      console.log(`${nome} ${cena.componente}: ${n} quadros, ${cena.dur.toFixed(2)} s, em ${((Date.now() - t0) / 1000).toFixed(0)} s (quadro do meio ${Math.round(tam / 1024)} KB)`);
      if (tam < minimo) { console.error(`${nome}: o quadro do meio está quase vazio (${tam} bytes)`); await b.close(); process.exit(1); }
    }
  }
  await b.close();
  if (cortadas) { console.error(`${cortadas} cena(s) com cortes na borda da câmera`); process.exit(3); }
})().catch((x) => { console.error("FALHOU", x.message); process.exit(1); });
