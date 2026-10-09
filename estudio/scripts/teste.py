#!/usr/bin/env python3
"""Testes dos portões e das travas do estúdio, sem gastar nada (a voz é um tom gerado pelo ffmpeg).

  python3 scripts/teste.py

Cada caso aqui é uma promessa do README: roteiro sem ok não narra, fala sem revisão não monta, a duração escolhida vale,
o roteiro mudado pede ok novo e a entrega só apaga a montagem depois de conferir a cópia."""
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ESTUDIO = Path(__file__).resolve().parent.parent
falhas = []


def confere(nome, cond):
    print(("ok      " if cond else "FALHOU  ") + nome)
    cond or falhas.append(nome)


def kit(raiz, *args):
    r = subprocess.run([sys.executable, "scripts/kit.py", *args], cwd=raiz, capture_output=True, text=True, env={"PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"})
    return r.returncode, r.stdout + r.stderr


def narracao_falsa(raiz, id_):
    """Escreve partes 'narradas' com um tom do tamanho da fala (2,6 palavras por segundo) e os tempos de palavra
    espalhados, como o narrar deixaria."""
    a = json.loads((raiz / "aulas" / f"{id_}.json").read_text(encoding="utf-8"))
    d = raiz / "public" / "aulas" / id_
    d.mkdir(parents=True, exist_ok=True)
    for i, p in enumerate(a["partes"], 1):
        segundos = round(max(3.0, len(p["fala"].split()) / 2.6), 2)
        mp3 = d / f"parte-{i:02d}.mp3"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=frequency=220:duration={segundos}", str(mp3)], check=True)
        toks = p["fala"].split()
        passo = segundos / max(1, len(toks))
        palavras = [{"p": t, "ini": round(k * passo, 3), "fim": round(k * passo + passo * 0.9, 3)} for k, t in enumerate(toks)]
        (d / f"parte-{i:02d}.json").write_text(json.dumps({"assinatura": f"falsa-{i}", "fala": p["fala"], "palavras": palavras}, ensure_ascii=False))


