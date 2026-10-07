import { createContext, useContext } from "react";
import type { Tema } from "../tipos";
import type { Formato } from "../layout";

export type Ambiente = { tema: Tema; formato: Formato; esc: number; areaW: number; areaH: number };

export const Ctx = createContext<Ambiente | null>(null);

export function useAmbiente(): Ambiente {
  const a = useContext(Ctx);
  if (!a) throw new Error("cena fora da aula");
  return a;
}
