---
name: aula-animada
description: >-
  Cria AULA NARRADA ANIMADA de 2 a 5 minutos, com a duração escolhida pela pessoa, no estúdio da
  Claquete.ai: roteiro em partes no tom e no glossário da marca, uma ideia por tela, voz da
  ElevenLabs, legenda palavra a palavra, telas que entram no segundo em que a voz diz a palavra e
  direção de movimento com as skills de motion design. Trabalha sozinha e para em dois portões (o
  roteiro e plano de edição antes de narrar; a revisão da fala por um subagente antes de montar),
  confere ritmo, duração e som, e entrega o vídeo deitado e/ou em pé, apagando a montagem. Use
  sempre que a pessoa pedir "aula narrada", "aula animada", "aula em vídeo", "videoaula", "explicar
  um conceito em vídeo", "vídeo didático", "aula para a central de ajuda", "série de aulas" ou
  "transformar este texto em aula", mesmo que não diga "animada". Para mostrar uma ferramenta
  funcionando, use tutorial-de-tela.
metadata:
  resumo: Aula narrada e animada de 2 a 5 min, do tema ao vídeo entregue
---

# Aula narrada e animada

O resultado é uma aula curta: uma janela com a tela da vez, a etiqueta acima, a legenda palavra a
palavra embaixo e a voz conduzindo. Cada elemento entra **no segundo em que a voz diz a palavra
dele**, e nada fica parado mais de 2,5 s. Tudo sai de um arquivo só, `aulas/<id>.json`, pelo estúdio
(a pasta com `kit.config.json`; o instalador cria `estudio-video/`). Todo comando roda de dentro dele.

O Claude faz tudo sozinho e para só no **portão 1** (roteiro e plano de edição), no **portão 2**
(revisão da fala) e na **entrega**.

## Antes de escrever

1. **Leia a marca** em `marca/marca.json`: `publico`, `tom`, `glossario`, `palavras_proibidas`,
   `chamada` e `movimento`. Sem o arquivo, a aula sai no visual padrão; ofereça "configura minha
   marca" (skill claquete-marca).
2. **Pergunte numa rodada só** o que o pedido e a marca não respondem (a skill claquete pode já ter
   perguntado), com sugestão pronta:
   - **tema e público**: quem assiste e o que precisa sair sabendo, numa frase;
   - **duração**: 2, 3, 4 ou 5 minutos, a pessoa escolhe;
   - **formato**: deitado (`h`, para site, YouTube, central de ajuda), em pé (`v`, para Reels e
     celular) ou os dois;
   - **fonte**: o texto, o artigo ou as anotações dela. Fato e número só entram com fonte.
3. **Crie o arquivo**: `python3 scripts/kit.py novo <id> --tipo aula --minutos 3` (id em letras
   minúsculas, números e hífen).

## O tamanho certo

O `montar` recusa a aula fora de 20% da duração escolhida, para mais ou para menos, e fora de 2 a 5
minutos. O `plano` mostra a estimativa antes de qualquer gasto. A voz real sai um pouco mais rápida
ou mais lenta que a estimativa: mire no meio da faixa.

| Duração | Faixa aceita | Mire em | Partes |
|---|---|---|---|
| 2 min | 120 a 144 s | umas 340 palavras | 11 ou 12 |
| 3 min | 144 a 216 s | umas 470 palavras | 15 ou 16 |
| 4 min | 192 a 288 s | umas 620 palavras | 20 ou 21 |
| 5 min | 240 a 300 s | umas 700 palavras | 23 ou 24 |

Contas com a velocidade padrão da voz (1,1) e o convite de 4 s no fim. Passou de 5 minutos: divida
em duas aulas.

## O arquivo da aula

`aulas/<id>.json`. Modelo completo em `aulas/exemplo.json`.

