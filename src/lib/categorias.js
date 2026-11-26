// Regras para pôr cada movimento numa categoria.
// Se a descrição tiver uma das palavras da lista, fica nessa categoria.
// Para corrigir ou acrescentar, basta mexer nas listas.

// Nomes usados noutros ficheiros (períodos e sugestões). Se mudares o nome aqui, muda em todo o lado.
export const CATEGORIA_SALARIO = 'Salário i-charging'
export const CATEGORIA_RESTAURACAO = 'Lazer e restauração'
export const CATEGORIA_SUPERMERCADO = 'Supermercado'
export const CATEGORIA_RESGATE = 'Resgate poupança'

export const REGRAS_SAIDAS = [
  ['Poupança e contas próprias', ['POUP PROGRAMADA', 'ABR POUPAN', 'TRANSFERENCIA', 'PEDRO MIGUEL RUAS']],
  [CATEGORIA_SUPERMERCADO, ['MODELO', 'MERCADONA', 'LIDL', 'PINGO', 'MINIPRECO', 'MDSUPER', 'CONTINENTE', 'AUCHAN SANTO', 'GRAN CARNES', 'ELECLERC']],
  ['Créditos e prestações', ['CREDIBOM', 'PRESTACAO', 'SVEA', 'ONEY', 'UNIVERSO']],
  ['Casa e diversos', ['MAXMAT', 'IKEA', 'PRO LAR', 'WORTEN', 'HOMA', 'RICO PRECO', 'TAKITUDO', 'NOTE ', 'ATRAENTES']],
  ['Saúde', ['FARMACI', 'FISIOMOV', 'WELL', 'TROFA SAUDE']],
  ['Seguros', ['ASISA', 'GENERALI']],
  ['Contas da casa', ['INDAQUA', 'GOLD ENERGY', 'NOS ', 'MANUT CONTA', 'COMISSAO', 'PAYSHOP', 'MUNICIPIO']],
  ['Transportes', ['VIA VERDE', 'REPSOL', 'ATLANTE', 'Z.E.T', 'E004', 'AUCHAN ENERGY']],
  ['Subscrições digitais', ['ANTHROP', 'MICROSO', 'GOOGLE', 'NETFLIX']],
  ['Roupa e Vinted', ['PRIMARK', 'KIK', 'MODALFA', 'STARA', 'VINTED', 'MGP VIN', 'MO FAMALICAO']],
  [CATEGORIA_RESTAURACAO, ['CINEMAS', 'BK26370', 'C CLASSIC', 'LAVANDARIA', 'MCDONALDS', 'WOK', 'SNACK', 'A SUPER 2000', 'D. FERNANDO']],
  ['Transferências e MB Way', ['MBWAY', 'JP MORGAN', 'CRUZ VERMELHA', 'CARINA', 'ATM']],
]

export const REGRAS_ENTRADAS = [
  [CATEGORIA_SALARIO, ['I CHARGING']],
  ['TFI Porto João Nunes', ['JOAO NUNE']],
  ['Segurança Social', ['INSTITUTO DE GEST']],
  ['Reembolsos Multicare', ['MULTICARE']],
  [CATEGORIA_RESGATE, ['LIQUIDA']],
  ['Transf. app CGD', ['CXDAPP']],
]

// Movimentos que só passam dinheiro entre contas tuas (não são gasto nem ganho real)
export const INTERNAS = ['Poupança e contas próprias', 'Resgate poupança', 'Transf. app CGD']

// Maiúsculas e sem acentos: "Transferência" -> "TRANSFERENCIA"
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

// ---------- Correções feitas na app (guardadas no browser) ----------
// { "-|COMPRA MERCADONA PORTO": "Supermercado", ... }  ("-" = saída, "+" = entrada)
const CHAVE_CORRECOES = 'correcoesCategorias'
let correcoes = null // carregadas do localStorage na primeira vez que são precisas

function lerCorrecoes() {
  if (correcoes === null) {
    try {
      correcoes = JSON.parse(localStorage.getItem(CHAVE_CORRECOES)) ?? {}
    } catch {
      correcoes = {} // sem localStorage (ex.: janela privada): funciona, só não guarda
    }
  }
  return correcoes
}

// A "regra" de uma correção é a descrição sem datas nem referências longas:
// "COMPRA 5544 MERCADONA 26/11" e "COMPRA 5544 MERCADONA 03/12" ficam com a mesma chave.
// Os números de telefone (9 dígitos) ficam, para cada contacto MB Way ter a sua categoria.
export function chaveDaDescricao(movimento) {
  const texto = normalizar(movimento.descricao)
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ') // datas
    .replace(/\d{10,}/g, ' ') // referências longas
    .replace(/\s+/g, ' ')
    .trim()
  return `${movimento.valor < 0 ? '-' : '+'}|${texto}`
}

// Guarda (ou, com null, apaga) a categoria escolhida para os movimentos com esta descrição
export function corrigirCategoria(movimento, nome) {
  const todas = lerCorrecoes()
  const chave = chaveDaDescricao(movimento)
  if (nome) todas[chave] = nome
  else delete todas[chave]
  try {
    localStorage.setItem(CHAVE_CORRECOES, JSON.stringify(todas))
  } catch {
    // sem localStorage: a correção vale só até fechares a página
  }
}

export const temCorrecao = (movimento) => chaveDaDescricao(movimento) in lerCorrecoes()

// Todas as categorias possíveis para uma saída ou entrada (para a lista de escolha)
export const categoriasPossiveis = (movimento) =>
  movimento.valor < 0
    ? [...REGRAS_SAIDAS.map(([nome]) => nome), 'Outros']
    : [...REGRAS_ENTRADAS.map(([nome]) => nome), 'Outras entradas']

// A palavra-chave tem de começar uma palavra: 'ONEY' não apanha "MONEY",
// 'WELL' não apanha "DWELL". O espaço no fim deixa 'NOS ' apanhar "NOS" no fim da descrição.
function contem(texto, palavra) {
  let i = texto.indexOf(palavra)
  while (i !== -1) {
    if (i === 0 || !/[A-Z]/.test(texto[i - 1])) return true
    i = texto.indexOf(palavra, i + 1)
  }
  return false
}

// A categoria de um movimento: a correção feita na app, se houver; senão, a das regras
export function categoria(movimento) {
  return lerCorrecoes()[chaveDaDescricao(movimento)] ?? categoriaAutomatica(movimento)
}

// A categoria só pelas regras (palavras-chave), sem correções
export function categoriaAutomatica(movimento) {
  const texto = normalizar(movimento.descricao) + ' '
  const regras = movimento.valor < 0 ? REGRAS_SAIDAS : REGRAS_ENTRADAS
  for (const [nome, palavras] of regras) {
    if (palavras.some((p) => contem(texto, normalizar(p)))) return nome
  }
  return movimento.valor < 0 ? 'Outros' : 'Outras entradas'
}

// A descrição do movimento tem esta palavra? (mesmas regras que as categorias)
export function descricaoTem(movimento, palavra) {
  return contem(normalizar(movimento.descricao) + ' ', normalizar(palavra))
}

// Só os movimentos entre duas datas (inclusive)
export function filtrarPeriodo(movimentos, inicio, fim) {
  return movimentos.filter((m) => m.data >= inicio && m.data <= fim)
}

// Soma os valores por categoria e devolve a lista ordenada do maior para o menor
export function agrupar(movimentos) {
  const totais = {}
  for (const m of movimentos) {
    const cat = categoria(m)
    totais[cat] = (totais[cat] || 0) + Math.abs(m.valor)
  }
  return Object.entries(totais)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
}
