// Produtos em promoção no site do Lidl (lidl.pt), para completar o que se lê no PDF do folheto.
//
// A pesquisa do site (/q/api/search, permitida no robots.txt) com o texto vazio lista os produtos
// desta semana e da próxima, em páginas de 60. O site não tem os preços normais do dia a dia:
// só as promoções, por isso serve para completar o folheto e não para o substituir.
//
// Cada produto tem "ians": é o mesmo número que o folheto mostra como "nº83164".
// Com ele sabemos o link da página do produto, as datas em que está na loja e o preço com e
// sem Lidl Plus (que no PDF são difíceis de separar).
import { AGENTE } from '../comum.js'

const ORIGEM = 'https://www.lidl.pt'
const PESQUISA = `${ORIGEM}/q/api/search?assortment=PT&locale=pt_PT&version=v2.0.0&q=`
const POR_PAGINA = 60 // o máximo que o site devolve de cada vez
const MAX_PAGINAS = 10 // ~600 produtos; hoje são ~300 (evita pedidos sem fim se o site mudar)

const valor = (v) => (typeof v === 'number' && v > 0 ? v : null)

// Segundos desde 1970 -> "2026-11-27", na hora de Portugal
function dataLisboa(segundos) {
  if (!segundos) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date(segundos * 1000))
}

function resumirProduto(dados) {
  return {
    link: dados.canonicalUrl ? `${ORIGEM}${dados.canonicalUrl}` : null,
    preco: valor(dados.price?.price),
    precoAntigo: valor(dados.price?.oldPrice),
    precoLidlPlus: valor(dados.lidlPlus?.[0]?.price?.price),
    validoDe: dataLisboa(dados.storeStartDate),
    validoAte: dataLisboa(dados.storeEndDate),
  }
}

// Devolve Map(código do folheto -> { link, preco, precoAntigo, precoLidlPlus, validoDe, validoAte })
export async function produtosDoSiteLidl() {
  const produtos = new Map()
  for (let pagina = 0, total = Infinity; pagina < MAX_PAGINAS && pagina * POR_PAGINA < total; pagina++) {
    const url = `${PESQUISA}&offset=${pagina * POR_PAGINA}&fetchsize=${POR_PAGINA}`
    const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE, 'Accept-Language': 'pt-PT' }, signal: AbortSignal.timeout(20000) })
    if (!resposta.ok) throw new Error(`a pesquisa do lidl.pt respondeu com erro ${resposta.status}`)
    const dados = await resposta.json()
    total = Number(dados.numFound) || 0
    const itens = dados.items ?? []
    if (itens.length === 0) break
    for (const item of itens) {
      const produto = item.type === 'product' ? item.gridbox?.data : null
      if (!produto) continue
      for (const codigo of produto.ians ?? []) produtos.set(String(codigo), resumirProduto(produto))
    }
  }
  return produtos
}

const igual = (a, b) => a != null && b != null && Math.abs(a - b) < 0.005

// Junta à promoção do folheto o que o site sabe do mesmo produto (pelo código).
// O link vem sempre do site. Os preços e as datas só vêm quando o preço do site é o mesmo do
// folheto: se não for, pode ser outra promoção do mesmo produto (outra semana), e não misturamos.
export function completarComSite(promocao, site) {
  if (!site) return promocao
  const completa = { ...promocao, link: site.link ?? promocao.link }

  const precoNormalIgual = igual(site.preco, promocao.preco)
  const precoLidlPlusIgual = igual(site.precoLidlPlus, promocao.preco)
  if (!precoNormalIgual && !precoLidlPlusIgual) return completa

  if (site.validoDe && site.validoAte) {
    completa.validoDe = site.validoDe
    completa.validoAte = site.validoAte
  }
  if (precoNormalIgual && !completa.precoAntigo && site.precoAntigo > promocao.preco) {
    completa.precoAntigo = site.precoAntigo
  }
  // Preço só com a app: o preço normal do site é o preço para quem não usa o Lidl Plus
  if (precoLidlPlusIgual && site.preco > promocao.preco && !completa.precoSemLidlPlus) {
    completa.precoSemLidlPlus = site.preco
    const texto = `Com Lidl Plus (sem a app: ${site.preco.toFixed(2).replace('.', ',')} €)`
    if (!completa.condicao) completa.condicao = texto
    else if (!/lidl plus/i.test(completa.condicao)) completa.condicao = `${texto} · ${completa.condicao}`
  }
  return completa
}
