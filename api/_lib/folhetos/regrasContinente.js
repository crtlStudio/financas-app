// Extrai as promoções do folheto do Continente (plataforma iPaper) só com regras (sem IA, custo zero).
//
// O iPaper dá duas coisas por página:
//  1. O texto da página, com os produtos neste formato (os euros e os cêntimos vêm separados):
//       "PVPR 1 € 0 90 € , UNID. LEITE UHT MIMOSA MEIO GORDO/ MAGRO EMB.: 1 L"
//       "6 42 € , UNID. LEITE UHT MAGRO/ MEIO GORDO CONTINENTE S/LACTOSE EMB.: 6 X 1 L"   (sem promoção)
//       "PVPR 27,99 € 9 99 € , UNID. AZEITE ... EMB.: 2 L 5€/L"
//  2. Os "enrichments": as zonas clicáveis, com o nome bonito, o número do produto no site e o preço
//     de referência (que é o PVPR, não o preço de promoção).
// Juntamos os dois pela página, pelo preço de referência e pelas palavras do nome.

import { euros, capitalizar } from './texto.js'

// Início de um produto: [preço antigo €] preço € [,] UNIDADE
//  - Preço antigo: "PVPR 27,99 €" ou só "11,99 €" (ex.: "Desconto Direto 11,99 € 8 99 € , KG").
//    Sem "PVPR" tem de ter cêntimos e não pode ser a oferta do produto anterior ("FICA A 1,50 €").
//  - Preço: "8 99 € , KG" (euros cêntimos) ou, em algumas páginas, ao contrário: "99 € 12 , KG" (= 12,99 €)
const PRECO =
  /(?<![\d.,])(?:(?:PVPR\s+(?<pvpr>\d+(?:[.,]\d{1,2})?)|(?<!FICA\s+A\s+)(?<antigo>\d+,\d{2}))\s*€\s+)?(?:(?<euros>\d+)(?:\s+(?<cents>\d{2}))?\s*€|(?<centsAntes>\d{2})\s*€\s+(?<eurosDepois>\d+))\s*,?\s*(?<unidade>UNID\.?|KG\.?|EMB\.?|CX\.?|PACK\.?)(?=\s)/g
const POR_UNIDADE = /(\d+(?:[.,]\d+)?)\s*€\s*\/\s*(KG|L|LT|UN|UNID|DOSE|M)\b/i
const TAMANHO = /EMB\.?\s*:?\s*((?:\d+\s*X\s*)?\d+(?:[.,]\d+)?\s*(?:KG|G|GR|ML|CL|L|LT|UN|UNID\.?|DOSES?|M|ROLOS|SAQUETAS|CÁPSULAS)\b(?:\s*\/\s*(?:\d+\s*X\s*)?\d+(?:[.,]\d+)?\s*(?:KG|G|GR|ML|CL|L|LT|UN|UNID\.?))?)/i
const OFERTA = /UNID\.?\s+FICA\s+A\s+(\d+(?:,\d+)?)\s*€/i
// Texto que já não é do produto: frases de campanha, títulos de secção, notas
const FIM_DO_NOME = /\s(?:EMB\.?\s*:|\d+(?:[.,]\d+)?\s*€\s*\/|%|\d+\s+de\s+Mais|Mais\s+de|Até\s|Apenas\s|•|\*)/

const numero = (texto) => Number(String(texto).replace(',', '.'))

// Palavras de um nome, para comparar o texto da página com os enrichments
const palavras = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1 && !['de', 'da', 'do', 'com', 'em', 'emb', 'unid', 'c', 's'].includes(p))


