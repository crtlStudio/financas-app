// Função serverless do Vercel: GET /api/precos?loja=continente&produto=<referência>
// Vai buscar o preço ao site da loja (o browser não pode, por causa do CORS).
import { precoContinente } from './_lib/continente.js'
import { precoPingoDoce } from './_lib/pingodoce.js'
import { precoAuchan } from './_lib/auchan.js'

// Que função lê os preços de cada loja
const LEITORES = {
  continente: precoContinente,
  pingodoce: precoPingoDoce,
  auchan: precoAuchan,
}

// Preços online parciais: mostramos "sem dados" em vez de inventar
const LOJAS_SEM_DADOS = ['lidl', 'mercadona']

export default async function handler(req, res) {
  const loja = String(req.query.loja ?? '').toLowerCase()
  const produto = String(req.query.produto ?? '')

  try {
    if (req.method !== 'GET') {
      res.status(405).json({ erro: 'Só aceito pedidos GET.' })
      return
    }
    if (LOJAS_SEM_DADOS.includes(loja)) {
      res.status(404).json({ erro: 'Sem dados online para esta loja.' })
      return
    }
    const leitor = LEITORES[loja]
    if (!leitor) {
      res.status(501).json({ erro: 'Esta loja ainda não está disponível.' })
      return
    }

    const dados = await leitor(produto)
    // A CDN do Vercel guarda a resposta 6 horas: o site da loja só é visitado poucas vezes por dia
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=43200')
    res.status(200).json(dados)
  } catch (e) {
    // Os erros ficam 10 minutos em cache, para não insistir com o site se ele estiver em baixo
    res.setHeader('Cache-Control', 'public, s-maxage=600')
    res.status(e.estado ?? 502).json({ erro: e.estado ? e.message : 'Erro inesperado ao obter o preço.' })
  }
}
