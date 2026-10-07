import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { Aula } from "./Aula";
import { AULAS } from "./indice.gen";
import { TAMANHO } from "./layout";
import { FPS } from "./tempo";

// Uma composição por aula e formato: Aula-<id>-h (deitado) e Aula-<id>-v (em pé).
// O índice é gerado pelo scripts/kit.py depois da narração.
// Sem nenhuma aula montada ainda: uma tela que diz o que fazer (o Studio não abre vazio).
const Vazio: React.FC = () => (
  <AbsoluteFill style={{ background: "#0f0e0c", color: "#f1ece3", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", fontSize: 44, textAlign: "center" }}>
    Nenhuma aula montada ainda.
    <div style={{ fontSize: 30, opacity: 0.7, marginTop: 20 }}>python3 scripts/kit.py fazer exemplo</div>
  </AbsoluteFill>
);

export const Raiz: React.FC = () => (
  <>
    {Object.keys(AULAS).length === 0 ? (
      <Composition id="Comece-aqui" component={Vazio} durationInFrames={FPS * 3} fps={FPS} width={1920} height={1080} />
    ) : null}
    {Object.values(AULAS).flatMap((plano) =>
      plano.formatos.map((formato) => (
        <Composition
          key={`${plano.id}-${formato}`}
          id={`Aula-${plano.id}-${formato}`}
          component={Aula}
          durationInFrames={Math.round(plano.total * FPS)}
          fps={FPS}
          width={TAMANHO[formato].w}
          height={TAMANHO[formato].h}
          defaultProps={{ plano, formato }}
        />
      )),
    )}
  </>
);
