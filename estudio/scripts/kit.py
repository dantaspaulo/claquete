#!/usr/bin/env python3
"""Claquete.ai: do arquivo do vídeo ao vídeo conferido, parando nos dois pontos em que a decisão é sua.

  python3 scripts/kit.py novo <id> --tipo aula --minutos 3     cria aulas/<id>.json com o tipo e a duração escolhidos
  python3 scripts/kit.py validar <id>                    confere o arquivo (sem gastar nada)
  python3 scripts/kit.py plano <id>                      roteiro e plano de edição em saida/<id>/roteiro-e-plano.md
  python3 scripts/kit.py aprovar <id>                    PORTÃO 1: o ok do roteiro e do plano (mudou depois, pede de novo)
  python3 scripts/kit.py narrar <id> [--partes 1,3]      gera a voz de cada parte na ElevenLabs (paga)
  python3 scripts/kit.py conferir <id> [--aprovado]      PORTÃO 2: relatório da fala para o subagente; --aprovado libera
  python3 scripts/kit.py montar <id>                     plano do Remotion e conferência do ritmo e da duração
  python3 scripts/kit.py renderizar <id> [--formatos h]  renderiza no Remotion
  python3 scripts/kit.py finalizar <id> [--pagina]       som em -14 LUFS, tela parada, legendas, folha de quadros
  python3 scripts/kit.py entregar <id> --destino <pasta> copia o vídeo final e apaga a montagem
  python3 scripts/kit.py fazer <id> [--formatos h,v]     tudo, na ordem; para nos portões (código 2)
  python3 scripts/kit.py marca                           aplica marca/marca.json ao kit.config.json
  python3 scripts/kit.py voz                             põe a voz configurada na sua conta e gera um áudio de teste
  python3 scripts/kit.py versao

Só biblioteca padrão do Python. Precisa de ffmpeg/ffprobe e Node (npx remotion). Chave: ELEVENLABS_API_KEY, no
ambiente ou no .env do estúdio. Nenhuma outra API: a conferência da fala é da própria sessão do Claude (subagente),
com transcrição local e gratuita quando o faster-whisper estiver instalado.
"""
import argparse
import base64
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AULAS = RAIZ / "aulas"
PUBLIC = RAIZ / "public"
SAIDA = RAIZ / "saida"
FPS = 30
TIPOS = {"capa", "lista", "colunas", "fluxo", "frase", "numero", "video", "imagem"}
# Tipos de vídeo e a duração que cada um aceita (segundos, do vídeo pronto). Aula, caso e trilha: a pessoa escolhe de 2 a 5
# minutos ao começar o projeto ("minutos" no arquivo). "exemplo" é só para testar o estúdio.
DURACAO = {"aula": (120, 300), "caso": (120, 300), "trilha": (120, 300), "demonstracao": (60, 240), "dica": (30, 90),
           "exemplo": (10, 300)}
COM_MINUTOS = {"aula", "caso", "trilha"}
PALAVRAS_POR_SEGUNDO = 2.5  # fala em português, antes da velocidade
# A transcrição escreve número em algarismo ("2 minutos") onde o roteiro tem "dois minutos": na comparação, os dois viram
# algarismo. "um" e "uma" ficam de fora (quase sempre são artigo).
NUMEROS = {"zero": "0", "dois": "2", "duas": "2", "tres": "3", "quatro": "4", "cinco": "5", "seis": "6", "sete": "7",
           "oito": "8", "nove": "9", "dez": "10", "onze": "11", "doze": "12", "treze": "13", "catorze": "14", "quatorze": "14",
           "quinze": "15", "dezesseis": "16", "dezessete": "17", "dezoito": "18", "dezenove": "19", "vinte": "20",
           "trinta": "30", "quarenta": "40", "cinquenta": "50", "sessenta": "60", "setenta": "70", "oitenta": "80",
           "noventa": "90", "cem": "100"}
REVISAR_ABAIXO, REPROVAR_ABAIXO = 0.9, 0.75  # semelhança com o roteiro: entre os dois, o subagente decide
# O que a voz diz igual e o transcritor (ou o ouvinte) não distingue: o relatório da conferência aponta para o subagente.
HOMOFONOS = [(r"\bpor qu[eê]\b|\bporqu[eê]\b", "por que / por quê / porque soam iguais: troque a construção ('os motivos')"),
             (r"\bma[lu]\b", "mal / mau soam iguais"), (r"\bcon[cs]erto\b", "conserto / concerto soam iguais"),
             (r"\b(sess|se[cç]|cess)[aã]o\b", "sessão / seção / cessão soam iguais")]
RAIZ_VERSAO = RAIZ / "VERSAO"
LIMITES = {"lista": ("itens", 5), "fluxo": ("passos", 5)}
INICIO = 0.3          # silêncio antes da primeira fala
FOLGA_FINAL = 0.6     # depois da última fala, antes do convite
ENCERRAMENTO = 4.0    # segundos do convite final


class Erro(Exception):
    pass


class Portao(Erro):
    """Parada de propósito: falta a decisão da pessoa ou a revisão da sessão (sai com código 2)."""


def carregar_env():
    """Lê o .env do estúdio (criado pelo instalador) sem sobrescrever o que já está no ambiente."""
    arq = RAIZ / ".env"
    if not arq.exists():
        return
    for linha in arq.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        k, v = linha.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# ── utilidades ────────────────────────────────────────────────────────────

def cfg():
    return json.loads((RAIZ / "kit.config.json").read_text(encoding="utf-8"))


def aula(id_):
    if not re.fullmatch(r"[a-z0-9-]+", id_):
        raise Erro("id da aula: só letras minúsculas, números e hífen")
    arq = AULAS / f"{id_}.json"
    if not arq.exists():
        raise Erro(f"não achei {arq}")
    return json.loads(arq.read_text(encoding="utf-8"))


def pasta(id_):
    p = PUBLIC / "aulas" / id_
    p.mkdir(parents=True, exist_ok=True)
    return p


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s)


def palavras_de(texto):
    return [w for w in (norm(t) for t in texto.split()) if w]


def chave(nome):
    v = os.environ.get(nome, "").strip()
    if not v:
        raise Erro(f"falta a variável {nome} (exporte antes de rodar; nunca escreva a chave em arquivo do projeto)")
    return v


def roda(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        raise Erro(f"falhou: {' '.join(map(str, cmd[:4]))}...\n{r.stderr[-1500:]}")
    return r


def duracao_audio(arq):
    r = roda(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arq)])
    return float(r.stdout.strip())


def http_json(url, corpo, cabecalhos):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode(), headers={"content-type": "application/json", **cabecalhos})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise Erro(f"{url} respondeu {e.code}: {e.read()[:400].decode(errors='replace')}")


# ── validar ──────────────────────────────────────────────────────────────

