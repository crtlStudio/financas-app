// Atualização semanal do Continente: descobre o folheto semanal e lê os dados do iPaper.
// Sem IA: as promoções saem do texto das páginas com as regras de regrasContinente.js (custo zero).
import { folhetoSemanalContinente, promocoesDoFolhetoContinente } from './continente.js'
import { atualizarLoja } from './atualizarLoja.js'

export function atualizarContinente(hoje = new Date()) {
  return atualizarLoja('continente', async () => {
    const folheto = await folhetoSemanalContinente(hoje)
    const promocoes = await promocoesDoFolhetoContinente(folheto)
    return { folhetos: [{ ...folheto, numPromocoes: promocoes.length }], promocoes }
  })
}
