---
name: tutorial-de-tela
description: >-
  Demonstração de ferramenta, dica rápida, caso completo e trilha de uma ferramenta, gravando um
  sistema de verdade no estúdio da Claquete.ai. O Claude mapeia o sistema, escreve o roteiro de
  usabilidade e o plano de edição (o caminho, onde corta, onde acelera, onde dá zoom) para a pessoa
  aprovar, grava com o Playwright (cursor visível, dado borrado, texto proibido descarta a
  gravação), narra com a voz da ElevenLabs, passa a fala e a folha de quadros por subagentes e
  entrega o vídeo conferido. Use sempre que a pessoa pedir "tutorial em vídeo", "demonstração",
  "demo do produto", "vídeo de como usar", "gravar a tela", "passo a passo do sistema", "vídeo de
  funcionalidade", "dica rápida", "screencast", "vídeo de onboarding", "curso da ferramenta",
  "trilha", "um caso do começo ao fim" ou "série mostrando o sistema", mesmo sem citar gravação.
  Para aula de conceito sem ferramenta, use aula-animada.
metadata:
  resumo: Demonstração, dica, caso e trilha gravando um sistema de verdade
---

# Demonstração, dica, caso e trilha

Três etapas: **planejar** (roteiro de usabilidade e plano de edição, com o ok da pessoa),
**gravar** o caminho no sistema (sem voz, sem pressa, com dado de teste) e **narrar por cima**, como
uma aula cujas telas são trechos da gravação. As regras de fala, voz, ritmo, os dois portões, os
subagentes e a entrega são os da skill aula-animada: leia-a se ainda não leu. Aqui está o que muda.

## Os tipos

| Tipo (`--tipo`) | O que é | Duração |
|---|---|---|
| `demonstracao` | uma tarefa do começo ao fim | 1 a 4 min |
| `dica` | um recurso só, direto ao ponto | 30 a 90 s |
| `caso` | série: um caso do começo ao fim, uma aula por etapa | cada aula de 2 a 5 min (`--minutos`) |
| `trilha` | curso de uma ferramenta, uma aula por recurso | cada aula de 2 a 5 min (`--minutos`) |

```bash
python3 scripts/kit.py novo cadastro-cliente --tipo demonstracao
python3 scripts/kit.py novo trilha-agenda-03-lembretes --tipo trilha --minutos 3
```

Demonstração e dica não levam `--minutos`: vale a faixa do tipo, e a duração sai do caminho.

## Antes de planejar: o que perguntar

Numa rodada só (a skill claquete pode já ter perguntado), com sugestão pronta:
1. **O caminho**: o que o vídeo mostra, do começo ao fim, e o resultado que quem assiste quer ter.
2. **Onde**: o endereço do sistema, e se é preciso login.
3. **Conta e dado**: conta de teste e dado fictício. **Nunca grave com dado real de cliente.**
4. **O que não pode aparecer**: nomes, e-mails, valores, documentos. Isso vira `esconder` e `proibidos`.
5. **Formato** (deitado, em pé ou os dois) e, em caso e trilha, a duração de cada aula.

Leia também `marca/marca.json` (tom, público, glossário, palavras proibidas, chamada), como na
aula-animada.

## Mapear a ferramenta

Antes de escrever, conheça o caminho: abra o sistema, percorra as telas, anote o seletor de cada
botão e campo. Um ensaio com `gravar.mjs` (abaixo) é grátis e mostra se cada passo acha o seu alvo.
Ensaio só com a conta de teste.

### Trilha: o curso de uma ferramenta

1. **Mapeie**: liste os recursos da ferramenta (menus, telas, ações principais).
2. **Uma aula por recurso**, de 2 a 5 minutos. Recurso grande demais: divida. Recurso pequeno: vira
   uma `dica`.
3. **Ordene pelo jeito de aprender**: primeiro o que se usa no primeiro dia (entrar, configurar, a
   tarefa principal), depois o que depende disso, por fim o avançado. Nenhuma aula usa o que uma
   anterior não mostrou.
4. **Cada aula é um id**, numerado na ordem: `trilha-<ferramenta>-01-<recurso>`, `-02-...`.
5. Mostre o mapa da trilha (aula, recurso, ordem, duração) junto com o roteiro da primeira aula, no
   portão 1. Cada aula passa pelos dois portões.

### Caso: uma série do começo ao fim

- Um caso fictício e verossímil, com os mesmos dados do começo ao fim (o mesmo cliente fictício, os
  mesmos números): a série mostra a continuidade.
