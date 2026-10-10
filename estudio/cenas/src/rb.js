// Os componentes do React Bits que estiverem nesta máquina. Eles NÃO vêm no repositório da Claquete (a licença do React
// Bits não deixa redistribuir): o instalador baixa do registro oficial direto para src/components/react-bits/. Sem eles,
// cada peça do ilustra.jsx usa a versão própria dela, feita só com motion.
//   RB.BlurText, RB.Orb, RB["staggered-text"], ...   (o nome é o do arquivo, sem a extensão)
const arquivos = import.meta.glob("./components/react-bits/*.{tsx,jsx,ts,js}", { eager: true });

export const RB = Object.fromEntries(
  Object.entries(arquivos)
    .map(([caminho, mod]) => [caminho.split("/").pop().replace(/\.(tsx|jsx|ts|js)$/, ""), mod.default])
    .filter(([, c]) => c),
);

export const temRB = (...nomes) => nomes.find((n) => RB[n]);
