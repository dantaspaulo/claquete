---
name: claquete-marca
description: >-
  Configura ou refaz a marca da Claquete.ai. Lê o material que a pessoa deu (pasta, HTML, .md, PDF,
  imagens, logos), o site e os links guardados em marca/marca.json, tira nome, cores em hex, fontes,
  logo, tom e termos da área, completa o marca.json sem apagar o que a pessoa respondeu (e pergunta
  quando o material contradiz a resposta), aplica ao estúdio com kit.py marca e mostra uma amostra
  no visual novo para ela aprovar. Use quando a pessoa disser "configura minha marca", "refaz a
  minha marca", "usa o manual da minha marca", "meu design system", "muda as cores dos vídeos",
  "troca a fonte", "põe o meu logo", "muda a chamada do fim", "troca a voz" ou "proíbe esta palavra",
  e quando outra skill da Claquete não achar marca/marca.json.
metadata:
  resumo: Lê o material da marca, completa o marca.json e mostra uma amostra
---

# A marca nos vídeos

Tudo o que a Claquete sabe da marca mora em `marca/marca.json`, dentro do estúdio (a pasta com
`kit.config.json`). O visual vai para o `kit.config.json` com `python3 scripts/kit.py marca`. O
resto (tom, público, glossário, chamada) as skills leem antes de escrever cada roteiro.

## O que tem no marca.json

As chaves que o questionário do instalador grava. Mantenha os mesmos nomes: é o que o `kit.py marca`
e as outras skills leem.

| Chave | O que é | Para onde vai |
|---|---|---|
| `nome`, `o_que_faz`, `publico` | quem é, o que faz, para quem fala | roteiro; `nome` vira `tema.marca` |
| `site`, `instagram`, `tiktok` | endereços | `site` vira o endereço do convite quando a chamada não tem um |
| `material` | lista de `{ "arquivo": "marca/material/..." }` ou `{ "link": "https://..." }` | leitura |
| `design_system` | caminho ou link | leitura |
| `fundo` | `escuro` ou `claro` | escolha das cores |
| `cores.principal`, `cores.secundaria`, `cores.fundo`, `cores.texto` | hex | `tema.destaque`, `tema.destaque2` (sem secundária, repete a principal), `tema.fundo`, `tema.texto` |
| `fontes.titulos`, `fontes.texto` | nome no Google Fonts | `tema.fonte_titulo`, `tema.fonte_texto` |
| `logo` | `marca/logo.svg` ou `.png`, arquivo em `public/marca/` | `tema.logo`: aparece no encerramento de todo vídeo |
| `movimento` | sóbrio, dinâmico ou editorial | roteiro: quanta ficha e quanto zoom |
| `tom` | próximo e didático, formal, descontraído ou técnico | roteiro |
| `palavras_proibidas` | lista | `travas.proibidas_na_fala` |
| `glossario` | termos que não viram sinônimo | roteiro e revisões |
| `voz` | `{ "nome": "Raquel" }` ou `{ "nome": "...", "voice_id": "..." }` | `voz.elevenlabs` |
| `chamada` | `texto`, `endereco`, `linha` | `convite.titulo`, `convite.endereco`, `convite.texto` |
| `avatar.provedor` | `higgsfield`, `heygen` ou sem avatar | guardado para a versão 2.1 |

`cores.secundaria` não sai do questionário: ponha quando o material tiver uma segunda cor de marca.
`cores.fundo2`, `cores.janela` e `cores.suave` também não: são opcionais e viram `tema.fundo2`,
`tema.janela` e `tema.suave`; sem eles, o `kit.py marca` os deriva do `fundo` (seção 4).

## 1. Ler o que já existe

- Leia `marca/marca.json` e liste `marca/material/`.
- **Não há marca.json**: faça as perguntas do questionário numa rodada só, já com sugestões tiradas
  do material ou do site, e crie o arquivo com as chaves da tabela (mais `"versao_questionario": 1`).
  Material que a pessoa der por caminho: copie para `marca/material/` e registre em `material`.
- **"Refaz a minha marca"**: pergunte se ela quer responder tudo de novo ou só trocar o que pediu.
  Antes de reescrever, guarde uma cópia do arquivo atual (`marca/marca.json.bak-<data>`).

