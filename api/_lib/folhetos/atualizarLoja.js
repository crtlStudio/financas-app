// Parte comum da atualização semanal de cada loja: guardar o resultado ou, se falhar, o aviso.
import { guardarJson, lerJson } from '../armazem.js'

// obter() devolve { folhetos: [{ nome, validoDe, validoAte, link, ... }], promocoes: [...] }
export async function atualizarLoja(loja, obter) {
  const atualizadoEm = new Date().toISOString()
  try {
    const { folhetos, promocoes } = await obter()
    if (promocoes.length === 0) throw new Error('o folheto foi lido, mas não encontrei nenhuma promoção (o formato pode ter mudado)')

    const dados = { loja, estado: 'ok', atualizadoEm, folhetos, promocoes }
    await guardarJson(`folhetos/${loja}/${folhetos[0].validoDe ?? atualizadoEm.slice(0, 10)}.json`, dados) // histórico
    await guardarJson(`folhetos/${loja}/atual.json`, dados)
    return { loja, estado: 'ok', folhetos: folhetos.length, promocoes: promocoes.length }
  } catch (e) {
    // A app mostra "folheto indisponível"; as promoções anteriores ficam (a app esconde as expiradas)
    const anterior = await lerJson(`folhetos/${loja}/atual.json`)
    await guardarJson(`folhetos/${loja}/atual.json`, {
      loja,
      estado: 'indisponivel',
      erro: e.message,
      atualizadoEm,
      folhetos: anterior?.folhetos ?? [],
      promocoes: anterior?.promocoes ?? [],
    })
    return { loja, estado: 'indisponivel', erro: e.message }
  }
}
