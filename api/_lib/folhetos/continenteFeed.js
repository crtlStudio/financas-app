// Folheto digital do Continente em feed.continente.pt (alternativa ao iPaper).
//
// O www.continente.pt (onde está a lista dos folhetos do iPaper) está atrás do Cloudflare e recusa
// pedidos vindos do Vercel (erro 403). O feed.continente.pt não passa pelo Cloudflare e o robots.txt
// deixa ler /folhetos. Lá, o folheto semanal é uma página HTML com uma "caixa" por produto:
//   nome, marca, preço, preço antigo (PVPR ou desconto direto), unidade, "Leve 2 por" e os números
//   dos produtos no site (data-sku).
// Tem menos produtos do que o iPaper (~190 contra ~440): as caixas "Até 25% numa seleção de ..."
// não trazem preço e ficam de fora.
import { erro } from '../comum.js'
import { pedirTexto, MESES, iso } from './ipaper.js'
import { euros, capitalizar } from './texto.js'

const ORIGEM = 'https://feed.continente.pt'
const LISTA = `${ORIGEM}/folhetos`

// HTML -> texto simples ("ESPOR&#195;O" -> "ESPORÃO")
function limpar(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

// "... de 24 a 30 de novembro de 2026 ..." ou "de 29 de dezembro a 4 de janeiro de 2027"
function lerPeriodo(texto) {
  const m = texto.match(/de\s+(\d{1,2})(?:\s+de\s+(\p{L}+))?\s+a\s+(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})/iu)
  if (!m) return [null, null]
  const mesAte = MESES.indexOf(m[4].toLowerCase()) + 1
  const mesDe = m[2] ? MESES.indexOf(m[2].toLowerCase()) + 1 : mesAte
  if (!mesDe || !mesAte) return [null, null]
  const anoAte = Number(m[5])
  const anoDe = mesDe > mesAte ? anoAte - 1 : anoAte
  return [iso(anoDe, mesDe, Number(m[1])), iso(anoAte, mesAte, Number(m[3]))]
}

// O folheto semanal em vigor (ou o mais recente), já com o HTML da página
export async function folhetoSemanalFeedContinente(hoje = new Date()) {
  const lista = await pedirTexto(LISTA)
  const links = [...new Set(lista.match(/https:\/\/feed\.continente\.pt\/folhetos\/semanal-\d+-\d{4}-[a-z0-9]+/g) ?? [])]
  if (links.length === 0) throw erro('Não encontrei o folheto semanal em feed.continente.pt (o site pode ter mudado).', 404)

  const hojeIso = iso(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
  const folhetos = []
  for (const link of links.slice(0, 3)) {
    const html = await pedirTexto(link)
    const [validoDe, validoAte] = lerPeriodo(limpar(html))
    const folheto = { identificador: link.split('/').pop(), nome: 'Folheto Semanal', validoDe, validoAte, link }
    if (validoDe && validoDe <= hojeIso && hojeIso <= validoAte) return { folheto, html }
    folhetos.push({ folheto, html })
  }
  return folhetos.sort((a, b) => (a.folheto.validoDe ?? '').localeCompare(b.folheto.validoDe ?? '')).at(-1)
}

// Texto de um elemento pela classe (ex.: "price-int"); aceita classes extra ("PromoTextBottom yellowBg")
function campo(caixa, nome) {
  const m = caixa.match(new RegExp(`class="digitalFlyerIdBox__${nome}(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)</div>`))
  return m ? limpar(m[1]) : ''
}

const valor = (inteiro, decimal) => (inteiro ? Number(`${inteiro}.${decimal || '00'}`) : null)

// Uma promoção por caixa de produto com nome e preço
function promocaoDaCaixa(caixa, folheto) {
  if (!/data-type="product"/.test(caixa)) return null
  const nome = campo(caixa, 'BoxInfo-name')
  const preco = valor(campo(caixa, 'price-int'), campo(caixa, 'price-dec'))
  if (!nome || !(preco > 0)) return null

  const marca = campo(caixa, 'BoxInfo-brand')
  const antigo = valor(campo(caixa, 'old-price-int'), campo(caixa, 'old-price-dec'))
  const precoAntigo = antigo && antigo > preco ? antigo : null
  const vendidoAoKg = /^kg/i.test(campo(caixa, 'price-unit'))
  const descricao = campo(caixa, 'BoxInfo-description')
  const tamanho = vendidoAoKg ? 'Vendido ao kg' : (descricao.match(/EMB\.?\s*:?\s*(.+)/i)?.[1]?.slice(0, 40) ?? null)

  // "Leve 2 por 2,78 €" e "UNID FICA A 1,39€"
  const condicoes = []
  const leve = campo(caixa, 'stamp3__textSimples')
  const levePreco = valor(campo(caixa, 'stamp3__price-int'), campo(caixa, 'stamp3__price-dec'))
  if (/^leve/i.test(leve) && levePreco) condicoes.push(`${leve} por ${euros(levePreco)}`)
  const fica = campo(caixa, 'PromoTextBottom').match(/FICA\s+A\s+(\d+(?:,\d+)?)\s*€/i)
  if (fica) condicoes.push(`Cada unid. fica a ${euros(Number(fica[1].replace(',', '.')))}`)
  if (/^desde/i.test(campo(caixa, 'stamp1__textSimples'))) condicoes.push('Preço desde (varia com a variedade)')

  const skus = (caixa.match(/data-sku="([^"]*)"/)?.[1] ?? '').split(',').filter((s) => /^\d+$/.test(s))
  return {
    loja: 'continente',
    produto: capitalizar(`${nome} ${marca}`.trim()),
    marca: marca ? capitalizar(marca) : null,
    tamanho,
    preco,
    precoAntigo,
    precoPorKgL: vendidoAoKg ? `${euros(preco)}/kg` : null,
    desconto: precoAntigo ? `-${Math.round((1 - preco / precoAntigo) * 100)}%` : null,
    condicao: condicoes.length > 0 ? condicoes.join(' · ') : null,
    codigo: skus[0] ?? null,
    validoDe: folheto.validoDe,
    validoAte: folheto.validoAte,
    pagina: null,
    emPromocao: Boolean(precoAntigo) || condicoes.some((c) => /^leve|fica a/i.test(c)),
    fonte: `Folheto digital Continente (${folheto.identificador})`,
    // Um só produto: a página dele no site; vários (sabores, tamanhos): o folheto
    link: skus.length === 1 ? `https://www.continente.pt/produto/p-${skus[0]}.html` : folheto.link,
  }
}

export function promocoesDoFeedContinente(html, folheto) {
  const inicios = [...html.matchAll(/data-control="digitalFlyerIdBox"/g)].map((m) => html.lastIndexOf('<div', m.index))
  const vistas = new Set()
  return inicios
    .map((inicio, i) => html.slice(inicio, inicios[i + 1] ?? html.length))
    .map((caixa) => promocaoDaCaixa(caixa, folheto))
    .filter((p) => {
      // O mesmo produto aparece em "Oportunidades" e outra vez na secção dele
      if (!p) return false
      const chave = `${p.produto}|${p.preco}|${p.codigo}`
      if (vistas.has(chave)) return false
      vistas.add(chave)
      return true
    })
}