```json
{
  "titulo": "Nome da aula",
  "cabecalho": "Série · Aula 1",
  "tipo": "aula",
  "minutos": 3,
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
| `animada` | `descricao`, `cena` (padrão `Cena<N>`), `chips` | cena em React, a tela mais rica (ver "Telas animadas") |

- `*trecho*` no título fica em destaque.
- **`quando`** amarra a entrada à palavra falada (`"palavra"`, ou `"palavra#2"` para a segunda vez).
  Sem `quando`, os itens se espalham por igual na fala.
- **`chips`** são fichas que entram na palavra dita: o jeito mais simples de pôr algo novo na tela.
- **`zooms`**: `{ "quando": "palavra", "foco": [x0, y0, x1, y1], "ate": "palavra" }`, com o foco em
  frações da janela. A câmera enquadra o foco inteiro e escurece o resto (nunca corta pela metade).

## Como escrever a fala

- **Uma ideia por parte**, 20 a 40 palavras (8 a 14 s).
- Primeira parte: o que a aula mostra e por que importa para o público. Última: a recapitulação e a
  ponte para a chamada da marca, que o convite do fim mostra.
- A tela **resume** a fala, não repete: título curto, itens de poucas palavras.
- **No tom da marca** (`tom`). Sem marca: o de quem explica a um colega, frases curtas, segunda pessoa,
  sem jargão sem explicação.
- **Glossário**: o termo aparece como está, na fala e na tela, nunca trocado por sinônimo, nem para
  variar.
- **Palavras proibidas**: nem na fala (o `validar` recusa) nem na tela (nada recusa: confira).
- Diga o limite com clareza (o que a coisa não faz). Fato e número só com fonte.
- **Sem travessão** (a voz lê mal; o `validar` recusa na fala e nos textos da tela).

### Escrever para a voz (o que a revisão da fala reprova)

- Ano em algarismo (`2022`), não por extenso.
- Palavras que soam iguais: "por quê" e "por que", "sessão" e "seção". Troque a construção ("os motivos").
- Artigo ambíguo: "é o modelo" pode soar "é um modelo". Mude a frase.
- Concordância como a voz vai dizer ("a IA era rápida").
- Siglas e nomes estrangeiros: ponha a pronúncia em `kit.config.json` → `pronuncia` (`"IA": "iá"`)
  **antes de narrar**. Mudar a pronúncia de uma palavra depois só pede nova narração das partes que
  usam essa palavra (ver "Mudou depois do ok").
- Palavra que o transcritor sempre escreve diferente e que a voz diz certo (um nome de marca):
  `travas.aceitar` (`"Wize": "wise"`).

## O ritmo: nada parado mais de 2,5 s

A cada 2,5 s no máximo, algo **novo** na tela: item que entra, ficha, número que conta, zoom. Pulsar
e flutuar não contam. Duas travas:
1. `montar` calcula, pelos tempos da fala, quando cada elemento entra e **recusa** a parte que fica
   mais de 2,5 s sem novidade, dizendo onde.
2. `finalizar` mede o vídeo pronto (só a área da janela, sem a legenda) e recusa tela parada.

Resolva já no roteiro, antes do portão 1: **uma novidade a cada 5 palavras faladas, mais ou menos**
(2,5 s de voz são umas 6 palavras). Um `quando` em cada item, fichas onde a fala corre sem item novo,
ou a parte dividida em duas. Assim o `montar` não recusa depois do ok.

## Direção de movimento

Com as skills de motion design da iart.ai (o instalador põe junto). Elas decidem; o estúdio executa
com o que já tem: tipo de tela, `quando`, fichas, zooms, cores e fundo.

- **motion-art-direction**, antes do roteiro: transforme o `movimento` e o `tom` da marca em três
  ou quatro regras que valem para a aula toda, para tudo parecer feito pela mesma mão.
  - Sóbrio: fichas só as que o ritmo pede, zoom raro, mais `lista` e `fluxo`.
  - Dinâmico: partes mais curtas, mais fichas, `numero` e `colunas` para virar a página.
  - Editorial: `capa` e `frase` com título forte e `*destaque*`, poucos itens por tela.
- **shot-composition**: um ponto de atenção por tela; título curto, que caiba também no em pé (a
  janela em pé é estreita); o `foco` do zoom pega o elemento inteiro.
- **animation-principles**: espaçe as entradas. Itens chegando todos no fim da fala, ou três no
  mesmo segundo, cansam. Uma entrada a cada 1 a 2,5 s é o ritmo do estúdio.
- **color-motion**: a paleta da marca com contraste (texto sobre a janela, destaque sobre o fundo) e
  os tons de apoio (detalhes na skill claquete-marca).
- **logo-animation**: a vinheta da marca. Hoje fica à parte; o estúdio não a encaixa no começo e no
  fim das aulas (o tipo vinheta chega na 2.2). O logo da marca já aparece no encerramento.
- Ilustração, metáfora visual ou animação que os tipos prontos não fazem: use a tela `animada` (abaixo),
  não código novo em `src/cenas/` (o `--atualizar` do instalador troca a pasta `src/`).

## Telas animadas (cenas em React)

A tela `animada` é a mais rica: uma cena em React com motion e os componentes do React Bits que o instalador
baixou na máquina da pessoa, fotografada quadro a quadro com o relógio da página controlado, no segundo de cada
palavra da voz, deitada e em pé. Use nas partes que pedem ilustração (um conceito, uma metáfora, uma conversa, um
documento, um número) e deixe `lista`, `fluxo` e `frase` para o resto: uma aula boa mistura as duas.

**No roteiro (antes do ok):** `{"tipo": "animada", "cena": "Cena3", "descricao": "o que a cena mostra"}`. A
`descricao` é o que a pessoa aprova no portão 1: diga o que entra e em que palavra ("o documento se escreve; tamanho,
tom e estrutura ganham o visto quando ditos"). O código da cena **ainda não existe**: o plano lista as cenas a escrever.

**Depois do ok e da revisão da fala**, escreva `cenas/src/aulas/<id>.jsx` (modelo completo:
`cenas/src/aulas/animada-exemplo.jsx`):

```jsx
import { Cena, Documento, Item, Placa, useArea, C } from "../ilustra.jsx";