def estimativa(a, c):
    """Segundos de fala estimados pelo número de palavras (antes de narrar), mais o encerramento."""
    palavras = sum(len(p.get("fala", "").split()) for p in a.get("partes", []))
    vel = c["voz"].get("velocidade", 1.0)
    pausa = c["voz"].get("pausa_entre_partes", 0.35)
    return palavras / (PALAVRAS_POR_SEGUNDO * vel) + pausa * max(0, len(a.get("partes", [])) - 1) + INICIO + FOLGA_FINAL + ENCERRAMENTO


def validar(id_, para_montar=False):
    """para_montar=False (plano, aprovar): gravação que ainda não existe é aviso (na demonstração, grava-se depois do ok).
    No montar ela é erro."""
    a = aula(id_)
    c = cfg()
    erros, avisos = [], []
    try:
        gerar_fontes(c)  # depois de um --atualizar o src/ volta ao padrão: aqui a fonte da marca volta junto
    except Erro as e:
        erros.append(str(e))
    if disco_livre_gb() < MINIMO_LIVRE_GB:
        avisos.append(f"só {disco_livre_gb():.1f} GB livres: a gravação e o render pedem pelo menos {MINIMO_LIVRE_GB} GB")
    tipo = a.get("tipo")
    if tipo not in DURACAO:
        erros.append(f"falta 'tipo' (um de {sorted(DURACAO)}); crie com: kit.py novo {id_} --tipo aula --minutos 3")
    elif tipo in COM_MINUTOS and a.get("minutos") not in (2, 3, 4, 5):
        erros.append(f"'{tipo}' precisa de 'minutos' entre 2 e 5, escolhido pela pessoa no começo do projeto")
    elif a.get("partes"):
        est = estimativa(a, c)
        lo, hi = DURACAO[tipo]
        if a.get("minutos"):
            lo, hi = max(lo, a["minutos"] * 60 * 0.8), min(hi + 0.01, a["minutos"] * 60 * 1.2)
        if not lo <= est <= hi:
            avisos.append(f"duração estimada {est:.0f} s fora do esperado para '{tipo}' ({lo:.0f} a {hi:.0f} s): ajuste o roteiro antes de aprovar")
    if not a.get("partes"):
        erros.append("a aula não tem partes")
    for campo in ("titulo", "cabecalho"):
        if not a.get(campo):
            erros.append(f"falta '{campo}'")
    proibidas = [norm(p) for p in c["travas"].get("proibidas_na_fala", [])]
    for i, p in enumerate(a.get("partes", []), 1):
        fala = p.get("fala", "")
        n = len(fala.split())
        if not fala:
            erros.append(f"parte {i}: sem fala")
        elif n > 50:
            avisos.append(f"parte {i}: {n} palavras (o ideal é 20 a 40, uma ideia por tela)")
        if "—" in fala or "–" in fala:
            erros.append(f"parte {i}: travessão na fala (a voz lê mal e tem cara de texto de IA)")
        for w in palavras_de(fala):
            if w in proibidas:
                erros.append(f"parte {i}: palavra proibida na fala: {w}")
        t = p.get("tela", {})
        if t.get("tipo") not in TIPOS:
            erros.append(f"parte {i}: tela.tipo deve ser um de {sorted(TIPOS)}")
            continue
        if t["tipo"] in LIMITES:
            campo, maximo = LIMITES[t["tipo"]]
            if len(t.get(campo, [])) > maximo:
                erros.append(f"parte {i}: {campo} tem mais de {maximo} itens (divida em duas partes)")
        if t["tipo"] in ("video", "imagem") and not (PUBLIC / t.get("arquivo", "")).is_file():
            (erros if para_montar else avisos).append(f"parte {i}: arquivo {t.get('arquivo')} não existe em public/"
                                                      + ("" if para_montar else " (grave depois do ok do roteiro)"))
        for z in t.get("zooms", []):
            f = z.get("foco", [])
            if len(f) != 4 or not (0 <= f[0] < f[2] <= 1 and 0 <= f[1] < f[3] <= 1):
                erros.append(f"parte {i}: zoom com foco inválido {f} (frações [x0, y0, x1, y1] da janela)")
        for campo in ("titulo", "sub", "nota", "legenda", "kicker"):
            if "—" in str(t.get(campo, "")):
                erros.append(f"parte {i}: travessão em tela.{campo}")
    return erros, avisos


# ── portão 1: roteiro e plano de edição ─────────────────────────────────

