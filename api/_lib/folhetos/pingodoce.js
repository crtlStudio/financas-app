// Folhetos do Pingo Doce: descobrir o folheto semanal e ler os produtos do iPaper
//  - Lista: https://www.pingodoce.pt/folhetos/ (permitida no robots.txt)
//  - Folheto: https://folhetos.pingodoce.pt/2026/poupe-esta-semana/continental-lojas-grandes/S48/
//
// Diferente do Continente: no Pingo Doce o texto das páginas quase não tem preços, mas o preço
// dos enrichments JÁ É o preço atual com a promoção (confirmado com as páginas dos produtos no site).
// O preço antigo não vem no folheto.
import { erro } from '../comum.js'
import { pedirTexto, lerFolhetoIpaper, MESES, iso } from './ipaper.js'
import { nomesDosProdutos } from '../indiceProdutos.js'

const LISTA = 'https://www.pingodoce.pt/folhetos/'

// "De 24 a 30 de Novembro" ou "De 29 de Dezembro a 4 de Janeiro" -> ["2026-11-24", "2026-11-30"]
function lerPeriodo(texto, ano) {
  const m = texto.match(/De\s+(\d{1,2})(?:\s+de\s+(\p{L}+))?\s+a\s+(\d{1,2})\s+de\s+(\p{L}+)/iu)
  if (!m) return [null, null]
  const mesAte = MESES.indexOf(m[4].toLowerCase()) + 1
  const mesDe = m[2] ? MESES.indexOf(m[2].toLowerCase()) + 1 : mesAte
  if (!mesDe || !mesAte) return [null, null]
  return [iso(ano, mesDe, Number(m[1])), iso(mesAte < mesDe ? ano + 1 : ano, mesAte, Number(m[3]))]
}

// O folheto "Poupe Esta Semana" das lojas do continente
export async function folhetoSemanalPingoDoce() {
  const html = await pedirTexto(LISTA)
  const m = html.match(/https:\/\/folhetos\.pingodoce\.pt\/(\d{4})\/poupe-esta-semana\/(continental[a-z-]*)\/(S\d+)\//)
  if (!m) throw erro('Não encontrei o folheto "Poupe Esta Semana" na lista do Pingo Doce (o site pode ter mudado).', 404)
  // A validade aparece no texto da página ("Folheto Poupe Esta Semana Lojas Grandes De 24 a 30 de Novembro")
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const [validoDe, validoAte] = lerPeriodo(texto.slice(texto.indexOf('Poupe Esta Semana')), Number(m[1]))
  return { identificador: `${m[2]}/${m[3]}`, nome: 'Poupe Esta Semana', validoDe, validoAte, link: m[0] }
}

// Códigos internos que aparecem no fim dos nomes: "CPG17", "CCG", "CCP", "5G"
const CODIGO_INTERNO = /^(?:C[CP][A-Z]\d*|[A-Z]{2,3}\d{2})$/

// "COUVE FLOR CPG17" -> "COUVE FLOR"; "BETERRABA INT COZIDA 500G 5G CCP" -> "BETERRABA INT COZIDA 500G"
function limparNome(nome) {
  const palavras = nome.split(' ')
  while (palavras.length > 1 && (CODIGO_INTERNO.test(palavras.at(-1)) || /^\d+G$/.test(palavras.at(-1)) && /\d/.test(palavras.at(-2)))) {
    palavras.pop()
  }
  return palavras.join(' ')
}

const euros = (v) => `${v.toFixed(2).replace('.', ',')} €`

// Tamanho no nome: "4X160G", "1KG", "15X25CL", "400 GR"; "LARANJA KG" = vendido ao kg
function lerTamanho(nome) {
  const m = nome.match(/(?:(\d+)\s*X\s*)?(\d+(?:[.,]\d+)?)\s*(KG|GR|G|ML|CL|LT|L|UN)\b/i)
  if (!m) return /\bKG\b/i.test(nome) ? { texto: 'Vendido ao kg', quantidade: 1, unidade: 'kg' } : null
  const vezes = m[1] ? Number(m[1]) : 1
  const valor = Number(m[2].replace(',', '.')) * vezes
  const [fator, unidade] = { KG: [1, 'kg'], GR: [0.001, 'kg'], G: [0.001, 'kg'], ML: [0.001, 'L'], CL: [0.01, 'L'], LT: [1, 'L'], L: [1, 'L'], UN: [1, 'un'] }[m[3].toUpperCase()]
  return { texto: m[0].replace(/\s+/g, ' ').toLowerCase(), quantidade: valor * fator, unidade }
}

export async function promocoesDoFolhetoPingoDoce(folheto) {
  const { enrichments } = await lerFolhetoIpaper(folheto.link)
  const nomes = await nomesDosProdutos('pingodoce')

  const vistos = new Set()
  const promocoes = []
  for (const e of enrichments) {
    // Só zonas de produto com preço; cada produto uma vez (a primeira página onde aparece)
    if (!e.productId || !(e.price > 0) || vistos.has(e.productId)) continue
    vistos.add(e.productId)

    const nomeFolheto = limparNome(String(e.name ?? '').replace(/\s+/g, ' ').trim())
    const nomeSite = nomes.get(String(e.productId))
    let tamanho = lerTamanho(nomeFolheto)
    // "Água com gás pack 4" + "25CL": o tamanho é de cada garrafa, o preço é do pack
    const pack = nomeSite?.match(/\bpack (\d+)\b/i)
    if (tamanho && pack && !/x/i.test(tamanho.texto) && tamanho.texto !== 'Vendido ao kg') {
      tamanho = { ...tamanho, texto: `${pack[1]}x${tamanho.texto}`, quantidade: tamanho.quantidade * Number(pack[1]) }
    }
    const pagina = e.pageIndex + 1
    promocoes.push({
      loja: 'pingodoce',
      // Nome completo do site (pelo número do produto); se não houver, o nome abreviado do folheto
      produto: nomeSite ?? nomeFolheto,
      nomeFolheto,
      marca: null,
      tamanho: tamanho?.texto ?? null,
      preco: e.price,
      precoAntigo: null, // o folheto do Pingo Doce não traz o preço antigo
      precoPorKgL: tamanho && tamanho.quantidade > 0 ? `${euros(e.price / tamanho.quantidade)}/${tamanho.unidade}` : null,
      desconto: null,
      condicao: null,
      codigo: String(e.productId),
      validoDe: folheto.validoDe,
      validoAte: folheto.validoAte,
      pagina,
      fonte: `Folheto Pingo Doce "${folheto.nome}" (${folheto.identificador}), página ${pagina}`,
      link: `https://www.pingodoce.pt/home/produtos/p-${e.productId}.html`,
    })
  }
  return promocoes
}
