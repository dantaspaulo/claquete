---
name: claquete
description: >-
  Porta de entrada da Claquete.ai, o estúdio de vídeo que o Claude opera. Lê a marca da pessoa,
  pergunta numa rodada só o tipo de vídeo, a duração, o público e o formato (deitado, em pé ou os
  dois), passa o trabalho para a skill do tipo e conduz tudo sozinho, parando só no roteiro e plano
  de edição, na revisão da fala e na entrega. Use sempre que a pessoa disser "quero fazer um vídeo",
  "faz um vídeo", "vídeo para o Instagram", "vídeo para o YouTube", "Reels", "aula", "videoaula",
  "tutorial", "curso", "trilha", "demonstração", "demo do produto", "dica rápida", "vídeo de marca",
  "vinheta", "anúncio em vídeo", "avatar", "editar minha gravação" ou "o que a Claquete faz", mesmo
  sem dizer o tipo. Também responde com honestidade o que ainda não está pronto.
metadata:
  resumo: Porta de entrada, com tipo, duração, marca e o fluxo de dois portões
---

# Claquete.ai: por onde começa um vídeo

Esta skill recebe o pedido, acerta o que falta numa rodada e passa o trabalho para a skill do tipo.
Daí em diante o Claude trabalha sozinho: escreve, revisa com subagentes, grava, narra, monta e
confere. Ele para em três momentos, e só neles: o ok do roteiro e do plano de edição (**portão 1**),
a revisão da fala (**portão 2**) e a **entrega**.

## 1. O estúdio e a chave

- O estúdio é a pasta com `kit.config.json` (o instalador cria `estudio-video/`). Todo comando roda
  de dentro dela.
- `python3 scripts/kit.py versao` precisa dizer 2.0.0 ou mais. Disse 1.x, ou o comando `plano` não
  existe? `npx github:dantaspaulo/claquete --atualizar` (mantém marca, roteiros, gravações, `.env`
  e configuração).
- Sem estúdio: `npx github:dantaspaulo/claquete`. Precisa de Node 18 ou mais; o resto o instalador resolve.
- A única chave é a `ELEVENLABS_API_KEY`, no `.env` do estúdio ou no ambiente. Não peça outra.
  Nunca escreva chave em arquivo do projeto.

## 2. A marca

Leia `marca/marca.json` antes de perguntar qualquer coisa. Ele sai do questionário do instalador ou
da skill claquete-marca.

| Campo | Para quê |
|---|---|
| `nome`, `o_que_faz`, `publico` | o assunto, os exemplos e o nível da explicação; `publico` já responde a pergunta do público |
| `tom` | como a fala soa: próximo e didático, formal, descontraído ou técnico |
| `glossario` | termos da área que aparecem como estão, nunca trocados por sinônimo |
| `palavras_proibidas` | não entram na fala nem na tela |
| `chamada` | o convite do fim de todo vídeo |
| `movimento` | sóbrio, dinâmico ou editorial: quanta ficha e quanto zoom |
| `cores`, `fontes`, `logo`, `fundo` | o visual, levado ao `kit.config.json` por `kit.py marca` |
| `material`, `design_system`, `site` | onde buscar exemplo, termo e fato da marca |

- Sem `marca/marca.json`: diga em uma linha que o vídeo sai no visual padrão do estúdio e ofereça
  "configura minha marca" (skill claquete-marca). Se a pessoa quiser seguir assim, siga.
- O `tema.marca` do `kit.config.json` é diferente do `nome` da marca? Então a marca não foi
  aplicada: rode `python3 scripts/kit.py marca`.

## 3. Uma rodada de perguntas

Pergunte só o que o pedido, a marca e o material não respondem. Tudo numa mensagem, com uma sugestão
pronta em cada item, para a pessoa só confirmar:

1. **Tipo** (tabela abaixo).
2. **Duração.** Aula, caso e trilha: 2, 3, 4 ou 5 minutos, e quem escolhe é a pessoa. Demonstração
   e dica: vale a faixa do tipo, e a duração sai do caminho na ferramenta.
3. **Público**: quem assiste e o que precisa sair sabendo. Se a marca já diz, confirme.
4. **Formato**: deitado (`h`, 1920×1080: site, YouTube, central de ajuda), em pé (`v`, 1080×1920:
   Reels, TikTok, Shorts) ou os dois.
5. **Assunto e fonte**: o texto, o material ou o sistema de onde sai o conteúdo. Fato e número só
   entram com fonte.
6. Quando há ferramenta: o endereço do sistema e uma **conta de teste**.

## 4. Os tipos

| Tipo (`--tipo`) | O que é | Duração | Skill |
|---|---|---|---|
| `aula` | aula didática e animada, sem mostrar ferramenta | 2 a 5 min, à escolha | aula-animada |
| `demonstracao` | passo a passo de uma tarefa, gravando o sistema | 1 a 4 min | tutorial-de-tela |
| `dica` | um recurso só, direto ao ponto | 30 a 90 s | tutorial-de-tela |
| `caso` | série: um caso do começo ao fim, com a ferramenta trabalhando | cada aula de 2 a 5 min | tutorial-de-tela |
| `trilha` | curso de uma ferramenta, uma aula por recurso | cada aula de 2 a 5 min | tutorial-de-tela |
| `exemplo` | só para testar o estúdio | 10 s a 5 min | · |

