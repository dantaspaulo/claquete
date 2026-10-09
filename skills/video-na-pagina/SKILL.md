---
name: video-na-pagina
description: >-
  Prepara um vídeo da Claquete.ai (ou qualquer MP4) para publicar em landing page, site, blog ou
  central de ajuda: versões leves H.264 e AV1, pôster, legenda .vtt, o HTML do player certo para cada
  uso (hero sem som em laço ou aula com controles), carregamento que não pesa a página e
  acessibilidade. Use quando a pessoa pedir "colocar o vídeo no site", "vídeo na landing page", "vídeo
  de fundo", "deixar o vídeo leve", "vídeo na central de ajuda", "player", "pôster do vídeo" ou
  "legenda no vídeo".
metadata:
  resumo: Vídeo leve e acessível numa página ou central de ajuda
---

# Vídeo numa página

## Gerar as versões

Vídeo do estúdio, **antes do `entregar`** (ele apaga a montagem):
```bash
cd estudio-video
python3 scripts/kit.py fazer <id> --formatos h --pagina
```
Use o mesmo `--formatos` do vídeo (`h`, `v` ou `h,v`). O `finalizar --pagina` roda também sobre um
vídeo já finalizado (sem o arquivo bruto do render, e sem normalizar o som outra vez), então basta:
```bash
python3 scripts/kit.py finalizar <id> --formatos h --pagina
```
Se não há render nenhum, ele para com "não há render": aí `renderizar <id> --formatos h` antes. O
`fazer ... --pagina` também serve, mas renderiza de novo (a voz não é gerada de novo).
Sai em `saida/<id>/`: `<id>-h-pagina.mp4` (H.264, compatível com tudo), `<id>-h-pagina-av1.mp4`
(AV1, ~25% menor, se o ffmpeg tiver `libsvtav1`), o pôster `<id>-h-pagina-poster.webp` (ou `.jpg`,
se o ffmpeg não tiver `libwebp`) e `<id>.vtt`. O `entregar` leva todos para a pasta de destino.

Vídeo já entregue, ou outro MP4 qualquer:
```bash
ffmpeg -i entrada.mp4 -c:v libx264 -preset slow -crf 28 -c:a aac -b:a 96k -movflags +faststart saida.mp4
ffmpeg -i entrada.mp4 -c:v libsvtav1 -preset 6 -crf 42 -c:a libopus -b:a 80k -movflags +faststart saida-av1.mp4
ffmpeg -ss 1 -i entrada.mp4 -frames:v 1 poster.jpg
```

Meta de peso: até ~2 MB por minuto na versão H.264 de página. `-movflags +faststart` sempre (o
vídeo começa a tocar antes de baixar inteiro): as versões H.264 e AV1 do `finalizar --pagina` e dos
comandos acima já saem com ele.

## O HTML

**Aula ou tutorial** (com som, controles, legenda):
```html
<video controls preload="none" playsinline width="1920" height="1080"
       poster="/videos/aula-poster.jpg" style="width:100%;height:auto;border-radius:12px">
  <source src="/videos/aula-av1.mp4" type='video/mp4; codecs="av01.0.08M.08"'>
  <source src="/videos/aula.mp4" type="video/mp4">
  <track kind="captions" src="/videos/aula.vtt" srclang="pt-BR" label="Português" default>
</video>
```

**Vídeo de fundo no topo da página** (sem som, em laço, nunca o maior peso da página):
```html
<video autoplay muted loop playsinline preload="metadata" poster="/videos/hero-poster.jpg"
       width="1920" height="1080" aria-hidden="true">
  <source src="/videos/hero-av1.mp4" type='video/mp4; codecs="av01.0.08M.08"'>
  <source src="/videos/hero.mp4" type="video/mp4">
</video>
<style>@media (prefers-reduced-motion: reduce){ video[autoplay]{ display:none } }</style>
```

- **AV1 primeiro, H.264 de reserva**: o navegador pega o primeiro que sabe tocar.
- **`width` e `height`** evitam a página pular quando o vídeo carrega.
- **Pôster** é o que aparece primeiro e conta como a maior imagem da página: leve (webp ou jpg ~60 KB).
- `preload="none"` em aula (só baixa quando der play); `metadata` em fundo.
- Legenda `.vtt` sempre que houver fala. Vídeo de fundo não pode ter informação que só ele mostra.
- Quem prefere menos movimento (`prefers-reduced-motion`) não vê o fundo animado.

## Central de ajuda e plataformas

- **Central de ajuda** (Chatwoot, Zendesk, Intercom...): suba o MP4 de página num armazenamento
  público com nome **único e datado** (`aula-1-20261006.mp4`); trocou o vídeo, troque o nome, porque
  o endereço fica em cache. Player que exige CORS (apps) precisa do cabeçalho
  `Access-Control-Allow-Origin` no armazenamento.
- **YouTube**: o `<id>-h.mp4` final (não o de página) e o `.srt` como legenda.
- **Reels, TikTok, Shorts**: o `<id>-v.mp4` (em pé). A legenda já vem queimada no vídeo.

## Conferir antes de dizer que está no ar

Abra a página publicada numa janela anônima: o pôster aparece, o vídeo toca, a legenda liga, e no
celular o vídeo não estoura a largura. Confira o endereço do vídeo com
`curl -sI <url>` (200, `content-type: video/mp4`).