- Uma aula por etapa do caso, cada uma de 2 a 5 minutos, com id numerado (`caso-<nome>-01-...`).
- Cada aula abre lembrando onde o caso parou e fecha dizendo o que vem na próxima. Entre os passos
  gravados, telas animadas (`fluxo`, `lista`, `frase`) explicam o porquê.
- Grave as etapas na ordem: o estado do sistema no fim de uma é o começo da outra.

## O portão 1: roteiro de usabilidade e plano de edição

Tudo num documento só, `saida/<id>/roteiro-e-plano.md`, para a pessoa aprovar de uma vez. A gravação
ainda não existe nessa hora, e o estúdio sabe disso: o `plano` e o `aprovar` tratam o arquivo de tela
`video` ou `imagem` que falta como aviso, e o `montar` é que o recusa.

**Roteiro de usabilidade**: o que quem assiste quer fazer, de onde parte, cada passo (uma ação por
passo), o resultado esperado, e o erro comum ou o limite que vale avisar.

**Plano de edição**, parte por parte:
- **o caminho**: que trecho da gravação a parte mostra;
- **onde corta**: cada parte começa num `de` (o segundo da gravação). O trecho entre o fim de uma
  parte e o `de` da próxima não aparece: espera, carregamento e digitação longa ficam de fora;
- **onde acelera**: `velocidade` (1,5 ou 2, por exemplo) no que precisa aparecer mas é lento;
- **onde dá zoom**: `zooms`, com o `foco` no campo, botão ou resultado, na palavra em que a voz fala
  dele.

Como montar:
1. Escreva o roteiro de gravação (`gravar/<nome>.json`, abaixo) e o arquivo da aula
   (`aulas/<id>.json`), com as telas `video` apontando para a gravação que ainda vai existir
   (`gravacoes/<nome>.mp4`), cada uma com o seu `de` provisório, `velocidade` e `zooms`. Abra com uma
   `capa` (o que o vídeo mostra) e feche com uma `lista` ou uma `frase` (o que lembrar). No topo do
   JSON, ponha o `caminho`: a lista dos passos na ferramenta, em palavras simples (modelo em
   `aulas/tutorial-exemplo.json`).
2. `python3 scripts/kit.py validar <id>`. Antes de gravar, o arquivo da gravação que falta sai como
   aviso ("arquivo gravacoes/<nome>.mp4 não existe em public/ (grave depois do ok do roteiro)"), não
   como erro.
3. **Revisor do roteiro**: o subagente da aula-animada (modelo mais forte escrito no pedido), com mais
   três itens: cada passo do caminho tem a sua parte; nenhum passo mostra dado real; `esconder` e
   `proibidos` cobrem tudo o que a pessoa disse que não pode aparecer.
4. `python3 scripts/kit.py plano <id>` escreve o plano: o **Caminho na ferramenta (o que será
   gravado)**, vindo do `caminho`, e depois as partes com o plano de edição de cada uma. A seção
   **A gravar depois do ok** lista os arquivos que serão gravados. A conta e o dado fictício usados,
   o que vai borrado (`esconder`) e o que descarta a gravação (`proibidos`) moram no roteiro de
   gravação, não no arquivo da aula: diga-os à pessoa ao mostrar o plano (ou ponha-os como itens do
   `caminho`, para entrarem no ok).
5. Mostre à pessoa. Os arquivos em "A gravar depois do ok" são esperados: explique que a gravação vem
   depois do ok. **Pare e espere.**

O ok vale para o caminho, as falas, os cortes, as acelerações e os zooms. O `caminho` entra na
assinatura do ok: mudou um passo, pede ok novo. O `de` das telas `video` não entra: trocar o `de`
provisório pelo segundo real das marcas é executar o plano aprovado, e o ok continua valendo. Qualquer
outra mudança (uma fala, um passo, um corte, um zoom) volta à pessoa antes do `aprovar`.

## Gravar

Roteiro em JSON (modelo em `gravar/exemplo.json`, que grava a página de demonstração em `gravar/demo/`):

```json
{
  "nome": "cadastro-cliente",
  "largura": 1280, "altura": 720, "escala": 1,
  "sessao": "sessao.json",
  "esconder": [".email-do-usuario", "#saldo"],
  "proibidos": ["@empresa.com.br", "CPF"],
  "passos": [
    { "ir": "https://sistema.exemplo.com/clientes", "esperar": 1000, "marca": "lista" },
    { "clicar": "text=Novo cliente", "marca": "novo" },
    { "digitar": { "em": "#nome", "texto": "Maria Exemplo", "atraso": 40 } },
    { "escolher": { "em": "#plano", "valor": "anual" } },
    { "clicar": "button[type=submit]", "esperar": 2000, "marca": "salvo" }
  ]
}
```

