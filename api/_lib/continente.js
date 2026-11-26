// Lê o preço de um produto na página dele no continente.pt.
// (A pasta _lib começa por "_", por isso o Vercel não a transforma num endereço da API.)
import { partirReferencia, obterPagina, erro, paraNumero, decodificar, UNIDADES, calcularPorUnidade } from './comum.js'

const ORIGEM = 'https://www.continente.pt'

export async function precoContinente(produto) {
  partirReferencia(produto) // valida
  const { html, url } = await obterPagina(`${ORIGEM}/produto/${produto}.html`, 'Continente')

  // 1. Dados estruturados (JSON-LD): nome, marca, preço, validade
  let dados = null
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const json = JSON.parse(m[1].trim())
      if (json['@type'] === 'Product') dados = json
    } catch {
      // bloco que não é JSON válido: ignora
    }
  }
  const preco = Number(dados?.offers?.price)
  if (!dados || !(preco > 0)) throw erro('Não encontrei o preço na página (o site pode ter mudado).', 502)

  // 2. Zona dos preços do produto principal (para não apanhar produtos recomendados mais abaixo)
  const inicio = html.indexOf('ct-pdp--prices')
  const zonaPrecos = inicio >= 0 ? html.slice(inicio, inicio + 3000) : ''

  // Preço antigo (só aparece em promoção): <div class="list "> PVPR 12,99&euro;
  const antigo = zonaPrecos.match(/class="list\s*">[\s\S]{0,150}?(\d+(?:\.\d{3})*,\d{2})\s*(?:&euro;|€)/)
  const precoAntigo = antigo ? paraNumero(antigo[1]) : null
  const emPromocao = precoAntigo !== null && precoAntigo > preco

  // Tamanho: <span class="ct-pdp--unit ..."> emb. 1 lt </span>
  const tamanhoTexto = html.match(/class="ct-pdp--unit[^"]*">\s*([^<]+?)\s*</)?.[1] ?? null
  const tamanho = tamanhoTexto ? decodificar(tamanhoTexto.replace(/^emb\.\s*/i, '')) : null

  // Preço por kg/L: o site mostra-o (11,99&euro;/lt); se não mostrar, calculamos pelo tamanho
  const secundario = zonaPrecos.match(/pwc-tile--price-secondary[^"]*">\s*(\d+(?:\.\d{3})*,\d{2})\s*(?:&euro;|€)\s*\/\s*([a-z]+)/i)
  const precoPorUnidade = secundario
    ? { valor: paraNumero(secundario[1]), unidade: UNIDADES[secundario[2].toLowerCase()] ?? secundario[2] }
    : calcularPorUnidade(preco, tamanho)

  return {
    loja: 'continente',
    produto,
    nome: decodificar(dados.name ?? ''),
    marca: dados.brand?.name ? decodificar(dados.brand.name) : null,
    preco,
    precoAntigo: emPromocao ? precoAntigo : null,
    emPromocao,
    // Em promoção, a "validade" do preço é o fim da promoção
    promocaoAte: emPromocao ? (dados.offers.priceValidUntil ?? null) : null,
    tamanho,
    precoPorUnidade,
    link: url,
    obtidoEm: new Date().toISOString(),
    fonte: 'continente.pt (página do produto)',
  }
}
