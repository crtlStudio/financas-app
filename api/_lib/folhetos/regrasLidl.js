// Extrai as promoções de uma página do folheto do Lidl só com regras (sem IA, custo zero).
//
// Como uma página do Lidl está organizada (medido nos folhetos reais):
//   MARCA (maiúsculas, opcional)        <- letra ~10, coluna do produto
//   Nome do produto (1 a 3 linhas)      <- letra ~10, mesma coluna
//   Emb. 2 kg                           <- letra ~8
//   1 kg = 1.00                         <- letra ~8 (preço por kg/L)
//   nº83164                             <- letra ~6: fecha a coluna do produto
//   1.99                                <- letra ~45: preço de promoção, ao lado ou por baixo do código
//   2.69 / PVPR 3.39                    <- letra ~9-11: preço antigo, por cima do preço grande
//   -26%  e  "Com Lidl Plus"            <- desconto (letra ~17) e condição, junto ao preço antigo
//
// As distâncias estão em pontos do PDF. Se o Lidl mudar o desenho do folheto, é aqui que se afina.

const PRECO = /^\d+[.,]\d{2}$/
// "nº83164", e na fruta ao peso "nº165/ 80537" (fica o último número)
const CODIGO = /^n[º°o]\s*(?:\d+\s*\/\s*)?(\d{3,})$/i
const PERCENTAGEM = /^-\s?\d+\s?%$/
// "1 kg = 1.00", "1 L = 5.72", "100 g = 0.25"
const POR_UNIDADE = /(\d+)\s*(kg|g|l|lt|ml|cl|un|unid)\.?\s*=\s*(\d+[.,]\d{2})/i
const TAMANHO = /^(emb\.?|pack|cada pack|cada unid\.?|unid\.?|garrafa|lata|frasco|caixa|saco|rolo|vendido ao)\b/i
// Ofertas por quantidade: "Leve 6 por", "5+1 Grátis", "6 unid. por", "Ou 1 unid. por 0.22", "Cada unid. sai a 0.17"
const OFERTA = /^(leve \d+ por|\d+\s*\+\s*\d+ gr[aá]tis|\d+ unid\.? por|ou 1 unid\.? por|cada unid\.? sai a)/i
const IGNORAR = /^(stock limitado|sempre dispon[ií]vel|pvpr|novidade|até|ate)$/i

const LETRA_PRECO_GRANDE = 25 // a partir deste tamanho, um preço é o de promoção
const LETRA_PRECO_PRINCIPAL = 36 // o preço principal costuma ter ~45; os de ~27 são o "preço sem Lidl Plus"

// "1,99" -> 1.99; também aceita "PVPR 2.44"
const numero = (texto) => Number(texto.replace(/^pvpr\s*/i, '').replace(',', '.'))
const PRECO_PVPR = /^pvpr\s+\d+[.,]\d{2}$/i
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const euros = (v) => `${v.toFixed(2).replace('.', ',')} €`

// "1 kg = 1.00" -> "1,00 €/kg"; "100 g = 0.25" -> "2,50 €/kg"; "1 L = 5.72" -> "5,72 €/L"
function lerPorUnidade(texto) {
  const m = texto.match(POR_UNIDADE)
  if (!m) return null
  const quantidade = Number(m[1])
  const [fator, unidade] = { kg: [1, 'kg'], g: [0.001, 'kg'], l: [1, 'L'], lt: [1, 'L'], ml: [0.001, 'L'], cl: [0.01, 'L'], un: [1, 'un'], unid: [1, 'un'] }[m[2].toLowerCase()]
  const porUnidade = numero(m[3]) / (quantidade * fator)
  return `${euros(porUnidade)}/${unidade}`
}

