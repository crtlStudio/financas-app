// Pequenas funções de texto partilhadas pelos leitores de folhetos

export const euros = (v) => `${v.toFixed(2).replace('.', ',')} €`

// "LEITE UHT MIMOSA C/ SAL DE OVELHA" ou "vinho tinto porta 6" -> "Leite UHT Mimosa c/ Sal de Ovelha", "Vinho Tinto Porta 6"
const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'em', 'a', 'o', 'para', 'c/', 's/', 'p/'])
const SIGLAS = new Set(['uht', 'dop', 'igp', 'xxl', 'xl', 'bio', 'doc'])

export const capitalizar = (texto) =>
  texto
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (SIGLAS.has(w)) return w.toUpperCase()
      if (i > 0 && PEQUENAS.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