def carregar_kit(raiz):
    spec = importlib.util.spec_from_file_location("kit_teste", raiz / "scripts" / "kit.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    tmp = Path(tempfile.mkdtemp())
    raiz = tmp / "estudio"
    shutil.copytree(ESTUDIO, raiz, ignore=shutil.ignore_patterns("node_modules", ".venv", "saida", "aulas", "public"))
    (raiz / "aulas").mkdir()
    (raiz / "public").mkdir()
    for f in ("fundos",):
        if (ESTUDIO / "public" / f).exists():
            shutil.copytree(ESTUDIO / "public" / f, raiz / "public" / f)
    shutil.copy(ESTUDIO / "aulas" / "exemplo.json", raiz / "aulas" / "exemplo.json")
    shutil.copy(ESTUDIO / "aulas" / "tutorial-exemplo.json", raiz / "aulas" / "tutorial-exemplo.json")

    rc, out = kit(raiz, "novo", "x", "--tipo", "aula")
    confere("aula sem --minutos é recusada (a pessoa escolhe a duração)", rc == 1 and "minutos" in out)
    rc, out = kit(raiz, "novo", "x", "--tipo", "aula", "--minutos", "3")
    confere("novo cria a aula com tipo e minutos", rc == 0 and json.loads((raiz / "aulas" / "x.json").read_text())["minutos"] == 3)

    rc, out = kit(raiz, "narrar", "exemplo")
    confere("narrar recusa roteiro sem ok (portão 1)", rc == 1 and "aprovado" in out)
    rc, out = kit(raiz, "fazer", "exemplo")
    confere("fazer para no portão 1 com código 2 e gera o plano", rc == 2 and (raiz / "saida" / "exemplo" / "roteiro-e-plano.md").exists())
    rc, _ = kit(raiz, "aprovar", "exemplo")
    confere("aprovar registra o ok", rc == 0 and (raiz / "aulas" / "exemplo.aprovado.json").exists())

    a = json.loads((raiz / "aulas" / "exemplo.json").read_text(encoding="utf-8"))
    a["partes"][0]["fala"] += " Mudou."
    (raiz / "aulas" / "exemplo.json").write_text(json.dumps(a, ensure_ascii=False))
    rc, out = kit(raiz, "narrar", "exemplo")
    confere("roteiro mudado depois do ok pede ok novo", rc == 1 and "aprovado" in out)
    shutil.copy(ESTUDIO / "aulas" / "exemplo.json", raiz / "aulas" / "exemplo.json")
    shutil.copy(ESTUDIO / "aulas" / "tutorial-exemplo.json", raiz / "aulas" / "tutorial-exemplo.json")

    narracao_falsa(raiz, "exemplo")
    rc, out = kit(raiz, "montar", "exemplo")
    confere("montar recusa fala sem revisão (portão 2)", rc == 2 and "revisão" in out)
    rc, out = kit(raiz, "conferir", "exemplo", "--aprovado")
    confere("--aprovado sem relatório é recusado", rc == 1)
    rc, out = kit(raiz, "conferir", "exemplo")
    confere("conferir gera o relatório e para com código 2", rc == 2 and (raiz / "public" / "aulas" / "exemplo" / "conferencia.json").exists())
    rc, _ = kit(raiz, "conferir", "exemplo", "--aprovado")
    confere("conferir --aprovado libera", rc == 0 and (raiz / "public" / "aulas" / "exemplo" / "conferencia-aprovada.json").exists())
    rc, out = kit(raiz, "montar", "exemplo")
    confere("depois dos dois portões o montar segue (para só no ritmo ou na duração, nunca no portão)", rc != 2 and "revisão" not in out)

    p = raiz / "public" / "aulas" / "exemplo" / "parte-02.json"
    m = json.loads(p.read_text())
    m["assinatura"] = "narrada-de-novo"
    p.write_text(json.dumps(m))
    rc, out = kit(raiz, "montar", "exemplo")
    confere("parte narrada de novo depois da revisão volta ao portão 2", rc == 2)

    a = json.loads((raiz / "aulas" / "exemplo.json").read_text(encoding="utf-8"))
    a["tipo"], a["minutos"] = "aula", 2
    (raiz / "aulas" / "exemplo.json").write_text(json.dumps(a, ensure_ascii=False))
    kit(raiz, "aprovar", "exemplo")
    kit(raiz, "conferir", "exemplo")
    kit(raiz, "conferir", "exemplo", "--aprovado")
    rc, out = kit(raiz, "montar", "exemplo")
    confere("aula de 2 min com menos de 1 min de vídeo é recusada pela duração", rc == 1 and "aceita de" in out)

    rc, out = kit(raiz, "entregar", "exemplo", "--destino", str(tmp / "entregue"))
    confere("entregar sem vídeo pronto não apaga nada", rc == 1 and (raiz / "public" / "aulas" / "exemplo").exists())

    # demonstração: o roteiro se aprova ANTES de gravar
    rc, out = kit(raiz, "plano", "tutorial-exemplo")
    md = (raiz / "saida" / "tutorial-exemplo" / "roteiro-e-plano.md")
    confere("plano sai sem a gravação feita (ela vem depois do ok)", rc == 0 and md.exists() and "A gravar depois do ok" in md.read_text()
            and "não existe em public" not in md.read_text())
    confere("plano mostra o caminho na ferramenta", md.exists() and "Caminho na ferramenta" in md.read_text() and "Clicar em Gerar" in md.read_text())
    rc, _ = kit(raiz, "aprovar", "tutorial-exemplo")
    k = carregar_kit(raiz)
    t = json.loads((raiz / "aulas" / "tutorial-exemplo.json").read_text(encoding="utf-8"))
    t["partes"][1]["tela"]["de"] = 9.9
    (raiz / "aulas" / "tutorial-exemplo.json").write_text(json.dumps(t, ensure_ascii=False))
    confere("acertar o 'de' depois de gravar não pede ok novo", rc == 0 and k.aprovado("tutorial-exemplo"))
    t["caminho"].append("Passo novo")
    (raiz / "aulas" / "tutorial-exemplo.json").write_text(json.dumps(t, ensure_ascii=False))
    confere("mudar o caminho pede ok novo", not k.aprovado("tutorial-exemplo"))
    rc, out = kit(raiz, "montar", "tutorial-exemplo")
    confere("montar recusa sem a gravação", rc == 1 and "não existe" in out)

    # a narração de uma parte só se paga de novo se algo DELA mudou
    c = k.cfg()
    a1 = k.assinatura_parte("A IA ajuda.", c)
    c["pronuncia"]["PJe"] = "outra coisa"
    a2 = k.assinatura_parte("A IA ajuda.", c)
    c["pronuncia"]["IA"] = "ia"
    a3 = k.assinatura_parte("A IA ajuda.", c)
    confere("pronúncia de outra palavra não muda a assinatura; a desta fala muda", a1 == a2 and a2 != a3)

    # finalizar de novo (para a versão de página) sem o render bruto
    shutil.copy(ESTUDIO / "aulas" / "exemplo.json", raiz / "aulas" / "exemplo.json")
    cfg = json.loads((raiz / "kit.config.json").read_text())
    cfg["travas"]["tela_parada_segundos"] = 30  # a voz falsa espalha as palavras por igual: aqui o ritmo não é o que se testa
    (raiz / "kit.config.json").write_text(json.dumps(cfg, ensure_ascii=False))
    kit(raiz, "aprovar", "exemplo")
    narracao_falsa(raiz, "exemplo")
    kit(raiz, "conferir", "exemplo")
    kit(raiz, "conferir", "exemplo", "--aprovado")
    rc, out = kit(raiz, "montar", "exemplo")
    if rc:
        print(out)
    if (raiz / "public" / "aulas" / "exemplo" / "plano.json").exists():
        plano = json.loads((raiz / "public" / "aulas" / "exemplo" / "plano.json").read_text())
        confere("o plano sempre traz os dois formatos", plano["formatos"] == ["h", "v"])
        (raiz / "saida" / "exemplo").mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size=640x360:rate=30:duration={plano['total']:.2f}",
                        "-f", "lavfi", "-i", f"sine=duration={plano['total']:.2f}", "-shortest", "-pix_fmt", "yuv420p",
                        str(raiz / "saida" / "exemplo" / "exemplo-h.mp4")], check=True)
        rc, out = kit(raiz, "finalizar", "exemplo")
        confere("finalizar roda de novo sobre o vídeo já finalizado", rc == 0)
        rc, out = kit(raiz, "finalizar", "exemplo", "--formatos", "v")
        confere("finalizar sem render nenhum avisa o que falta", rc == 1 and "não há render" in out)
    else:
        confere("montar do exemplo gerou o plano (pré-requisito dos testes do finalizar)", False)

    # marca: fundo claro leva o resto da paleta junto, e a fonte vira import
    (raiz / "marca").mkdir(exist_ok=True)
    (raiz / "marca" / "marca.json").write_text(json.dumps({"nome": "Marca Clara", "cores": {"principal": "#1a4fd6", "fundo": "#f7f5ef"},
                                                            "fontes": {"titulos": "Playfair Display", "texto": "Montserrat"}}))
    rc, out = kit(raiz, "marca")
    tema = json.loads((raiz / "kit.config.json").read_text())["tema"]
    gen = (raiz / "src" / "fontes.gen.ts").read_text()
    confere("fundo claro deixa o texto escuro e os painéis claros", rc == 0 and tema["texto"] == "#14171a" and k.escuro(tema["texto"])
            and not k.escuro(tema["fundo2"]) and not k.escuro(tema["janela"]) and tema["fundo_imagem"] == "")
    confere("as fontes da marca entram no fontes.gen.ts (com a Inter de reserva)",
            all(f"@remotion/google-fonts/{m}" in gen for m in ("PlayfairDisplay", "Montserrat", "Inter")))
    if (ESTUDIO / "node_modules").exists():
        (raiz / "node_modules").symlink_to(ESTUDIO / "node_modules")
        (raiz / "marca" / "marca.json").write_text(json.dumps({"nome": "X", "fontes": {"titulos": "Fonte Que Nao Existe"}}))
        rc, out = kit(raiz, "marca")
        confere("fonte fora do Google Fonts é recusada", rc == 1 and "Google Fonts" in out)

    # disco quase cheio: o render nem começa
    k.MINIMO_LIVRE_GB = 10 ** 9
    try:
        k.renderizar("exemplo", ["h"])
        confere("render recusa com o disco quase cheio", False)
    except k.Erro as e:
        confere("render recusa com o disco quase cheio", "livres" in str(e))

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{'TUDO CERTO' if not falhas else str(len(falhas)) + ' FALHA(S)'}")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
