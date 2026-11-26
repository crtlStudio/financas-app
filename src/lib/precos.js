// Preços das lojas: que produto do site corresponde a cada item da lista, e cache dos preços

const CHAVE_ASSOCIACOES = 'produtosLojas'
const CHAVE_CACHE = 'cachePrecos'
const VALIDADE_CACHE = 6 * 60 * 60 * 1000 // 6 horas

function ler(chave, porDefeito) {
  try {
    return JSON.parse(localStorage.getItem(chave)) ?? porDefeito
  } catch {
    return porDefeito
  }
}

function escrever(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // sem localStorage: funciona na mesma, só não guarda
  }
}

// Associações: { "leite meio-gordo": { continente: { produto: "leite-...-8912985", nome: "Leite ..." } } }
export const carregarAssociacoes = () => ler(CHAVE_ASSOCIACOES, {})
export const guardarAssociacoes = (associacoes) => escrever(CHAVE_ASSOCIACOES, associacoes)

// A chave de um item da lista ignora maiúsculas e espaços a mais
export const chaveDoItem = (item) => item.trim().toLowerCase().replace(/\s+/g, ' ')

// Vai buscar o preço à nossa função /api/precos (com cache de 6 horas no browser)
export async function obterPreco(loja, produto) {
  const chave = `${loja}|${produto}`
  const cache = ler(CHAVE_CACHE, {})
  const guardado = cache[chave]
  if (guardado && Date.now() - guardado.quando < VALIDADE_CACHE) return guardado.dados

  const resposta = await fetch(
    `/api/precos?loja=${encodeURIComponent(loja)}&produto=${encodeURIComponent(produto)}`,
  )
  let dados = null
  try {
    dados = await resposta.json()
  } catch {
    // resposta que não é JSON (ex.: função em baixo)
  }
  if (!resposta.ok) throw new Error(dados?.erro ?? `Erro ${resposta.status} ao obter o preço.`)

  // Guarda e aproveita para limpar entradas antigas
  const novaCache = Object.fromEntries(
    Object.entries(cache).filter(([, v]) => Date.now() - v.quando < VALIDADE_CACHE),
  )
  novaCache[chave] = { quando: Date.now(), dados }
  escrever(CHAVE_CACHE, novaCache)
  return dados
}

// Esquece o preço em cache (para o botão "atualizar")
export function esquecerPreco(loja, produto) {
  const cache = ler(CHAVE_CACHE, {})
  delete cache[`${loja}|${produto}`]
  escrever(CHAVE_CACHE, cache)
}
