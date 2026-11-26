// Gera public/dados/<loja>-produtos.json a partir do sitemap de cada loja.
// Os sitemaps são públicos e permitidos no robots.txt (as pesquisas dos sites não são).
// Corre sozinho antes de cada build (npm run build) ou à mão com: npm run indice
//
// Se uma loja falhar (sem internet, site em baixo), não estraga o build nem as outras lojas:
// mantém o índice anterior dessa loja, ou cria um vazio, e a app mostra o aviso.
import { mkdir, writeFile, access } from 'node:fs/promises'

const AGENTE = 'financas-app/1.0 (uso pessoal; precos de lista de compras)'
const PASTA = new URL('../public/dados/', import.meta.url)

// Para cada loja: onde está o índice dos sitemaps e como tirar nome, número e categoria de cada endereço
const LOJAS = [
  {
    id: 'continente',
    sitemap: 'https://www.continente.pt/sitemap_index.xml',
    // https://www.continente.pt/produto/leite-meio-gordo-continente-8912985.html
    produto: /<loc>https:\/\/www\.continente\.pt\/produto\/([^/<]+)-(\d+)\.html<\/loc>/g,
    ler: (m) => ({ slug: m[1], id: m[2], categoria: '' }),
  },
  {
    id: 'pingodoce',
    sitemap: 'https://www.pingodoce.pt/home/sitemap_index.xml',
    // https://www.pingodoce.pt/home/produtos/leite-e-bebidas-vegetais/leite/.../leite-uht-meio-gordo-agros-39020.html
    produto: /<loc>https:\/\/www\.pingodoce\.pt\/home\/produtos\/([^/<]+)\/(?:[^<]*\/)?([^/<]+)-(\d+)\.html<\/loc>/g,
    ler: (m) => ({ slug: m[2], id: m[3], categoria: m[1] }),
  },
  {
    id: 'auchan',
    sitemap: 'https://www.auchan.pt/sitemap_index.xml',
    // https://www.auchan.pt/pt/alimentacao/produtos-lacteos/.../leite-agros-uht-meio-gordo-1l/11763.html
    produto: /<loc>https:\/\/www\.auchan\.pt\/pt\/([^/<]+)\/(?:[^<]*\/)?([^/<]+)\/(\d+)\.html<\/loc>/g,
    ler: (m) => ({ slug: m[2], id: m[3], categoria: m[1] }),
  },
]

// "vinho-0.75l", "pescada-n%C2%BA5", "l%27oreal" -> "vinho-0-75l", "pescada-no5", "l-oreal"
// (as lojas encontram o produto pelo número, por isso o nome só serve para pesquisar e mostrar)
function limparNome(texto) {
  let t = texto
  try {
    t = decodeURIComponent(texto)
  } catch {
    // codificação estranha: fica como está
  }
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function descarregar(url) {
  const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(60000) })
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`)
  return resposta.text()
}

async function gerar(loja) {
  // 1. Lista dos sitemaps; só interessam os de produtos
  const indice = await descarregar(loja.sitemap)
  const sitemaps = [...indice.matchAll(/<loc>([^<]+-product\.xml)<\/loc>/g)].map((m) => m[1])
  if (sitemaps.length === 0) throw new Error('não encontrei sitemaps de produtos (o site pode ter mudado)')

  // 2. Um pedido de cada vez, para não sobrecarregar o site
  const produtos = new Map() // número -> "nome|número|categoria" (sem repetidos)
  for (const url of sitemaps) {
    const xml = await descarregar(url)
    for (const m of xml.matchAll(loja.produto)) {
      const { slug, id, categoria } = loja.ler(m)
      const nome = limparNome(slug)
      if (nome) produtos.set(id, `${nome}|${id}|${categoria}`)
    }
  }
  if (produtos.size === 0) throw new Error('o sitemap não tem produtos no formato esperado (o site pode ter mudado)')

  await writeFile(
    new URL(`${loja.id}-produtos.json`, PASTA),
    JSON.stringify({ loja: loja.id, geradoEm: new Date().toISOString(), produtos: [...produtos.values()] }),
  )
  console.log(`Índice ${loja.id}: ${produtos.size} produtos`)
}

await mkdir(PASTA, { recursive: true })
for (const loja of LOJAS) {
  try {
    await gerar(loja)
  } catch (e) {
    console.warn(`Aviso: não consegui atualizar o índice ${loja.id} (${e.message}).`)
    const destino = new URL(`${loja.id}-produtos.json`, PASTA)
    try {
      await access(destino) // já existe um índice anterior: fica esse
    } catch {
      await writeFile(destino, JSON.stringify({ loja: loja.id, geradoEm: null, produtos: [] }))
    }
  }
}
