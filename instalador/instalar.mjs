#!/usr/bin/env node
// Instalador da Claquete.ai. Deixa tudo pronto para o Claude fazer vídeos com a sua marca:
//   1. as skills (as da Claquete e as de motion design da iart.ai, MIT)
//   2. o estúdio (projeto Remotion), novo ou atualizado sem perder o que é seu
//   3. as ferramentas da máquina: ffmpeg, Python 3, os navegadores do Remotion e do Playwright e, se quiser, a
//      transcrição local e gratuita para a revisão da fala (faster-whisper)
//   4. a chave da ElevenLabs num .env só seu, e a voz pronta na sua conta
//   5. a sua marca: um questionário (nome, público, cores, fontes, logo, tom, chamada, voz) e o material que você
//      tiver (pasta, HTML, .md ou link), para o Claude ler depois
//   6. um teste final
//
//   npx github:dantaspaulo/claquete                 interativo
//   npx github:dantaspaulo/claquete --tudo          tudo, sem perguntas (usa a chave do ambiente, se houver; --sim é igual)
//   ... --atualizar                                 atualiza skills e estúdio, mantendo marca, aulas, .env e configuração
//   ... --projeto | --global                        skills em ./.claude/skills ou em ~/.claude/skills
//   ... --skills claquete,aula-animada              só estas
//   ... --estudio ./meu-estudio                     o estúdio nessa pasta
//   ... --sem-ferramentas | --sem-motion | --sem-marca | --transcricao-local
//   ... --desinstalar                               remove as skills (o estúdio fica)
//   ... --versao | --ajuda
//
// Só Node 18+. Instalar não apaga nada: skill que já existe vira cópia de segurança.
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSAO = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).version;
const PASTA_SKILLS = join(RAIZ, "skills");
const PASTA_ESTUDIO = join(RAIZ, "estudio");
const MOTION = { repo: "iart-ai/motion-design-skills", tar: "https://codeload.github.com/iart-ai/motion-design-skills/tar.gz/refs/heads/main" };
const SO = platform(); // darwin | linux | win32
const args = process.argv.slice(2);
const tem = (f) => args.includes(f);
const valor = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

// Flag desconhecida (ou --help) mostra o uso e para: sem isso, "--help" rodava a instalação inteira.
const FLAGS = ["--tudo", "--sim", "--atualizar", "--projeto", "--global", "--skills", "--estudio", "--sem-ferramentas", "--sem-motion",
  "--sem-marca", "--transcricao-local", "--desinstalar", "--versao", "--ajuda", "--help", "-h"];
const COM_VALOR = ["--skills", "--estudio"];
const uso = () => readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//   ")).map((l) => l.slice(5)).join("\n");
for (let i = 0; i < args.length; i++) {
  if (COM_VALOR.includes(args[i])) {
    if (!args[i + 1] || args[i + 1].startsWith("--")) {
      console.error(`${args[i]} pede um valor.\n\n${uso()}`);
      process.exit(1);
    }
    i++;
  } else if (!FLAGS.includes(args[i])) {
    console.error(`Opção desconhecida: ${args[i]}\n\n${uso()}`);
    process.exit(1);
  }
}
if (tem("--ajuda") || tem("--help") || tem("-h")) {
  console.log(`Claquete.ai ${VERSAO}\n\n${uso()}`);
  process.exit(0);
}

const cor = (c, t) => (process.stdout.isTTY ? `\x1b[${c}m${t}\x1b[0m` : t);
const verde = (t) => cor("32", t);
const fraco = (t) => cor("2", t);
const negrito = (t) => cor("1", t);
const ok = (t) => console.log(`  ${verde("✓")} ${t}`);
const nao = (t) => console.log(`  · ${t}`);
const titulo = (t) => console.log(`\n${negrito(t)}`);

