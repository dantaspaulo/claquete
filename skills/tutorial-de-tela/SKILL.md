---
name: tutorial-de-tela
description: >-
  Grava um passo a passo de um sistema ou site com o Playwright (cursor visível, trava de privacidade
  que descarta a gravação se aparecer texto proibido) e transforma a gravação num TUTORIAL NARRADO com
  o estúdio do kit-video-ia: voz por IA, legenda palavra a palavra, zoom com holofote no que importa,
  conferências de fala e ritmo. Use sempre que a pessoa pedir "tutorial em vídeo", "vídeo de como
  usar", "gravar a tela", "passo a passo do sistema", "demo do produto", "vídeo de funcionalidade",
  "screencast" ou "vídeo de onboarding", mesmo sem citar gravação. Para aula de conceito sem gravação,
  use a skill aula-animada.
metadata:
  resumo: Tutorial narrado gravando um sistema de verdade
---

# Tutorial narrado gravando a tela

Duas etapas: **gravar** o caminho no sistema (sem voz, sem pressa, com dado de teste) e **narrar**
por cima, como uma aula cujas telas são trechos da gravação. As regras de roteiro, voz e ritmo são
as da skill aula-animada; leia-a se ainda não leu.

## Antes de gravar: o que perguntar

1. **O caminho**: o que o tutorial mostra, do começo ao fim, em passos (uma ação por passo).
2. **Onde**: endereço do sistema, e se é preciso login.
3. **Conta e dado**: conta de teste e dado fictício. **Nunca grave com dado real de cliente.**
4. **O que não pode aparecer**: nomes, e-mails, valores, documentos. Isso vira `esconder` e `proibidos`.
5. **Formato**: deitado e/ou em pé.

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
npx playwright install chromium        # uma vez
node gravar/gravar.mjs gravar/<roteiro>.json
```

- Passos: `ir`, `clicar`, `pairar`, `digitar`, `escolher`, `apertar` (tecla), `rolar` (pixels), `esperar` (ms).
- O cursor aparece e anda até cada alvo; o clique afunda.
- **`esconder`** borra os seletores na gravação. **`proibidos`**: se um desses textos aparecer na tela,
  a gravação é **descartada** e o programa sai com código 3. Ajuste e grave de novo.
- **Login**: grave a sessão antes (`npx playwright codegen --save-storage=sessao.json <url>`) e aponte
  `"sessao"`. Nunca ponha senha no roteiro. O arquivo de sessão não vai para repositório.
- Sai `public/gravacoes/<nome>.mp4` e `<nome>.marcas.json`, com o segundo de cada passo.

## Narrar por cima

Uma aula com telas `video` apontando para a gravação (modelo: `aulas/tutorial-exemplo.json`):

```json
{ "fala": "Depois, escolha o plano anual.", "rotulo": "Passo 2",
  "tela": { "tipo": "video", "arquivo": "gravacoes/cadastro-cliente.mp4", "de": 4.6,
            "legenda": "Escolha o plano",
            "zooms": [{ "quando": "plano", "foco": [0.15, 0.3, 0.85, 0.6] }] } }
```

- **`de`**: o segundo da gravação onde a parte começa (tire das marcas). `velocidade` acelera trechos lentos.
- **Uma parte por passo** da gravação; a fala diz o que fazer e por quê, não descreve o óbvio.
- **Zoom com foco que inclui o elemento inteiro**: o resto escurece (holofote). Se o foco cortar um
  campo pela metade, aumente o foco. Na folha de quadros, confira cada zoom.
- A parte não pode ser mais longa que o trecho da gravação que sobra depois do `de`.

```bash
python3 scripts/kit.py fazer <id> --formatos h
```

A conferência de ritmo do plano não se aplica às telas `video` (a gravação já se mexe); o medidor
de tela parada no vídeo pronto continua valendo. Trecho parado demais: acelere (`velocidade`), corte
com `de`, ou ponha um zoom.

## Entrega

Vídeo em `saida/<id>/`, legendas `.vtt`/`.srt` e a folha de quadros. Diga à pessoa o que foi
escondido ou trocado por dado fictício. Para página de produto, a skill video-na-pagina.
