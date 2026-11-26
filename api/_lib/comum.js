// Funções partilhadas pelos leitores de preços das lojas

export const AGENTE = 'financas-app/1.0 (uso pessoal; precos de lista de compras)'

// Referências do tipo "leite-meio-gordo-continente-8912985" (nome + número do produto).
// Só aceitamos isto, para ninguém conseguir usar a função para pedir outras páginas.
const PRODUTO_VALIDO = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d+)$/

// "leite-uht-agros-39020" -> { slug: "leite-uht-agros", id: "39020" }
export function partirReferencia(produto) {
  const m = PRODUTO_VALIDO.exec(produto)
  if (!m) throw erro('Referência de produto inválida.', 400)
  return { slug: m[1], id: m[2] }
}

export function erro(mensagem, estado) {
  const e = new Error(mensagem)
  e.estado = estado
  return e
}

// Pede uma página da loja e devolve { html, url } (url final, depois de redirecionamentos)
export async function obterPagina(url, nomeLoja) {
  let resposta
  try {
    resposta = await fetch(url, {
      headers: { 'User-Agent': AGENTE, 'Accept-Language': 'pt-PT' },
      signal: AbortSignal.timeout(12000),
    })
  } catch {
    throw erro(`O site do ${nomeLoja} não respondeu.`, 504)
  }
  if (resposta.status === 404 || resposta.status === 410) {
    throw erro('Este produto já não existe no site. Escolhe outro.', 404)
  }
  if (!resposta.ok) throw erro(`O site do ${nomeLoja} respondeu com erro ${resposta.status}.`, 502)
  return { html: await resposta.text(), url: resposta.url }
}

// "12,99" ou "1.097,38" -> número
export const paraNumero = (texto) => Number(texto.replace(/\./g, '').replace(',', '.'))

// Troca as entidades HTML mais comuns (&ccedil;, &atilde;, &amp;...) pelos caracteres
export const decodificar = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, '€')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&([aeiouAEIOU])(acute|grave|circ|tilde);/g, (_, l, a) => l + { acute: '́', grave: '̀', circ: '̂', tilde: '̃' }[a])
    .normalize('NFC')
    .trim()

// "emb. 750 ml" -> { quantidade: 0.75, unidade: 'L', texto: '750 ml' }; aceita também "6 x 1 lt"
export function lerTamanho(texto) {
  const m = texto.toLowerCase().match(/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|gr|g|lt|l|ml|cl|un)\b/)
  if (!m) return null
  const vezes = m[1] ? Number(m[1]) : 1
  const valor = Number(m[2].replace(',', '.')) * vezes
  const conversao = { kg: [1, 'kg'], gr: [0.001, 'kg'], g: [0.001, 'kg'], lt: [1, 'L'], l: [1, 'L'], ml: [0.001, 'L'], cl: [0.01, 'L'], un: [1, 'un'] }
  const [fator, unidade] = conversao[m[3]]
  return { quantidade: valor * fator, unidade, texto: m[0] }
}

// Unidades como as lojas as escrevem -> como as mostramos
export const UNIDADES = { lt: 'L', l: 'L', kg: 'kg', un: 'un', uni: 'un', dz: 'dz' }

// Preço por unidade calculado a partir do tamanho (quando a loja não o mostra)
export function calcularPorUnidade(preco, tamanhoTexto) {
  const t = tamanhoTexto ? lerTamanho(tamanhoTexto) : null
  if (!t || !(t.quantidade > 0)) return null
  return { valor: Math.round((preco / t.quantidade) * 100) / 100, unidade: t.unidade }
}

// "30/11" -> "2026-11-30" (o ano é o da próxima vez que essa data acontece)
export function dataDoDiaMes(texto) {
  const m = texto.match(/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const hoje = new Date()
  let data = new Date(hoje.getFullYear(), Number(m[2]) - 1, Number(m[1]))
  // Se a data já passou há mais de uma semana, é do ano seguinte (ex.: em dezembro, "até 05/01")
  if (data < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7)) {
    data = new Date(hoje.getFullYear() + 1, Number(m[2]) - 1, Number(m[1]))
  }
  const dd = String(data.getDate()).padStart(2, '0')
  const mm = String(data.getMonth() + 1).padStart(2, '0')
  return `${data.getFullYear()}-${mm}-${dd}`
}
