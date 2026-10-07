---
name: aula-animada
description: >-
  Cria AULA NARRADA ANIMADA curta (até 4 min) com o estúdio do kit-video-ia: roteiro em partes, uma
  ideia por tela, voz por IA (ElevenLabs ou OpenAI), legenda palavra a palavra, telas animadas no
  tempo da fala, convite no fim, e entrega o vídeo deitado e/ou em pé, conferido (fala comparada com o
  roteiro por transcrição, ritmo sem tela parada mais de 2,5 s, som em -14 LUFS) e com legendas
  .vtt/.srt. Use sempre que a pessoa pedir "aula narrada", "aula em vídeo", "videoaula", "curso em
  vídeo", "série de aulas", "explicar um conceito em vídeo", "vídeo didático", "aula para a central de
  ajuda" ou "transformar este texto em aula", mesmo que não diga "animada". Para gravar um sistema
  funcionando, use a skill tutorial-de-tela.
metadata:
  resumo: Aula narrada e animada, do tema ao vídeo conferido
---

# Aula narrada e animada

O resultado é um vídeo curto de explicação: uma janela com a tela da vez, a etiqueta acima, a
legenda palavra a palavra embaixo e a voz conduzindo. Cada elemento entra **no segundo em que a voz
diz a palavra dele**, e nada fica parado mais de 2,5 s. Tudo sai de um arquivo só, `aulas/<id>.json`,
pelo estúdio (a pasta com `kit.config.json`; o instalador cria em `estudio-video/`).

## Antes de escrever: o que perguntar

Pergunte só o que não der para tirar do pedido ou do material que a pessoa trouxe. Junte numa
rodada e traga sugestão pronta para ela aprovar:
1. **Tema e público**: quem assiste e o que precisa sair sabendo (uma frase).
2. **Duração**: o padrão é 1 a 2 minutos; o máximo é 4.
3. **Formato**: deitado (`h`, para site, YouTube, central de ajuda) e/ou em pé (`v`, para Reels e celular).
4. **Fonte**: texto, artigo ou anotações dela. Número e fato só entram com fonte.
5. **Marca e convite**: cores, nome e o endereço do convite final (`kit.config.json`).
6. **Voz**: provedor e voz já configurados? Se não, ver "Configurar a voz".

Se a pessoa trouxer um texto longo, proponha o roteiro em partes e peça o ok antes de narrar: a
narração é a parte paga.

## O arquivo da aula

`estudio-video/aulas/<id>.json` (id em letras minúsculas, números e hífen). Modelo completo em
`aulas/exemplo.json`.

```json
{
  "titulo": "Nome da aula",
  "cabecalho": "Série · Aula 1",
  "destaques": ["palavras", "que", "ficam", "coloridas", "na", "legenda"],
  "partes": [
    {
      "fala": "O que a voz diz nesta tela.",
      "rotulo": "Etiqueta acima da janela",
      "tela": { "tipo": "lista", "kicker": "Etiqueta", "titulo": "Título com *destaque*",
                "itens": [{ "texto": "um", "quando": "palavra" }, "dois", "três"],
                "chips": [{ "texto": "ficha", "quando": "outra" }] }
    }
  ]
}
```

| tipo | campos | para quê |
|---|---|---|
| `capa` | `kicker`, `titulo`, `sub` | abertura |
| `lista` | `kicker`, `titulo`, `itens` (até 5) | pontos de uma ideia |
| `colunas` | `titulo`, `esquerda` e `direita` (`titulo`, `itens`) | antes e depois, isto e aquilo |
| `fluxo` | `kicker`, `titulo`, `passos` (até 5), `nota` | etapas em sequência |
| `frase` | `kicker`, `titulo`, `sub` | uma afirmação forte |
| `numero` | `kicker`, `de`, `para`, `legenda` | um número que conta até o valor |
| `imagem` | `arquivo` (em `public/`), `legenda`, `zooms` | foto ou ilustração |
| `video` | `arquivo`, `de`, `velocidade`, `legenda`, `zooms` | gravação de tela (skill tutorial-de-tela) |

- `*trecho*` no título fica em destaque.
- **`quando`** amarra a entrada à palavra falada (`"palavra"` ou `"palavra#2"` para a segunda vez).
  Sem `quando`, os itens se espalham por igual na fala.
- **`chips`** são fichas que entram na palavra dita: o jeito mais simples de pôr algo novo na tela.
- **`zooms`**: `{ "quando": "palavra", "foco": [x0, y0, x1, y1], "ate": "palavra" }`, com o foco em
  frações da janela. A câmera enquadra o foco inteiro e escurece o resto (nunca corta pela metade).

## Como escrever a fala