Dica sem ferramenta (um conceito em um minuto): tipo `dica`, com as telas animadas da aula-animada.

Desde a 2.1, qualquer tipo pode ter telas `animada`: cenas em React com os componentes do React Bits que o instalador
baixou nesta máquina, fotografadas no tempo da voz. É o visual das aulas do ChatADV; os detalhes estão na skill
aula-animada ("Telas animadas"). Prefira-as nas partes que pedem ilustração.

```bash
python3 scripts/kit.py novo <id> --tipo aula --minutos 3
python3 scripts/kit.py novo <id> --tipo demonstracao
```

O id leva só letras minúsculas, números e hífen. O `montar` recusa vídeo fora da faixa do tipo e,
quando há `--minutos`, fora de 20% para mais ou para menos, sem sair da faixa: 2 min aceita de 120 a
144 s; 3 min, de 144 a 216 s; 4 min, de 192 a 288 s; 5 min, de 240 a 300 s. Acerte o tamanho antes
do portão 1: o `plano` mostra a duração estimada.

## 5. O fluxo: sozinho, com dois portões

1. **Roteiro.** A skill do tipo escreve `aulas/<id>.json` e roda `kit.py validar <id>` (grátis).
2. **Revisão do roteiro** por um subagente: fatos, tom da marca, glossário, palavras proibidas,
   frases difíceis para a voz, duração. O Claude corrige o que ele apontar.
3. **Portão 1: roteiro e plano de edição.** `kit.py plano <id>` gera `saida/<id>/roteiro-e-plano.md`.
   Mostre o conteúdo à pessoa, não só o caminho do arquivo, e espere. Só com o ok dela:
   `kit.py aprovar <id>`. Qualquer mudança no arquivo depois pede ok novo; o `narrar` recusa roteiro
   sem aprovação ou mudado depois dela. Gravação que ainda não existe (tela `video` ou `imagem`)
   não trava o portão: aparece como aviso e na seção "A gravar depois do ok" do plano, e só o
   `montar` a recusa. O `de` das telas `video` fica fora do ok: acertá-lo depois de gravar não pede
   ok novo. Tela `animada` entra no plano pela `descricao`; o código da cena se escreve depois do ok.
4. **Execução.** Grava a ferramenta, quando há, e narra com a ElevenLabs (a parte paga).
5. **Portão 2: revisão da fala.** `kit.py conferir <id>` gera `public/aulas/<id>/conferencia.json` e
   sai com código 2. Um subagente confere cada parte. Aprovou: `kit.py conferir <id> --aprovado`.
   Reprovou: o Claude conserta e narra só aquela parte de novo. Acertar a pronúncia não muda o
   roteiro, e só as partes que usam a palavra são narradas de novo; reescrever uma frase muda o
   roteiro, e a frase nova volta à pessoa (portão 1). Sem transcrição
   local, a pessoa ouve os áudios listados no relatório antes do `--aprovado`.
6. **Cenas animadas**, se houver: escrever, `kit.py cenas <id> --previa`, revisão das prévias por um
   subagente, e `kit.py cenas <id>` (a captura inteira). O `fazer` fotografa sozinho as pendentes.
7. **Montagem.** `montar`, `renderizar`, `finalizar`: ritmo, duração, som em -14 LUFS, legendas e
   folha de quadros. O `montar` prepara sempre os dois formatos; o `--formatos` (`h`, `v` ou `h,v`,
   padrão `h`) vale para `renderizar`, `finalizar` e `fazer`.
8. **Revisão da folha de quadros** por um subagente: texto cortado, tela vazia, zoom ruim, dado
   sensível. O Claude corrige e monta de novo.
9. **Entrega.** Mostre o vídeo pronto e espere o ok. Com ele: `kit.py entregar <id> --destino <pasta>`.

`kit.py fazer <id> --formatos h,v` roda tudo na ordem e para nos portões. Código de saída 2 é parada
de propósito (mensagem `AGUARDANDO`, com o que falta); 1 é erro (`PAROU`, com o motivo). Leia a
mensagem e siga o que ela diz. Os detalhes de cada etapa estão nas skills aula-animada e
tutorial-de-tela.

### Os subagentes

O Claude não confere o próprio trabalho de cabeça: abre um subagente da própria sessão, sempre com o
modelo escrito no pedido.

| Papel | Quando | Modelo |
|---|---|---|
| Revisor do roteiro | antes do portão 1 | um mais forte (opus, por exemplo): pede julgamento |
| Conferente da fala | no portão 2 | um rápido (sonnet, por exemplo): conferência guiada por lista |
| Revisor da folha de quadros | depois do `finalizar` | um rápido (sonnet, por exemplo) |
| Leitor do material da marca | na skill claquete-marca, com material grande | um rápido (sonnet, por exemplo) |

