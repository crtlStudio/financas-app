// Promoções dos folhetos: carregar, ver se estão válidas e encontrar a promoção de um produto da lista
import { palavrasDe } from './procurarProduto'

let pedido = null // as promoções só mudam uma vez por semana: carregamos uma vez por sessão

export function carregarPromocoes() {
  if (!pedido) {
    pedido = fetch('/api/promocoes')
      .then((r) => {
        if (!r.ok) throw new Error(`Erro ${r.status} ao carregar as promoções.`)
        return r.json()
      })
      .catch((e) => {
        pedido = null // para tentar outra vez da próxima
        throw e
      })
  }
  return pedido
}

// "2026-11-29" -> fim do dia 29/11 (hora local)
const dataLocal = (iso, fimDoDia) => {
  const [a, m, d] = iso.split('-').map(Number)
  return fimDoDia ? new Date(a, m - 1, d, 23, 59, 59) : new Date(a, m - 1, d)
}

// A promoção está em vigor nesta data?
export function promocaoValida(promocao, hoje = new Date()) {
  if (promocao.validoDe && hoje < dataLocal(promocao.validoDe, false)) return false
  if (promocao.validoAte && hoje > dataLocal(promocao.validoAte, true)) return false
  return true
}

// Ainda vai começar (ex.: promoções de fim de semana vistas à segunda)?
export const promocaoFutura = (promocao, hoje = new Date()) =>
  Boolean(promocao.validoDe) && hoje < dataLocal(promocao.validoDe, false)

// "Leite 1L", "Emb. 750 ml", "6 x 1 L" -> { quantidade: 1, unidade: 'L' }
export function lerTamanho(texto) {
  const m = (texto ?? '').toLowerCase().match(/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|gr|g|lt|l|ml|cl|un|unid)\b/)
  if (!m) return null
  const valor = Number(m[2].replace(',', '.')) * (m[1] ? Number(m[1]) : 1)
  const [fator, unidade] = { kg: [1, 'kg'], gr: [0.001, 'kg'], g: [0.001, 'kg'], lt: [1, 'L'], l: [1, 'L'], ml: [0.001, 'L'], cl: [0.01, 'L'], un: [1, 'un'], unid: [1, 'un'] }[m[3]]
  return { quantidade: valor * fator, unidade }
}

// Uma palavra da lista aparece nas palavras da promoção? (aceita singular/plural e início de palavra)
function temPalavra(palavras, termo) {
  const singular = termo.length >= 4 && termo.endsWith('s') ? termo.slice(0, -1) : termo
  return palavras.some((w) => w === termo || w === singular || (singular.length >= 4 && w.startsWith(singular)) || (w.length >= 4 && singular.startsWith(w)))
}

// Encontra a melhor promoção (de uma loja) para um produto da lista.
// Ex.: "leite meio-gordo 1L" encontra "Leite Meio-Gordo Mimosa 1 L".
// Todas as palavras do produto da lista têm de aparecer na promoção.
export function procurarPromocao(item, promocoes, loja, hoje = new Date()) {
  const termos = palavrasDe(item)
  if (termos.length === 0) return null
  const tamanhoItem = lerTamanho(item)

  let melhor = null
  for (const p of promocoes) {
    if (p.loja !== loja || !promocaoValida(p, hoje)) continue
    const palavras = palavrasDe(`${p.marca ?? ''} ${p.produto}`)
    if (!termos.every((t) => temPalavra(palavras, t))) continue
    // O nome tem de começar pelo produto: "bananas" encontra "Banana da Madeira",
    // mas não "Chips de Banana" nem "Proteína Vegan Banana/Chocolate".
    // (Mais vale não mostrar nada do que mostrar o produto errado.)
    if (!temPalavra(palavrasDe(p.produto).slice(0, 1), termos[0])) continue

    // Se a lista diz o tamanho ("1L") e a promoção é de outro (pack de 6 x 1 L), não conta:
    // comparar preços de quantidades diferentes daria uma conclusão errada
    const tamanhoPromo = lerTamanho(p.tamanho)
    if (tamanhoItem && tamanhoPromo) {
      const igual = tamanhoItem.unidade === tamanhoPromo.unidade && Math.abs(tamanhoItem.quantidade - tamanhoPromo.quantidade) < 0.001
      if (!igual) continue
    }
    // Preferir nomes parecidos (poucas palavras a mais)
    const pontos = 100 - (palavras.length - termos.length) * 5
    if (!melhor || pontos > melhor.pontos) melhor = { promocao: p, pontos }
  }
  return melhor?.promocao ?? null
}

// Preço que conta para comparar lojas: o que qualquer pessoa paga (sem a app Lidl Plus)
export const precoParaComparar = (promocao) => promocao.precoSemLidlPlus ?? promocao.preco
