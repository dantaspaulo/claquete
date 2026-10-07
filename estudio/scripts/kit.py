#!/usr/bin/env python3
"""Do arquivo da aula ao vídeo conferido.

  python3 scripts/kit.py fazer <id> [--formatos h,v]   tudo, na ordem, parando no primeiro erro
  python3 scripts/kit.py validar <id>                    confere o arquivo da aula (sem gastar nada)
  python3 scripts/kit.py narrar <id> [--partes 1,3]      gera a voz de cada parte (paga: TTS)
  python3 scripts/kit.py conferir <id> [--refazer]       transcreve e compara com o roteiro (paga: centavos)
  python3 scripts/kit.py montar <id>                     plano, índice do Remotion e conferência do ritmo
  python3 scripts/kit.py renderizar <id> [--formatos h]  renderiza no Remotion
  python3 scripts/kit.py finalizar <id> [--pagina]       som em -14 LUFS, tela parada, folha de quadros

Só biblioteca padrão do Python. Precisa de ffmpeg/ffprobe e Node (npx remotion).
Chaves: ELEVENLABS_API_KEY (voz) e OPENAI_API_KEY (transcrição; voz se provedor = openai).
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
LIMITES = {"lista": ("itens", 5), "fluxo": ("passos", 5)}
INICIO = 0.3          # silêncio antes da primeira fala
FOLGA_FINAL = 0.6     # depois da última fala, antes do convite
ENCERRAMENTO = 4.0    # segundos do convite final


class Erro(Exception):
    pass


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

def validar(id_):
    a = aula(id_)
    c = cfg()
    erros, avisos = [], []
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
            erros.append(f"parte {i}: arquivo {t.get('arquivo')} não existe em public/")
        for z in t.get("zooms", []):
            f = z.get("foco", [])
            if len(f) != 4 or not (0 <= f[0] < f[2] <= 1 and 0 <= f[1] < f[3] <= 1):
                erros.append(f"parte {i}: zoom com foco inválido {f} (frações [x0, y0, x1, y1] da janela)")
        for campo in ("titulo", "sub", "nota", "legenda", "kicker"):
            if "—" in str(t.get(campo, "")):
                erros.append(f"parte {i}: travessão em tela.{campo}")
    return erros, avisos


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
    if "COLOQUE" in v["voice_id"]:
        raise Erro("defina voz.elevenlabs.voice_id no kit.config.json")
    ajustes = dict(v.get("voice_settings", {}))
    ajustes["speed"] = c["voz"].get("velocidade", 1.0)
    corpo = {"text": texto, "model_id": v["model_id"], "voice_settings": ajustes}
    if anterior:
        corpo["previous_text"] = anterior
    if seguinte:
        corpo["next_text"] = seguinte
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{v['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    r = json.loads(http_json(url, corpo, {"xi-api-key": chave("ELEVENLABS_API_KEY")}))
    al = r.get("alignment") or r.get("normalized_alignment")
    return base64.b64decode(r["audio_base64"]), al


def transcrever(arq):
    """whisper-1 com tempo por palavra."""
    r = roda([
        "curl", "-sS", "https://api.openai.com/v1/audio/transcriptions",
        "-H", f"Authorization: Bearer {chave('OPENAI_API_KEY')}",
        "-F", f"file=@{arq}", "-F", "model=whisper-1", "-F", "language=pt",
        "-F", "response_format=verbose_json", "-F", "timestamp_granularities[]=word",
    ])
    d = json.loads(r.stdout)
    if "error" in d:
        raise Erro(f"transcrição: {d['error'].get('message')}")
    return d


def tts_openai(texto, c):
    v = c["voz"]["openai"]
    corpo = {"model": v["modelo"], "voice": v["voz"], "input": texto, "response_format": "mp3"}
    if v.get("instrucoes"):
        corpo["instructions"] = v["instrucoes"]
    return http_json("https://api.openai.com/v1/audio/speech", corpo, {"Authorization": f"Bearer {chave('OPENAI_API_KEY')}"})


def tempos_por_caracteres(spans, al, fala):
    starts, ends = al["character_start_times_seconds"], al["character_end_times_seconds"]
    out = []
    for tok, (a, b) in zip(fala.split(), spans):
        a, b = min(a, len(starts) - 1), min(max(a, b - 1), len(ends) - 1)
        out.append({"p": tok, "ini": round(starts[a], 3), "fim": round(ends[b], 3)})
    return out


def tempos_por_transcricao(fala, transcricao, duracao):
    toks = fala.split()
    esperado = [norm(t) for t in toks]
    ouvidas = transcricao.get("words", [])
    ouvido = [norm(w["word"]) for w in ouvidas]
    sm = difflib.SequenceMatcher(None, esperado, ouvido, autojunk=False)
    tempos = [None] * len(toks)
    for bloco in sm.get_matching_blocks():
        for k in range(bloco.size):
            w = ouvidas[bloco.b + k]
            tempos[bloco.a + k] = (w["start"], w["end"])
    # interpola o que não casou
    conhecidos = [(i, t) for i, t in enumerate(tempos) if t]
    for i in range(len(toks)):
        if tempos[i]:
            continue
        ant = max((k for k in conhecidos if k[0] < i), default=(-1, (0.0, 0.0)), key=lambda k: k[0])
        pro = min((k for k in conhecidos if k[0] > i), default=(len(toks), (duracao, duracao)), key=lambda k: k[0])
        frac = (i - ant[0]) / max(1, pro[0] - ant[0])
        t = ant[1][1] + (pro[1][0] - ant[1][1]) * frac
        tempos[i] = (t, t + 0.2)
    return [{"p": tok, "ini": round(a, 3), "fim": round(b, 3)} for tok, (a, b) in zip(toks, tempos)]


def narrar(id_, partes=None):
    a, c = aula(id_), cfg()
    d = pasta(id_)
    provedor = c["voz"].get("provedor", "elevenlabs")
    vel = c["voz"].get("velocidade", 1.0)
    falas = [p["fala"] for p in a["partes"]]
    for i, fala in enumerate(falas, 1):
        if partes and i not in partes:
            continue
        mp3, meta = d / f"parte-{i:02d}.mp3", d / f"parte-{i:02d}.json"
        assinatura = hashlib.sha256(json.dumps([fala, c["voz"], c["pronuncia"]], sort_keys=True).encode()).hexdigest()[:16]
        if not partes and meta.exists() and json.loads(meta.read_text()).get("assinatura") == assinatura and mp3.exists():
            print(f"  parte {i}: já narrada (mesma fala e voz)")
            continue
        texto, spans = falado(fala, c["pronuncia"])
        if provedor == "elevenlabs":
            audio, al = tts_elevenlabs(texto, falas[i - 2] if i > 1 else "", falas[i] if i < len(falas) else "", c)
            mp3.write_bytes(audio)
            palavras = tempos_por_caracteres(spans, al, fala)
        else:
            bruto = tts_openai(texto, c)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as t:
                t.write(bruto)
            if abs(vel - 1.0) > 0.01:
                roda(["ffmpeg", "-y", "-loglevel", "error", "-i", t.name, "-filter:a", f"atempo={vel}", str(mp3)])
            else:
                shutil.move(t.name, mp3)
            palavras = tempos_por_transcricao(fala, transcrever(mp3), duracao_audio(mp3))
        meta.write_text(json.dumps({"assinatura": assinatura, "fala": fala, "palavras": palavras}, ensure_ascii=False, indent=1))
        print(f"  parte {i}: {duracao_audio(mp3):.1f} s")


# ── conferir ─────────────────────────────────────────────────────────────

def conferir(id_, refazer=False):
    a, c = aula(id_), cfg()
    d = pasta(id_)
    minimo = c["travas"].get("similaridade_minima", 0.9)
    aceitar = {norm(k): norm(v) for k, v in c["travas"].get("aceitar", {}).items()}
    for rodada in range(3 if refazer else 1):
        reprovadas, relatorio = [], []
        for i, p in enumerate(a["partes"], 1):
            mp3 = d / f"parte-{i:02d}.mp3"
            if not mp3.exists():
                raise Erro(f"parte {i} ainda não foi narrada")
            ouvido = [aceitar.get(w, w) for w in palavras_de(transcrever(mp3).get("text", ""))]
            esperado = [aceitar.get(w, w) for w in palavras_de(p["fala"])]
            sm = difflib.SequenceMatcher(None, esperado, ouvido, autojunk=False)
            r = sm.ratio()
            difs = [f"{' '.join(esperado[i1:i2]) or '∅'} → {' '.join(ouvido[j1:j2]) or '∅'}" for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
            ok = r >= minimo
            relatorio.append({"parte": i, "similaridade": round(r, 3), "ok": ok, "diferencas": difs})
            print(f"  parte {i}: {r:.0%} {'ok' if ok else 'REPROVADA'}" + (f"  ({'; '.join(difs[:4])})" if difs else ""))
            if not ok:
                reprovadas.append(i)
        (d / "conferencia.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=1))
        if not reprovadas:
            return
        if refazer and rodada < 2:
            print(f"  narrando de novo: {reprovadas}")
            narrar(id_, set(reprovadas))
            continue
        raise Erro(f"partes reprovadas: {reprovadas}. Reescreva a frase (homófono, ano por extenso, sigla) em vez de afrouxar a trava.")


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
    erros, avisos = validar(id_)
    if erros:
        raise Erro("arquivo da aula com problema:\n  " + "\n  ".join(erros))
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
    if total > c["travas"].get("maximo_segundos", 240):
        raise Erro(f"aula com {total:.0f} s passa do máximo de {c['travas']['maximo_segundos']} s: divida em duas")
    for x in avisos:
        print("  aviso:", x)
    if ritmo:
        raise Erro("ritmo: tela parada demais\n  " + "\n  ".join(ritmo))
    tema = {k: v for k, v in c["tema"].items() if not k.startswith("_")}
    trilha = c.get("trilha", {})
    plano = {"id": id_, "titulo": a["titulo"], "cabecalho": a["cabecalho"], "formatos": formatos,
             "destaques": a.get("destaques", []), "partes": partes, "pausa": pausa, "encerramento": ENCERRAMENTO,
             "total": total, "tema": tema, "convite": a.get("convite") or c["convite"],
             "trilha": {"arquivo": trilha.get("arquivo", ""), "volume": trilha.get("volume", 0.07)}}
    (d / "plano.json").write_text(json.dumps(plano, ensure_ascii=False, indent=1))
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

def renderizar(id_, formatos, concorrencia=None):
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
        loudnorm(bruto, final)
        bruto.unlink()
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
                      "-c:a", "libopus", "-b:a", "80k", f"{leve}-av1.mp4"])
            else:
                print("  (sem libsvtav1 no ffmpeg: pulei a versão AV1)")
            poster = f"{leve}-poster.webp" if "libwebp" in codificadores else f"{leve}-poster.jpg"
            roda(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(final), "-frames:v", "1", poster])
            print(f"  versão para página em {leve.name}*")
    print(f"  pronto: {SAIDA / id_}")


# ── linha de comando ─────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("comando", choices=["fazer", "validar", "narrar", "conferir", "montar", "renderizar", "finalizar"])
    ap.add_argument("id")
    ap.add_argument("--formatos", default="h", help="h, v ou h,v")
    ap.add_argument("--partes", help="só estas partes (narrar), ex.: 1,3")
    ap.add_argument("--refazer", action="store_true", help="conferir: narra de novo as reprovadas, até 2 vezes")
    ap.add_argument("--concorrencia", type=int, help="renderizar: quantos quadros ao mesmo tempo (menos = mais leve para a máquina)")
    ap.add_argument("--pagina", action="store_true", help="finalizar: também a versão leve para página (H.264, AV1 e pôster)")
    a = ap.parse_args()
    formatos = [f for f in a.formatos.split(",") if f in ("h", "v")] or ["h"]
    partes = {int(x) for x in a.partes.split(",")} if a.partes else None
    try:
        if a.comando == "validar":
            erros, avisos = validar(a.id)
            for x in avisos:
                print("aviso:", x)
            for x in erros:
                print("ERRO:", x)
            sys.exit(1 if erros else 0)
        if a.comando in ("fazer",):
            erros, _ = validar(a.id)
            if erros:
                raise Erro("\n  ".join(erros))
        if a.comando in ("narrar", "fazer"):
            print("narrar"); narrar(a.id, partes)
        if a.comando in ("conferir", "fazer"):
            print("conferir"); conferir(a.id, refazer=a.refazer or a.comando == "fazer")
        if a.comando in ("montar", "fazer"):
            print("montar"); montar(a.id, formatos)
        if a.comando in ("renderizar", "fazer"):
            print("renderizar"); renderizar(a.id, formatos, a.concorrencia)
        if a.comando in ("finalizar", "fazer"):
            print("finalizar"); finalizar(a.id, formatos, a.pagina)
    except Erro as e:
        print(f"\nPAROU: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