def assinatura_aula(a):
    """O que a pessoa aprovou: tudo, menos o 'de' das gravações, que o Claude acerta depois de gravar pelas marcas."""
    b = json.loads(json.dumps(a))
    for p in b.get("partes", []):
        if p.get("tela", {}).get("tipo") == "video":
            p["tela"].pop("de", None)
    return hashlib.sha256(json.dumps(b, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def arq_aprovacao(id_):
    return AULAS / f"{id_}.aprovado.json"


def aprovado(id_):
    arq = arq_aprovacao(id_)
    return arq.exists() and json.loads(arq.read_text(encoding="utf-8")).get("assinatura") == assinatura_aula(aula(id_))


def plano_md(id_):
    """O roteiro e o plano de edição num documento só, para a pessoa aprovar antes de qualquer gasto."""
    a, c = aula(id_), cfg()
    erros, avisos = validar(id_)
    linhas = [f"# {a.get('titulo', id_)}", "",
              f"**Tipo:** {a.get('tipo', '?')}" + (f" · **duração escolhida:** {a['minutos']} min" if a.get("minutos") else "")
              + f" · **estimada:** {estimativa(a, c) / 60:.1f} min · **partes:** {len(a.get('partes', []))}", ""]
    if a.get("caminho"):
        linhas += ["## Caminho na ferramenta (o que será gravado)", ""] + [f"{k}. {passo}" for k, passo in enumerate(a["caminho"], 1)] + [""]
    for i, p in enumerate(a.get("partes", []), 1):
        t = p.get("tela", {})
        linhas += [f"## {i}. {p.get('rotulo') or t.get('titulo') or ''}".rstrip(), "", f"> {p.get('fala', '')}", ""]
        tela = f"**Tela:** {t.get('tipo')}"
        if t.get("titulo"):
            tela += f" · {t['titulo'].replace('*', '')}"
        linhas.append(tela)
        for campo in ("itens", "passos"):
            for it in t.get(campo, []):
                txt = it.get("texto") if isinstance(it, dict) else it
                quando = f" (entra em \"{it['quando']}\")" if isinstance(it, dict) and it.get("quando") else ""
                linhas.append(f"- {txt}{quando}")
        if t.get("tipo") in ("video", "imagem"):
            linhas.append(f"**Plano de edição:** arquivo `{t.get('arquivo')}`"
                          + (f", começa em {t['de']} s" if t.get("de") is not None else "")
                          + (f", velocidade {t['velocidade']}x" if t.get("velocidade") else ""))
            for z in t.get("zooms", []):
                linhas.append(f"- zoom em {z.get('foco')} de \"{z.get('quando')}\"" + (f" até \"{z['ate']}\"" if z.get("ate") else ""))
        for ch in t.get("chips", []):
            linhas.append(f"- ficha \"{ch.get('texto')}\" em \"{ch.get('quando')}\"")
        linhas.append("")
    gravar = sorted({re.search(r"arquivo (\S+)", x).group(1) for x in avisos if "grave depois" in x})
    outros = [x for x in avisos if "grave depois" not in x]
    if gravar:
        linhas += ["## A gravar depois do ok", ""] + [f"- `{g}`" for g in gravar] + [""]
    if erros or outros:
        linhas += ["## A resolver antes do ok", ""] + [f"- ERRO: {x}" for x in erros] + [f"- aviso: {x}" for x in outros] + [""]
    linhas += ["---", f"Para aprovar: `python3 scripts/kit.py aprovar {id_}`. Qualquer mudança depois pede um ok novo."]
    destino = SAIDA / id_ / "roteiro-e-plano.md"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print(f"  roteiro e plano de edição: {destino}")
    for x in avisos:
        print("  aviso:", x)
    for x in erros:
        print("  ERRO:", x)
    return erros


def aprovar(id_):
    erros, _ = validar(id_)
    if erros:
        raise Erro("o arquivo tem erros; corrija e gere o plano de novo:\n  " + "\n  ".join(erros))
    from datetime import datetime
    arq_aprovacao(id_).write_text(json.dumps({"assinatura": assinatura_aula(aula(id_)), "quando": datetime.now().isoformat(timespec="seconds")},
                                             indent=1), encoding="utf-8")
    print(f"  roteiro e plano aprovados ({arq_aprovacao(id_).name})")


# ── marca ────────────────────────────────────────────────────────────────

def _rgb(h):
    h = h.lstrip("#")
    h = "".join(ch * 2 for ch in h) if len(h) == 3 else h[:6]
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def misturar(a, b, quanto):
    """Cor entre a e b: quanto=0 é a, quanto=1 é b."""
    return "#" + "".join(f"{round(x + (y - x) * quanto):02x}" for x, y in zip(_rgb(a), _rgb(b)))


def escuro(cor):
    r, g, b = _rgb(cor)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128


FONTES_PKG = RAIZ / "node_modules" / "@remotion" / "google-fonts" / "dist" / "cjs"


def gerar_fontes(c):
    """Escreve src/fontes.gen.ts com as fontes do tema (Google Fonts). Rodado pelo marca e pelo montar, então trocar a
    fonte no kit.config.json basta. A Inter vai sempre: é a reserva da pilha."""
    nomes = []
    for n in (c["tema"].get("fonte_titulo"), c["tema"].get("fonte_texto"), "Inter"):
        if n and n not in nomes:
            nomes.append(n)
    modulos = []
    for n in nomes:
        mod = re.sub(r"[^A-Za-z0-9]", "", n)
        if FONTES_PKG.is_dir() and not (FONTES_PKG / f"{mod}.js").is_file():
            raise Erro(f"a fonte \"{n}\" não está no Google Fonts (procurei {mod}). Troque em marca/marca.json "
                       "ou em kit.config.json, tema.fonte_titulo / tema.fonte_texto")
        modulos.append(mod)
    corpo = ("// Gerado por scripts/kit.py a partir de tema.fonte_titulo e tema.fonte_texto. Não edite à mão.\n"
             + "".join(f'import * as f{i} from "@remotion/google-fonts/{m}";\n' for i, m in enumerate(modulos))
             + f"\nexport const modulos = [{', '.join(f'f{i}' for i in range(len(modulos)))}];\n")
    arq = RAIZ / "src" / "fontes.gen.ts"
    if not arq.exists() or arq.read_text(encoding="utf-8") != corpo:
        arq.write_text(corpo, encoding="utf-8")


def aplicar_marca():
    """Leva marca/marca.json (do questionário da instalação ou da skill claquete-marca) para o kit.config.json."""
    arq = RAIZ / "marca" / "marca.json"
    if not arq.exists():
        raise Erro("não achei marca/marca.json: rode o instalador com o questionário, ou peça ao Claude \"configura minha marca\"")
    m = json.loads(arq.read_text(encoding="utf-8"))
    c = cfg()
    cores, fontes = m.get("cores", {}), m.get("fontes", {})
    for chave_tema, valor in (("destaque", cores.get("principal")), ("destaque2", cores.get("secundaria") or cores.get("principal")),
                              ("fundo", cores.get("fundo")), ("texto", cores.get("texto")), ("marca", m.get("nome")),
                              ("fonte_titulo", fontes.get("titulos")), ("fonte_texto", fontes.get("texto"))):
        if valor:
            c["tema"][chave_tema] = valor
    # o resto da paleta sai do fundo: escuro pede texto claro, claro pede texto escuro, e o painel e a janela ficam
    # um tom acima do fundo (sem isso, uma marca de fundo claro sai com painéis escuros do tema padrão)
    t = c["tema"]
    if cores.get("fundo"):
        t["texto"] = cores.get("texto") or ("#f1f4f2" if escuro(t["fundo"]) else "#14171a")
        t["fundo2"] = cores.get("fundo2") or misturar(t["fundo"], t["texto"], 0.07)
        t["janela"] = cores.get("janela") or misturar(t["fundo"], t["texto"], 0.03)
        t["suave"] = cores.get("suave") or misturar(t["texto"], t["fundo"], 0.4)
        if not escuro(t["fundo"]) and "fundo_imagem" not in m:
            t["fundo_imagem"] = ""  # as fotos prontas escurecem atrás da janela: com texto escuro, o fim e a legenda somem
    if "fundo_imagem" in m:
        t["fundo_imagem"] = m["fundo_imagem"]
    if m.get("logo") and (PUBLIC / m["logo"]).is_file():
        c["tema"]["logo"] = m["logo"]  # aparece no encerramento de todo vídeo
    cta = m.get("chamada", {})
    if cta.get("texto"):
        c["convite"]["titulo"] = cta["texto"]
    if cta.get("endereco") or m.get("site"):
        c["convite"]["endereco"] = cta.get("endereco") or m.get("site")
        c["convite"]["texto"] = cta.get("linha", "")
    proibidas = set(c["travas"].get("proibidas_na_fala", [])) | set(m.get("palavras_proibidas", []))
    c["travas"]["proibidas_na_fala"] = sorted(proibidas)
    if m.get("voz", {}).get("voice_id"):
        c["voz"]["elevenlabs"]["voice_id"] = m["voz"]["voice_id"]
        c["voz"]["elevenlabs"]["nome"] = m["voz"].get("nome", "Voz da marca")
        c["voz"]["elevenlabs"].pop("dono_publico", None)
    gerar_fontes(c)
    (RAIZ / "kit.config.json").write_text(json.dumps(c, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  marca \"{m.get('nome', '?')}\" aplicada ao kit.config.json (cores, fontes, convite, palavras proibidas)")


# ── narrar ───────────────────────────────────────────────────────────────

def falado(fala, pronuncia):
    """Texto que vai para a voz e, para cada palavra escrita, o trecho [ini, fim) dela no texto falado."""
    pron = {k: v for k, v in pronuncia.items() if not k.startswith("_")}
    pedacos, spans, pos = [], [], 0
    for tok in fala.split():
        m = re.match(r"^(\W*)(.*?)(\W*)$", tok)
        antes, nucleo, depois = m.groups()
        dito = antes + pron.get(nucleo, nucleo) + depois
        if pedacos:
            pos += 1
        spans.append((pos, pos + len(dito)))
        pedacos.append(dito)
        pos += len(dito)
    return " ".join(pedacos), spans


def tts_elevenlabs(texto, anterior, seguinte, c):
    v = c["voz"]["elevenlabs"]
    if not v.get("voice_id"):
        raise Erro("defina voz.elevenlabs.voice_id no kit.config.json")
    ajustes = dict(v.get("voice_settings", {}))
    corpo = {"text": texto, "model_id": v["model_id"], "voice_settings": ajustes}
    if anterior:
        corpo["previous_text"] = anterior
    if seguinte:
        corpo["next_text"] = seguinte
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{v['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    r = json.loads(http_json(url, corpo, {"xi-api-key": chave("ELEVENLABS_API_KEY")}))
    al = r.get("alignment") or r.get("normalized_alignment")
    return base64.b64decode(r["audio_base64"]), al


def tempos_por_caracteres(spans, al, fala):
    starts, ends = al["character_start_times_seconds"], al["character_end_times_seconds"]
    out = []
    for tok, (a, b) in zip(fala.split(), spans):
        a, b = min(a, len(starts) - 1), min(max(a, b - 1), len(ends) - 1)
        out.append({"p": tok, "ini": round(starts[a], 3), "fim": round(ends[b], 3)})
    return out


def assinatura_parte(fala, c):
    """Muda quando a fala, a voz ou a pronúncia de uma palavra DESTA fala muda. Mexer na pronúncia de outra palavra
    não paga a narração desta parte de novo."""
    usadas = {k: v for k, v in c["pronuncia"].items() if not k.startswith("_") and re.search(rf"(?<!\w){re.escape(k)}(?!\w)", fala)}
    return hashlib.sha256(json.dumps([fala, c["voz"], usadas], sort_keys=True).encode()).hexdigest()[:16]


def narrar(id_, partes=None):
    a, c = aula(id_), cfg()
    if not aprovado(id_):
        raise Erro(f"o roteiro ainda não foi aprovado (ou mudou depois do ok). Rode: kit.py plano {id_}, mostre e, com o ok, kit.py aprovar {id_}")
    d = pasta(id_)
    provedor = c["voz"].get("provedor", "elevenlabs")
    if provedor != "elevenlabs":
        raise Erro("a voz é da ElevenLabs (voz.provedor = \"elevenlabs\" no kit.config.json)")
    vel = c["voz"].get("velocidade", 1.0)
    falas = [p["fala"] for p in a["partes"]]
    for i, fala in enumerate(falas, 1):
        if partes and i not in partes:
            continue
        mp3, meta = d / f"parte-{i:02d}.mp3", d / f"parte-{i:02d}.json"
        assinatura = assinatura_parte(fala, c)
        if not partes and meta.exists() and json.loads(meta.read_text()).get("assinatura") == assinatura and mp3.exists():
            print(f"  parte {i}: já narrada (mesma fala e voz)")
            continue
        texto, spans = falado(fala, c["pronuncia"])
        audio, al = tts_elevenlabs(texto, falas[i - 2] if i > 1 else "", falas[i] if i < len(falas) else "", c)
        palavras = tempos_por_caracteres(spans, al, fala)
        # A velocidade é aplicada depois, igual para qualquer modelo (nem todo modelo respeita "speed").
        if abs(vel - 1.0) > 0.01:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as t:
                t.write(audio)
            roda(["ffmpeg", "-y", "-loglevel", "error", "-i", t.name, "-filter:a", f"atempo={vel}", "-b:a", "160k", str(mp3)])
            os.unlink(t.name)
            palavras = [{"p": w["p"], "ini": round(w["ini"] / vel, 3), "fim": round(w["fim"] / vel, 3)} for w in palavras]
        else:
            mp3.write_bytes(audio)
        meta.write_text(json.dumps({"assinatura": assinatura, "fala": fala, "palavras": palavras}, ensure_ascii=False, indent=1))
        print(f"  parte {i}: {duracao_audio(mp3):.1f} s")


# ── voz: deixar a voz pronta na conta ───────────────────────────────────

def http(metodo, url, chave_api, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo,
                                 headers={"xi-api-key": chave_api, "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def preparar_voz():
    c = cfg()
    if c["voz"].get("provedor", "elevenlabs") != "elevenlabs":
        print("  provedor de voz não é o ElevenLabs: nada a preparar")
        return
    v = c["voz"]["elevenlabs"]
    k = chave("ELEVENLABS_API_KEY")
    status, d = http("GET", f"https://api.elevenlabs.io/v1/voices/{v['voice_id']}", k)
    if status == 200:
        print(f"  a voz {v.get('nome', v['voice_id'])} já está disponível na sua conta")
    elif v.get("dono_publico"):
        status, d = http("POST", f"https://api.elevenlabs.io/v1/voices/add/{v['dono_publico']}/{v['voice_id']}", k,
                         {"new_name": f"{v.get('nome', 'Voz')} (Claquete)"})
        if status != 200:
            raise Erro(f"não consegui pôr a voz na sua conta ({status}: {json.dumps(d)[:300]}). "
                       "Adicione-a pela biblioteca de vozes do site do ElevenLabs e rode de novo.")
        novo = d.get("voice_id", v["voice_id"])
        if novo != v["voice_id"]:
            texto = (RAIZ / "kit.config.json").read_text(encoding="utf-8").replace(v["voice_id"], novo)
            (RAIZ / "kit.config.json").write_text(texto, encoding="utf-8")
            print(f"  voice_id atualizado no kit.config.json: {novo}")
        print(f"  voz {v.get('nome')} adicionada à sua conta")
        c = cfg()
    else:
        raise Erro(f"a voz {v['voice_id']} não está na sua conta ({status}). Confira o voice_id.")
    SAIDA.mkdir(exist_ok=True)
    audio, _ = tts_elevenlabs("Olá! Esta é a voz do seu estúdio. Tudo pronto para a primeira aula.", "", "", c)
    (SAIDA / "teste-voz.mp3").write_bytes(audio)
    print(f"  áudio de teste: {SAIDA / 'teste-voz.mp3'}")


# ── conferir ─────────────────────────────────────────────────────────────

def transcricao_local(mp3s, c):
    """Transcrição LOCAL e gratuita (faster-whisper) de todas as partes de uma vez, quando instalada (o instalador põe num
    .venv do estúdio). Nada sai da máquina. Sem ela, devolve None e a revisão fica com a sessão e com o ouvido da pessoa."""
    modelo = c.get("conferencia", {}).get("modelo_local", "small")
    venv = RAIZ / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not venv.exists():
        return None
    script = ("import sys, json\nfrom faster_whisper import WhisperModel\n"
              f"m = WhisperModel({modelo!r}, compute_type='int8')\n"
              "print(json.dumps([' '.join(x.text.strip() for x in m.transcribe(a, language='pt')[0]) for a in sys.argv[1:]]))")
    print(f"  transcrição local ({modelo}), {len(mp3s)} partes...")
    r = subprocess.run([str(venv), "-c", script, *map(str, mp3s)], capture_output=True, text=True)
    if r.returncode:
        print(f"  (transcrição local falhou: {r.stderr.strip()[-300:]})")
        return None
    return json.loads(r.stdout.strip().splitlines()[-1])


def alertas_da_fala(fala, c):
    out = []
    for padrao, msg in HOMOFONOS:
        if re.search(padrao, fala, re.I):
            out.append(msg)
    if re.search(r"\b(1[5-9]|20)\d\d\b", fala):
        out.append("ano no texto: confira se a voz leu como número")
    pron = {k for k in c["pronuncia"] if not k.startswith("_")}
    for sigla in sorted(set(re.findall(r"\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}\b", fala)) - pron):
        out.append(f"sigla {sigla} sem pronúncia em kit.config.json: confira como a voz leu")
    return out


def conferir(id_, aprovar_agora=False):
    """PORTÃO 2. Gera o relatório da fala de cada parte para a revisão da sessão (subagente) e só libera o montar com
    --aprovado. Com o faster-whisper instalado, o relatório traz o que foi ouvido e a semelhança com o roteiro."""
    a, c = aula(id_), cfg()
    d = pasta(id_)
    rel_arq, ok_arq = d / "conferencia.json", d / "conferencia-aprovada.json"
    assinaturas = []
    for i in range(1, len(a["partes"]) + 1):
        meta = d / f"parte-{i:02d}.json"
        if not (d / f"parte-{i:02d}.mp3").exists() or not meta.exists():
            raise Erro(f"parte {i} ainda não foi narrada")
        assinaturas.append(json.loads(meta.read_text(encoding="utf-8"))["assinatura"])
    if aprovar_agora:
        if not rel_arq.exists() or json.loads(rel_arq.read_text(encoding="utf-8")).get("assinaturas") != assinaturas:
            raise Erro(f"a narração mudou depois do relatório (ou ele não existe): rode kit.py conferir {id_} e revise de novo")
        rel = json.loads(rel_arq.read_text(encoding="utf-8"))
        ruins = [p["parte"] for p in rel["partes"] if p.get("similaridade") is not None and not p["ok"]]
        if ruins:
            raise Erro(f"a transcrição local reprovou as partes {ruins} (menos de {REPROVAR_ABAIXO:.0%} de semelhança): reescreva a "
                       "frase e narre de novo (narrar --partes), ou, se o texto estiver certo e só a grafia mudou, ponha a troca em travas.aceitar")
        ok_arq.write_text(json.dumps({"assinaturas": assinaturas}, indent=1), encoding="utf-8")
        print("  fala aprovada: pode montar")
        return
    minimo = c["travas"].get("similaridade_minima", REVISAR_ABAIXO)
    aceitar = {norm(k): norm(v) for k, v in c["travas"].get("aceitar", {}).items()}
    partes = []
    ouvidos = transcricao_local([d / f"parte-{i:02d}.mp3" for i in range(1, len(a["partes"]) + 1)], c)
    local = ouvidos is not None
    for i, p in enumerate(a["partes"], 1):
        mp3 = d / f"parte-{i:02d}.mp3"
        ouvido = ouvidos[i - 1] if local else None
        item = {"parte": i, "audio": str(mp3.relative_to(RAIZ)), "duracao": round(duracao_audio(mp3), 2), "fala": p["fala"],
                "falado": falado(p["fala"], c["pronuncia"])[0], "alertas": alertas_da_fala(p["fala"], c),
                "ouvido": ouvido, "similaridade": None, "diferencas": [], "ok": None}
        if ouvido is not None:
            esperado = [NUMEROS.get(w, w) for w in (aceitar.get(w, w) for w in palavras_de(p["fala"]))]
            escutado = [NUMEROS.get(w, w) for w in (aceitar.get(w, w) for w in palavras_de(ouvido))]
            sm = difflib.SequenceMatcher(None, esperado, escutado, autojunk=False)
            item["similaridade"] = round(sm.ratio(), 3)
            item["diferencas"] = [f"{' '.join(esperado[i1:i2]) or '∅'} → {' '.join(escutado[j1:j2]) or '∅'}"
                                  for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
            item["ok"] = sm.ratio() >= REPROVAR_ABAIXO
            item["situacao"] = "ok" if sm.ratio() >= minimo else ("revisar" if item["ok"] else "reprovada")
        partes.append(item)
        estado = "" if item["ok"] is None else f" {item['similaridade']:.0%} {item['situacao'].upper() if item['situacao'] != 'ok' else 'ok'}"
        if item.get("situacao") == "revisar":
            estado += f" ({'; '.join(item['diferencas'][:3])})"
        print(f"  parte {i}:{estado}" + (f"  alertas: {'; '.join(item['alertas'])}" if item["alertas"] else ""))
    rel_arq.write_text(json.dumps({"assinaturas": assinaturas, "transcricao_local": bool(local), "partes": partes},
                                  ensure_ascii=False, indent=1), encoding="utf-8")
    if ok_arq.exists():
        ok_arq.unlink()
    raise Portao(f"revisão da fala: um subagente da sessão lê {rel_arq.relative_to(RAIZ)} e confere cada parte (fala exata, "
                 "pronúncia, siglas, palavras que soam iguais" + ("" if local else "; sem transcrição local, a pessoa ouve os áudios")
                 + f"). Aprovou: kit.py conferir {id_} --aprovado. Reprovou: reescreva a frase e narre a parte de novo.")


# ── montar: plano, ritmo e índice ───────────────────────────────────────

def momento(palavras, marca):
    if not marca:
        return None
    alvo, _, vez = marca.partition("#")
    vez, n, achadas = int(vez or 1), norm(alvo), 0
    for w in palavras:
        if norm(w["p"]) == n:
            achadas += 1
            if achadas == vez:
                return w["ini"]
    return None


def agenda(itens, palavras, duracao, inicio=1.0, fim_frac=0.78):
    fim = max(inicio + 0.5, duracao * fim_frac)
    passo = (fim - inicio) / (len(itens) - 1) if len(itens) > 1 else 0
    out = []
    for i, it in enumerate(itens):
        marca = it.get("quando") if isinstance(it, dict) else None
        t = momento(palavras, marca)
        out.append(t if t is not None else inicio + passo * i)
    return out


def eventos(tela, palavras, dur):
    """RITMO: os mesmos tempos de entrada de src/cenas/Cenas.tsx."""
    t, ev = tela["tipo"], [0.0]
    if t in ("capa", "lista", "fluxo", "frase", "colunas"):
        ev.append(0.15)
    if t == "capa" and tela.get("sub"):
        ev.append(1.2)
    if t == "lista":
        ev += agenda(tela["itens"], palavras, dur)
    if t == "colunas":
        ev += [0.6, dur * 0.5]
        ev += agenda(tela["esquerda"]["itens"], palavras, dur, 1.0, 0.45)
        ev += agenda(tela["direita"]["itens"], palavras, dur, dur * 0.5 + 0.4, 0.85)
    if t == "fluxo":
        ev += agenda(tela["passos"], palavras, dur, 1.0, 0.8)
        if tela.get("nota"):
            ev.append(dur * 0.85)
    if t == "frase" and tela.get("sub"):
        ev.append(max(1.6, dur * 0.5))
    if t == "numero":
        fim = 0.4 + min(2.5, dur * 0.4)
        ev += [x / 10 for x in range(4, int(fim * 10) + 1, 5)]  # o número contando é informação nova
        if tela.get("legenda"):
            ev.append(fim + 0.3)
    if t in ("video", "imagem"):
        ev.append(0.3)
        for z in tela.get("zooms", []):
            ev += [x for x in (momento(palavras, z["quando"]), momento(palavras, z.get("ate"))) if x is not None]
    for ch in tela.get("chips", []):
        x = momento(palavras, ch["quando"])
        if x is not None:
            ev.append(x)
    return sorted(ev)


def marcas_da_tela(tela):
    out = []
    for campo in ("itens", "passos"):
        out += [it["quando"] for it in tela.get(campo, []) if isinstance(it, dict) and it.get("quando")]
    for lado in ("esquerda", "direita"):
        out += [it["quando"] for it in tela.get(lado, {}).get("itens", []) if isinstance(it, dict) and it.get("quando")]
    out += [ch["quando"] for ch in tela.get("chips", [])]
    for z in tela.get("zooms", []):
        out += [z["quando"]] + ([z["ate"]] if z.get("ate") else [])
    return out


def montar(id_, formatos):
    a, c = aula(id_), cfg()
    d = pasta(id_)
    erros, avisos = validar(id_, para_montar=True)
    if erros:
        raise Erro("arquivo da aula com problema:\n  " + "\n  ".join(erros))
    ok_arq = d / "conferencia-aprovada.json"
    assin = [json.loads((d / f"parte-{i:02d}.json").read_text(encoding="utf-8")).get("assinatura") for i in range(1, len(a["partes"]) + 1)
             if (d / f"parte-{i:02d}.json").exists()]
    if not ok_arq.exists() or json.loads(ok_arq.read_text(encoding="utf-8")).get("assinaturas") != assin:
        raise Portao(f"a fala ainda não foi aprovada na revisão (ou foi narrada de novo depois): kit.py conferir {id_}")
    limite = c["travas"].get("tela_parada_segundos", 2.5)
    pausa = c["voz"].get("pausa_entre_partes", 0.35)
    partes, t = [], INICIO
    ritmo = []
    for i, p in enumerate(a["partes"], 1):
        meta = json.loads((d / f"parte-{i:02d}.json").read_text(encoding="utf-8"))
        if meta["fala"] != p["fala"]:
            raise Erro(f"parte {i}: a fala mudou depois da narração. Rode: kit.py narrar {id_} --partes {i}")
        dur = duracao_audio(d / f"parte-{i:02d}.mp3")
        for m in marcas_da_tela(p["tela"]):
            if momento(meta["palavras"], m) is None:
                erros.append(f"parte {i}: a fala não tem a palavra '{m}' (usada em 'quando')")
        ev = eventos(p["tela"], meta["palavras"], dur) + [dur + pausa]
        maior = max(b - a_ for a_, b in zip(ev, ev[1:]))
        # Gravação de tela já se mexe sozinha: quem mede o ritmo dela é o medidor de tela parada, no vídeo pronto.
        if maior > limite and p["tela"]["tipo"] != "video":
            onde = next(a_ for a_, b in zip(ev, ev[1:]) if b - a_ == maior)
            ritmo.append(f"parte {i}: {maior:.1f} s sem nada novo a partir de {onde:.1f} s (limite {limite} s). "
                         f"Ponha um 'quando' num item, uma ficha em 'chips', ou divida a parte.")
        partes.append({"fala": p["fala"], "rotulo": p.get("rotulo"), "tela": p["tela"],
                       "audio": f"aulas/{id_}/parte-{i:02d}.mp3", "inicio": round(t, 3),
                       "duracao": round(dur, 3), "palavras": meta["palavras"]})
        t += dur + pausa
    if erros:
        raise Erro("\n  ".join(erros))
    total = round(t - pausa + FOLGA_FINAL + ENCERRAMENTO, 3)
    lo, hi = DURACAO[a["tipo"]]
    if a.get("minutos"):
        lo, hi = max(lo, a["minutos"] * 60 * 0.8), min(hi, a["minutos"] * 60 * 1.2)
    if not lo <= total <= hi:
        raise Erro(f"o vídeo tem {total:.0f} s e '{a['tipo']}'" + (f" de {a['minutos']} min" if a.get("minutos") else "")
                   + f" aceita de {lo:.0f} a {hi:.0f} s: ajuste o roteiro (ou divida em dois vídeos)")
    for x in avisos:
        print("  aviso:", x)
    if ritmo:
        raise Erro("ritmo: tela parada demais\n  " + "\n  ".join(ritmo))
    tema = {k: v for k, v in c["tema"].items() if not k.startswith("_")}
    trilha = c.get("trilha", {})
    plano = {"id": id_, "titulo": a["titulo"], "cabecalho": a["cabecalho"], "formatos": ["h", "v"],
             "destaques": a.get("destaques", []), "partes": partes, "pausa": pausa, "encerramento": ENCERRAMENTO,
             "total": total, "tema": tema, "convite": a.get("convite") or c["convite"],
             "trilha": {"arquivo": trilha.get("arquivo", ""), "volume": trilha.get("volume", 0.07)}}
    (d / "plano.json").write_text(json.dumps(plano, ensure_ascii=False, indent=1))
    gerar_fontes(c)
    indice()
    print(f"  plano: {len(partes)} partes, {total:.1f} s, ritmo ok")


def indice():
    planos = {}
    for p in sorted((PUBLIC / "aulas").glob("*/plano.json")):
        planos[p.parent.name] = json.loads(p.read_text(encoding="utf-8"))
    corpo = json.dumps(planos, ensure_ascii=False, indent=1)
    (RAIZ / "src" / "indice.gen.ts").write_text(
        "// Gerado por scripts/kit.py. Não edite à mão.\nimport type { Plano } from \"./tipos\";\n\n"
        f"export const AULAS: Record<string, Plano> = {corpo} as Record<string, Plano>;\n", encoding="utf-8")


# ── renderizar e finalizar ───────────────────────────────────────────────

MINIMO_LIVRE_GB = 5


def disco_livre_gb():
    return shutil.disk_usage(RAIZ).free / 1e9


def renderizar(id_, formatos, concorrencia=None):
    # o render escreve milhares de quadros temporários; com o disco quase cheio o Mac trava no meio
    if disco_livre_gb() < MINIMO_LIVRE_GB:
        raise Erro(f"só {disco_livre_gb():.1f} GB livres no disco (mínimo {MINIMO_LIVRE_GB}): entregue vídeos prontos "
                   "(kit.py entregar) ou libere espaço antes de renderizar")
    out = SAIDA / id_
    out.mkdir(parents=True, exist_ok=True)
    npx = shutil.which("npx") or "npx"
    for f in formatos:
        destino = out / f"{id_}-{f}-bruto.mp4"
        print(f"  renderizando {f}...")
        extra = [f"--concurrency={concorrencia}"] if concorrencia else []
        r = subprocess.run([npx, "remotion", "render", "src/index.ts", f"Aula-{id_}-{f}", str(destino), "--log=error", *extra], cwd=RAIZ)
        if r.returncode:
            raise Erro("o render falhou (veja a mensagem acima)")


def loudnorm(entrada, saida):
    medir = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(entrada), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                            "-f", "null", "-"], capture_output=True, text=True)
    m = json.loads(re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", medir.stderr)[-1])
    filtro = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
              f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    roda(["ffmpeg", "-y", "-loglevel", "error", "-i", str(entrada), "-c:v", "copy", "-af", filtro, "-ar", "48000",
          "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(saida)])


# Sensibilidade do medidor. Medido no exemplo: com 0.004 ele não vê uma ficha pequena entrando e acusa
# tela parada onde há novidade; com 0.001 o resultado bate com a conferência do ritmo no plano. Dentro
# da janela nada se mexe sozinho (sem pulsar, sem deriva), então 0.001 não esconde tela parada.
RUIDO = 0.001


def tela_parada(video, formato, limite, ate_segundo):
    # Mede só a área de dentro da janela (sem a barra): a legenda e o fundo mudam sempre e esconderiam a tela parada.
    j = {"h": (200, 196, 1520, 724), "v": (40, 336, 1000, 1134)}[formato]  # = LAYOUT de src/layout.ts, sem a barra
    r = subprocess.run(["ffmpeg", "-hide_banner", "-t", f"{ate_segundo:.2f}", "-i", str(video), "-vf",
                        f"crop={j[2]}:{j[3]}:{j[0]}:{j[1]},scale=480:-2,freezedetect=n={RUIDO}:d={limite}",
                        "-an", "-f", "null", "-"], capture_output=True, text=True)
    return re.findall(r"freeze_start: ([\d.]+)", r.stderr)


def legendas(plano, destino):
    """Arquivos de legenda (.vtt e .srt) a partir dos tempos das palavras, em blocos de até ~42 letras."""
    blocos = []
    for parte in plano["partes"]:
        atual, letras = [], 0
        for w in parte["palavras"]:
            if atual and letras + len(w["p"]) > 42:
                blocos.append(atual)
                atual, letras = [], 0
            atual.append((parte["inicio"] + w["ini"], parte["inicio"] + w["fim"], w["p"]))
            letras += len(w["p"]) + 1
        if atual:
            blocos.append(atual)

    def ts(seg, sep):
        h, r = divmod(seg, 3600)
        m, s = divmod(r, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(s):02d}{sep}{int(round((s % 1) * 1000)):03d}"

    vtt, srt = ["WEBVTT", ""], []
    for i, b in enumerate(blocos, 1):
        proximo = blocos[i][0][0] if i < len(blocos) else float("inf")
        ini, fim, txt = b[0][0], min(b[-1][1] + 0.15, proximo - 0.01), " ".join(x[2] for x in b)
        vtt += [f"{ts(ini, '.')} --> {ts(fim, '.')}", txt, ""]
        srt += [str(i), f"{ts(ini, ',')} --> {ts(fim, ',')}", txt, ""]
    destino.with_suffix(".vtt").write_text("\n".join(vtt), encoding="utf-8")
    destino.with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")


def finalizar(id_, formatos, pagina=False):
    c = cfg()
    plano = json.loads((pasta(id_) / "plano.json").read_text(encoding="utf-8"))
    legendas(plano, SAIDA / id_ / id_)
    limite = c["travas"].get("tela_parada_segundos", 2.5)
    for f in formatos:
        bruto, final = SAIDA / id_ / f"{id_}-{f}-bruto.mp4", SAIDA / id_ / f"{id_}-{f}.mp4"
        if bruto.exists():
            loudnorm(bruto, final)
            bruto.unlink()
        elif not final.exists():
            raise Erro(f"não há render de {f}: rode kit.py renderizar {id_} --formatos {f}")
        paradas = tela_parada(final, f, limite, plano["total"] - plano["encerramento"])
        folha = SAIDA / id_ / f"{id_}-{f}-folha.jpg"
        passo = max(1.0, plano["total"] / 16)
        roda(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final), "-vf", f"fps=1/{passo:.2f},scale=480:-2,tile=4x4",
              "-frames:v", "1", str(folha)])
        print(f"  {final.name}: som em -14 LUFS · folha em {folha.name}")
        if paradas:
            raise Erro(f"tela parada por {limite} s ou mais em {f} a partir de: {', '.join(paradas)} s")
        if pagina:
            leve = SAIDA / id_ / f"{id_}-{f}-pagina"
            roda(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final), "-c:v", "libx264", "-preset", "slow", "-crf", "28",
                  "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", f"{leve}.mp4"])
            codificadores = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
            if "libsvtav1" in codificadores:
                roda(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final), "-c:v", "libsvtav1", "-preset", "6", "-crf", "42",
                      "-c:a", "libopus", "-b:a", "80k", "-movflags", "+faststart", f"{leve}-av1.mp4"])
            else:
                print("  (sem libsvtav1 no ffmpeg: pulei a versão AV1)")
            poster = f"{leve}-poster.webp" if "libwebp" in codificadores else f"{leve}-poster.jpg"
            roda(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(final), "-frames:v", "1", poster])
            print(f"  versão para página em {leve.name}*")
    print(f"  pronto: {SAIDA / id_}")


# ── entregar: só o vídeo final fica ────────────────────────────────────

def entregar(id_, destino):
    """Copia o vídeo pronto (e legendas, versões de página) para a pasta da pessoa, confere a cópia e apaga a montagem.
    O arquivo do roteiro (aulas/<id>.json) fica, para refazer depois; refazer narra de novo (paga)."""
    origem = SAIDA / id_
    finais = sorted(p for p in origem.glob(f"{id_}*") if p.suffix in (".mp4", ".vtt", ".srt", ".webp", ".jpg") and "bruto" not in p.name
                    and "folha" not in p.name)
    if not any(p.suffix == ".mp4" for p in finais):
        raise Erro(f"não há vídeo pronto em {origem}: rode até o finalizar")
    alvo = Path(destino).expanduser().resolve()
    alvo.mkdir(parents=True, exist_ok=True)
    for p in finais:
        shutil.copy2(p, alvo / p.name)
        if (alvo / p.name).stat().st_size != p.stat().st_size:
            raise Erro(f"a cópia de {p.name} não bateu de tamanho: nada foi apagado")
    shutil.rmtree(PUBLIC / "aulas" / id_, ignore_errors=True)
    shutil.rmtree(origem, ignore_errors=True)
    indice()
    print(f"  entregue em {alvo}: {', '.join(p.name for p in finais)}; a montagem foi apagada")


def novo(id_, tipo, minutos):
    if tipo not in DURACAO:
        raise Erro(f"--tipo: um de {sorted(DURACAO)}")
    if tipo in COM_MINUTOS and minutos not in (2, 3, 4, 5):
        raise Erro(f"'{tipo}' precisa de --minutos entre 2 e 5 (a pessoa escolhe)")
    arq = AULAS / f"{id_}.json"
    if arq.exists():
        raise Erro(f"{arq.name} já existe")
    if not re.fullmatch(r"[a-z0-9-]+", id_):
        raise Erro("id: só letras minúsculas, números e hífen")
    a = {"titulo": "", "cabecalho": "", "tipo": tipo, **({"minutos": minutos} if tipo in COM_MINUTOS else {}), "destaques": [],
         "partes": [{"fala": "", "rotulo": "", "tela": {"tipo": "capa", "kicker": "", "titulo": ""}}]}
    arq.write_text(json.dumps(a, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    lo, hi = DURACAO[tipo]
    alvo = f"{minutos} min" if minutos else f"{lo} a {hi} s"
    print(f"  criado {arq.relative_to(RAIZ)} ({tipo}, {alvo}). Escreva o roteiro, gere o plano e peça o ok.")


def conferencia_ok(id_):
    d = pasta(id_)
    ok_arq = d / "conferencia-aprovada.json"
    if not ok_arq.exists():
        return False
    n = len(aula(id_)["partes"])
    assin = [json.loads((d / f"parte-{i:02d}.json").read_text(encoding="utf-8")).get("assinatura") for i in range(1, n + 1)
             if (d / f"parte-{i:02d}.json").exists()]
    return json.loads(ok_arq.read_text(encoding="utf-8")).get("assinaturas") == assin


# ── linha de comando ─────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("comando", choices=["novo", "validar", "plano", "aprovar", "narrar", "conferir", "montar", "renderizar",
                                        "finalizar", "entregar", "fazer", "marca", "voz", "versao"])
    ap.add_argument("id", nargs="?")
    ap.add_argument("--tipo", help="novo: " + ", ".join(sorted(DURACAO)))
    ap.add_argument("--minutos", type=int, help="novo: duração escolhida, de 2 a 5 (aula, caso, trilha)")
    ap.add_argument("--formatos", default="h", help="h, v ou h,v")
    ap.add_argument("--partes", help="só estas partes (narrar), ex.: 1,3")
    ap.add_argument("--aprovado", action="store_true", help="conferir: a revisão da sessão aprovou a fala")
    ap.add_argument("--destino", help="entregar: a pasta onde o vídeo final fica")
    ap.add_argument("--concorrencia", type=int, help="renderizar: quantos quadros ao mesmo tempo (menos = mais leve para a máquina)")
    ap.add_argument("--pagina", action="store_true", help="finalizar: também a versão leve para página (H.264, AV1 e pôster)")
    a = ap.parse_args()
    carregar_env()
    try:
        if a.comando == "versao":
            print(RAIZ_VERSAO.read_text().strip() if RAIZ_VERSAO.exists() else "?")
            return
        if a.comando == "voz":
            preparar_voz()
            return
        if a.comando == "marca":
            aplicar_marca()
            return
        if not a.id:
            ap.error("diga o id (o nome do arquivo em aulas/, sem .json)")
        formatos = [f for f in a.formatos.split(",") if f in ("h", "v")] or ["h"]
        partes = {int(x) for x in a.partes.split(",")} if a.partes else None
        if a.comando == "novo":
            novo(a.id, a.tipo, a.minutos)
            return
        if a.comando == "validar":
            erros, avisos = validar(a.id)
            for x in avisos:
                print("aviso:", x)
            for x in erros:
                print("ERRO:", x)
            sys.exit(1 if erros else 0)
        if a.comando == "plano":
            sys.exit(1 if plano_md(a.id) else 0)
        if a.comando == "aprovar":
            aprovar(a.id)
            return
        if a.comando == "entregar":
            if not a.destino:
                ap.error("entregar: diga a pasta com --destino")
            entregar(a.id, a.destino)
            return
        if a.comando == "fazer":
            erros, _ = validar(a.id)
            if erros:
                raise Erro("\n  ".join(erros))
            if not aprovado(a.id):
                plano_md(a.id)
                raise Portao(f"mostre o roteiro e o plano de edição à pessoa e, com o ok dela: kit.py aprovar {a.id}")
        if a.comando in ("narrar", "fazer"):
            print("narrar"); narrar(a.id, partes)
        if a.comando == "conferir" or (a.comando == "fazer" and not conferencia_ok(a.id)):
            print("conferir"); conferir(a.id, aprovar_agora=a.aprovado)
            if a.comando == "conferir":
                return
        if a.comando in ("montar", "fazer"):
            print("montar"); montar(a.id, formatos)
        if a.comando in ("renderizar", "fazer"):
            print("renderizar"); renderizar(a.id, formatos, a.concorrencia)
        if a.comando in ("finalizar", "fazer"):
            print("finalizar"); finalizar(a.id, formatos, a.pagina)
    except Portao as e:
        print(f"\nAGUARDANDO: {e}", file=sys.stderr)
        sys.exit(2)
    except Erro as e:
        print(f"\nPAROU: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
