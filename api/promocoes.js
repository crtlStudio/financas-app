// GET /api/promocoes: as promoções dos folhetos desta semana, de todas as lojas
import { lerJson } from './_lib/armazem.js'

// Estado de cada loja quanto a folhetos
const LOJAS = [
  { id: 'lidl', nome: 'Lidl', tratada: true },
  { id: 'continente', nome: 'Continente', tratada: true },
  { id: 'pingodoce', nome: 'Pingo Doce', tratada: true },
  { id: 'auchan', nome: 'Auchan', tratada: true },
]

export default async function handler(req, res) {
  const lojas = []
  const promocoes = []

  for (const loja of LOJAS) {
    if (!loja.tratada) {
      lojas.push({ id: loja.id, nome: loja.nome, estado: 'sem folheto', mensagem: loja.mensagem })
      continue
    }
    const dados = await lerJson(`folhetos/${loja.id}/atual.json`)
    if (!dados) {
      lojas.push({ id: loja.id, nome: loja.nome, estado: 'indisponivel', mensagem: 'Folheto indisponível: ainda não foi lido nenhum.' })
      continue
    }
    lojas.push({
      id: loja.id,
      nome: loja.nome,
      estado: dados.estado,
      mensagem: dados.estado === 'ok' ? null : `Folheto indisponível (${dados.erro ?? 'erro desconhecido'}).`,
      atualizadoEm: dados.atualizadoEm,
      folhetos: dados.folhetos,
    })
    promocoes.push(...dados.promocoes)
  }

  // Muda no máximo uma vez por semana: a CDN pode guardar a resposta 1 hora
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).json({ lojas, promocoes })
}
