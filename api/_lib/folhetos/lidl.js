// Folhetos do Lidl: descobrir o folheto da semana e ler o texto do PDF (com posições)
// A API é a mesma que o visualizador do lidl.pt usa (endpoints.leaflets.schwarz).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
// O pdf.js, no Node, carrega o "worker" com um import calculado em tempo de execução, que o Vercel
// pode não incluir na função. Importá-lo aqui de forma explícita garante que vai junto.
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { AGENTE, erro } from '../comum.js'

globalThis.pdfjsWorker = pdfjsWorker

const API = 'https://endpoints.leaflets.schwarz/v4/flyer'

// Segunda-feira da semana de uma data (o folheto semanal do Lidl começa à segunda)
export function segundaFeira(data) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  const diasDesdeSegunda = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diasDesdeSegunda)
  return d
}

const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`

async function pedirFolheto(identificador) {
  const url = `${API}?flyer_identifier=${encodeURIComponent(identificador)}&region_id=0&region_code=0`
  const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(20000) })
  if (resposta.status === 404) return null
  if (!resposta.ok) throw erro(`A API de folhetos do Lidl respondeu com erro ${resposta.status}.`, 502)
  return (await resposta.json()).flyer ?? null
}

function resumir(identificador, folheto) {
  return {
    identificador,
    nome: `${folheto.name} (${folheto.title ?? ''})`.replace(' ()', ''),
    validoDe: (folheto.offerStartDate ?? folheto.startDate ?? '').slice(0, 10) || null,
    validoAte: (folheto.offerEndDate ?? folheto.endDate ?? '').slice(0, 10) || null,
    pdfUrl: folheto.pdfUrl,
    numPaginas: folheto.pages?.length ?? null,
    link: `https://www.lidl.pt/l/pt/folhetos/${identificador}/ar/0`,
  }
}

// Devolve os folhetos de promoções desta semana: o semanal e os relacionados
// (ex.: "Promoções Fim-de-Semana"). Os temáticos (brinquedos, decoração...) ficam de fora.
export async function folhetosDaSemanaLidl(hoje = new Date()) {
  // O nome segue o padrão "promocoes-semanais-a-partir-de-23-11" (segunda-feira da semana)
  const identificador = `promocoes-semanais-a-partir-de-${ddmm(segundaFeira(hoje))}`
  const semanal = await pedirFolheto(identificador)
  if (!semanal?.pdfUrl) {
    throw erro(`Não encontrei o folheto "${identificador}" (o Lidl pode ter mudado o nome dos folhetos).`, 404)
  }
  const folhetos = [resumir(identificador, semanal)]

  for (const relacionado of semanal.relatedFlyers ?? []) {
    if (!relacionado.slug?.startsWith('promocoes-') || relacionado.slug === identificador) continue
    const detalhe = await pedirFolheto(relacionado.slug)
    if (!detalhe?.pdfUrl) continue
    const resumo = resumir(relacionado.slug, detalhe)
    // Só os que ainda estão (ou vão estar) em vigor esta semana
    if (resumo.validoAte && resumo.validoAte < folhetos[0].validoDe) continue
    folhetos.push(resumo)
  }
  return folhetos
}

export async function descarregarPdf(url) {
  const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(120000) })
  if (!resposta.ok) throw erro(`Não consegui descarregar o PDF do folheto (erro ${resposta.status}).`, 502)
  return new Uint8Array(await resposta.arrayBuffer())
}

// Lê o texto de cada página com a posição e o tamanho da letra de cada pedaço.
// Devolve [{ pagina, pedacos: [{ x, y, tamanho, texto }] }]
// (y conta de cima para baixo; os preços estão em letra grande perto do nome do produto)
export async function textoDasPaginas(dadosPdf, paginas = null) {
  const tarefa = pdfjs.getDocument({ data: dadosPdf, verbosity: 0 })
  const pdf = await tarefa.promise
  const resultado = []
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      if (paginas && !paginas.includes(n)) continue
      const pagina = await pdf.getPage(n)
      const altura = pagina.getViewport({ scale: 1 }).height
      const { items } = await pagina.getTextContent()
      const pedacos = items
        .filter((i) => i.str && i.str.trim())
        .map((i) => ({
          x: Math.round(i.transform[4]),
          y: Math.round(altura - i.transform[5]), // de cima para baixo
          tamanho: Math.round(Math.hypot(i.transform[2], i.transform[3])),
          texto: i.str.trim(),
        }))
        .sort((a, b) => a.y - b.y || a.x - b.x)
      resultado.push({ pagina: n, pedacos })
      pagina.cleanup()
    }
  } finally {
    await tarefa.destroy() // o destroy() é da tarefa de carregamento, não do documento
  }
  return resultado
}
