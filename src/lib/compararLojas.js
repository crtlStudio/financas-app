// Compara o total da lista entre lojas e sugere: uma só loja, ou dividir por duas

// Só sugerimos dividir a compra se a poupança for pelo menos esta (em €)
export const POUPANCA_MINIMA_PARA_DIVIDIR = 5

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const soma = (valores) => valores.reduce((s, v) => s + v, 0)
const produtos = (n) => `${n} ${n === 1 ? 'produto' : 'produtos'}`

// precos = { [item]: { [idLoja]: número } }
export function sugerirLojas(itens, precos, lojas) {
  const temPreco = (item, loja) => typeof precos[item]?.[loja.id] === 'number'

  const lojasComPrecos = lojas.filter((l) => itens.some((i) => temPreco(i, l)))
  if (lojasComPrecos.length < 2) {
    return { tipo: 'insuficiente', texto: 'A sugestão aparece quando houver preços de pelo menos duas lojas.' }
  }

  // Para ser justo, só comparamos os produtos que têm preço em todas essas lojas
  const comparaveis = itens.filter((i) => lojasComPrecos.every((l) => temPreco(i, l)))
  if (comparaveis.length === 0) {
    return { tipo: 'insuficiente', texto: 'Ainda não há nenhum produto com preço em todas as lojas para comparar.' }
  }
  const deFora = itens.length - comparaveis.length
  const notaDeFora = deFora > 0 ? ` (${deFora} ${deFora === 1 ? 'produto ficou' : 'produtos ficaram'} de fora por não ter preço em todas as lojas.)` : ''

  // Melhor loja única
  const unicas = lojasComPrecos
    .map((l) => ({ loja: l, total: soma(comparaveis.map((i) => precos[i][l.id])) }))
    .sort((a, b) => a.total - b.total)
  const melhor = unicas[0]

  // Melhor par de lojas: cada produto na mais barata das duas
  let melhorPar = null
  for (let a = 0; a < lojasComPrecos.length; a++) {
    for (let b = a + 1; b < lojasComPrecos.length; b++) {
      const [la, lb] = [lojasComPrecos[a], lojasComPrecos[b]]
      const total = soma(comparaveis.map((i) => Math.min(precos[i][la.id], precos[i][lb.id])))
      if (!melhorPar || total < melhorPar.total) {
        const naA = comparaveis.filter((i) => precos[i][la.id] <= precos[i][lb.id])
        melhorPar = { lojas: [la, lb], total, naA, naB: comparaveis.filter((i) => !naA.includes(i)) }
      }
    }
  }

  const poupanca = melhor.total - melhorPar.total
  if (poupanca >= POUPANCA_MINIMA_PARA_DIVIDIR && melhorPar.naB.length > 0 && melhorPar.naA.length > 0) {
    const [la, lb] = melhorPar.lojas
    return {
      tipo: 'dividir',
      texto: `Compensa dividir: ${la.nome} (${produtos(melhorPar.naA.length)}) + ${lb.nome} (${produtos(melhorPar.naB.length)}) custa ${euro(melhorPar.total)}, menos ${euro(poupanca)} do que ir só ao ${melhor.loja.nome}.${notaDeFora}`,
    }
  }
  return {
    tipo: 'uma',
    texto: `Compensa ir só ao ${melhor.loja.nome}: ${euro(melhor.total)}. Dividir por duas lojas pouparia apenas ${euro(Math.max(0, poupanca))}.${notaDeFora}`,
  }
}

// Ordena as lojas da mais barata para a mais cara (para a tabela: a mais barata fica à esquerda).
// Usa a mesma regra justa da sugestão: só conta os produtos com preço em todas as lojas que têm preços.
// Lojas sem nenhum preço ficam no fim, pela ordem original.
export function ordenarLojas(itens, precos, lojas) {
  const temPreco = (item, loja) => typeof precos[item]?.[loja.id] === 'number'
  const comPrecos = lojas.filter((l) => itens.some((i) => temPreco(i, l)))
  const semPrecos = lojas.filter((l) => !comPrecos.includes(l))

  const comparaveis = itens.filter((i) => comPrecos.every((l) => temPreco(i, l)))
  if (comPrecos.length < 2 || comparaveis.length === 0) return [...comPrecos, ...semPrecos]

  const total = (l) => soma(comparaveis.map((i) => precos[i][l.id]))
  // sort é estável: em caso de empate mantém-se a ordem original
  return [...[...comPrecos].sort((a, b) => total(a) - total(b)), ...semPrecos]
}
