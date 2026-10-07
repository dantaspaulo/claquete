#!/usr/bin/env node
// Instalador do kit-video-ia: copia as skills para o Claude e, se você quiser,
// cria o estúdio (o projeto Remotion que renderiza as aulas).
//
//   npx github:dantaspaulo/kit-video-ia               interativo
//   npx github:dantaspaulo/kit-video-ia --tudo        tudo, global, sem perguntas
//   ... --projeto                                     skills em ./.claude/skills
//   ... --skills aula-animada,gravar-tela             só estas
//   ... --estudio ./meu-estudio                       cria o estúdio nessa pasta
//   ... --desinstalar                                 remove as skills do kit
//
// Sem dependências: só Node 18+. Nada é apagado: skill que já existe com o
// mesmo nome vira cópia de segurança antes de ser substituída.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_SKILLS = join(RAIZ, "skills");
const PASTA_ESTUDIO = join(RAIZ, "estudio");
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

function lerSkills() {
  return readdirSync(PASTA_SKILLS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PASTA_SKILLS, d.name, "SKILL.md")))
    .map((d) => {
      const md = readFileSync(join(PASTA_SKILLS, d.name, "SKILL.md"), "utf8");
      const resumo = (md.match(/^\s+resumo:\s*(.+)$/m) || md.match(/^description:\s*(.+)$/m) || [, ""])[1];
      return { nome: d.name, resumo: resumo.replace(/^["']|["']$/g, "").split(". ")[0].slice(0, 90) };
    });
}

function ferramenta(cmd) {
  try {
    execSync(`${cmd} 2>&1`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function copiarSkill(nome, destino) {
  const alvo = join(destino, nome);
  if (existsSync(alvo)) {
    const copia = `${alvo}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    renameSync(alvo, copia);
    console.log(fraco(`   já existia: guardei a anterior em ${copia}`));
  }
  cpSync(join(PASTA_SKILLS, nome), alvo, { recursive: true });
}

async function main() {
  const skills = lerSkills();
  console.log(`\n${dourado("◆ kit-video-ia")}  ${fraco("aulas narradas animadas e tutoriais de tela, com o Claude")}\n`);

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
  const rl = semPerguntas ? null : createInterface({ input: process.stdin, output: process.stdout });
  const perguntar = async (q, padrao) => {
    if (!rl) return padrao;
    const r = (await rl.question(`${q} ${fraco(`[${padrao}]`)} `)).trim();
    return r || padrao;
  };

  // 1. onde
  let destino = tem("--projeto") ? projeto : global;
  if (!tem("--projeto") && !tem("--global") && rl) {
    console.log(`${negrito("Onde instalar as skills?")}`);
    console.log(`  1) para você, em todos os projetos  ${fraco(global)}`);
    console.log(`  2) só neste projeto                 ${fraco(projeto)}`);
    destino = (await perguntar("Escolha", "1")) === "2" ? projeto : global;
  }

  // 2. quais
  let escolhidas = skills.map((s) => s.nome);
  if (valor("--skills")) {
    escolhidas = valor("--skills").split(",").map((s) => s.trim()).filter(Boolean);
  } else if (rl) {
    console.log(`\n${negrito("Quais skills?")}`);
    skills.forEach((s, i) => console.log(`  ${i + 1}) ${s.nome.padEnd(16)} ${fraco(s.resumo)}`));
    const r = await perguntar("Números separados por vírgula, ou enter para todas", "todas");
    if (r !== "todas") {
      escolhidas = r.split(",").map((n) => skills[Number(n.trim()) - 1]?.nome).filter(Boolean);
    }
  }
  const desconhecidas = escolhidas.filter((n) => !skills.some((s) => s.nome === n));
  if (desconhecidas.length) {
    console.error(`skill desconhecida: ${desconhecidas.join(", ")}`);
    process.exit(2);
  }

  mkdirSync(destino, { recursive: true });
  console.log(`\n${negrito("Instalando")} em ${destino}`);
  for (const nome of escolhidas) {
    copiarSkill(nome, destino);
    console.log(`  ${dourado("✓")} ${nome}`);
  }

  // 3. estúdio
  let pastaEstudio = valor("--estudio");
  if (!pastaEstudio && rl) {
    console.log(`\n${negrito("Criar o estúdio?")} ${fraco("(o projeto Remotion que renderiza as aulas; precisa para a skill aula-animada)")}`);
    const r = await perguntar("Pasta (ou 'nao' para pular)", "./estudio-video");
    if (!/^n(ao|ão|o)?$/i.test(r)) pastaEstudio = r;
  } else if (!pastaEstudio && tem("--tudo")) {
    pastaEstudio = "./estudio-video";
  }
  if (pastaEstudio) {
    const alvo = resolve(pastaEstudio);
    if (existsSync(alvo) && readdirSync(alvo).length) {
      console.log(`  ${alvo} já existe e não está vazia: não mexi. Escolha outra pasta com --estudio.`);
    } else {
      const fora = ["node_modules", "saida", join("public", "aulas"), join("public", "gravacoes")].map((x) => join(PASTA_ESTUDIO, x));
      cpSync(PASTA_ESTUDIO, alvo, { recursive: true, filter: (f) => !fora.some((x) => f === x || f.startsWith(x + sep)) });
      console.log(`  ${dourado("✓")} estúdio criado em ${alvo}`);
    }
  }
  rl?.close();

  // 4. o que falta na máquina
  console.log(`\n${negrito("Conferindo a máquina")}`);
  const checa = [
    ["Node 18+", Number(process.versions.node.split(".")[0]) >= 18, "https://nodejs.org"],
    ["ffmpeg", ferramenta("ffmpeg -version"), "brew install ffmpeg  |  apt install ffmpeg  |  winget install ffmpeg"],
    ["Python 3", ferramenta("python3 --version") || ferramenta("python --version"), "https://python.org"],
    ["ELEVENLABS_API_KEY", Boolean(process.env.ELEVENLABS_API_KEY), "crie em elevenlabs.io e exporte a variável (só para narrar)"],
  ];
  for (const [nome, ok, dica] of checa) {
    console.log(`  ${ok ? dourado("✓") : "·"} ${nome}${ok ? "" : fraco(`  →  ${dica}`)}`);
  }

  console.log(`\n${negrito("Próximos passos")}`);
  if (pastaEstudio) {
    console.log(`  cd ${pastaEstudio} && npm install`);
    console.log(`  npx playwright install chromium   ${fraco("(só para gravar tela)")}`);
    console.log(`  no kit.config.json: o voice_id da sua voz, o tema e o convite final`);
  }
  console.log(`  Abra o Claude e peça: ${dourado('"faz uma aula narrada animada de 2 minutos sobre <tema>"')}`);
  console.log(`  ou: ${dourado('"grava um tutorial de tela de como <fazer algo> no meu sistema"')}\n`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
