// Lê o índice de produtos de uma loja (gerado no build a partir do sitemap: public/dados/<loja>-produtos.json)
// e devolve um Map: número do produto -> nome legível ("leite-uht-meio-gordo-agros" -> "Leite uht meio gordo agros")
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const nomeDoSlug = (slug) => {
  const texto = slug.replace(/-/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export async function nomesDosProdutos(loja) {
  let dados = null
  // No teu computador o ficheiro está na pasta public/
  try {
    dados = JSON.parse(await readFile(path.resolve(process.cwd(), 'public', 'dados', `${loja}-produtos.json`), 'utf8'))
  } catch {
    // No Vercel os ficheiros de public/ são servidos pelo site: pedimos ao próprio site
    const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
    if (dominio) {
      try {
        const resposta = await fetch(`https://${dominio}/dados/${loja}-produtos.json`, { signal: AbortSignal.timeout(30000) })
        if (resposta.ok) dados = await resposta.json()
      } catch {
        // sem índice: ficam os nomes do folheto
      }
    }
  }
  const nomes = new Map()
  for (const texto of dados?.produtos ?? []) {
    const [slug, id] = texto.split('|')
    nomes.set(id, nomeDoSlug(slug))
  }
  return nomes
}