## 2. Ler o material

| Fonte | O que procurar |
|---|---|
| HTML e CSS | variáveis de cor (`--primary`, `--brand`...), `font-family`, o link do Google Fonts, o título, as frases de chamada |
| `.md` e PDF | o manual: cores, tipografia, tom de voz, "use" e "não use", termos da área |
| imagens e pasta de logos | o logo (prefira SVG; PNG com fundo transparente), a versão para fundo escuro e a para fundo claro |
| design system | cores e fontes saem dele antes de qualquer outra fonte |
| site e links | abra a página com a ferramenta de leitura de páginas da sessão |

Instagram e TikTok costumam pedir login. Se não abrir, diga e siga sem eles.

**Material grande** (muitos arquivos, PDF longo, site com várias páginas): passe a leitura a um
subagente com modelo rápido escrito no pedido (sonnet, por exemplo), nunca herdando o da sessão. Peça
que ele devolva cada item com a origem (arquivo e trecho):

- nome, o que faz e público;
- cores em hex, com o papel de cada uma (principal, secundária, fundo, texto);
- fontes de títulos e de texto, e se estão no Google Fonts;
- arquivos de logo, para fundo escuro e para fundo claro;
- tom: como a marca fala (você ou o senhor, frase curta ou longa, com humor ou não), com dois ou
  três exemplos tirados do material;
- termos da área que aparecem sempre do mesmo jeito (o glossário);
- palavras e expressões que o material proíbe;
- a chamada que a marca usa nos posts e no site.

Cor tirada só de imagem é aproximada. Prefira o hex escrito no manual, no CSS ou no design system, e
diga à pessoa quando não houver.

## 3. Juntar sem apagar

- **O que a pessoa respondeu fica.** Campo vazio, ou com o valor padrão do instalador, pode receber o
  que o material diz; conte isso no resumo.
- Valores padrão do instalador: nome "Minha marca"; cor principal `#2EE59D`; fundo `#0F1114`
  (escuro) ou `#F6F7F5` (claro); texto `#F1F4F2` ou `#111814`; fontes Instrument Serif e Inter; tom
  "próximo e didático"; movimento "dinâmico"; voz Raquel; chamada "Conheça" e o nome.
- **A pessoa escreveu uma coisa e o material diz outra** (cor, fonte, nome, chamada): pergunte,
  todas as dúvidas numa rodada só, com as duas opções lado a lado. Não escolha sozinho.
- Listas (`glossario`, `palavras_proibidas`): some, sem repetir.
- Logo novo: copie para `public/marca/logo.<extensão>` (guarde o anterior com outro nome, se houver)
  e grave `"logo": "marca/logo.<extensão>"`.

## 4. Aplicar ao estúdio

```bash
python3 scripts/kit.py marca
```

Leva cores, fontes, nome, logo, convite, palavras proibidas e voz para o `kit.config.json`, e já
cuida de duas coisas que antes eram à mão:

- **Os tons de apoio.** O `kit.py marca` deriva `tema.texto`, `tema.fundo2`, `tema.janela` e
  `tema.suave` a partir do `fundo`: fundo escuro leva texto claro, fundo claro leva texto escuro e
  painéis claros. Se o `marca.json` trouxer essas cores (`cores.texto`, `cores.fundo2`,
  `cores.janela`, `cores.suave`), valem as da pessoa. Fora isso, só ajuste à mão no
  `kit.config.json` o que a conferência de contraste abaixo reprovar (a skill color-motion ajuda),
  e lembre que rodar `kit.py marca` de novo refaz esses quatro a partir do `marca.json`.
- **As fontes.** Qualquer fonte do Google Fonts entra sozinha: o estúdio gera `src/fontes.gen.ts`
  no `marca`, no `validar`, no `plano` e no `montar`, então nem editar `src/fontes.ts` nem repor a
  fonte depois do `--atualizar` é preciso. Fonte que não está no Google Fonts é recusada com erro
  claro: sugira a mais parecida.

O que ele não faz, e você faz:

