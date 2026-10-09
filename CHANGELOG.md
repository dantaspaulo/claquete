# Versões

Formato: [versão semântica](https://semver.org/lang/pt-BR/). A versão de cada entrega fica no `package.json`, na tag do
Git (`vX.Y.Z`) e na página de versões do GitHub, sempre iguais.

- **X.0.0**: mudança grande, que pode exigir reinstalar ou mudar o jeito de usar (a 2.0, por exemplo).
- **X.Y.0**: melhoria ou recurso novo que não quebra nada (2.1, 2.2...).
- **X.Y.Z**: correção (2.1.1, 2.1.2...).

## 2.0.0 · 09/10/2026

Mudança grande: o fluxo, as skills e a instalação foram reorganizados. Quem tem a 1.x atualiza com
`npx github:dantaspaulo/claquete --atualizar` (roteiros, gravações, chaves e configuração ficam).

- **Tipos de vídeo com duração:** aula, caso e trilha (de 2 a 5 minutos, escolhidos ao começar o projeto), demonstração
  (1 a 4 min) e dica (30 a 90 s). `kit.py novo <id> --tipo aula --minutos 3`; o `montar` recusa o que sai da duração.
- **Dois portões de verdade:** o roteiro com o plano de edição (`plano` e `aprovar`; o `narrar` recusa sem ok) e a
  revisão da fala (`conferir`; o `montar` recusa sem `--aprovado`).
- **Sem OpenAI:** a revisão da fala é da própria sessão do Claude, com subagentes. Transcrição local e gratuita
  (faster-whisper, num `.venv` do estúdio) como opção. A única chave é a da ElevenLabs.
- **Sua marca:** questionário na instalação (nome, público, redes, cores, fontes, logo, movimento, tom, palavras
  proibidas, glossário, voz e chamada) e material da marca por pasta, HTML, `.md` ou link. `kit.py marca` aplica ao estúdio.
- **Skills novas:** `claquete` (porta de entrada) e `claquete-marca`. `aula-animada` e `tutorial-de-tela` reescritas
  para os tipos, os portões e os subagentes.
- **Motion design:** as skills da [iart.ai](https://github.com/iart-ai/motion-design-skills) (MIT) são instaladas junto.
- **Só o vídeo final fica:** `kit.py entregar <id> --destino <pasta>` copia, confere e apaga a montagem.
- **Testes dos portões:** `python3 scripts/teste.py` no estúdio (sem gastar nada), com os portões provados por mutação.
- **Demonstração aprovada antes de gravar:** o plano mostra o caminho na ferramenta (campo `caminho`) e lista o que se
  grava depois do ok; acertar o `de` de uma gravação não pede ok novo.
- **A marca inteira:** fundo claro leva o texto, os painéis e o tom suave junto, e qualquer fonte do Google Fonts entra
  sozinha (`src/fontes.gen.ts`, refeito no `marca` e no `montar`). Fonte fora do Google Fonts é recusada com aviso.
- **Logo da marca** no encerramento de todo vídeo.
- **Mais guardas:** o render recusa com menos de 5 GB livres; a narração de uma parte só se paga de novo quando a fala,
  a voz ou a pronúncia de uma palavra dela muda; o `montar` sempre prepara os dois formatos; o `finalizar --pagina` roda
  de novo sobre um vídeo já finalizado.
- Instalador: `--atualizar`, `--versao`, `--ajuda`, `--sem-motion`, `--sem-marca` e `--transcricao-local`; opção
  desconhecida mostra o uso e para (antes, `--help` rodava a instalação inteira). Tema padrão escuro com
  verde no lugar do champanhe. README com 12 tipos de vídeo em três grupos e o modo autônomo; dois exemplos novos
  (instrução no celular e corte viral narrado).
- Próximas: **2.1** redes (avatar com Higgsfield como principal e HeyGen como alternativa, anúncio demonstrativo, corte
  viral, carrossel e imagem 4:5) e vinheta de marca; **2.2** edição das suas gravações (Screen Studio, Recordly e
  qualquer vídeo) e instrução no celular.

## 1.2.0 · 09/10/2026

- Nome novo: **Claquete.ai** (antes `kit-video-ia`). O repositório virou `dantaspaulo/claquete`; o endereço antigo e o
  `npx github:dantaspaulo/kit-video-ia` continuam funcionando.
- README reorganizado nos quatro tipos de vídeo (demonstração de ferramenta, aula animada, redes e edição de gravação),
  com um exemplo de cada, feitos com o método no ChatADV. Os vídeos de exemplo estão na página desta versão.
- Saíram os exemplos antigos de cor champanhe.
- `package.json` acertado: estava em 1.0.0 enquanto a última versão publicada era a 1.1.0.
- Nada mudou no instalador nem no estúdio: os textos internos deles ainda dizem `kit-video-ia` e mudam na 2.0.

## 1.1.0 · 07/10/2026

- Instalação completa, voz Raquel pronta e fundo de papel de parede.

## 1.0.0 · 07/10/2026

- Primeira versão: skills `aula-animada`, `tutorial-de-tela` e `video-na-pagina` e o estúdio em Remotion.
