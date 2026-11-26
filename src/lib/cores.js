// Cores das categorias, partilhadas pelo gráfico e pelas tabelas.
// A última (cinzento) é usada para "Outras".
export const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#888780']

export const corDaPosicao = (i) => (i < CORES.length - 1 ? CORES[i] : CORES.at(-1))

// Para os gráficos circulares: mostra as 7 maiores categorias e junta as restantes em "Outras"
export function juntarPequenas(linhas) {
  if (linhas.length <= 8) return linhas
  const resto = linhas.slice(7).reduce((s, l) => s + l.total, 0)
  return [...linhas.slice(0, 7), { nome: 'Outras', total: resto }]
}
