// Divide o extrato em períodos mensais "de salário a salário" (por defeito de dia 26 a dia 25)
import { categoria, INTERNAS, CATEGORIA_SALARIO } from './categorias'

// Dia em que começa cada período. O salário entra por volta do dia 28.
// Para mudar, basta alterar este número (ou o campo "Dia de corte" na app).
export const DIA_CORTE = 26

const diasDoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate()

// Dia de corte num mês. Se o mês for mais curto (ex.: dia 30 em fevereiro), usa o último dia.
const inicioNoMes = (ano, mes, diaCorte) => new Date(ano, mes, Math.min(diaCorte, diasDoMes(ano, mes)))

// Em que dia começa o período a que esta data pertence?
function inicioDoPeriodo(data, diaCorte) {
  const nesteMes = inicioNoMes(data.getFullYear(), data.getMonth(), diaCorte)
  return data >= nesteMes ? nesteMes : inicioNoMes(data.getFullYear(), data.getMonth() - 1, diaCorte)
}

// O período acaba na véspera do início do seguinte
function fimDoPeriodo(inicio, diaCorte) {
  const seguinte = inicioNoMes(inicio.getFullYear(), inicio.getMonth() + 1, diaCorte)
  return new Date(seguinte.getFullYear(), seguinte.getMonth(), seguinte.getDate() - 1)
}

const diaMes = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

// Devolve os períodos do mais antigo para o mais recente:
// { inicio, fim, nome, movimentos, temSalario, avisos, completo }
export function dividirEmPeriodos(movimentos, diaCorte = DIA_CORTE) {
  if (movimentos.length === 0) return []

  // Agrupa os movimentos pelo dia de início do período
  const porInicio = new Map()
  for (const m of movimentos) {
    const inicio = inicioDoPeriodo(m.data, diaCorte)
    const chave = inicio.getTime()
    if (!porInicio.has(chave)) {
      const fim = fimDoPeriodo(inicio, diaCorte)
      porInicio.set(chave, { inicio, fim, nome: `${diaMes(inicio)} – ${diaMes(fim)}`, movimentos: [] })
    }
    porInicio.get(chave).movimentos.push(m)
  }

  const periodos = [...porInicio.values()].sort((a, b) => a.inicio - b.inicio)

  for (const p of periodos) {
    p.temSalario = p.movimentos.some((m) => m.valor > 0 && categoria(m) === CATEGORIA_SALARIO)
    p.avisos = []
  }

  // Primeiro período: se não tem salário, o extrato começou depois de ele entrar
  const primeiro = periodos[0]
  if (!primeiro.temSalario) {
    primeiro.avisos.push('O extrato começa depois da entrada do salário, por isso este período está incompleto.')
  }

  // Último período: se o extrato acaba antes do fim, o período ainda está a decorrer
  const ultimaData = new Date(Math.max(...movimentos.map((m) => m.data.getTime())))
  const ultimo = periodos.at(-1)
  if (ultimaData < ultimo.fim) {
    ultimo.avisos.push(`O extrato só vai até ${diaMes(ultimaData)}, por isso este período ainda não acabou.`)
  }

  for (const p of periodos) p.completo = p.avisos.length === 0
  return periodos
}

// Quais os períodos que entram nas médias? Os completos; se não houver nenhum, todos.
export function periodosParaMedia(periodos) {
  const completos = periodos.filter((p) => p.completo)
  return completos.length > 0 ? completos : periodos
}

// Gastos por categoria em cada período (sem as categorias internas).
// Devolve [{ nome, valores: [um por período], media }], do maior para o menor.
export function gastosPorCategoria(periodos) {
  const nomes = new Set()
  const totaisPorPeriodo = periodos.map((p) => {
    const totais = {}
    for (const m of p.movimentos) {
      if (m.valor >= 0) continue
      const cat = categoria(m)
      if (INTERNAS.includes(cat)) continue
      totais[cat] = (totais[cat] || 0) + Math.abs(m.valor)
      nomes.add(cat)
    }
    return totais
  })

  const paraMedia = periodosParaMedia(periodos)

  return [...nomes]
    .map((nome) => {
      const valores = totaisPorPeriodo.map((totais) => totais[nome] || 0)
      const soma = periodos.reduce((s, p, i) => (paraMedia.includes(p) ? s + valores[i] : s), 0)
      return { nome, valores, media: soma / paraMedia.length }
    })
    .sort((a, b) => b.media - a.media)
}

// Totais de entradas e saídas reais (sem internas) de um período
export function totaisDoPeriodo(periodo) {
  let entradas = 0
  let saidas = 0
  for (const m of periodo.movimentos) {
    if (INTERNAS.includes(categoria(m))) continue
    if (m.valor > 0) entradas += m.valor
    else saidas += Math.abs(m.valor)
  }
  return { entradas, saidas, resultado: entradas - saidas }
}
