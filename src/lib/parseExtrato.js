// Lê um extrato PDF da CGD ("Consultar saldos e movimentos à ordem")
// e devolve a lista de movimentos.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// O pdf.js lê o PDF num "worker" (em segundo plano), para não bloquear a página
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Converte "1.097,38" ou "-34,51" em número
function paraNumero(texto) {
  return parseFloat(texto.replace(/\./g, '').replace(',', '.'))
}

// Converte "26-11-2026" numa data
function paraData(texto) {
  const [dia, mes, ano] = texto.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

// Junta os pedaços de texto de uma página em linhas (pela posição vertical)
// Pedaços com até TOLERANCIA de diferença vertical contam como a mesma linha
// (arredondar o y partia linhas quando os valores ficavam dos dois lados de .5)
const TOLERANCIA = 2

function linhasDaPagina(items) {
  const pedacos = items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({ x: item.transform[4], y: item.transform[5], texto: item.str.trim() }))
    .sort((a, b) => b.y - a.y) // de cima para baixo

  const linhas = []
  for (const p of pedacos) {
    const linha = linhas.at(-1)
    if (linha && Math.abs(linha.y - p.y) <= TOLERANCIA) linha.partes.push(p)
    else linhas.push({ y: p.y, partes: [p] })
  }
  return linhas.map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.texto))
}

// Data mov. | Data-valor | Descrição | Montante | Saldo após movimento
const DATA = /^\d{2}-\d{2}-\d{4}$/
const VALOR = /^-?[\d.]+,\d{2}$/

export async function lerExtrato(arrayBuffer) {
  const tarefa = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await tarefa.promise
  const movimentos = []

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n)
      const { items } = await pagina.getTextContent()

      for (const partes of linhasDaPagina(items)) {
        if (partes.length < 5) continue
        const [dataMov, dataValor] = partes
        const saldo = partes.at(-1)
        const montante = partes.at(-2)
        if (!DATA.test(dataMov) || !DATA.test(dataValor)) continue
        if (!VALOR.test(montante) || !VALOR.test(saldo)) continue

        movimentos.push({
          data: paraData(dataMov),
          descricao: partes.slice(2, -2).join(' '),
          valor: paraNumero(montante),
          saldo: paraNumero(saldo),
        })
      }
      pagina.cleanup()
    }
  } finally {
    // Liberta a memória do PDF e do worker (antes ficava tudo preso a cada importação)
    await tarefa.destroy()
  }
  return movimentos // do mais recente para o mais antigo, como no extrato
}