```bash
cd estudio-video
npx playwright install chromium        # uma vez (o instalador oferece)
node gravar/gravar.mjs gravar/<roteiro>.json
```

- Passos: `ir`, `clicar`, `pairar`, `digitar` (`atraso` em ms por letra), `escolher`, `apertar`
  (tecla), `rolar` (pixels), `esperar` (ms). Sem `esperar`, cada passo espera 350 ms.
- O cursor aparece e anda até cada alvo; o clique afunda.
- **`esconder`** borra os seletores na gravação. **`proibidos`**: se um desses textos aparecer na
  tela, a gravação é **descartada** e o programa sai com código 3. Ajuste e grave de novo.
- A trava de `proibidos` lê o texto da página depois de cada passo. Ela não vê o que foi digitado
  dentro de um campo, o que está em imagem, nem o que aparece e some entre dois passos. Por isso a
  folha de quadros também procura dado sensível.
- **Login**: grave a sessão antes (`npx playwright codegen --save-storage=sessao.json <url>`) e aponte
  `"sessao"`. Nunca ponha senha no roteiro. O arquivo de sessão (`sessao*.json`) não vai para
  repositório.
- O navegador da gravação é próprio do Playwright. Peça à pessoa para deixar a máquina livre e fechar
  o que for pesado: máquina carregada grava engasgado. Confira o disco antes de gravar (no macOS e no
  Linux, `df -h .`; a gravação não passa pelo `kit.py`); com menos de 5 GB livres, pare e avise. O
  render depois recusa sozinho abaixo disso.
- Sai `public/gravacoes/<nome>.mp4` e `<nome>.marcas.json`: o segundo em que cada passo começou, com
  a `marca` que você deu.

## Depois de gravar: acertar o plano

1. Troque cada `de` provisório pelo segundo do passo em `public/gravacoes/<nome>.marcas.json` (um
   pouco antes, se a parte deve mostrar o cursor chegando).
2. Confira cada passo num quadro da gravação: o clique pegou, a resposta carregou, nada real apareceu.
   ```bash
   mkdir -p saida/<id>/quadros
   ffmpeg -ss <segundo> -i public/gravacoes/<nome>.mp4 -frames:v 1 saida/<id>/quadros/passo-1.jpg
   ```
3. A parte não pode passar do fim da gravação: `de` + (duração da fala × `velocidade`) cabe no que
   sobra. A duração exata só sai na narração; estime uns 0,36 s por palavra.
4. `kit.py validar <id>`: agora o arquivo da gravação existe, e o `montar` o exige. Se só o `de`
   mudou, o ok anterior continua valendo, sem `aprovar` de novo. Mudou mais que isso (uma fala, um
   passo do `caminho`, um corte, um zoom): diferença à pessoa, `plano` e ok novo.

## Narrar por cima

Telas `video` apontando para a gravação (modelo: `aulas/tutorial-exemplo.json`):

```json
{ "fala": "Depois, escolha o plano anual.", "rotulo": "Passo 2",
  "tela": { "tipo": "video", "arquivo": "gravacoes/cadastro-cliente.mp4", "de": 4.6,
            "velocidade": 1.5, "legenda": "Escolha o plano",
            "zooms": [{ "quando": "plano", "foco": [0.15, 0.3, 0.85, 0.6] }],
            "chips": [{ "texto": "plano anual", "quando": "anual" }] } }
```

- **Uma parte por passo** da gravação. A fala diz o que fazer e por quê, não descreve o óbvio
  ("clique no botão azul").
- `legenda` é a etiqueta dentro da janela; as fichas (`chips`) também entram na janela.
- **Zoom com foco que inclui o elemento inteiro**: o resto escurece (holofote). Se o foco cortar um
  campo pela metade, aumente o foco. A câmera aproxima no máximo 3 vezes.

### Deitado e em pé: o zoom muda de lugar

O `foco` é medido na janela, e a janela muda com o formato. Uma gravação 16:9 (1280×720) ocupa:
- **deitado**: a altura toda, e a largura de 7,7% a 92,3% da janela;
- **em pé**: a largura toda, e só a faixa de 25% a 75% da altura.

Para um alvo que está, na gravação, na fração `a` da largura e `b` da altura (de 0 a 1):
- deitado: `x = 0,077 + 0,847 × a` e `y = b`;
- em pé: `x = a` e `y = 0,252 + 0,496 × b`.

