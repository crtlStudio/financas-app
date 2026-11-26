// Atualização semanal do Lidl: descobre os folhetos, lê os PDF e guarda as promoções.
// Sem IA: as promoções saem do texto do PDF com as regras de regrasLidl.js (custo zero).
// Depois, o site do Lidl completa cada promoção (link do produto, datas, preço sem Lidl Plus).
import { folhetosDaSemanaLidl, descarregarPdf, textoDasPaginas } from './lidl.js'
import { promocoesDaPagina } from './regrasLidl.js'
import { produtosDoSiteLidl, completarComSite } from './lidlSite.js'
import { atualizarLoja } from './atualizarLoja.js'

export function atualizarLidl(hoje = new Date()) {
  return atualizarLoja('lidl', async () => {
    const folhetos = await folhetosDaSemanaLidl(hoje)

    // O site é só um complemento: se falhar, ficam as promoções do folheto como estavam
    let doSite = new Map()
    try {
      doSite = await produtosDoSiteLidl()
    } catch (e) {
      console.warn(`Lidl: não consegui ler o site para completar o folheto (${e.message})`)
    }

    const promocoes = []
    const resumo = []

    // Um folheto de cada vez (cada PDF tem ~50 MB): poucos pedidos e pouca memória
    for (const folheto of folhetos) {
      const paginas = await textoDasPaginas(await descarregarPdf(folheto.pdfUrl))
      const doFolheto = paginas.flatMap((pagina) => promocoesDaPagina(pagina, folheto))
      for (const p of doFolheto) {
        const promocao = {
          ...p,
          // A fonte de cada preço: que folheto, que página e onde o ver
          fonte: `Folheto Lidl "${folheto.nome}", página ${p.pagina}`,
          link: `${folheto.link.replace('/ar/0', '')}/view/flyer/page/${p.pagina}`,
        }
        promocoes.push(completarComSite(promocao, doSite.get(p.codigo)))
      }
      const { pdfUrl, ...semPdf } = folheto
      resumo.push({ ...semPdf, pdf: pdfUrl, numPromocoes: doFolheto.length })
    }
    return { folhetos: resumo, promocoes }
  })
}
