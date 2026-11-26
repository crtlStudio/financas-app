// Procura produtos de uma loja no índice gerado a partir do sitemap (public/dados/<loja>-produtos.json)

const indices = {} // fica em memória depois do primeiro carregamento de cada loja

export async function carregarIndice(loja) {
  if (indices[loja]) return indices[loja]
  const resposta = await fetch(`/dados/${loja}-produtos.json`)
  if (!resposta.ok) throw new Error('O índice de produtos desta loja não está disponível.')
  const dados = await resposta.json()
  indices[loja] = {
    geradoEm: dados.geradoEm,
    produtos: dados.produtos.map((texto) => {
      const [slug, id, categoria = ''] = texto.split('|')
      return { produto: `${slug}-${id}`, slug, categoria, palavras: slug.split('-') }
    }),
  }
  return indices[loja]
}

// Endereço da página do produto (as lojas redirecionam para a página completa)
export function urlDoProduto(loja, produto) {
  const [, slug, id] = produto.match(/^(.*)-(\d+)$/) ?? []
  if (loja === 'continente') return `https://www.continente.pt/produto/${produto}.html`
  if (loja === 'pingodoce') return `https://www.pingodoce.pt/home/produtos/${produto}.html`
  if (loja === 'auchan') return `https://www.auchan.pt/pt/${slug}/${id}.html`
  return null
}

// Palavras que não ajudam a distinguir produtos
const IGNORAR = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'em', 'e', 'a', 'o', 'para'])

// "Leite Meio-Gordo 1L" -> ["leite", "meio", "gordo"]
// (os tamanhos nem sempre aparecem nos nomes, por isso saem da pesquisa)
export function palavrasDe(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|l|lt|ml|cl|un|x)?\b/g, ' ')
    .split(/[^a-z]+/)
    .filter((p) => p.length > 1 && !IGNORAR.has(p))
}

// "leite-meio-gordo-acores-continente" -> "Leite meio gordo acores continente"
export function nomeDoSlug(slug) {
  const texto = slug.replace(/-/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// "produtos-lacteos" -> "Produtos lacteos"
export const nomeDaCategoria = (categoria) => (categoria ? nomeDoSlug(categoria) : '')

// Devolve os melhores candidatos: primeiro os que têm todas as palavras, e os de nome mais curto
// (normalmente o produto "base", sem variantes)
export function procurar(produtos, texto, maximo = 12) {
  const termos = palavrasDe(texto)
  if (termos.length === 0) return []

  const resultados = []
  for (const p of produtos) {
    let encontrados = 0
    let exatos = 0
    for (const termo of termos) {
      // Singular simples: "bananas" -> "banana", "ovos" -> "ovo"
      const singular = termo.length >= 4 && termo.endsWith('s') ? termo.slice(0, -1) : termo
      if (p.palavras.includes(termo) || p.palavras.includes(singular)) {
        encontrados++
        exatos++
      } else if (singular.length >= 4 && p.palavras.some((w) => w.startsWith(singular))) {
        encontrados++ // "banana" encontra "bananas"
      }
    }
    // Aceita os que têm todas as palavras, ou todas menos uma se a pesquisa for longa
    if (encontrados === termos.length || (termos.length >= 3 && encontrados === termos.length - 1)) {
      resultados.push({ ...p, encontrados, exatos })
    }
  }

  return resultados
    .sort(
      (a, b) =>
        b.encontrados - a.encontrados ||
        b.exatos - a.exatos ||
        // a primeira palavra do nome igual à primeira da pesquisa conta muito ("ovos ..." e não "massa com ovos")
        Number(b.palavras[0] === termos[0]) - Number(a.palavras[0] === termos[0]) ||
        a.palavras.length - b.palavras.length,
    )
    .slice(0, maximo)
}