O mesmo arquivo não acerta os dois. Só um formato: use a conta dele. Os dois, com zoom bom nos dois:
1. Faça o deitado com o id normal, até passar no portão 2.
2. Copie o arquivo para `aulas/<id>-empe.json`, com os focos convertidos. No em pé cabe pouco: foque
   um campo, um botão, um trecho da resposta; foco largo quase não aproxima.
3. Copie `public/aulas/<id>/parte-*.mp3` e `parte-*.json` para `public/aulas/<id>-empe/`: o `narrar`
   reconhece a mesma fala, voz e pronúncia e não paga de novo.
4. A cópia passa pelos portões como as outras: `plano <id>-empe`, mostre à pessoa (só os focos
   mudaram), `aprovar <id>-empe` com o ok, e `conferir <id>-empe` (o conferente da fala revisa o
   mesmo áudio).
5. `--formatos h` no original e `--formatos v` na cópia (no `renderizar`, no `finalizar` e no
   `fazer`; o `montar` prepara sempre os dois).

Outra saída: gravar de novo numa janela mais estreita (`largura` 900, `altura` 1000, por exemplo), que
enche melhor o em pé. Aí o em pé tem gravação e `de` próprios.

## Portão 2, montagem e entrega

Iguais aos da aula-animada: `fazer <id> --formatos ...` narra e para no portão 2; o conferente da fala
revisa `public/aulas/<id>/conferencia.json`; `conferir <id> --aprovado`; `fazer` de novo monta,
renderiza e finaliza; o revisor da folha olha os quadros; você mostra o vídeo à pessoa e, com o ok,
`entregar`.

### Ritmo na gravação

A conferência de ritmo do `montar` não vale para telas `video` (a gravação já se mexe). O medidor de
tela parada do `finalizar` vale, e mede só a janela: gravação parada por 2,5 s ou mais (esperando
carregar, alguém lendo) é recusada. Resolva já no plano: corte com `de`, acelere com `velocidade`, ou
ponha um zoom ou uma ficha na palavra certa.

### Dica: vídeo curto, de rede

- Uma ideia, um recurso. A primeira frase diz o ganho de quem assiste; depois mostra; fecha com a
  chamada da marca.
- Em pé (`v`) para Reels, TikTok e Shorts, de 30 a 90 s.
- Com música (`trilha.arquivo` no `kit.config.json`), a skill beat-sync-editing ajuda a escolher a
  música e a pôr cortes (`de`) e zooms perto das batidas. O tempo continua sendo o da voz. A trilha
  entra no `montar`: dá para pôr a música, montar a dica e voltar a trilha ao que era.
- Direção, composição e paleta: as mesmas skills de motion design da aula-animada.

### Folha de quadros e privacidade

O revisor da folha (subagente com modelo rápido escrito no pedido) olha `saida/<id>/<id>-h-folha.jpg`
(e a do em pé) como na aula-animada, e aqui procura com mais cuidado:
- **dado sensível**: nome, e-mail, telefone, documento, valor, endereço na barra do navegador,
  notificação que pulou na tela;
- **zoom**: foco no lugar certo, elemento inteiro na luz, sem faixa preta no em pé;
- tela de carregamento ou de erro que ficou no corte.

Dado sensível achado não vai para a entrega: ponha em `esconder` ou `proibidos` e grave de novo. Conte
à pessoa o que apareceu e o que mudou, acerte o `de` pelas marcas novas (não pede ok novo) e rode de
`montar` em diante. Se o achado mudou também um passo, um corte ou um zoom, esse trecho volta à
pessoa e pede `aprovar`. A fala não muda, então a voz não é gerada de novo.

## Entrega

- Igual à aula-animada: o vídeo pronto para a pessoa, o ok, `entregar <id> --destino <pasta>`.
- Diga à pessoa o que foi escondido ou trocado por dado fictício.
- A gravação fica em `public/gravacoes/` (o `entregar` não a apaga). Ela é grande e só serve para
  montar de novo: pergunte se pode apagar, e só a que nenhuma outra aula usa (num caso ou numa
  trilha, várias aulas podem usar a mesma).
- Para página de produto ou central de ajuda: skill video-na-pagina, antes do `entregar`.

## Privacidade, em resumo

- Conta de teste e dado fictício, sempre. Nunca dado real de cliente.
- Senha nunca no roteiro; login pelo arquivo de sessão, que não vai para repositório.
- `esconder` para o que pode aparecer borrado; `proibidos` para o que não pode aparecer de jeito nenhum.
- Gravação descartada (código 3): ajuste o caminho e grave de novo. Nunca tire um texto de
  `proibidos` para passar.
- O revisor da folha procura dado sensível em todo vídeo, e o achado volta para a gravação, nunca
  para a entrega.
