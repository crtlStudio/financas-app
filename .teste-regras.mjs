import fs from 'node:fs'
import { textoDasPaginas } from './api/_lib/folhetos/lidl.js'
import { promocoesDaPagina } from './api/_lib/folhetos/regrasLidl.js'
const folheto = { validoDe: '2026-11-23', validoAte: '2026-11-29' }
const paginas = await textoDasPaginas(new Uint8Array(fs.readFileSync(process.argv[2])))
let codigos = 0, grandes = 0, total = 0
const semPreco = [], precosSoltos = []
for (const p of paginas) {
  const proms = promocoesDaPagina(p, folheto)
  total += proms.length
  const cods = p.pedacos.filter((x) => /^n[º°o]\s*\d{3,}$/i.test(x.texto)); codigos += cods.length
  const gr = p.pedacos.filter((x) => /^\d+[.,]\d{2}$/.test(x.texto) && x.tamanho >= 25); grandes += gr.length
  const usados = new Set(proms.map((x) => x.codigo))
  for (const c of cods) if (!usados.has(c.texto.match(/\d+/)[0])) semPreco.push(`p${p.pagina}:${c.texto}@${c.x},${c.y}`)
  const precosUsados = proms.flatMap((x) => [x.preco, x.precoSemLidlPlus]).filter((v) => v != null)
  for (const g of gr) { const i = precosUsados.indexOf(Number(g.texto.replace(',', '.'))); if (i >= 0) precosUsados.splice(i, 1); else precosSoltos.push(`p${p.pagina}:${g.texto}@${g.x},${g.y}`) }
  if ([9, 22, 25].includes(p.pagina)) { console.log(`=== página ${p.pagina}`); for (const x of proms) console.log(`  ${x.marca ? x.marca + ' · ' : ''}${x.produto} | ${x.tamanho ?? '-'} | ${x.preco} | antes ${x.precoAntigo ?? '-'} | ${x.desconto ?? ''} | ${x.precoPorKgL ?? '-'} | s/app ${x.precoSemLidlPlus ?? "-"} | ${x.condicao ?? ''} | nº${x.codigo}`) }
}
console.log(`\nTOTAL: ${total} promoções | códigos na página: ${codigos} | preços grandes: ${grandes}`)
console.log(`códigos sem preço (${semPreco.length}):`, semPreco.slice(0, 15).join('  '))
console.log(`preços grandes sem produto (${precosSoltos.length}):`, precosSoltos.slice(0, 15).join('  '))
