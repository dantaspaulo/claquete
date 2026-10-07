#!/usr/bin/env node
// Grava um passo a passo de tela com o Playwright, com cursor visível e trava de privacidade.
//
//   node gravar/gravar.mjs gravar/exemplo.json
//
// Sai em public/gravacoes/<nome>.mp4 (pronto para uma tela "video" da aula) e
// public/gravacoes/<nome>.marcas.json (o segundo de cada passo, para usar em "de").
//
// Privacidade, em duas camadas:
//   "esconder": seletores CSS que entram borrados na gravação (e-mail, nome, saldo...)
//   "proibidos": textos que NÃO podem aparecer; se aparecerem, a gravação é descartada e o programa sai com 3.
// Login: faça antes de gravar (storageState) ou use uma conta de teste. Nunca grave com dado real de cliente.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: node gravar/gravar.mjs <roteiro.json>");
  process.exit(2);
}
const roteiro = JSON.parse(readFileSync(arquivo, "utf8"));
const { nome, largura = 1280, altura = 720, escala = 1, esconder = [], proibidos = [], passos = [] } = roteiro;
if (!/^[a-z0-9-]+$/.test(nome || "")) {
  console.error('"nome" do roteiro: só letras minúsculas, números e hífen');
  process.exit(2);
}
const resolverUrl = (u) => (/^[a-z]+:/i.test(u) ? u : pathToFileURL(resolve(dirname(resolve(arquivo)), u)).href);

const CURSOR = `
(() => {
  const montar = () => {
    if (document.getElementById("__cursor")) return;
    const c = document.createElement("div");
    c.id = "__cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.95);" +
      "border:2px solid rgba(0,0,0,.55);box-shadow:0 2px 10px rgba(0,0,0,.45);pointer-events:none;z-index:2147483647;" +
      "transform:translate(-50%,-50%);transition:transform .12s ease;";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "translate(-50%,-50%) scale(.7)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = "translate(-50%,-50%) scale(1)"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", montar); else montar();
})();`;

const ESCONDER = esconder.length
  ? `(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(
      esconder.map((sel) => `${sel}{filter:blur(10px)!important}`).join("\n"),
    )}; const p = () => document.head ? document.head.appendChild(s) : setTimeout(p, 10); p(); })();`
  : "";

const tmp = mkdtempSync(join(tmpdir(), "gravar-"));
let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error("Não consegui abrir o navegador do Playwright. Rode uma vez: npx playwright install chromium");
  process.exit(2);
}
const contexto = await browser.newContext({
  viewport: { width: largura, height: altura },
  deviceScaleFactor: escala,
  recordVideo: { dir: tmp, size: { width: largura, height: altura } },
  ...(roteiro.sessao ? { storageState: roteiro.sessao } : {}),
});
await contexto.addInitScript(CURSOR);
if (ESCONDER) await contexto.addInitScript(ESCONDER);
const pagina = await contexto.newPage();
const t0 = Date.now();
const marcas = [];
const segundos = () => Number(((Date.now() - t0) / 1000).toFixed(2));

async function conferirPrivacidade(passo) {
  if (!proibidos.length) return;
  const texto = (await pagina.evaluate(() => document.body?.innerText || "")).toLowerCase();
  const achado = proibidos.find((p) => texto.includes(p.toLowerCase()));
  if (achado) {
    await contexto.close();
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
    console.error(`PAROU: texto proibido na tela depois do passo ${passo}. Gravação descartada.`);
    process.exit(3);
  }
}

async function moverAte(seletor) {
  const alvo = pagina.locator(seletor).first();
  await alvo.scrollIntoViewIfNeeded();
  const caixa = await alvo.boundingBox();
  if (!caixa) throw new Error(`não achei ${seletor} na tela`);
  await pagina.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, { steps: 28 });
  return alvo;
}

const espera = (ms) => pagina.waitForTimeout(ms);
await pagina.mouse.move(largura / 2, altura / 2);

for (const [i, passo] of passos.entries()) {
  const n = i + 1;
  marcas.push({ passo: n, segundo: segundos(), o_que: Object.keys(passo)[0], marca: passo.marca });
  if (passo.ir) await pagina.goto(resolverUrl(passo.ir), { waitUntil: "load" });
  if (passo.pairar) await moverAte(passo.pairar);
  if (passo.clicar) {
    await moverAte(passo.clicar);
    await espera(180);
    await pagina.mouse.down();
    await pagina.mouse.up();
  }
  if (passo.digitar) {
    const { em, texto, atraso = 45 } = passo.digitar;
    if (em) {
      await moverAte(em);
      await pagina.mouse.down();
      await pagina.mouse.up();
    }
    await pagina.keyboard.type(texto, { delay: atraso });
  }
  if (passo.escolher) await pagina.locator(passo.escolher.em).selectOption(passo.escolher.valor);
  if (passo.apertar) await pagina.keyboard.press(passo.apertar);
  if (passo.rolar) await pagina.mouse.wheel(0, passo.rolar);
  if (passo.esperar) await espera(passo.esperar);
  else await espera(350);
  await conferirPrivacidade(n);
}
marcas.push({ passo: "fim", segundo: segundos() });

await contexto.close();
const webm = await pagina.video().path();
await browser.close();

const destino = join(RAIZ, "public", "gravacoes");
mkdirSync(destino, { recursive: true });
const mp4 = join(destino, `${nome}.mp4`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-r", "30", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-an", mp4]);
writeFileSync(join(destino, `${nome}.marcas.json`), JSON.stringify(marcas, null, 1));
rmSync(tmp, { recursive: true, force: true });
console.log(`gravado: public/gravacoes/${nome}.mp4 (${marcas.at(-1).segundo} s)`);
console.log(`marcas:  public/gravacoes/${nome}.marcas.json  → use "de" (segundo de início) nas telas "video"`);