function roda(cmd, cwd, mostrar = true) {
  const r = spawnSync(cmd, { cwd, shell: true, stdio: mostrar ? "inherit" : "pipe" });
  return r.status === 0;
}
const existe = (cmd) => spawnSync(SO === "win32" ? `where ${cmd}` : `command -v ${cmd}`, { shell: true, stdio: "pipe" }).status === 0;

function lerSkills() {
  return readdirSync(PASTA_SKILLS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PASTA_SKILLS, d.name, "SKILL.md")))
    .map((d) => {
      const md = readFileSync(join(PASTA_SKILLS, d.name, "SKILL.md"), "utf8");
      const resumo = (md.match(/^\s+resumo:\s*(.+)$/m) || [, ""])[1];
      return { nome: d.name, resumo };
    });
}

function copiarPasta(origem, alvo) {
  if (existsSync(alvo)) {
    const copia = `${alvo}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    renameSync(alvo, copia);
    console.log(fraco(`    já existia: a anterior ficou em ${copia}`));
  }
  cpSync(origem, alvo, { recursive: true });
}

// As skills de motion design da iart.ai (MIT): baixa o repositório e copia cada skill, com a licença junto.
function instalarMotion(destino) {
  if (!existe("curl") || !existe("tar")) {
    nao(`motion design: preciso de curl e tar para baixar ${MOTION.repo}; instale à mão: npx skills add ${MOTION.repo}`);
    return [];
  }
  const tmp = mkdtempSync(join(tmpdir(), "claquete-motion-"));
  if (!roda(`curl -sL ${MOTION.tar} | tar xz -C "${tmp}"`, undefined, false)) {
    nao(`motion design: não consegui baixar ${MOTION.repo} (sem internet?). Depois: npx github:dantaspaulo/claquete --atualizar`);
    return [];
  }
  const raiz = join(tmp, readdirSync(tmp)[0]);
  const licenca = join(raiz, "LICENSE");
  const nomes = readdirSync(join(raiz, "skills"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const n of nomes) {
    copiarPasta(join(raiz, "skills", n), join(destino, n));
    if (existsSync(licenca)) copyFileSync(licenca, join(destino, n, "LICENSE-iart.txt"));
  }
  rmSync(tmp, { recursive: true, force: true });
  return nomes;
}

function perguntarSegredo(q) {
  if (!process.stdin.isTTY) return Promise.resolve("");
  process.stdout.write(q);
  return new Promise((res) => {
    let v = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const fim = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", ao);
      process.stdout.write("\n");
      res(v.trim());
    };
    const ao = (bloco) => {
      for (const ch of bloco) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return fim();
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f" || ch === "\b") v = v.slice(0, -1);
        else {
          v += ch;
          process.stdout.write("•");
        }
      }
    };
    process.stdin.on("data", ao);
  });
}

function comandoPython() {
  for (const c of ["python3", "python", "py -3"]) {
    const r = spawnSync(`${c} --version`, { shell: true, stdio: "pipe" });
    if (r.status === 0 && /Python 3/.test(`${r.stdout}${r.stderr}`)) return c;
  }
  return null;
}

function instaladorDoSistema(pacote) {
  const nomes = {
    ffmpeg: { brew: "ffmpeg", apt: "ffmpeg", dnf: "ffmpeg", winget: "Gyan.FFmpeg" },
    python: { brew: "python", apt: "python3", dnf: "python3", winget: "Python.Python.3.12" },
  }[pacote];
  if (SO === "darwin" && existe("brew")) return `brew install ${nomes.brew}`;
  if (SO === "linux" && existe("apt-get")) return `sudo apt-get update && sudo apt-get install -y ${nomes.apt}`;
  if (SO === "linux" && existe("dnf")) return `sudo dnf install -y ${nomes.dnf}`;
  if (SO === "win32" && existe("winget")) return `winget install -e --id ${nomes.winget}`;
  return null;
}

// Atualiza o estúdio sem tocar no que é da pessoa: roteiros, gravações, marca, saída, chaves e a configuração dela
// (que só ganha as chaves novas que não tinha).
const DA_PESSOA = ["aulas", join("public", "aulas"), join("public", "gravacoes"), join("public", "marca"), "marca", "saida", ".env", "kit.config.json", "node_modules"];
function atualizarEstudio(estudio) {
  const pula = DA_PESSOA.map((x) => join(PASTA_ESTUDIO, x));
  cpSync(PASTA_ESTUDIO, estudio, { recursive: true, filter: (f) => !pula.some((x) => f === x || f.startsWith(x + sep)) });
  for (const ex of ["exemplo.json", "tutorial-exemplo.json"]) {
    if (!existsSync(join(estudio, "aulas", ex))) cpSync(join(PASTA_ESTUDIO, "aulas", ex), join(estudio, "aulas", ex));
  }
  const arq = join(estudio, "kit.config.json");
  const novo = JSON.parse(readFileSync(join(PASTA_ESTUDIO, "kit.config.json"), "utf8"));
  const atual = existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : {};
  const mesclar = (base, meu) => {
    const out = { ...meu };
    for (const [k, v] of Object.entries(base)) {
      if (!(k in out)) out[k] = v;
      else if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") out[k] = mesclar(v, out[k]);
    }
    return out;
  };
  const mesclado = mesclar(novo, atual);
  if (mesclado.voz) delete mesclado.voz.openai; // a 2.0 tirou a OpenAI do estúdio
  writeFileSync(arq, JSON.stringify(mesclado, null, 2) + "\n");
}

// ── o questionário da marca ─────────────────────────────────────────────────
async function questionarioMarca(perguntar, estudio) {
  const escolha = async (q, opcoes, padrao = 1) => {
    opcoes.forEach((o, i) => console.log(`    ${i + 1}) ${o}`));
    const r = Number(await perguntar(`  ${q}`, String(padrao)));
    return opcoes[(r >= 1 && r <= opcoes.length ? r : padrao) - 1];
  };
  const lista = (t) => t.split(",").map((x) => x.trim()).filter(Boolean);
  const hex = (t, padrao) => (/^#?[0-9a-f]{6}$/i.test(t) ? (t.startsWith("#") ? t : `#${t}`) : padrao);
  console.log(fraco("  Enter aceita o que está entre colchetes. Tudo pode mudar depois: peça ao Claude \"refaz a minha marca\"."));
  const m = { versao_questionario: 1 };
  m.nome = await perguntar("  Nome da marca", "Minha marca");
  m.o_que_faz = await perguntar("  O que ela faz, em uma linha", "");
  m.publico = await perguntar("  Para quem são os vídeos (público)", "");
  m.site = await perguntar("  Site", "");
  m.instagram = await perguntar("  Instagram (@)", "");
  m.tiktok = await perguntar("  TikTok (@)", "");

  titulo("  Material da marca");
  console.log(fraco("  Uma pasta (logos, fontes, manual, posts de exemplo), um arquivo HTML ou .md com o padrão da marca, ou um link."));
  console.log(fraco("  O Claude lê tudo depois e monta a marca com mais precisão. Pode dar vários, separados por vírgula."));
  const material = lista(await perguntar("  Caminho(s) ou link(s)", ""));
  const destMaterial = join(estudio, "marca", "material");
  m.material = [];
  for (const item of material) {
    if (/^https?:\/\//i.test(item)) {
      m.material.push({ link: item });
      ok(`link guardado: ${item}`);
      continue;
    }
    const caminho = resolve(item.replace(/^~(?=$|\/)/, homedir()));
    if (!existsSync(caminho)) {
      nao(`não achei ${caminho}: ficou de fora`);
      continue;
    }
    mkdirSync(destMaterial, { recursive: true });
    const alvo = join(destMaterial, basename(caminho));
    cpSync(caminho, alvo, { recursive: true });
    m.material.push({ arquivo: join("marca", "material", basename(caminho)) });
    ok(`copiado para marca/material/${basename(caminho)}`);
  }
  m.design_system = await perguntar("  Design system (caminho ou link; enter se não tiver)", "");

  titulo("  Visual");
  m.fundo = (await escolha("Fundo dos vídeos", ["escuro", "claro"], 1));
  m.cores = {
    principal: hex(await perguntar("  Cor principal (hex)", "#2EE59D"), "#2EE59D"),
    fundo: hex(await perguntar("  Cor de fundo (hex)", m.fundo === "claro" ? "#F6F7F5" : "#0F1114"), m.fundo === "claro" ? "#F6F7F5" : "#0F1114"),
    texto: hex(await perguntar("  Cor do texto (hex)", m.fundo === "claro" ? "#111814" : "#F1F4F2"), m.fundo === "claro" ? "#111814" : "#F1F4F2"),
  };
  m.fontes = {
    titulos: await perguntar("  Fonte dos títulos (do Google Fonts)", "Instrument Serif"),
    texto: await perguntar("  Fonte do texto (do Google Fonts)", "Inter"),
  };
  const logo = await perguntar("  Logo (caminho de um SVG ou PNG; enter se não tiver)", "");
  if (logo) {
    const caminho = resolve(logo.replace(/^~(?=$|\/)/, homedir()));
    if (existsSync(caminho) && statSync(caminho).isFile()) {
      mkdirSync(join(estudio, "public", "marca"), { recursive: true });
      const nome = `logo${extname(caminho).toLowerCase()}`;
      copyFileSync(caminho, join(estudio, "public", "marca", nome));
      m.logo = `marca/${nome}`;
      ok(`logo em public/marca/${nome}`);
    } else nao(`não achei ${caminho}: o logo ficou de fora`);
  }
  m.movimento = await escolha("Estilo de movimento", ["sóbrio (entradas suaves, pouco zoom)", "dinâmico (mais cortes e zooms)", "editorial (tipografia em destaque)"], 2);

  titulo("  Voz e tom");
  m.tom = await escolha("Tom", ["próximo e didático", "formal", "descontraído", "técnico"], 1);
  m.palavras_proibidas = lista(await perguntar("  Palavras que nunca podem aparecer (vírgula)", ""));
  m.glossario = lista(await perguntar("  Termos da sua área que não podem virar sinônimo (vírgula)", ""));
  const voz = await perguntar("  Voz da ElevenLabs: enter para a Raquel, ou o voice_id de outra", "Raquel");
  m.voz = voz === "Raquel" ? { nome: "Raquel" } : { nome: "Voz da marca", voice_id: voz };

  titulo("  Chamada do fim dos vídeos");
  m.chamada = {
    texto: await perguntar("  Texto", `Conheça ${m.nome}`),
    endereco: await perguntar("  Endereço", m.site || ""),
    linha: await perguntar("  Linha de apoio", ""),
  };

  titulo("  Vídeos para redes (versão 2.1)");
  m.avatar = { provedor: (await escolha("Provedor do avatar apresentador", ["Higgsfield (principal)", "HeyGen (alternativa)", "não vou usar avatar"], 1)).split(" ")[0].toLowerCase() };

  mkdirSync(join(estudio, "marca"), { recursive: true });
  writeFileSync(join(estudio, "marca", "marca.json"), JSON.stringify(m, null, 2) + "\n");
  ok("marca/marca.json salvo");
  return m;
}

