// Atualização semanal do Auchan: lê a categoria do folheto semanal no próprio site auchan.pt.
// Sem IA, sem chaves privadas e sem custos.
import { folhetoSemanalAuchan, promocoesDoFolhetoAuchan } from './auchan.js'
import { atualizarLoja } from './atualizarLoja.js'

export function atualizarAuchan(hoje = new Date()) {
  return atualizarLoja('auchan', async () => {
    const folheto = await folhetoSemanalAuchan(hoje)
    const promocoes = await promocoesDoFolhetoAuchan(folheto)
    return { folhetos: [{ ...folheto, numPromocoes: promocoes.length }], promocoes }
  })
}
