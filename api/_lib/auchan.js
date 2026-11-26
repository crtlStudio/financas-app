// Lê o preço de um produto na página dele em auchan.pt.
// O Auchan não tem JSON-LD de produto, por isso lemos o HTML:
//   <title>Leite Agros Uht Meio Gordo 1l | Auchan</title>
//   <span class="sales"> <span class="value" content="0.88">
//   <span class="auc-measures--price-per-unit">0.88 &euro;/Lt</span>
//   <span class="auc-price__promotion__label"> Promoção </span>   (só em promoção)
// A data de fim da promoção não vem na página (chega por outro pedido, que não fazemos).
import { partirReferencia, obterPagina, erro, decodificar, UNIDADES, calcularPorUnidade, lerTamanho } from './comum.js'

const ORIGEM = 'https://www.auchan.pt'

export async function precoAuchan(produto) {
  const { slug, id } = partirReferencia(produto)
  // No Auchan o endereço é /pt/<nome>/<número>.html e redireciona para a página completa
  const { html, url } = await obterPagina(`${ORIGEM}/pt/${slug}/${id}.html`, 'Auchan')

  const inicio = html.indexOf('auc-pdp__price')
  if (inicio < 0) throw erro('Não encontrei o preço na página (o produto pode estar indisponível online).', 502)
  const zona = html.slice(inicio, inicio + 2500)

  const venda = zona.match(/class="sales">\s*<span class="value" content="(\d+(?:\.\d+)?)"/)
  const preco = venda ? Number(venda[1]) : NaN
  if (!(preco > 0)) throw erro('Não encontrei o preço na página (o site pode ter mudado).', 502)

  // Preço antigo: o Auchan às vezes mostra-o riscado (mesmo modelo do Pingo Doce)
  const antigo = zona.match(/class="strike-through[^"]*">\s*<span class="value" content="(\d+(?:\.\d+)?)"/)
  const precoAntigo = antigo ? Number(antigo[1]) : null
  const emPromocao = zona.includes('auc-price__promotion__label') || (precoAntigo !== null && precoAntigo > preco)

  // Nome: o <title> tem as maiúsculas certas; o <h1> vem todo em minúsculas
  const titulo = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
  const nome = decodificar(titulo.replace(/\s*\|\s*Auchan\s*$/i, ''))

  // Preço por unidade: "0.88 &euro;/Lt" (aqui com ponto decimal)
  let precoPorUnidade = null
  const pu = html.match(/auc-measures--price-per-unit">\s*(\d+(?:[.,]\d+)?)\s*(?:&euro;|€)\s*\/\s*([a-z]+)/i)
  if (pu) precoPorUnidade = { valor: Number(pu[1].replace(',', '.')), unidade: UNIDADES[pu[2].toLowerCase()] ?? pu[2] }

  // O tamanho costuma estar no fim do nome ("... 1l", "... 250 ml")
  const tamanho = lerTamanho(nome)?.texto ?? null
  if (!precoPorUnidade) precoPorUnidade = calcularPorUnidade(preco, tamanho)

  return {
    loja: 'auchan',
    produto,
    nome,
    marca: null,
    preco,
    precoAntigo: precoAntigo !== null && precoAntigo > preco ? precoAntigo : null,
    emPromocao,
    promocaoAte: null,
    tamanho,
    precoPorUnidade,
    link: url,
    obtidoEm: new Date().toISOString(),
    fonte: 'auchan.pt (página do produto)',
  }
}
