// Tarefa semanal (Vercel Cron): GET /api/folhetos/atualizar
// Lê os folhetos de cada loja e guarda as promoções. Uma loja que falhe não impede as outras.
//
// Segurança: o Vercel Cron envia "Authorization: Bearer <CRON_SECRET>".
// Em produção, sem esse segredo certo, o pedido é recusado (assim ninguém pode pôr a app
// a descarregar folhetos vezes sem conta).
import { atualizarLidl } from '../_lib/folhetos/atualizarLidl.js'
import { atualizarContinente } from '../_lib/folhetos/atualizarContinente.js'
import { atualizarPingoDoce } from '../_lib/folhetos/atualizarPingoDoce.js'
import { atualizarAuchan } from '../_lib/folhetos/atualizarAuchan.js'

// Lojas com folheto tratado
const ATUALIZADORES = [atualizarLidl, atualizarContinente, atualizarPingoDoce, atualizarAuchan]

export default async function handler(req, res) {
  // O Vercel Cron usa GET; qualquer outro pedido é recusado logo (não descarrega nada)
  if (req.method !== 'GET') {
    res.status(405).json({ erro: 'Só aceito pedidos GET.' })
    return
  }
  const segredo = process.env.CRON_SECRET
  const emProducao = process.env.VERCEL_ENV === 'production'
  if (emProducao && !segredo) {
    res.status(500).json({ erro: 'Falta configurar a variável CRON_SECRET no Vercel.' })
    return
  }
  if (segredo && req.headers.authorization !== `Bearer ${segredo}`) {
    res.status(401).json({ erro: 'Não autorizado.' })
    return
  }

  const resultados = []
  for (const atualizar of ATUALIZADORES) {
    resultados.push(await atualizar()) // cada atualizador apanha os próprios erros
  }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ atualizadoEm: new Date().toISOString(), resultados })
}
