// Leitura de folhetos na plataforma iPaper (usada pelo Continente e pelo Pingo Doce).
// A página do folheto traz um objeto "staticSettings" com:
//  - pageTexts: o texto de cada página
//  - enrichments.chunkUrls: ficheiros JSON com as zonas clicáveis dos produtos (nome, número do produto, preço)
// O robots.txt dos folhetos só proíbe .js/.xml/.ashx/.asmx/.swf/.axd: não usamos nenhum.
import { AGENTE, erro } from '../comum.js'

export async function pedirTexto(url) {
  const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE, 'Accept-Language': 'pt-PT' }, signal: AbortSignal.timeout(30000) })
  if (!resposta.ok) throw erro(`${url} respondeu com erro ${resposta.status}.`, 502)
  return resposta.text()
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const iso = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// Devolve { textos: [texto da página 1, ...], enrichments: [...] }
export async function lerFolhetoIpaper(url) {
  const html = await pedirTexto(url)
  const m = html.match(/window\.staticSettings\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>|\n)/)
  if (!m) throw erro('Não encontrei os dados do folheto na página (o iPaper pode ter mudado).', 502)
  const dados = JSON.parse(m[1])

  // Os enrichments vêm em vários ficheiros JSON (um por grupo de páginas), um pedido de cada vez
  const enrichments = []
  for (const urlParte of Object.values(dados.enrichments?.chunkUrls ?? {})) {
    try {
      const resposta = await fetch(urlParte, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(30000) })
      if (!resposta.ok) continue
      const parte = await resposta.json()
      enrichments.push(...(Array.isArray(parte) ? parte : (parte.enrichments ?? Object.values(parte).flat())))
    } catch {
      // perder um bocado só afeta essas páginas
    }
  }
  return { textos: dados.pageTexts ?? [], enrichments }
}
