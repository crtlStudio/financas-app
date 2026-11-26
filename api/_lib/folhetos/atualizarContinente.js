// Atualização semanal do Continente. Sem IA: as promoções saem só com regras (custo zero).
//  1. Folheto do iPaper (mais produtos): a lista está em www.continente.pt, que às vezes recusa
//     pedidos vindos do Vercel (Cloudflare, erro 403).
//  2. Se falhar: o folheto digital de feed.continente.pt (menos produtos, mas sem bloqueio).
import { folhetoSemanalContinente, promocoesDoFolhetoContinente } from './continente.js'
import { folhetoSemanalFeedContinente, promocoesDoFeedContinente } from './continenteFeed.js'
import { atualizarLoja } from './atualizarLoja.js'

async function doIpaper(hoje) {
  const folheto = await folhetoSemanalContinente(hoje)
  const promocoes = await promocoesDoFolhetoContinente(folheto)
  if (promocoes.length === 0) throw new Error('o folheto do iPaper não tinha promoções que eu conseguisse ler')
  return { folhetos: [{ ...folheto, numPromocoes: promocoes.length }], promocoes }
}

async function doFeed(hoje) {
  const { folheto, html } = await folhetoSemanalFeedContinente(hoje)
  const promocoes = promocoesDoFeedContinente(html, folheto)
  return { folhetos: [{ ...folheto, numPromocoes: promocoes.length }], promocoes }
}

export function atualizarContinente(hoje = new Date()) {
  return atualizarLoja('continente', async () => {
    try {
      return await doIpaper(hoje)
    } catch (e) {
      console.warn(`Continente: iPaper falhou (${e.message}); vou usar o folheto de feed.continente.pt`)
      try {
        return await doFeed(hoje)
      } catch (e2) {
        throw new Error(`${e.message} E o folheto de feed.continente.pt também falhou: ${e2.message}`)
      }
    }
  })
}
