// Lê o preço de um produto na página dele em pingodoce.pt.
// O JSON-LD do Pingo Doce não traz o preço, por isso lemos o HTML:
//   <span class="sales"> <span class="value" content="0.88">
//   <span class="strike-through list"> <span class="value" content="0.99">   (preço antigo, em promoção)
//   <span class="product-promo-end">Promoção até 30/11</span>
//   <h1 class="product-unit-measure">1 L | 0,88 €/L</h1>
import { partirReferencia, obterPagina, erro, paraNumero, decodificar, UNIDADES, calcularPorUnidade, dataDoDiaMes } from './comum.js'

const ORIGEM = 'https://www.pingodoce.pt'

export async function precoPingoDoce(produto) {
  partirReferencia(produto) // valida
  // O endereço curto redireciona para a página completa (com as categorias)
  const { html, url } = await obterPagina(`${ORIGEM}/home/produtos/${produto}.html`, 'Pingo Doce')

  // Nome e marca (estes vêm no JSON-LD)
  let dados = null
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const json = JSON.parse(m[1].trim())
      if (json['@type'] === 'Product') dados = json
    } catch {
      // ignora blocos inválidos
    }
  }

  // Zona do produto principal: começa nas ações de compra (antes vem só o cabeçalho)
  const inicio = html.indexOf('prices-add-to-cart-actions')
  if (inicio < 0) throw erro('Não encontrei o preço na página (o produto pode estar indisponível online).', 502)
  const zona = html.slice(Math.max(0, inicio - 1500), inicio + 4000)

  const venda = zona.match(/class="sales">\s*<span class="value" content="(\d+(?:\.\d+)?)"/)
  const preco = venda ? Number(venda[1]) : NaN
  if (!(preco > 0)) throw erro('Não encontrei o preço na página (o site pode ter mudado).', 502)

  const antigo = zona.match(/class="strike-through[^"]*">\s*<span class="value" content="(\d+(?:\.\d+)?)"/)
  const precoAntigo = antigo ? Number(antigo[1]) : null
  const fim = zona.match(/class="product-promo-end">([^<]+)</)
  const emPromocao = (precoAntigo !== null && precoAntigo > preco) || Boolean(fim)

  // "1 L | 0,88 €/L"
  const medida = html.match(/class="product-unit-measure">([^<]+)</)?.[1]
  let tamanho = null
  let precoPorUnidade = null
  if (medida) {
    const [parteTamanho, partePorUnidade] = decodificar(medida).split('|').map((s) => s.trim())
    tamanho = parteTamanho || null
    const pu = partePorUnidade?.match(/(\d+(?:\.\d{3})*,\d{2})\s*€\s*\/\s*([a-z]+)/i)
    if (pu) precoPorUnidade = { valor: paraNumero(pu[1]), unidade: UNIDADES[pu[2].toLowerCase()] ?? pu[2] }
  }
  if (!precoPorUnidade) precoPorUnidade = calcularPorUnidade(preco, tamanho)

  const nome = dados?.name ? decodificar(dados.name) : decodificar(html.match(/<title>([^<|]+)/)?.[1] ?? '')
  const marca = dados?.brand?.name ? decodificar(dados.brand.name) : null

  return {
    loja: 'pingodoce',
    produto,
    // No Pingo Doce o nome não inclui a marca ("Leite UHT Meio Gordo" + "Agros")
    nome: marca && !nome.toLowerCase().includes(marca.toLowerCase()) ? `${nome} ${marca}` : nome,
    marca,
    preco,
    precoAntigo: precoAntigo !== null && precoAntigo > preco ? precoAntigo : null,
    emPromocao,
    promocaoAte: fim ? dataDoDiaMes(decodificar(fim[1])) : null,
    tamanho,
    precoPorUnidade,
    link: url,
    obtidoEm: new Date().toISOString(),
    fonte: 'pingodoce.pt (página do produto)',
  }
}
