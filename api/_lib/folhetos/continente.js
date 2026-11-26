// Folhetos do Continente: descobrir o folheto semanal e ler os dados do iPaper
//  - Lista de folhetos: https://www.continente.pt/folhetos/ (permitida no robots.txt)
//  - Folheto: https://folhetos.continente.pt/2026/11/semanal-48-xm98/ (o fim do nome muda todas as semanas)
import { erro } from '../comum.js'
import { pedirTexto, lerFolhetoIpaper, MESES, iso } from './ipaper.js'
import { promocoesDaPagina } from './regrasContinente.js'

const LISTA = 'https://www.continente.pt/folhetos/'

// "De 24 de Novembro até 30 de Novembro" -> ["2026-11-24", "2026-11-30"]
function lerPeriodo(texto, ano) {
  const limpo = texto.replace(/&eacute;/g, 'é').replace(/&ccedil;/g, 'ç')
  const m = limpo.match(/De\s+(\d{1,2})\s+de\s+(\p{L}+)\s+até\s+(\d{1,2})\s+de\s+(\p{L}+)/iu)
  if (!m) return [null, null]
  const mesDe = MESES.indexOf(m[2].toLowerCase()) + 1
  const mesAte = MESES.indexOf(m[4].toLowerCase()) + 1
  if (!mesDe || !mesAte) return [null, null]
  const anoAte = mesAte < mesDe ? ano + 1 : ano // ex.: de 29 de dezembro até 4 de janeiro
  return [iso(ano, mesDe, Number(m[1])), iso(anoAte, mesAte, Number(m[3]))]
}

// O folheto semanal principal em vigor (ou o próximo) nesta data
export async function folhetoSemanalContinente(hoje = new Date()) {
  const html = await pedirTexto(LISTA)
  const vistos = new Set()
  const folhetos = []
  // Só o semanal principal ("semanal-48-xm98"); os regionais têm mais um bocado no nome ("semanal-48-mad-gt76")
  for (const m of html.matchAll(/https:\/\/folhetos\.continente\.pt\/(\d{4})\/\d{2}\/(semanal-\d+-[a-z]{2}\d{2})\//g)) {
    if (vistos.has(m[2])) continue
    vistos.add(m[2])
    const [validoDe, validoAte] = lerPeriodo(html.slice(m.index, m.index + 4000), Number(m[1]))
    folhetos.push({ identificador: m[2], nome: 'Folheto Semanal', validoDe, validoAte, link: m[0] })
  }
  if (folhetos.length === 0) throw erro('Não encontrei o folheto semanal na lista do Continente (o site pode ter mudado).', 404)

  const hojeIso = iso(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
  const emVigor = folhetos.find((f) => f.validoDe && f.validoDe <= hojeIso && hojeIso <= f.validoAte)
  return emVigor ?? folhetos.sort((a, b) => (a.validoDe ?? '').localeCompare(b.validoDe ?? '')).at(-1)
}

// Lê o folheto: o preço de promoção vem do texto das páginas; os enrichments só dão o número do produto
export async function promocoesDoFolhetoContinente(folheto) {
  const { textos, enrichments } = await lerFolhetoIpaper(folheto.link)
  return textos.flatMap((texto, i) =>
    (texto ? promocoesDaPagina(i + 1, texto, enrichments, folheto) : []).map((p) => ({
      ...p,
      fonte: `Folheto Continente "${folheto.nome}" (${folheto.identificador}), página ${p.pagina}`,
      // Com o número do produto, o link vai para a página do produto no site; sem ele, para o folheto
      link: p.codigo ? `https://www.continente.pt/produto/p-${p.codigo}.html` : `${folheto.link}?page=${p.pagina}`,
    })),
  )
}
