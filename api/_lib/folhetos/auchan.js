// Folheto do Auchan.
// O folheto em si está num visualizador externo (ShopFully) que só funciona com uma chave de API
// privada: NÃO a usamos. Em vez disso, o próprio site auchan.pt tem uma categoria com os produtos
// do folheto semanal (ex.: /pt/folheto-semanal-48-3/), com preço, preço antigo e validade.
//  - A página /pt/folhetos/ tem o link para essa categoria
//  - Paginação com ?start=&sz= (permitida). O "ver mais" do site usa prefn1/prefv1, que o
//    robots.txt proíbe, por isso não o usamos.
import { AGENTE, erro, decodificar, lerTamanho, UNIDADES } from '../comum.js'
import { MESES, iso } from './ipaper.js'
import { euros, capitalizar } from './texto.js'

const ORIGEM = 'https://www.auchan.pt'
const POR_PAGINA = 200
const MAX_PAGINAS = 10 // segurança: no máximo 2000 produtos

async function pedirTexto(url) {
  const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE, 'Accept-Language': 'pt-PT' }, signal: AbortSignal.timeout(60000) })
  if (!resposta.ok) throw erro(`${url} respondeu com erro ${resposta.status}.`, 502)
  return resposta.text()
}

// "semanal_48_26_novembro_a_2_dezembro_40p" -> ["2026-11-26", "2026-12-02"]
function periodoDoNome(nome, ano) {
  const m = nome.match(/(\d{1,2})_([a-zç]+)_a_(\d{1,2})_([a-zç]+)/i)
  if (!m) return [null, null]
  const mesDe = MESES.indexOf(m[2].toLowerCase()) + 1
  const mesAte = MESES.indexOf(m[4].toLowerCase()) + 1
  if (!mesDe || !mesAte) return [null, null]
  return [iso(ano, mesDe, Number(m[1])), iso(mesAte < mesDe ? ano + 1 : ano, mesAte, Number(m[3]))]
}

// "26/11/2026" -> "2026-11-26"
const dataPt = (texto) => {
  const [d, m, a] = texto.split('/').map(Number)
  return iso(a, m, d)
}

export async function folhetoSemanalAuchan(hoje = new Date()) {
  const html = await pedirTexto(`${ORIGEM}/pt/folhetos/`)
  const categoria = html.match(/href="(\/pt\/(folheto-semanal-(\d+)-\d+)\/)"/)
  if (!categoria) throw erro('Não encontrei a categoria do folheto semanal no site do Auchan (o site pode ter mudado).', 404)
  // A validade vem do nome do folheto no visualizador ("semanal_48_26_novembro_a_2_dezembro_40p")
  const campanha = html.match(/utm_campaign=(semanal_[^"'&]+)/)?.[1] ?? ''
  const [validoDe, validoAte] = periodoDoNome(decodeURIComponent(campanha), hoje.getFullYear())
  return {
    identificador: categoria[2],
    nome: `Folheto Semanal ${categoria[3]}`,
    validoDe,
    validoAte,
    link: `${ORIGEM}${categoria[1]}`,
  }
}

// Lê os produtos de uma página da categoria
function produtosDaPagina(html, folheto) {
  const promocoes = []
  const blocos = html.split('<div class="product" data-pid="').slice(1)
  for (const bloco of blocos) {
    const pid = bloco.match(/^(\d+)"/)?.[1]
    const nomeHtml = bloco.match(/class="link" href="([^"]+)">([^<]+)</)
    const venda = bloco.match(/class="sales">\s*<span class="value" content="(\d+(?:\.\d+)?)"/)
    if (!pid || !nomeHtml || !venda) continue

    const preco = Number(venda[1])
    if (!(preco > 0)) continue
    const antigo = bloco.match(/class="strike-through[^"]*" content="(\d+(?:\.\d+)?)"/)
    const precoAntigo = antigo && Number(antigo[1]) > preco ? Number(antigo[1]) : null
    const desconto = bloco.match(/auc-promo--discount--red">\s*(-\s?\d+\s?%)/)?.[1]?.replace(/\s/g, '') ?? null
    // A categoria também tem produtos ao preço normal: só ficam os que têm alguma marca de promoção
    const temPromocao = Boolean(precoAntigo || desconto) || bloco.includes('auc-price__promotion__label')
    if (!temPromocao) continue
    const datas = bloco.match(/promotion--pdp__date">\s*de\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+a\s+(\d{1,2}\/\d{1,2}\/\d{4})/)

    const nome = capitalizar(decodificar(nomeHtml[2]))
    // Preço por unidade: "5.32 &euro;/Lt"
    const pu = bloco.match(/auc-measures--price-per-unit">\s*(\d+(?:[.,]\d+)?)\s*(?:&euro;|€)\s*\/\s*([a-z]+)/i)
    const porKg = /class="sales">[\s\S]{0,200}?\/\s*Kg/i.test(bloco) // vendido ao kg
    const tamanho = porKg ? 'Vendido ao kg' : (lerTamanho(nome)?.texto ?? null)

    promocoes.push({
      loja: 'auchan',
      produto: nome,
      marca: null,
      tamanho,
      preco,
      precoAntigo,
      precoPorKgL: pu ? `${euros(Number(pu[1].replace(',', '.')))}/${UNIDADES[pu[2].toLowerCase()] ?? pu[2]}` : null,
      desconto,
      // Sem preço antigo, a promoção costuma ser do tipo "2.ª unidade -50%" ou "Leve 3 pague 2":
      // as condições são carregadas à parte pelo site e o preço mostrado é o normal
      condicao: precoAntigo || desconto ? null : 'Promoção com condições: ver no site',
      codigo: pid,
      // Cada produto traz a validade da promoção; se não trouxer, fica a do folheto
      validoDe: datas ? dataPt(datas[1]) : folheto.validoDe,
      validoAte: datas ? dataPt(datas[2]) : folheto.validoAte,
      pagina: null,
      fonte: `Site Auchan, categoria "${folheto.nome}" (${folheto.identificador})`,
      link: `${ORIGEM}${nomeHtml[1]}`,
    })
  }
  return { promocoes, blocos: blocos.length }
}

export async function promocoesDoFolhetoAuchan(folheto) {
  const vistos = new Set()
  const promocoes = []
  let total = Infinity // "853 resultados", lido na primeira página
  // Um pedido de cada vez, 200 produtos por pedido, até ao total da categoria
  for (let pagina = 0; pagina < MAX_PAGINAS && pagina * POR_PAGINA < total; pagina++) {
    const html = await pedirTexto(`${folheto.link}?start=${pagina * POR_PAGINA}&sz=${POR_PAGINA}`)
    if (pagina === 0) {
      const resultados = html.match(/([\d.]+)\s*resultados/)
      if (resultados) total = Number(resultados[1].replace(/\./g, ''))
    }
    const { promocoes: daPagina, blocos } = produtosDaPagina(html, folheto)
    for (const p of daPagina) {
      if (vistos.has(p.codigo)) continue
      vistos.add(p.codigo)
      promocoes.push(p)
    }
    if (blocos < POR_PAGINA) break // última página
  }
  return promocoes
}