async function main() {
  if (tem("--versao")) {
    console.log(VERSAO);
    return;
  }
  const skills = lerSkills();
  console.log(`\n${verde("◆ Claquete.ai")} ${fraco(`v${VERSAO}`)}  ${fraco("o estúdio de vídeo que o Claude opera")}`);

  const global = join(homedir(), ".claude", "skills");
  const projeto = join(process.cwd(), ".claude", "skills");

  if (tem("--desinstalar")) {
    const destino = tem("--projeto") ? projeto : global;
    for (const s of skills) {
      const alvo = join(destino, s.nome);
      if (existsSync(alvo)) {
        rmSync(alvo, { recursive: true });
        console.log(`  removida: ${s.nome}`);
      }
    }
    console.log("\nPronto. O estúdio e as skills de motion design ficam onde estão.\n");
    return;
  }

  const atualizar = tem("--atualizar");
  const semPerguntas = tem("--tudo") || tem("--sim") || !process.stdin.isTTY;
  let rl = semPerguntas ? null : createInterface({ input: process.stdin, output: process.stdout });
  const perguntar = async (q, padrao) => {
    if (!rl) return padrao;
    const r = (await rl.question(`${q} ${fraco(`[${padrao}]`)} `)).trim();
    return r || padrao;
  };
  const sim = async (q, padrao = "s") => /^s/i.test(await perguntar(`${q} (s/n)`, padrao));

  // ── 1. skills ──────────────────────────────────────────────────────
  let destino = tem("--projeto") ? projeto : global;
  if (!tem("--projeto") && !tem("--global") && rl) {
    titulo("Onde instalar as skills?");
    console.log(`  1) para você, em todos os projetos  ${fraco(global)}`);
    console.log(`  2) só neste projeto                 ${fraco(projeto)}`);
    destino = (await perguntar("Escolha", "1")) === "2" ? projeto : global;
  }
  let escolhidas = skills.map((s) => s.nome);
  if (valor("--skills")) escolhidas = valor("--skills").split(",").map((s) => s.trim()).filter(Boolean);
  const desconhecidas = escolhidas.filter((n) => !skills.some((s) => s.nome === n));
  if (desconhecidas.length) {
    console.error(`skill desconhecida: ${desconhecidas.join(", ")}`);
    process.exit(2);
  }
  titulo(`1/6 Skills em ${destino}`);
  mkdirSync(destino, { recursive: true });
  for (const nome of escolhidas) {
    copiarPasta(join(PASTA_SKILLS, nome), join(destino, nome));
    ok(`${nome} ${fraco(skills.find((s) => s.nome === nome).resumo)}`);
  }
  if (!tem("--sem-motion")) {
    const motion = instalarMotion(destino);
    if (motion.length) ok(`motion design (iart.ai, MIT): ${motion.join(", ")}`);
  }

  // ── 2. estúdio ─────────────────────────────────────────────────────
  let pastaEstudio = valor("--estudio") || (semPerguntas || atualizar ? "./estudio-video" : null);
  if (!pastaEstudio) {
    titulo("Criar o estúdio? (o projeto que monta os vídeos; as skills precisam dele)");
    const r = await perguntar("Pasta, ou 'nao' para pular", "./estudio-video");
    if (!/^n(ao|ão|o)?$/i.test(r)) pastaEstudio = r;
  }
  const estudio = pastaEstudio ? resolve(pastaEstudio) : null;
  if (estudio) {
    titulo(`2/6 Estúdio em ${estudio}`);
    if (existsSync(join(estudio, "kit.config.json"))) {
      const antes = existsSync(join(estudio, "VERSAO")) ? readFileSync(join(estudio, "VERSAO"), "utf8").trim() : "1.x";
      atualizarEstudio(estudio);
      ok(`estúdio atualizado de ${antes} para ${VERSAO}: roteiros, gravações, marca, saída, chaves e a sua configuração ficaram como estavam`);
    } else if (existsSync(estudio) && readdirSync(estudio).length) {
      console.log(`  ${estudio} já existe e não está vazia. Escolha outra pasta com --estudio.`);
      process.exit(2);
    } else {
      const fora = ["node_modules", "saida", join("public", "aulas"), join("public", "gravacoes")].map((x) => join(PASTA_ESTUDIO, x));
      cpSync(PASTA_ESTUDIO, estudio, { recursive: true, filter: (f) => !fora.some((x) => f === x || f.startsWith(x + sep)) });
      ok("arquivos copiados");
    }
    writeFileSync(join(estudio, "VERSAO"), `${VERSAO}\n`);
  }

  // ── 3. ferramentas da máquina ──────────────────────────────────────
  titulo("3/6 Ferramentas da máquina");
  const nodeOk = Number(process.versions.node.split(".")[0]) >= 18;
  nodeOk ? ok(`Node ${process.versions.node}`) : nao(`Node 18+ necessário (tem ${process.versions.node}): https://nodejs.org`);
  for (const [pacote, presente] of [
    ["ffmpeg", () => existe("ffmpeg") && existe("ffprobe")],
    ["python", () => Boolean(comandoPython())],
  ]) {
    const nome = pacote === "python" ? "Python 3" : "ffmpeg";
    if (presente()) {
      ok(nome);
      continue;
    }
    const cmd = instaladorDoSistema(pacote);
    if (!cmd) {
      nao(`${nome} não encontrado e não sei instalar sozinho aqui. ${SO === "darwin" ? "Instale o Homebrew (https://brew.sh) e rode de novo." : "Instale pelo gerenciador de pacotes do sistema."}`);
      continue;
    }
    if (tem("--sem-ferramentas")) {
      nao(`${nome} não encontrado. Para instalar: ${cmd}`);
      continue;
    }
    if (semPerguntas || (await sim(`  ${nome} não encontrado. Instalar agora com "${cmd}"?`))) {
      console.log(fraco(`  $ ${cmd}`));
      roda(cmd) && presente() ? ok(`${nome} instalado`) : nao(`${nome}: a instalação não terminou; rode à mão: ${cmd}`);
    } else nao(`${nome} ficou de fora. Depois: ${cmd}`);
  }
  if (estudio) {
    console.log(fraco("  instalando as dependências do estúdio (Remotion, React, Playwright)..."));
    roda("npm install --no-audit --no-fund", estudio) ? ok("dependências do estúdio (npm)") : nao("npm install falhou: rode dentro do estúdio");
    console.log(fraco("  baixando o navegador que o Remotion usa para renderizar..."));
    roda("npx remotion browser ensure", estudio) ? ok("navegador do Remotion") : nao("navegador do Remotion: rode 'npx remotion browser ensure' no estúdio");
    if (semPerguntas || (await sim("  Instalar o navegador do Playwright (a IA usa para operar sistemas e gravar a tela)?"))) {
      const cmd = SO === "linux" ? "npx playwright install --with-deps chromium" : "npx playwright install chromium";
      roda(cmd, estudio) ? ok("navegador do Playwright") : nao(`navegador do Playwright: rode '${cmd}' no estúdio`);
    }
    // Transcrição local num ambiente Python só do estúdio (.venv): não mexe no Python do sistema.
    const py = comandoPython();
    const venvPy = join(estudio, ".venv", SO === "win32" ? "Scripts\\python.exe" : "bin/python");
    if (py && !tem("--sem-ferramentas")) {
      const temWhisper = existsSync(venvPy) && spawnSync(`"${venvPy}" -c "import faster_whisper"`, { shell: true, stdio: "pipe" }).status === 0;
      if (temWhisper) ok("transcrição local (faster-whisper, em .venv)");
      else if (tem("--transcricao-local") || (!semPerguntas && (await sim("  Transcrição local e gratuita para a revisão da fala (faster-whisper; uns 500 MB com o modelo, baixado no primeiro uso)?")))) {
        const cmd = `${py} -m venv .venv && "${venvPy}" -m pip install --quiet faster-whisper`;
        roda(cmd, estudio) ? ok("transcrição local (faster-whisper, em .venv)") : nao(`faster-whisper: rode no estúdio: ${cmd}`);
      } else nao("sem transcrição local: a revisão da fala é feita pela sessão do Claude e por você, ouvindo");
    }
  }

  // ── 4. chave e voz ─────────────────────────────────────────────────
  // A chave é lida sem eco: fecha o readline antes (ele ecoaria o que se digita) e abre de novo para a marca.
  rl?.close();
  rl = null;
  if (estudio) {
    titulo("4/6 Chave e voz");
    const arqEnv = join(estudio, ".env");
    const atual = existsSync(arqEnv) ? readFileSync(arqEnv, "utf8") : "";
    const temNoEnv = (k) => new RegExp(`^${k}=.+`, "m").test(atual);
    const linhas = [];
    const k = "ELEVENLABS_API_KEY";
    if (temNoEnv(k)) ok(`${k} já está no .env`);
    else {
      let v = process.env[k] || "";
      if (!v && !semPerguntas) v = await perguntarSegredo(`  ${k} ${fraco("(elevenlabs.io → Configurações → API Keys; enter para pular)")}: `);
      if (v) {
        linhas.push(`${k}=${v}`);
        ok(`${k} guardada em ${arqEnv}`);
      } else nao(`${k} ficou de fora: ponha no ${arqEnv} depois`);
    }
    if (/^OPENAI_API_KEY=/m.test(atual)) nao("o .env ainda tem OPENAI_API_KEY: a Claquete 2.0 não usa mais; pode apagar a linha");
    if (linhas.length) {
      writeFileSync(arqEnv, (atual ? atual.replace(/\n?$/, "\n") : "# Chaves do estúdio. Este arquivo é só seu: nunca vai para repositório.\n") + linhas.join("\n") + "\n");
      try {
        chmodSync(arqEnv, 0o600);
      } catch {}
    }
    const py = comandoPython();
    if (py && (temNoEnv(k) || linhas.length) && !atualizar) {
      console.log(fraco("  preparando a voz na sua conta da ElevenLabs e gerando um áudio de teste..."));
      roda(`${py} scripts/kit.py voz`, estudio) ? ok("voz pronta (ouça saida/teste-voz.mp3)") : nao(`a voz não ficou pronta: rode '${py} scripts/kit.py voz' no estúdio`);
    }
  }

  // ── 5. a sua marca ─────────────────────────────────────────────────
  if (!semPerguntas) rl = createInterface({ input: process.stdin, output: process.stdout });
  if (estudio) {
    titulo("5/6 A sua marca");
    const temMarca = existsSync(join(estudio, "marca", "marca.json"));
    if (tem("--sem-marca") || !rl) nao(temMarca ? "marca mantida" : "sem questionário agora: depois, no Claude, peça \"configura minha marca\"");
    else if (!temMarca || (await sim("  Você já tem uma marca configurada. Responder de novo?", "n"))) {
      await questionarioMarca(perguntar, estudio);
      const py = comandoPython();
      py && roda(`${py} scripts/kit.py marca`, estudio) ? ok("marca aplicada ao estúdio") : nao("rode 'python3 scripts/kit.py marca' no estúdio");
    } else ok("marca mantida");
  }
  rl?.close();
  rl = null;

  // ── 6. teste final ─────────────────────────────────────────────────
  if (estudio) {
    titulo("6/6 Teste");
    const py = comandoPython();
    py && roda(`${py} scripts/kit.py validar exemplo`, estudio, false) ? ok("o vídeo de exemplo passa na validação") : nao("validação do exemplo falhou");
    roda("npx remotion compositions src/index.ts", estudio, false) ? ok("o Remotion monta o projeto") : nao("o Remotion não montou o projeto: rode 'npx remotion compositions src/index.ts' no estúdio");
  }

  titulo(`Pronto: Claquete.ai ${VERSAO}`);
  if (estudio) {
    console.log(`  Abra o Claude na pasta ${verde(pastaEstudio)} e diga ${verde('"quero fazer um vídeo"')}.`);
    console.log("  Ele pergunta o tipo (demonstração, aula animada, dica, caso, trilha) e, nas aulas, a duração de 2 a 5 minutos.");
    if (existsSync(join(estudio, "marca", "material"))) console.log(`  Para ele ler o material da marca: ${verde('"configura minha marca"')}.`);
  }
  console.log(fraco("  Durante as gravações a IA opera o computador: deixe a máquina livre e feche o que for pesado.\n"));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