export function Cena3({ b }) {           // b("palavra") = o segundo da cena em que a voz diz a palavra
  const { w, h } = useArea();            // a área da câmera: muda do deitado para o em pé
  return (
    <Cena kicker="2 · Formato" titulo="Mostre o *formato*" texto="Tamanho, tom e estrutura." textoEm={b("tamanho,")}>
      <Documento em={b("exemplo")} largura={w * 0.32} style={{ position: "absolute", left: w * 0.06, top: h * 0.08 }} />
      <Item em={b("tamanho,")} marca={b("tamanho,") + 0.3} texto="Tamanho" icone="Ruler" />
    </Cena>
  );
}
```

- **`<Cena>`**: o texto (kicker, título, apoio, `lado`) fica fixo fora da câmera e nunca é cortado; os filhos ficam na
  área da câmera, em coordenadas dela (0,0 no canto). Deitado: texto à esquerda e área de ~790 x 610 à direita (com
  `cheia`, título em cima e área na largura toda). Em pé: texto em cima e área de 800 x ~600 embaixo. **Posicione em
  frações de `w` e `h`**: a mesma cena sai nos dois formatos.
- `animado` usa o texto animado do React Bits no título; `fundo="aurora" | "particulas" | "feixes"` põe um fundo vivo.
- **Câmera:** `quadros={[[b("palavra"), { s: 1.3, foco: [x0, y0, x1, y1] }, 0.6], [b("outra"), { s: 1 }, 0.4]]}`. Todo
  zoom tem `foco` (em coordenadas da área), que entra inteiro; o resto escurece. `tremores={[b("impacto")]}` sacode.
- **Peças** (`cenas/src/ilustra.jsx`, nas cores e fontes da marca): `Surge`, `Depois` (monta entre dois segundos),
  `Titulo`, `TituloRB`, `Texto`, `Kicker`, `Pilula`, `Cartao`, `Item` (com visto), `ListaViva`, `Balao`, `Digitando`,
  `Escreve`, `Digita`, `Documento`, `Agente`, `Selo`, `Anel`, `Fio`, `Cronometro`, `Tecla`, `Assinatura`, `Carimbo`,
  `NumeroGrande`, `Contador`, `Placa`, `Gira`, `TextoVeloz`, `TextoBrilho`, `TextoGradiente`, `Decifra`, `Palavrao`,
  `Explosao`, `Chuva`, `Velocidade`, `Holofote`, `Flutua`, `Orbe`, `Globo`, `FundoVivo`.
- **React Bits:** as peças `Orbe`, `FundoVivo`, `Contador`, `Gira`, `Digita`, `TextoBrilho`, `TextoGradiente`,
  `TituloRB`, `TextoVeloz`, `ListaViva` e `Globo` usam o componente do React Bits quando ele está em
  `cenas/src/components/react-bits/` (o instalador baixa; com a licença Pro, mais seis) e caem numa versão própria quando
  não está. Pode usar um componente direto: `import { RB } from "../rb.js"` e `<RB.Aurora ... />`, sempre com
  plano B (`RB.Aurora ? ... : ...`), porque o estúdio de outra pessoa pode não ter. **Nunca copie um componente do React
  Bits para fora dessa pasta nem o mande a ninguém**: a licença não deixa redistribuir.
- **Ritmo:** uma novidade a cada 2 s, amarrada às palavras (`b("...")`). Pulsar e flutuar não contam.

**Conferir e fotografar:**
1. `python3 scripts/kit.py cenas <id> --previa`: cinco fotos de cada cena, deitada e em pé, em
   `saida/<id>/previa-NN-h.jpg` e `previa-NN-v.jpg`, e a guarda de cortes. **Revisor das prévias:** um subagente com
   modelo rápido escrito no pedido (sonnet) abre as imagens e aponta texto cortado, peça sobreposta, área vazia demais,
   cor fora da marca e o que não bate com a `descricao` aprovada. Corrija e tire a prévia de novo.
2. `python3 scripts/kit.py cenas <id>`: a captura inteira (uns 13 s de máquina por segundo de cena, nos dois formatos).
   Recusa erro na cena, palavra que a fala não tem, peça cortada pela metade na borda da câmera, quadro vazio e tela
   parada. O `fazer` roda isso sozinho para as cenas pendentes.
3. O `montar` recusa a tela animada não fotografada ou que mudou depois (código da cena, componentes, tempo da voz,
   duração, tema): fotografe de novo só a parte (`cenas <id> --partes 3`).

Se a captura disser que não abriu o navegador: `npx playwright install chromium` no estúdio (ou
`CLAQUETE_CHROMIUM=<caminho de um Chrome>`). Sem o app de cenas (`cenas/node_modules`): `cd cenas && npm install`.

## O fluxo

### 1. Roteiro e revisão

- Escreva `aulas/<id>.json` e rode `python3 scripts/kit.py validar <id>` (grátis) até não haver erro.
- **Revisor do roteiro**: um subagente com um modelo mais forte escrito no pedido (opus, por
  exemplo), porque a tarefa pede julgamento. Nunca herdando o modelo da sessão. Passe o arquivo da
  aula, `marca/marca.json` e a fonte. Ele devolve, parte por parte:
  - fato ou número sem fonte;
  - fora do tom da marca ou do nível do público;
  - termo do glossário trocado por sinônimo; palavra proibida na fala ou na tela;
  - frase difícil para a voz (palavras que soam iguais, ano, sigla sem pronúncia, artigo ambíguo);
  - tela que repete a fala em vez de resumir;
  - trecho de mais de umas 6 palavras sem novidade na tela;
  - duração estimada longe do meio da faixa.
- Corrija tudo e valide de novo.

### 2. Portão 1: roteiro e plano de edição

- `python3 scripts/kit.py plano <id>` gera `saida/<id>/roteiro-e-plano.md`: cada parte com a fala,
  a tela, o que entra em cada palavra, as fichas e os zooms, e a duração estimada. Tela `imagem` ou
  `video` com arquivo que ainda não existe é só aviso aqui (seção "A gravar depois do ok"); o `montar`
  a recusa.
- Mostre o conteúdo à pessoa na conversa, não só o caminho do arquivo. **Pare e espere.**
- Com o ok: `python3 scripts/kit.py aprovar <id>`. Pediu mudança: mude, gere o plano de novo e mostre
  outra vez.

### 3. Narrar

`python3 scripts/kit.py fazer <id> --formatos h,v` narra cada parte na ElevenLabs (a parte paga) e
para no portão 2 (código 2). Parte já narrada com a mesma fala, voz e pronúncia não é narrada de novo.

### 4. Portão 2: revisão da fala

O `conferir` (o `fazer` já roda) gera `public/aulas/<id>/conferencia.json`. Para cada parte:
- `fala` (o roteiro) e `falado` (o que foi para a voz, com a `pronuncia` aplicada);
- `audio` e `duracao`;
- `alertas`: palavras que soam iguais, ano no texto, sigla sem pronúncia;
- com a transcrição local (faster-whisper, que o instalador oferece): `ouvido`, `similaridade` (0 a
  1), `diferencas` e `situacao`: `ok` (a partir de `travas.similaridade_minima`, 0,9), `revisar`
  (de 0,75 até ali: o subagente decide) ou `reprovada` (abaixo de 0,75: o `--aprovado` recusa).
  Números simples por extenso e em algarismo ("dois" e "2") contam como iguais.

**Conferente da fala**: um subagente com um modelo rápido escrito no pedido (sonnet, por exemplo):
é conferência guiada por lista. Ele não ouve; ele lê. Devolve cada parte como aprovada ou reprovada,
com o motivo e o conserto:
- **Fala exata**: `ouvido` diz o mesmo que `fala`? Diferença que muda o sentido reprova. Diferença só
  de grafia ("e-mail" e "email") não reprova.
- **Pronúncia e siglas**: sigla ou nome estrangeiro que o transcritor escreveu errado indica que a
  voz disse errado.
- **Anos**: lidos como número.
- **Palavras que soam iguais** (`alertas`): o sentido sobrevive só de ouvido?
- **Glossário**: cada termo dito como está.
- **Duração**: muito longe de uns 0,36 s por palavra (pausa estranha, trecho cortado) pede ouvido.

Sem transcrição local, `ouvido` vem vazio. O subagente confere o lado do texto (`falado`, `alertas`,
glossário), e **a pessoa ouve os áudios listados no relatório** antes do ok. Diga quais partes ele
marcou para ouvir com atenção.

- **Aprovou**: `python3 scripts/kit.py conferir <id> --aprovado`.
- **Reprovou**: conserte e narre só a parte. Nunca afrouxe a trava.
  - Pronúncia, sigla ou ano: acerte `kit.config.json` → `pronuncia`. O roteiro não muda:
    `python3 scripts/kit.py narrar <id> --partes 3` e `conferir <id>` de novo.
  - Frase que precisa mudar (palavras que soam iguais, artigo ambíguo, sentido trocado): reescrever
    muda o roteiro aprovado, e o `narrar` recusa. Mostre à pessoa a frase antes e depois; com o ok,
    `aprovar <id>`, `narrar <id> --partes 3` e `conferir <id>`.
  - O transcritor escreve diferente uma palavra que a voz diz certo: `travas.aceitar`. Só quando o
    áudio está certo.
- O `--aprovado` recusa se alguma parte ficou `reprovada`, ou se a narração mudou depois do relatório.

### 5. Cenas animadas (só se a aula tiver tela `animada`)

Escreva as cenas e fotografe-as (seção "Telas animadas"): prévia, revisão das prévias por subagente, captura. O
`fazer` fotografa sozinho as pendentes, mas a prévia revisada vem antes.

### 6. Montar, renderizar, finalizar

- `python3 scripts/kit.py fazer <id> --formatos h,v` de novo (pula a voz e a revisão já feitas), ou
  por partes: `montar`, `renderizar`, `finalizar`. O `montar` prepara sempre os dois formatos; o
  `--formatos` (padrão `h`) vale para `renderizar` e `finalizar`.
- `montar` recusa: palavra de `quando` que a fala não tem; mais de 2,5 s sem novidade (diz a parte e
  o segundo); duração fora da faixa.
- `finalizar` põe o som em -14 LUFS, gera as legendas `.vtt` e `.srt` e a folha de quadros, e recusa
  tela parada no vídeo pronto. Ele apaga o arquivo bruto do render, mas roda de novo sobre o vídeo
  já finalizado (sem o bruto, e sem normalizar o som outra vez). Sem render nenhum, para com "não há
  render": aí renderize.
- Para ver no navegador antes do render: `npm run studio`, depois do `montar`.

### 7. Revisão da folha de quadros

`saida/<id>/<id>-h-folha.jpg` (e `<id>-v-folha.jpg`): 16 quadros do vídeo. **Revisor da folha**: um
subagente com um modelo rápido escrito no pedido (sonnet, por exemplo), que abre as imagens e aponta:
- texto cortado, vazando da janela ou quebrando feio;
- tela vazia;
- zoom ruim (o foco corta um elemento);
- legenda em cima de algo importante;
- cor, fonte ou logo fora da marca;
- dado sensível.

Para ver um momento exato, ele tira um quadro. O segundo está em `public/aulas/<id>/plano.json` (o
`inicio` da parte mais o `ini` da palavra):

```bash
mkdir -p saida/<id>/quadros
ffmpeg -ss <segundo> -i saida/<id>/<id>-h.mp4 -frames:v 1 saida/<id>/quadros/q1.jpg
```

Corrija o que ele apontar e rode de `montar` em diante.

### 8. Mudou depois do ok

- **Qualquer mudança no arquivo da aula depois do `aprovar`**, até uma ficha ou um foco de zoom:
  mostre à pessoa só a diferença e peça ok novo; com ele, `aprovar <id>` de novo. O `fazer` e o
  `narrar` param enquanto isso.
- Mudança só de tela não gera a voz de novo: rode de `montar` em diante.
- Mudança de fala: narre só as partes mudadas (`narrar <id> --partes 2,5`), depois `conferir`.
- **Cuidado com o custo**: mudar a `voz` (ou o modelo) muda a assinatura de **todas** as partes. Depois
  disso, narre só com `--partes` e siga com `conferir`, `montar`, `renderizar` e `finalizar` soltos.
  O `fazer`, e o `narrar` sem `--partes`, narrariam a aula inteira de novo. Já mudar a `pronuncia`
  de uma palavra só muda as partes cuja fala usa essa palavra: o `narrar` sem `--partes` refaz só elas.

### 9. Entrega

- Mostre o vídeo pronto (`saida/<id>/<id>-h.mp4`, `<id>-v.mp4`), a duração e o que as revisões
  acharam e corrigiram. **Pare e espere o ok.**
- Vai para uma página? Gere a versão leve antes de entregar (skill video-na-pagina).
- Com o ok: `python3 scripts/kit.py entregar <id> --destino <pasta>`. Ele copia o vídeo final, as
  legendas e as versões de página, confere a cópia e apaga a montagem (`public/aulas/<id>/` e
  `saida/<id>/`). Ficam o vídeo final e o arquivo da aula. Refazer depois narra de novo, e a voz é paga.

## Comandos

```bash
cd estudio-video
python3 scripts/kit.py novo <id> --tipo aula --minutos 3
python3 scripts/kit.py validar <id>                     # grátis
python3 scripts/kit.py plano <id>                       # portão 1: mostre e espere o ok
python3 scripts/kit.py aprovar <id>                     # só com o ok da pessoa
python3 scripts/kit.py fazer <id> --formatos h,v        # narra e para no portão 2
python3 scripts/kit.py conferir <id> --aprovado         # depois da revisão da fala
python3 scripts/kit.py cenas <id> --previa              # telas animadas: fotos para conferir o desenho
python3 scripts/kit.py cenas <id>                       # telas animadas: a captura inteira
python3 scripts/kit.py fazer <id> --formatos h,v        # monta, renderiza e finaliza
python3 scripts/kit.py entregar <id> --destino <pasta>  # depois do ok ao vídeo pronto
```

Por partes: `narrar <id> [--partes 2,5]`, `conferir <id>`, `montar <id>` (sempre h e v),
`renderizar <id> --formatos h,v [--concorrencia 2]`, `finalizar <id> --formatos h,v [--pagina]`.
Código de saída 2 é portão (mensagem `AGUARDANDO`); 1 é erro (`PAROU`).

## A voz

- Só a ElevenLabs. A única chave é `ELEVENLABS_API_KEY`, no `.env` do estúdio (o instalador cria)
  ou no ambiente; nunca em arquivo versionado.
- Vem a **Raquel**, voz pública em português do Brasil, com o modelo `eleven_v4`. A voz da marca
  (`voz.voice_id` no `marca.json`) entra com `kit.py marca`. `python3 scripts/kit.py voz` confere a
  voz na conta e gera `saida/teste-voz.mp3`.
- `voz.velocidade` (padrão 1,1) é aplicada depois da síntese, e os tempos das palavras acompanham.
  `pausa_entre_partes`: 0,35 s.
- A ElevenLabs cobra por caractere. Uma aula de 3 minutos tem uns 2.500.

## A aparência

- `kit.py marca` leva cores, fontes, nome, logo, convite e palavras proibidas da marca para o
  `kit.config.json`, deriva os tons de apoio do fundo (claro leva texto escuro) e gera as fontes do
  Google Fonts sozinho. O que ele não acerta (a conferência de contraste) está na skill claquete-marca.
- `tema.fundo_imagem`: a foto desfocada atrás da janela (prontas: `fundos/champagne.jpg`,
  `fundos/oceano.jpg`, `fundos/esmeralda.jpg`; vazio = luzes em degradê nas cores da marca).
- Música de fundo: `trilha.arquivo` (um arquivo em `public/`) e `trilha.volume` (padrão 0,07).
- Não é preciso app de gravação: janela, sombra, fundo e zoom são do próprio estúdio.

## Tempo e máquina

- Narração: 1 a 2 minutos. Render: cerca de 1 minuto de máquina por minuto de vídeo, por formato
  (`--concorrencia 2` deixa a máquina mais leve). Uma aula por vez.
- O `renderizar` recusa sozinho com menos de 5 GB livres, e o `validar` e o `plano` avisam. Antes de
  gravar uma tela (a gravação em Playwright não passa pelo `kit.py`), confira o disco (no macOS e no
  Linux, `df -h .`) e, com menos de 5 GB livres, pare e avise.
