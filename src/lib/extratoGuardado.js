// Guarda o último extrato analisado no browser (localStorage), para não teres de o importar sempre.
// Só ficam os movimentos (data, descrição, valor, saldo); o PDF nunca é guardado.
// Os dados ficam apenas neste browser, neste computador, e não são enviados para lado nenhum.

const CHAVE = 'ultimoExtrato'

export function guardarExtrato(movimentos) {
  try {
    const dados = {
      guardadoEm: new Date().toISOString(),
      movimentos: movimentos.map((m) => ({
        data: m.data.toISOString(),
        descricao: m.descricao,
        valor: m.valor,
        saldo: m.saldo,
      })),
    }
    localStorage.setItem(CHAVE, JSON.stringify(dados))
    return true
  } catch {
    return false // sem espaço ou sem localStorage: a app funciona na mesma, só não guarda
  }
}

// Devolve { movimentos, guardadoEm } ou null se não houver nada guardado
export function carregarExtrato() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE))
    if (!dados?.movimentos?.length) return null
    return {
      guardadoEm: dados.guardadoEm,
      // As datas voltam a ser objetos Date (no JSON ficam como texto)
      movimentos: dados.movimentos.map((m) => ({ ...m, data: new Date(m.data) })),
    }
  } catch {
    return null
  }
}

export function apagarExtrato() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // nada a fazer
  }
}