- Nunca deixe o subagente herdar o modelo da sessão, e nunca use o modelo mais caro por padrão.
- Um subagente por tarefa, um de cada vez. Nada em laço.
- O subagente aponta; quem corrige é o Claude. Depois de corrigir, a mesma revisão roda de novo.
- Nunca afrouxe uma trava para passar: não baixe `similaridade_minima`, não suba
  `tela_parada_segundos`, não tire palavra proibida, não ponha em `travas.aceitar` uma palavra que a
  voz disse errado.

## 6. Motion design

O instalador põe junto as skills de motion design da iart.ai (MIT). Elas decidem a linguagem; o
estúdio executa com o que já tem (tipo de tela, entradas no tempo da fala, fichas, zooms, cores,
fundo).

| Skill | Onde entra |
|---|---|
| motion-art-direction | antes do roteiro: traduz a marca e o `movimento` em poucas regras para o vídeo inteiro |
| shot-composition | composição de cada tela, foco dos zooms, área segura do em pé |
| animation-principles | o espaçamento das entradas e das fichas |
| color-motion | a paleta da marca: destaque, fundo, tons de apoio e contraste |
| beat-sync-editing | vídeos curtos com música: cortes e zooms perto da batida |
| logo-animation | vinheta da marca (hoje à parte, ver a seção 7) |
| motion-background | fundo animado, só em peça à parte |
| remotion-video | só quando for preciso mexer no código do estúdio (`src/`) |
| after-effects | só se a pessoa trabalha no After Effects |

Não estão instaladas (instalação com `--sem-motion`, ou sem internet)? Siga as regras das skills do
tipo. Para pôr: `npx github:dantaspaulo/claquete --atualizar`.

## 7. O que ainda não está pronto

Diga o que dá para fazer hoje e não prometa o resto.

| Pedido | Chega na | O que dá hoje |
|---|---|---|
| Avatar apresentador (Higgsfield como principal, HeyGen como alternativa) | 2.2 | nenhum avatar. Uma dica ou demonstração em pé, narrada pela voz da marca. O provedor escolhido já fica em `marca.json` (`avatar`) |
| Anúncio demonstrativo (em pé, sem pessoa, 20 a 35 s) | 2.2 | uma `dica` em pé (`--formatos v`) com o ganho de quem assiste na primeira frase; o piso da dica é 30 s |
| Corte viral (uma gravação longa em vários Reels) | 2.2 | o em pé de qualquer vídeo do estúdio já sai com legenda palavra a palavra; tirar vários cortes de uma gravação, ainda não |
| Carrossel e imagem 4:5 | 2.2 | ainda não: o estúdio só faz 16:9 e 9:16 |
| Vinheta de marca | 2.2 | a skill logo-animation, com a remotion-video, pode montar uma vinheta curta à parte, fora das travas do estúdio; ela não entra sozinha no começo e no fim dos vídeos |
| Editar as gravações da pessoa (Screen Studio, Recordly ou qualquer vídeo) | 2.3 | exportado em MP4, o vídeo entra como tela `video` numa demonstração: corte com `de`, aceleração com `velocidade`, zoom e a voz da ElevenLabs por cima. O som original não entra (a tela `video` é muda); cortar muletas da fala da pessoa, ainda não |
| Instrução no celular | 2.3 | um site em tamanho de celular dá para gravar e narrar em pé; as telas do sistema do celular (instalar o app, liberar notificação), ainda não |

## 8. A máquina

- Na gravação, a IA opera um navegador próprio e, se a sessão controlar o computador, também o da
  pessoa. Peça para deixar a máquina livre: não mexer no navegador que a IA estiver usando e fechar
  o que for pesado. Máquina carregada grava engasgado.
- Renderizar usa bastante memória. Um vídeo por vez; `renderizar --concorrencia 2` alivia.
- Disco: a montagem de cada vídeo ocupa centenas de MB até o `entregar`, e as gravações ficam em
  `public/gravacoes/`. Confira o espaço livre antes de gravar (no macOS e no Linux, `df -h .`): a
  gravação em Playwright não passa pelo `kit.py`. Com menos de 5 GB livres, pare e avise. O
  `renderizar` já recusa sozinho abaixo disso, e o `validar` e o `plano` avisam.

## 9. Entrega

- `kit.py entregar <id> --destino <pasta>` copia o vídeo final, as legendas e as versões de página,
  confere a cópia e apaga a montagem. Só o vídeo final fica.
- Refazer depois narra de novo, e a voz é paga. Por isso a entrega só vem depois do ok da pessoa ao
  vídeo pronto, e a versão para página (`--pagina`, skill video-na-pagina) sai antes dela.
- Na resposta final, diga: onde ficou o vídeo, a duração, o que as revisões acharam e o que foi
  corrigido, o que foi escondido ou trocado por dado fictício e o que ainda depende da pessoa.
