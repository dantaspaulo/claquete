// O que o plano de uma aula carrega (gerado por scripts/kit.py a partir de aulas/<id>.json).

export type Palavra = { p: string; ini: number; fim: number }; // segundos, relativos ao início da parte

export type Item = { texto: string; quando?: string };
export type Coluna = { titulo: string; itens: (string | Item)[] };
export type Chip = { texto: string; quando: string };
// foco em frações da área da janela: [x0, y0, x1, y1]
export type Zoom = { quando: string; foco: [number, number, number, number]; ate?: string };

export type Tela =
  | { tipo: "capa"; kicker?: string; titulo: string; sub?: string; chips?: Chip[] }
  | { tipo: "lista"; kicker?: string; titulo: string; itens: (string | Item)[]; chips?: Chip[] }
  | { tipo: "colunas"; titulo?: string; esquerda: Coluna; direita: Coluna; chips?: Chip[] }
  | { tipo: "fluxo"; kicker?: string; titulo: string; passos: (string | Item)[]; nota?: string; chips?: Chip[] }
  | { tipo: "frase"; kicker?: string; titulo: string; sub?: string; chips?: Chip[] }
  | { tipo: "numero"; kicker?: string; de?: string; para: string; legenda?: string; chips?: Chip[] }
  | { tipo: "video"; arquivo: string; de?: number; velocidade?: number; legenda?: string; zooms?: Zoom[]; chips?: Chip[] }
  | { tipo: "imagem"; arquivo: string; legenda?: string; zooms?: Zoom[]; chips?: Chip[] };

export type Parte = {
  fala: string;
  rotulo?: string;
  tela: Tela;
  audio: string; // caminho dentro de public/
  inicio: number; // segundos desde o começo da aula
  duracao: number; // segundos da fala
  palavras: Palavra[];
};

export type Tema = {
  fundo: string;
  fundo2: string;
  janela: string;
  texto: string;
  suave: string;
  destaque: string;
  destaque2: string;
  marca: string;
  fonte_titulo: string;
  fonte_texto: string;
};

export type Plano = {
  id: string;
  titulo: string;
  cabecalho: string;
  formatos: ("h" | "v")[];
  destaques: string[];
  partes: Parte[];
  pausa: number;
  encerramento: number;
  total: number;
  tema: Tema;
  convite: { titulo: string; texto: string; endereco: string };
  trilha: { arquivo: string; volume: number };
};