// Lê os produtos do texto de uma página
export function produtosDoTexto(texto) {
  const inicios = [...texto.matchAll(PRECO)]
  const produtos = []
  inicios.forEach((m, i) => {
    const fim = i + 1 < inicios.length ? inicios[i + 1].index : texto.length
    const corpo = texto.slice(m.index + m[0].length, fim).trim()

    const g = m.groups
    const preco = g.euros ? numero(`${g.euros}.${g.cents ?? '00'}`) : numero(`${g.eurosDepois}.${g.centsAntes}`)
    const antigo = g.pvpr ?? g.antigo
    const pvpr = antigo ? numero(antigo) : null
    if (!(preco > 0)) return

    // Tira restos de frases de campanha no fim ("... de Mais", "... Até")
    const nome = corpo
      .split(FIM_DO_NOME)[0]
      .replace(/(\s+(de\s+mais|mais\s+de|até|apenas|\d+))+$/i, '')
      .trim()
    // Em algumas páginas (ex.: talho) os nomes vêm todos juntos e os preços seguidos:
    // aí o "nome" começa por "Apenas", "%" ou números e não sabemos de que produto é o preço.
    // Fica de fora, em vez de arriscar um preço errado.
    if (/^(apenas|%|sobre|pvpr|até|mais|\d)/i.test(nome)) return
    if (palavras(nome).length === 0) return

    const tamanho = corpo.match(TAMANHO)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const pu = corpo.match(POR_UNIDADE)
    const unidade = pu ? { KG: 'kg', L: 'L', LT: 'L', UN: 'un', UNID: 'un', DOSE: 'dose', M: 'm' }[pu[2].toUpperCase()] : null
    const oferta = corpo.match(OFERTA)

    produtos.push({
      nomeTexto: nome,
      preco,
      pvpr: pvpr && pvpr > preco ? pvpr : null,
      vendidoAoKg: /^KG/i.test(m[4]),
      tamanho,
      precoPorKgL: pu ? `${euros(numero(pu[1]))}/${unidade}` : null,
      condicao: oferta ? `Cada unid. fica a ${euros(numero(oferta[1]))}` : null,
    })
  })
  return produtos
}

// Junta os produtos do texto com os enrichments da mesma página (nome bonito + número do produto)
export function promocoesDaPagina(pagina, texto, enrichments, folheto) {
  const daPagina = enrichments.filter((e) => e.pageIndex === pagina - 1 && e.productId && e.name)
  const produtos = produtosDoTexto(texto)

  // Todos os pares possíveis (produto do texto, enrichment), com uma pontuação
  const pares = []
  for (const p of produtos) {
    const palavrasTexto = palavras(p.nomeTexto)
    for (const e of daPagina) {
      const palavrasEnr = palavras(e.name)
      const comuns = palavrasTexto.filter((w) => palavrasEnr.includes(w)).length
      // Parecença dos nomes: palavras em comum / palavras diferentes no total
      const parecenca = comuns / new Set([...palavrasTexto, ...palavrasEnr]).size
      // O preço dos enrichments é o de referência: igual ao PVPR (em promoção) ou ao preço
      const mesmoPreco = Math.abs(e.price - (p.pvpr ?? p.preco)) < 0.005 || Math.abs(e.price - p.preco) < 0.005
      // Com o mesmo preço basta alguma parecença; sem ele, os nomes têm de ser quase iguais
      if (comuns < 2 || parecenca < (mesmoPreco ? 0.35 : 0.7)) continue
      pares.push({ p, e, pontos: parecenca + (mesmoPreco ? 0.5 : 0) })
    }
  }
  // O melhor par primeiro; cada produto e cada enrichment só são usados uma vez
  pares.sort((a, b) => b.pontos - a.pontos)
  const ligacao = new Map()
  const usados = new Set()
  for (const { p, e } of pares) {
    if (ligacao.has(p) || usados.has(e)) continue
    ligacao.set(p, e)
    usados.add(e)
  }

  const promocoes = []
  for (const p of produtos) {
    // O nome vem sempre do texto da página (o enrichment pode ser de outro sabor/variante com o mesmo preço);
    // o enrichment só dá o número do produto, para o link
    const enr = ligacao.get(p)
    const melhor = enr ? { e: enr } : null

    const desconto = p.pvpr ? `-${Math.round((1 - p.preco / p.pvpr) * 100)}%` : null
    promocoes.push({
      loja: 'continente',
      produto: capitalizar(p.nomeTexto),
      marca: null, // no Continente a marca já vem dentro do nome
      tamanho: p.vendidoAoKg ? 'Vendido ao kg' : p.tamanho,
      preco: p.preco,
      precoAntigo: p.pvpr,
      precoPorKgL: p.precoPorKgL ?? (p.vendidoAoKg ? `${euros(p.preco)}/kg` : null),
      desconto,
      condicao: p.condicao,
      codigo: melhor ? melhor.e.productId : null,
      validoDe: folheto.validoDe,
      validoAte: folheto.validoAte,
      pagina,
      emPromocao: Boolean(p.pvpr),
    })
  }
  return promocoes
}
