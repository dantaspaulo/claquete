#!/usr/bin/env node
// Instalador do kit-video-ia. Deixa tudo pronto para gravar:
//   1. as skills do Claude
//   2. o estúdio (projeto Remotion) com as dependências instaladas
//   3. as ferramentas da máquina: ffmpeg, Python 3, o navegador do Remotion e o do Playwright
//   4. as chaves (ElevenLabs e OpenAI) num .env só seu, e a voz Raquel pronta na sua conta
//   5. um teste final
//
//   npx github:dantaspaulo/kit-video-ia               interativo
//   npx github:dantaspaulo/kit-video-ia --tudo        tudo, sem perguntas (usa as chaves do ambiente, se houver)
//   ... --projeto                                     skills em ./.claude/skills
//   ... --skills aula-animada,tutorial-de-tela        só estas
//   ... --estudio ./meu-estudio                       o estúdio nessa pasta
//   ... --sem-ferramentas                             não instala ffmpeg/Python (só confere)
//   ... --desinstalar                                 remove as skills do kit
//
// Só Node 18+. Nada é apagado: skill que já existe vira cópia de segurança.
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_SKILLS = join(RAIZ, "skills");
const PASTA_ESTUDIO = join(RAIZ, "estudio");
const SO = platform(); // darwin | linux | win32
const args = process.argv.slice(2);
const tem = (f) => args.includes(f);
const valor = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const cor = (c, t) => (process.stdout.isTTY ? `\x1b[${c}m${t}\x1b[0m` : t);
const dourado = (t) => cor("33", t);
const fraco = (t) => cor("2", t);
const negrito = (t) => cor("1", t);
const ok = (t) => console.log(`  ${dourado("✓")} ${t}`);
const nao = (t) => console.log(`  · ${t}`);
const titulo = (t) => console.log(`\n${negrito(t)}`);

// roda um comando mostrando a saída; devolve true se deu certo
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