- **O contraste.** Confira texto sobre `janela` e sobre `fundo`; `destaque` sobre `janela` e sobre
  `fundo`; e `fundo` sobre `destaque` (a etiqueta acima da janela e o endereço do convite). Mínimo
  4,5, medido com o comando logo abaixo da lista.
- **O fundo atrás da janela.** `tema.fundo_imagem` vem com `fundos/esmeralda.jpg`. Troque por
  `fundos/champagne.jpg`, `fundos/oceano.jpg`, uma foto da marca em `public/`, ou deixe vazio para
  luzes em degradê nas cores da marca.
- **A voz.** Com `voz.voice_id`, rode `python3 scripts/kit.py voz`: ele confere se a voz está na
  conta da ElevenLabs e gera `saida/teste-voz.mp3` para a pessoa ouvir. Voz da biblioteca que ainda
  não está na conta: a pessoa adiciona pelo site da ElevenLabs, e você roda de novo.

Contraste entre duas cores (o resultado é a razão; abaixo de 4,5, escureça ou clareie uma delas):

```bash
python3 -c "
import sys
def lum(h):
    c = [int(h.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
a, b = sorted([lum(sys.argv[1]), lum(sys.argv[2])])
print(round((b + 0.05) / (a + 0.05), 1))
" '#2EE59D' '#0F1114'
```

## 5. A amostra

Antes de dar a marca por pronta, mostre o visual novo num vídeo curto. Use o `exemplo` (cinco
partes, uns 630 caracteres de voz):

1. **O exemplo já foi narrado e conferido** (existe `public/aulas/exemplo/plano.json`): rode
   `python3 scripts/kit.py montar exemplo`, depois `renderizar exemplo` e `finalizar exemplo`
   (`--formatos h`, `v` ou `h,v` só no `renderizar` e no `finalizar`; o `montar` já prepara os dois).
   O visual é lido no `montar`; a voz não é gerada de novo. Se a voz mudou, narre de novo (passo 2).
2. **Não foi**: a narração é paga, então pergunte antes ("a amostra gasta a voz de uns 630
   caracteres na ElevenLabs"). Com o sim, troque o `cabecalho` do exemplo pelo nome da marca, rode
   `kit.py plano exemplo` e `kit.py aprovar exemplo` (o sim da pessoa à amostra é o portão 1 dela) e
   `kit.py fazer exemplo --formatos h` (ou `h,v`). Ele para na revisão da fala: o conferente da fala,
   um subagente com modelo rápido escrito no pedido, lê `public/aulas/exemplo/conferencia.json`;
   aprovado, `kit.py conferir exemplo --aprovado` e `fazer` de novo. Se o exemplo esbarrar numa
   palavra proibida da marca, troque a frase antes do `aprovar`.
3. Mostre `saida/exemplo/exemplo-h-folha.jpg` (16 quadros) e o vídeo `saida/exemplo/exemplo-h.mp4`.
   Pergunte o que mudar. Ajuste de cor, fonte, fundo, logo ou convite: `kit.py marca` (ou o
   `kit.config.json`) e de `montar` em diante; a voz não muda.
4. Com o ok, a marca está pronta. A amostra pode ficar onde está, ou ir para uma pasta da pessoa
   com `kit.py entregar exemplo --destino <pasta>` (que apaga a montagem dela).

## 6. Motion design e marca

Com as skills de motion design da iart.ai, quando instaladas:

- **color-motion**: a paleta a partir das cores da marca, os tons de apoio (`fundo2`, `janela`,
  `suave`) e o contraste.
- **motion-art-direction**: traduz a marca numa linguagem de movimento. Se o material pedir outra
  coisa que o `movimento` respondido, pergunte, como em qualquer contradição.
- **logo-animation**: a vinheta do logo. Hoje ela fica à parte; o tipo vinheta de marca chega na 2.1.

## 7. Fechar

Diga à pessoa, curto: o que veio do material (com a origem), o que ela respondeu e ficou, o que foi
perguntado e a resposta, e o que ficou de fora (fonte fora do Google Fonts, que o estúdio recusa; cor
aproximada; link que não abriu). Daí em diante, todo roteiro sai com esta marca.
