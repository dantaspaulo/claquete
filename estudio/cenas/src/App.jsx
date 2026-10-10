// Uma CENA por página. A captura (capturar.cjs) põe os dados em window.__CENA__, para o relógio e chama
// window.__comecar(). A cena de cada parte é src/aulas/<id>.jsx, export <componente> (Cena1, Cena2...).
import { Component, useEffect, useMemo, useState } from "react";
import { FormatoCtx, Moldura, aplicarTema } from "./ilustra.jsx";

const AULAS = import.meta.glob("./aulas/*.jsx", { eager: true });
const norma = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

class Guarda extends Component {
  state = { erro: null };
  static getDerivedStateFromError(e) {
    window.__erro = String((e && e.message) || e);
    return { erro: window.__erro };
  }
  render() {
    return this.state.erro ? <pre style={{ color: "#fff", padding: 40, whiteSpace: "pre-wrap" }}>{this.state.erro}</pre> : this.props.children;
  }
}

export default function App() {
  const [c, setC] = useState(null);
  useEffect(() => {
    window.__comecar = () => setC(window.__CENA__);
    window.__pronto = true;
  }, []);
  // b("palavra", vez, ajuste): o segundo (dentro da cena) em que a narração diz a palavra; a animação entra um pouco antes.
  const b = useMemo(() => {
    if (!c) return null;
    const ws = c.palavras.map((w) => ({ ...w, n: norma(w.t) }));
    return (p, vez = 1, ajuste = -0.12) => {
      const xs = ws.filter((w) => w.n === norma(p));
      if (xs.length < vez) throw new Error(`a fala da ${c.componente} não tem a ${vez}ª "${p}"`);
      return Math.max(0, xs[vez - 1].i + ajuste);
    };
  }, [c]);
  const dados = c || window.__CENA__ || {};
  aplicarTema(dados.tema, dados.formato);
  if (!c) return <Moldura />;
  const Cena = AULAS[`./aulas/${c.aula}.jsx`]?.[c.componente];
  if (!Cena) throw new Error(`não achei a cena ${c.componente} em cenas/src/aulas/${c.aula}.jsx`);
  return (
    <FormatoCtx.Provider value={c.formato}>
      <Guarda>
        <Moldura dur={c.dur}>
          <Cena b={b} dur={c.dur} formato={c.formato} />
        </Moldura>
      </Guarda>
    </FormatoCtx.Provider>
  );
}
