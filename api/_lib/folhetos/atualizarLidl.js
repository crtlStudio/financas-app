// Atualização semanal do Lidl: descobre os folhetos, lê os PDF e guarda as promoções.
// Sem IA: as promoções saem do texto do PDF com as regras de regrasLidl.js (custo zero).
import { folhetosDaSemanaLidl, descarregarPdf, textoDasPaginas } from './lidl.js'
import { promocoesDaPagina } from './regrasLidl.js'
import { atualizarLoja } from './atualizarLoja.js'

export function atualizarLidl(hoje = new Date()) {
  return atualizarLoja('lidl', async () => {
    const folhetos = await folhetosDaSemanaLidl(hoje)
    const promocoes = []
    const resumo = []

    // Um folheto de cada vez (cada PDF tem ~50 MB): poucos pedidos e pouca memória
    for (const folheto of folhetos) {
      const paginas = await textoDasPaginas(await descarregarPdf(folheto.pdfUrl))
      const doFolheto = paginas.flatMap((pagina) => promocoesDaPagina(pagina, folheto))
      for (const p of doFolheto) {
        promocoes.push({
          ...p,
          // A fonte de cada preço: que folheto, que página e onde o ver
          fonte: `Folheto Lidl "${folheto.nome}", página ${p.pagina}`,
          link: `${folheto.link.replace('/ar/0', '')}/view/flyer/page/${p.pagina}`,
        })
      }
      const { pdfUrl, ...semPdf } = folheto
      resumo.push({ ...semPdf, pdf: pdfUrl, numPromocoes: doFolheto.length })
    }
    return { folhetos: resumo, promocoes }
  })
}