function copiarSkill(nome, destino) {
  const alvo = join(destino, nome);
  if (existsSync(alvo)) {
    const copia = `${alvo}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    renameSync(alvo, copia);
    console.log(fraco(`    já existia: a anterior ficou em ${copia}`));
  }
  cpSync(join(PASTA_SKILLS, nome), alvo, { recursive: true });
}

// Lê uma chave sem mostrar na tela.
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

// Como instalar um pacote do sistema em cada SO. null = não sei instalar sozinho aqui.
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

async function main() {
  const skills = lerSkills();
  console.log(`\n${dourado("◆ kit-video-ia")}  ${fraco("aulas narradas animadas e tutoriais de tela, com o Claude")}`);

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
    console.log("\nPronto. O estúdio (se você criou) fica onde está.\n");
    return;
  }

  const semPerguntas = tem("--tudo") || tem("--sim") || !process.stdin.isTTY;
  let rl = semPerguntas ? null : createInterface({ input: process.stdin, output: process.stdout });
  const perguntar = async (q, padrao) => {
    if (!rl) return padrao;
    const r = (await rl.question(`${q} ${fraco(`[${padrao}]`)} `)).trim();
    return r || padrao;
  };
  const sim = async (q) => /^s/i.test(await perguntar(`${q} (s/n)`, "s"));

  // ── 1. skills ──────────────────────────────────────────────────────
  let destino = tem("--projeto") ? projeto : global;
  if (!tem("--projeto") && !tem("--global") && rl) {
    titulo("Onde instalar as skills?");
    console.log(`  1) para você, em todos os projetos  ${fraco(global)}`);
    console.log(`  2) só neste projeto                 ${fraco(projeto)}`);
    destino = (await perguntar("Escolha", "1")) === "2" ? projeto : global;
  }
  let escolhidas = skills.map((s) => s.nome);
  if (valor("--skills")) {
    escolhidas = valor("--skills").split(",").map((s) => s.trim()).filter(Boolean);
  } else if (rl) {
    titulo("Quais skills?");
    skills.forEach((s, i) => console.log(`  ${i + 1}) ${s.nome.padEnd(17)} ${fraco(s.resumo)}`));
    const r = await perguntar("Números separados por vírgula, ou enter para todas", "todas");
    if (r !== "todas") escolhidas = r.split(",").map((n) => skills[Number(n.trim()) - 1]?.nome).filter(Boolean);
  }
  const desconhecidas = escolhidas.filter((n) => !skills.some((s) => s.nome === n));
  if (desconhecidas.length) {
    console.error(`skill desconhecida: ${desconhecidas.join(", ")}`);
    process.exit(2);
  }
  titulo(`1/5 Skills em ${destino}`);
  mkdirSync(destino, { recursive: true });
  for (const nome of escolhidas) {
    copiarSkill(nome, destino);
    ok(nome);
  }

  // ── 2. estúdio ─────────────────────────────────────────────────────
  let pastaEstudio = valor("--estudio") || (semPerguntas ? "./estudio-video" : null);
  if (!pastaEstudio) {
    titulo("Criar o estúdio? (o projeto que renderiza as aulas; as skills precisam dele)");
    const r = await perguntar("Pasta, ou 'nao' para pular", "./estudio-video");
    if (!/^n(ao|ão|o)?$/i.test(r)) pastaEstudio = r;
  }
  const estudio = pastaEstudio ? resolve(pastaEstudio) : null;
  if (estudio) {
    titulo(`2/5 Estúdio em ${estudio}`);
    if (existsSync(join(estudio, "kit.config.json"))) {
      ok("já existe um estúdio aqui: mantive os seus arquivos e só atualizo as dependências");
    } else if (existsSync(estudio) && readdirSync(estudio).length) {
      console.log(`  ${estudio} já existe e não está vazia. Escolha outra pasta com --estudio.`);
      process.exit(2);
    } else {
      const fora = ["node_modules", "saida", join("public", "aulas"), join("public", "gravacoes")].map((x) => join(PASTA_ESTUDIO, x));
      cpSync(PASTA_ESTUDIO, estudio, { recursive: true, filter: (f) => !fora.some((x) => f === x || f.startsWith(x + sep)) });
      ok("arquivos copiados");
    }
  }

  // ── 3. ferramentas da máquina ──────────────────────────────────────
  titulo("3/5 Ferramentas da máquina");
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
    } else {
      nao(`${nome} ficou de fora. Depois: ${cmd}`);
    }
  }

  if (estudio) {
    console.log(fraco("  instalando as dependências do estúdio (Remotion, React, Playwright)..."));
    roda("npm install --no-audit --no-fund", estudio) ? ok("dependências do estúdio (npm)") : nao("npm install falhou: rode dentro do estúdio");
    console.log(fraco("  baixando o navegador que o Remotion usa para renderizar..."));
    roda("npx remotion browser ensure", estudio) ? ok("navegador do Remotion") : nao("navegador do Remotion: rode 'npx remotion browser ensure' no estúdio");
    if (semPerguntas || (await sim("  Instalar o navegador do Playwright (para gravar tela)?"))) {
      const cmd = SO === "linux" ? "npx playwright install --with-deps chromium" : "npx playwright install chromium";
      roda(cmd, estudio) ? ok("navegador do Playwright") : nao(`navegador do Playwright: rode '${cmd}' no estúdio`);
    }
  }
  rl?.close();
  rl = null;

  // ── 4. chaves e voz ────────────────────────────────────────────────
  if (estudio) {
    titulo("4/5 Chaves e voz");
    const arqEnv = join(estudio, ".env");
    const atual = existsSync(arqEnv) ? readFileSync(arqEnv, "utf8") : "";
    const temNoEnv = (k) => new RegExp(`^${k}=.+`, "m").test(atual);
    const linhas = [];
    for (const [k, onde] of [
      ["ELEVENLABS_API_KEY", "elevenlabs.io → Configurações → API Keys (a voz)"],
      ["OPENAI_API_KEY", "platform.openai.com → API keys (a conferência da fala)"],
    ]) {
      if (temNoEnv(k)) {
        ok(`${k} já está no .env`);
        continue;
      }
      let v = process.env[k] || "";
      if (!v && !semPerguntas) v = await perguntarSegredo(`  ${k} ${fraco(`(${onde}; enter para pular)`)}: `);
      if (v) {
        linhas.push(`${k}=${v}`);
        ok(`${k} guardada em ${arqEnv}`);
      } else {
        nao(`${k} ficou de fora: ponha no ${arqEnv} depois (${onde})`);
      }
    }
    if (linhas.length) {
      writeFileSync(arqEnv, (atual ? atual.replace(/\n?$/, "\n") : "# Chaves do estúdio. Este arquivo é só seu: nunca vai para repositório.\n") + linhas.join("\n") + "\n");
      try {
        chmodSync(arqEnv, 0o600);
      } catch {}
    }
    const py = comandoPython();
    const temChaveVoz = temNoEnv("ELEVENLABS_API_KEY") || linhas.some((l) => l.startsWith("ELEVENLABS_API_KEY="));
    if (py && temChaveVoz) {
      console.log(fraco("  preparando a voz Raquel na sua conta do ElevenLabs e gerando um áudio de teste..."));
      roda(`${py} scripts/kit.py voz`, estudio) ? ok("voz pronta (ouça saida/teste-voz.mp3)") : nao(`a voz não ficou pronta: rode '${py} scripts/kit.py voz' no estúdio e leia a mensagem`);
    } else {
      nao("voz: depois de pôr a ELEVENLABS_API_KEY no .env, rode 'python3 scripts/kit.py voz' no estúdio");
    }
  }

  // ── 5. teste final ─────────────────────────────────────────────────
  if (estudio) {
    titulo("5/5 Teste");
    const py = comandoPython();
    py && roda(`${py} scripts/kit.py validar exemplo`, estudio, false) ? ok("a aula de exemplo passa na validação") : nao("validação da aula de exemplo falhou");
    roda("npx remotion compositions src/index.ts", estudio, false) ? ok("o Remotion monta o projeto") : nao("o Remotion não montou o projeto: rode 'npx remotion compositions src/index.ts' no estúdio");
  }

  titulo("Pronto");
  if (estudio) {
    const py = comandoPython() || "python3";
    console.log(`  Primeira aula: ${dourado(`cd ${pastaEstudio} && ${py} scripts/kit.py fazer exemplo --formatos h,v`)}`);
    console.log(`  Ajuste no ${fraco("kit.config.json")}: cores, nome e o convite final.`);
  }
  console.log(`  Ou abra o Claude e peça: ${dourado('"faz uma aula narrada animada de 2 minutos sobre <tema>"')}`);
  console.log(`  ou: ${dourado('"grava um tutorial de tela de como <fazer algo> no meu sistema"')}\n`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
