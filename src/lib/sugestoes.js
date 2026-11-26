// "Onde poupar": sugestões a partir das médias mensais dos períodos completos
import {
  categoria,
  descricaoTem,
  CATEGORIA_RESTAURACAO,
  CATEGORIA_SUPERMERCADO,
  CATEGORIA_RESGATE,
} from './categorias'
import { periodosParaMedia } from './periodos'

// Limites a partir dos quais aparece uma sugestão. Ajusta à tua realidade.
export const LIMITES = {
  restauracao: 100, // € por mês em lazer e restauração
  idasSupermercado: 12, // compras por mês no supermercado
  passagensViaVerde: 15, // movimentos Via Verde por mês
  mbwaySemDescricao: 50, // € por mês em MB Way sem nome/descrição
}

// Que parte do gasto achamos realista poupar em cada caso
const PERCENTAGEM_POUPANCA = {
  restauracao: 0.3, // comer mais vezes em casa
  supermercado: 0.1, // compras planeadas, menos compras por impulso
  viaVerde: 0.2, // trocar alguns percursos por estradas sem portagem
  mbway: 0.25, // saber para onde vai o dinheiro costuma reduzi-lo
}

// Créditos pequenos que vale a pena liquidar primeiro
const CREDITOS_PEQUENOS = ['SVEA', 'ONEY', 'UNIVERSO']

// Soma e número de movimentos que passam no filtro, em média por período
function mediaMensal(periodos, filtro) {
  const usados = periodosParaMedia(periodos)
  let soma = 0
  let contagem = 0
  for (const p of usados) {
    for (const m of p.movimentos) {
      if (!filtro(m)) continue
      soma += Math.abs(m.valor)
      contagem += 1
    }
  }
  return { valor: soma / usados.length, vezes: contagem / usados.length }
}

// MB Way "sem descrição": tirando "MBWAY", números e palavras genéricas, não sobra quase nada.
// (Heurística: pode ser preciso afinar quando virmos descrições reais.)
function mbwaySemDescricao(m) {
  if (m.valor >= 0 || !descricaoTem(m, 'MBWAY')) return false
  const resto = m.descricao
    .toUpperCase()
    .replace(/MB ?WAY|TRF|TRANSF|ENVIO|COMPRA|PARA|P\//g, '')
    .replace(/[^A-Z]/g, '')
  return resto.length < 3
}

// Devolve [{ titulo, texto, gastoMensal, poupancaMensal }], da maior poupança para a menor
export function sugestoesDePoupanca(periodos) {
  if (periodos.length === 0) return []
  const sugestoes = []

  // 1. Restauração e lazer
  const restauracao = mediaMensal(periodos, (m) => m.valor < 0 && categoria(m) === CATEGORIA_RESTAURACAO)
  if (restauracao.valor > LIMITES.restauracao) {
    sugestoes.push({
      titulo: 'Restauração e lazer',
      texto: `Gastas em média mais de ${LIMITES.restauracao} € por mês. Trocar algumas refeições fora por refeições em casa faz diferença rapidamente.`,
      gastoMensal: restauracao.valor,
      poupancaMensal: restauracao.valor * PERCENTAGEM_POUPANCA.restauracao,
    })
  }

  // 2. Muitas idas ao supermercado
  const supermercado = mediaMensal(periodos, (m) => m.valor < 0 && categoria(m) === CATEGORIA_SUPERMERCADO)
  if (supermercado.vezes > LIMITES.idasSupermercado) {
    sugestoes.push({
      titulo: 'Idas ao supermercado',
      texto: `Fazes cerca de ${Math.round(supermercado.vezes)} compras por mês. Menos idas, com lista, reduzem as compras por impulso.`,
      gastoMensal: supermercado.valor,
      poupancaMensal: supermercado.valor * PERCENTAGEM_POUPANCA.supermercado,
    })
  }

  // 3. Via Verde
  const viaVerde = mediaMensal(periodos, (m) => m.valor < 0 && descricaoTem(m, 'VIA VERDE'))
  if (viaVerde.vezes > LIMITES.passagensViaVerde) {
    sugestoes.push({
      titulo: 'Portagens (Via Verde)',
      texto: `Cerca de ${Math.round(viaVerde.vezes)} movimentos Via Verde por mês. Em percursos curtos, vale a pena ver se há alternativa sem portagem.`,
      gastoMensal: viaVerde.valor,
      poupancaMensal: viaVerde.valor * PERCENTAGEM_POUPANCA.viaVerde,
    })
  }

  // 4. Créditos pequenos: liquidar primeiro o de prestação mais baixa (liberta dinheiro todos os meses)
  const creditos = CREDITOS_PEQUENOS.map((nome) => ({
    nome,
    ...mediaMensal(periodos, (m) => m.valor < 0 && descricaoTem(m, nome)),
  }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => a.valor - b.valor)
  if (creditos.length > 0) {
    const lista = creditos.map((c) => `${c.nome} (${euro(c.valor)}/mês)`).join(', ')
    sugestoes.push({
      titulo: 'Créditos pequenos',
      texto: `Tens prestações de ${lista}. Liquidar primeiro o ${creditos[0].nome} liberta essa prestação todos os meses; depois passa ao seguinte.`,
      gastoMensal: creditos.reduce((s, c) => s + c.valor, 0),
      poupancaMensal: creditos[0].valor,
    })
  }

  // 5. MB Way sem descrição
  const mbway = mediaMensal(periodos, mbwaySemDescricao)
  if (mbway.valor > LIMITES.mbwaySemDescricao) {
    sugestoes.push({
      titulo: 'MB Way sem descrição',
      texto: 'Uma parte das transferências MB Way não diz para quem nem para quê. Pôr sempre uma descrição ajuda a perceber para onde vai o dinheiro.',
      gastoMensal: mbway.valor,
      poupancaMensal: mbway.valor * PERCENTAGEM_POUPANCA.mbway,
    })
  }

  // 6. Resgates da poupança
  const resgates = mediaMensal(periodos, (m) => m.valor > 0 && categoria(m) === CATEGORIA_RESGATE)
  if (resgates.valor > 0) {
    sugestoes.push({
      titulo: 'Resgates da poupança',
      texto: 'Estás a tirar dinheiro da poupança para pagar o dia a dia. Se cortares noutros gastos, esse dinheiro fica guardado.',
      gastoMensal: resgates.valor,
      poupancaMensal: resgates.valor,
    })
  }

  return sugestoes.sort((a, b) => b.poupancaMensal - a.poupancaMensal)
}

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
