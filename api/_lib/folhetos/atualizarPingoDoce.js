// Atualização semanal do Pingo Doce: descobre o folheto "Poupe Esta Semana" e lê os produtos do iPaper.
// Sem IA e sem custos.
import { folhetoSemanalPingoDoce, promocoesDoFolhetoPingoDoce } from './pingodoce.js'
import { atualizarLoja } from './atualizarLoja.js'

export function atualizarPingoDoce() {
  return atualizarLoja('pingodoce', async () => {
    const folheto = await folhetoSemanalPingoDoce()
    const promocoes = await promocoesDoFolhetoPingoDoce(folheto)
    return { folhetos: [{ ...folheto, numPromocoes: promocoes.length }], promocoes }
  })
}