// "A partir de seg. 23/11 a dom. 29/11" -> ["2026-11-23", "2026-11-29"] (o ano vem do folheto)
function lerPeriodo(pedacos, ano) {
  const cabecalho = pedacos.find((p) => p.y < 80 && /\d{1,2}\/\d{1,2}.*\d{1,2}\/\d{1,2}/.test(p.texto))
  if (!cabecalho) return [null, null]
  const datas = [...cabecalho.texto.matchAll(/(\d{1,2})\/(\d{1,2})/g)].map(
    (m) => `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
  )
  return [datas[0] ?? null, datas[1] ?? null]
}

// Junta pares (a, b) que estejam perto, do mais perto para o mais longe, sem repetir nenhum
function emparelhar(as, bs, pontuacao) {
  const pares = []
  for (const a of as) {
    for (const b of bs) {
      const p = pontuacao(a, b)
      if (p !== null) pares.push({ a, b, p })
    }
  }
  pares.sort((x, y) => x.p - y.p)
  const usadosA = new Set()
  const usadosB = new Set()
  const resultado = new Map()
  for (const { a, b } of pares) {
    if (usadosA.has(a) || usadosB.has(b)) continue
    usadosA.add(a)
    usadosB.add(b)
    resultado.set(a, b)
  }
  return resultado
}

// Ponto de entrada: devolve as promoções de uma página
export function promocoesDaPagina({ pagina, pedacos }, folheto) {
  const ano = (folheto.validoDe ?? String(new Date().getFullYear())).slice(0, 4)
  const [periodoDe, periodoAte] = lerPeriodo(pedacos, ano)

  const codigos = pedacos.filter((p) => CODIGO.test(p.texto))
  const precosGrandes = pedacos.filter((p) => PRECO.test(p.texto) && p.tamanho >= LETRA_PRECO_GRANDE)
  const precosPequenos = pedacos.filter(
    (p) => (PRECO.test(p.texto) && p.tamanho < LETRA_PRECO_GRANDE) || PRECO_PVPR.test(p.texto),
  )
  const percentagens = pedacos.filter((p) => PERCENTAGEM.test(p.texto))
  const lidlPlus = pedacos.filter((p) => /com lidl plus/i.test(p.texto))

  const ofertas = pedacos.filter((p) => OFERTA.test(p.texto))

  // 1. Cada código fica com o preço grande mais próximo: na mesma linha à direita, ou até ~115 pontos abaixo
  const precoDoCodigo = emparelhar(codigos, precosGrandes, (c, preco) => {
    const dx = preco.x - c.x
    const dy = preco.y - c.y
    if (dy < -15 || dy > 115 || dx < -40 || dx > 180) return null
    // Os preços médios (~27) quase sempre são o "preço sem Lidl Plus": só ficam se não houver outro
    const penalizacao = preco.tamanho < LETRA_PRECO_PRINCIPAL ? 100 : 0
    return Math.abs(dy) + Math.abs(dx) * 0.5 + penalizacao
  })

  // Preço sem Lidl Plus: um preço médio por cima do preço principal, na mesma coluna
  const usados = new Set(precoDoCodigo.values())
  const semLidlPlusDoPreco = emparelhar(
    [...precoDoCodigo.values()],
    precosGrandes.filter((p) => !usados.has(p) && p.tamanho < LETRA_PRECO_PRINCIPAL),
    (preco, medio) => {
      const dx = medio.x - preco.x
      const dy = medio.y - preco.y
      if (dy > -10 || dy < -90 || Math.abs(dx) > 25) return null
      if (numero(medio.texto) <= numero(preco.texto)) return null
      return distancia(preco, medio)
    },
  )

  // 2. Cada preço grande fica com o preço pequeno logo acima (o preço antigo), se existir.
  //    Com preço duplo, o preço antigo está por cima do preço "sem Lidl Plus".
  const antigoDoPreco = emparelhar([...precoDoCodigo.values()], precosPequenos, (preco, antigo) => {
    const referencia = semLidlPlusDoPreco.get(preco) ?? preco
    const dx = antigo.x - referencia.x
    const dy = antigo.y - referencia.y
    if (dy > -5 || dy < -70 || Math.abs(dx) > 90) return null
    if (numero(antigo.texto) <= numero(referencia.texto)) return null // o preço antigo é sempre maior
    return distancia(referencia, antigo)
  })

  const promocoes = []
  for (const [codigo, preco] of precoDoCodigo) {
    // 3. A coluna do produto: pedaços alinhados com o código (mesmo x) logo por cima dele
    const coluna = pedacos
      .filter((p) => Math.abs(p.x - codigo.x) <= 4 && p.y < codigo.y && p.y >= codigo.y - 80 && p !== codigo)
      .sort((a, b) => b.y - a.y) // de baixo para cima
    const bloco = []
    let yAnterior = codigo.y
    for (const p of coluna) {
      if (yAnterior - p.y > 16) break // espaço grande: já é outro bloco
      bloco.unshift(p)
      yAnterior = p.y
    }

    let tamanho = null
    let precoPorKgL = null
    const linhasNome = []
    for (const p of bloco) {
      // Às vezes vem tudo junto: "Emb. 800 g; 1 kg = 2.36"
      for (const parte of p.texto.split(';').map((s) => s.trim())) {
        if (POR_UNIDADE.test(parte)) precoPorKgL = lerPorUnidade(parte)
        else if (TAMANHO.test(parte)) tamanho = parte.replace(/^(emb\.?|unid\.?)\s*/i, '').trim()
        else if (!IGNORAR.test(parte) && !OFERTA.test(parte) && !PRECO.test(parte) && p.tamanho >= 9 && p.tamanho <= 13) linhasNome.push(parte)
      }
    }
    // Fruta e legumes "Vendido ao kg": o preço já é por kg
    if (/^vendido ao kg/i.test(tamanho ?? '') && !precoPorKgL) precoPorKgL = `${euros(numero(preco.texto))}/kg`
    if (linhasNome.length === 0) continue // sem nome não é um produto

    // A marca são as primeiras linhas todas em maiúsculas ("DANONE", "OLIVEIRA" + "DA SERRA")
    const emMaiusculas = (t) => /^[A-ZÀ-Ý0-9 .&'-]+$/.test(t) && /[A-Z]{2}/.test(t)
    const linhasMarca = []
    while (linhasNome.length > 1 && emMaiusculas(linhasNome[0])) linhasMarca.push(linhasNome.shift())
    const marca = linhasMarca.length > 0 ? linhasMarca.join(' ') : null

    // 4. Desconto e "Com Lidl Plus": perto do preço antigo (ou do preço, se não houver antigo)
    const antigo = antigoDoPreco.get(preco) ?? null
    const referencia = antigo ?? preco
    const desconto = percentagens
      .filter((d) => Math.abs(d.y - referencia.y) <= 30 && Math.abs(d.x - referencia.x) <= 90 && d.y <= preco.y)
      .sort((a, b) => distancia(a, referencia) - distancia(b, referencia))[0]
    // "Com Lidl Plus" fica por cima do desconto ou, nas ofertas por quantidade, por cima do preço
    const acimaDe = (alvo, limite) => lidlPlus.some((l) => Math.abs(l.x - alvo.x) <= 30 && alvo.y - l.y >= 0 && alvo.y - l.y <= limite)
    const comLidlPlus = (desconto && acimaDe(desconto, 25)) || acimaDe(preco, 60)

    // Ofertas por quantidade perto do preço ("Leve 6 por", "4+4 Grátis", "Ou 1 unid. por 0.22")
    const textosOferta = ofertas
      .filter((o) => Math.abs(o.x - preco.x) <= 60 && o.y - preco.y >= -60 && o.y - preco.y <= 15)
      .sort((a, b) => a.y - b.y)
      .map((o) => o.texto)
    const semLidlPlus = semLidlPlusDoPreco.get(preco) ?? null
    const textoLidlPlus = comLidlPlus || semLidlPlus
      ? `Com Lidl Plus${semLidlPlus ? ` (sem a app: ${euros(numero(semLidlPlus.texto))})` : ''}`
      : null
    const condicoes = [textoLidlPlus, ...textosOferta].filter(Boolean)

    promocoes.push({
      loja: 'lidl',
      produto: linhasNome.join(' ').replace(/\s+/g, ' '),
      marca,
      tamanho,
      preco: numero(preco.texto),
      precoAntigo: antigo ? numero(antigo.texto) : null,
      // Quando o preço é só com a app Lidl Plus, este é o preço para quem não a usa
      precoSemLidlPlus: semLidlPlus ? numero(semLidlPlus.texto) : null,
      precoPorKgL,
      desconto: desconto ? desconto.texto.replace(/\s/g, '') : null,
      condicao: condicoes.length > 0 ? condicoes.join(' · ') : null,
      codigo: codigo.texto.match(CODIGO)[1],
      validoDe: periodoDe ?? folheto.validoDe,
      validoAte: periodoAte ?? folheto.validoAte,
      pagina,
    })
  }
  return promocoes
}
