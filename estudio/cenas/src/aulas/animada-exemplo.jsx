// Aula de exemplo com telas animadas. b("palavra") = o segundo da cena em que a voz diz a palavra (a peça entra ali).
// Dentro da <Cena>, as coordenadas são da área da câmera: useArea() dá a largura e a altura, que mudam do deitado para o
// em pé. Por isso as posições abaixo são frações de w e h.
import {
  Balao, Cena, Depois, Digita, Digitando, Documento, Escreve, Explosao, Flutua, Item, Orbe, Pilula, Placa, Selo, Surge, TextoGradiente,
  fx, useArea, C,
} from "../ilustra.jsx";

// Peça centrada em (x, y) da área, sem brigar com o transform das animações dela.
const No = ({ x, y, children }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>{children}</div>
);

export function Cena1({ b }) {
  const { w, h } = useArea();
  const ctx = b("contexto,"), ex = b("exemplo"), fo = b("formato."), res = b("resposta"), pri = b("primeira");
  const cx = w / 2, cy = h * 0.36, r = Math.min(w, h) * 0.2;
  const pilulas = [["Contexto", "UserRound", ctx, cx - w * 0.28], ["Exemplo", "FileText", ex, cx], ["Formato", "LayoutList", fo, cx + w * 0.28]];
  return (
    <Cena kicker="Aula animada" titulo="Pedidos *melhores* para a IA" texto="Três partes mudam a resposta." textoEm={b("partes:")} animado fundo="aurora">
      <Orbe x={cx} y={cy} size={r * 2} em={0.2} pulsos={[ctx, ex, fo]} />
      {pilulas.map(([t, ic, em, x]) => <No key={t} x={x} y={cy + r + 56}><Pilula icone={ic} texto={t} em={em} /></No>)}
      <Explosao em={res} x={cx} y={cy} n={22} raio={r * 1.6} />
      <Selo x={cx} y={h * 0.84} icone="Sparkles" rotulo="na 1ª tentativa" em={pri} />
    </Cena>
  );
}

export function Cena2({ b }) {
  const { w, h } = useArea();
  const diga = b("diga"), ia = b("IA"), escreve = b("escreve"), pub = b("público");
  const cw = Math.min(w - 90, 640), x0 = (w - cw) / 2;
  return (
    <Cena kicker="1 · Contexto" titulo="Diga *quem você é*" texto="E para quem é o texto." textoEm={b("quem")}>
      <Flutua amp={4} style={{ position: "absolute", left: x0, top: h * 0.08, width: cw }}>
        <Surge em={0.3} style={{ background: C.card, border: `1px solid ${C.borda}`, borderRadius: 22, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ font: fx(17, 700), color: C.cinza }}>Pedido à IA</div>
          <Depois em={diga}>
            <Balao key="eu" de="voce" em={0}><Digita texto="Sou professora. Resuma para alunos de 12 anos." em={0} velocidade={30} style={{ font: fx(21, 500), color: "#1d2329" }} /></Balao>
          </Depois>
          <Digitando em={ia} ate={escreve} />
          <Depois em={escreve}>
            <Balao key="ia" de="ia" em={0}><Escreve texto="Claro! Vou usar frases curtas e exemplos do dia a dia." dur={1.1} /></Balao>
          </Depois>
        </Surge>
      </Flutua>
      <No x={w / 2} y={h * 0.86}><Pilula icone="Target" texto="público certo" em={pub} /></No>
    </Cena>
  );
}

export function Cena3({ b }) {
  const { w, h } = useArea();
  const ex = b("exemplo"), tam = b("tamanho,"), tom = b("tom"), est = b("estrutura."), cinco = b("cinco"), basta = b("basta.");
  const largDoc = Math.min(260, w * 0.36);
  return (
    <Cena kicker="2 · Exemplo e formato" titulo="Mostre o *formato*" texto="Tamanho, tom e estrutura." textoEm={tam - 0.2}>
      <Documento em={ex} largura={largDoc} linhas={9} titulo="Exemplo" escreve={0.12} style={{ position: "absolute", left: w * 0.06, top: h * 0.08 }} />
      <div style={{ position: "absolute", left: w * 0.06 + largDoc + 34, right: w * 0.06, top: h * 0.1, display: "flex", flexDirection: "column", gap: 12 }}>
        <Item em={tam} marca={tam + 0.3} texto="Tamanho" icone="Ruler" />
        <Item em={tom} marca={tom + 0.3} texto="Tom" icone="AudioLines" />
        <Item em={est} marca={est + 0.3} texto="Estrutura" icone="ListTree" />
      </div>
      <div style={{ position: "absolute", left: w * 0.06, right: w * 0.06, top: h * 0.66, display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <Placa valores={["5 tentativas", "4 tentativas", "3 tentativas", "2 tentativas", "1 tentativa"]} em={cinco} passo={0.22} size={52} cor={C.verde} />
        <TextoGradiente texto="basta" em={basta} size={52} />
      </div>
    </Cena>
  );
}