- **Uma ideia por parte**, 20 a 40 palavras (8 a 14 s). Seis a dez partes por aula.
- Primeira parte: o que a aula mostra e por que importa. Última: recapitulação ou o gancho da próxima.
- A tela **resume** a fala, não repete: título curto, itens de poucas palavras.
- Tom de quem explica a um colega: frases curtas, segunda pessoa, sem jargão sem explicação.
- Diga o limite com clareza (o que a coisa não faz). Fato e número só com fonte.
- **Sem travessão** (a voz lê mal; a validação recusa).

### Escrever para a voz (o que a conferência reprova)

Cada parte é transcrita e comparada com o roteiro. Reprovou: **reescreva a frase**, não afrouxe a trava.
- Ano em algarismo (`2022`), não por extenso.
- Homófonos: "por quê" e "por que" soam iguais. Troque a construção ("os motivos").
- Artigo ambíguo: "é o modelo" pode soar "é um modelo". Mude a frase.
- Concordância como a voz vai dizer ("a IA era rápida").
- Siglas: ponha a pronúncia em `kit.config.json` → `pronuncia` (`"IA": "iá"`).
- Palavra que o transcritor sempre troca e está certa: `travas.aceitar` (`"Wize": "wise"`).

## O ritmo: nada parado mais de 2,5 s

Regra do kit: a cada 2,5 s no máximo, algo **novo** na tela (item que entra, ficha, número que conta,
zoom). Pulsar e flutuar não contam. Duas travas:
1. `montar` calcula, pelos tempos da fala, quando cada elemento entra e **recusa** a parte que fica
   mais de 2,5 s sem novidade, dizendo onde. Conserto: um `quando` num item, uma ficha em `chips`,
   ou dividir a parte em duas.
2. `finalizar` mede o vídeo pronto (só a área da janela, sem a legenda) e recusa tela parada.

## Do arquivo ao vídeo

```bash
cd estudio-video
python3 scripts/kit.py validar <id>                    # grátis: confere o arquivo
python3 scripts/kit.py fazer <id> --formatos h,v       # narra, confere, monta, renderiza, finaliza
```

Por partes, quando precisar: `narrar <id> [--partes 2,5]`, `conferir <id> [--refazer]`, `montar <id>`,
`renderizar <id> [--concorrencia 2]`, `finalizar <id> [--pagina]`. Só mudou a tela (não a fala)? Rode
de `montar` em diante: a voz não é gerada de novo. Ver no navegador antes do render: `npm run studio`.

Sai em `saida/<id>/`: `<id>-h.mp4`, `<id>-v.mp4`, `<id>.vtt`, `<id>.srt` e uma **folha de quadros**
(`<id>-h-folha.jpg`). Olhe a folha antes de entregar: texto quebrando feio, tela vazia, zoom ruim.

## Configurar a voz

O instalador já deixa pronto: as chaves num `.env` do estúdio e a voz na conta da pessoa. Se algo
ficou de fora, `python3 scripts/kit.py voz` põe a voz configurada na conta e gera `saida/teste-voz.mp3`.

`kit.config.json` → `voz`:
- **ElevenLabs** (padrão): vem a **Raquel**, voz pública em português do Brasil da biblioteca do
  ElevenLabs, com o modelo `eleven_v4`. Outra voz: troque `voice_id` (e `dono_publico`, se for da
  biblioteca) e rode `kit.py voz`. A resposta já traz o tempo de cada letra.
- **OpenAI**: `"provedor": "openai"`, `modelo`, `voz` e `instrucoes`. O tempo das palavras vem da transcrição.
- **`velocidade`** (padrão 1,1) é aplicada depois da síntese, igual para qualquer modelo, e os tempos
  das palavras acompanham.
- A conferência usa a transcrição da OpenAI (`OPENAI_API_KEY`) nos dois casos.

Chave só no `.env` do estúdio ou em variável de ambiente, nunca em arquivo versionado. Custo de uma
aula de 2 min: o TTS de uns 2 mil caracteres mais centavos de transcrição.

## A aparência

`kit.config.json` → `tema`: cores, fontes, nome (`marca`) e `fundo_imagem`, a foto desfocada atrás da
janela (prontas: `fundos/champagne.jpg`, `fundos/oceano.jpg`, `fundos/esmeralda.jpg`; vazio = luzes em
degradê). O convite final fica em `convite`. Não é preciso app de gravação: janela, sombra, fundo,
cursor e zoom são do próprio estúdio.

## Tempo e máquina

Narração e conferência: 1 a 2 min. Render: cerca de 1 min de máquina por minuto de vídeo, por
formato (`--concorrencia 2` deixa a máquina mais leve). Rode uma aula por vez.

## Entrega

Diga à pessoa: onde está o vídeo, a duração, o resultado das conferências (fala, ritmo, som) e o que
ficou de fora ou precisa de decisão dela. Para publicar numa página, ver a skill video-na-pagina.
