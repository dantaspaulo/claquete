import { modulos } from "./fontes.gen";

type Modulo = {
  loadFont: (estilo?: string, opcoes?: { weights?: string[]; subsets?: string[] }) => unknown;
  getInfo: () => { fonts: Record<string, Record<string, Record<string, string>>> };
};

const PESOS = ["400", "500", "600", "700"];
const ALFABETOS = ["latin", "latin-ext"];

// Carrega só os pesos e alfabetos que cada fonte tem: pedir um que ela não tem derruba o render.
for (const m of modulos as unknown as Modulo[]) {
  const estilos = m.getInfo().fonts;
  for (const estilo of Object.keys(estilos)) {
    const tem = Object.keys(estilos[estilo]);
    const pesos = tem.filter((p) => PESOS.includes(p));
    const usar = pesos.length ? pesos : [tem[0]];
    const alfabetos = ALFABETOS.filter((a) => usar.every((p) => estilos[estilo][p][a]));
    m.loadFont(estilo, { weights: usar, subsets: alfabetos.length ? alfabetos : Object.keys(estilos[estilo][usar[0]]).slice(0, 1) });
  }
}

export const pilha = (nome: string) => `"${nome}", "Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
