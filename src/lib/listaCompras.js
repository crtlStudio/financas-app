// Funções da lista de compras: limpar o texto e guardar no browser (localStorage)

const CHAVE = 'listaCompras'

// estado: 'ativo' = preços do site (e promoções do folheto, quando houver);
//         'folheto' = só promoções do folheto (a loja não tem preços online fiáveis);
//         'sem dados' = nem preços online nem folheto
export const LOJAS = [
  { id: 'continente', nome: 'Continente', estado: 'ativo' },
  { id: 'pingodoce', nome: 'Pingo Doce', estado: 'ativo' },
  { id: 'auchan', nome: 'Auchan', estado: 'ativo' },
  { id: 'lidl', nome: 'Lidl', estado: 'folheto' },
  { id: 'mercadona', nome: 'Mercadona', estado: 'sem dados' },
]

// Transforma o texto (um produto por linha) numa lista limpa.
// Tira marcadores como "- ", "* ", "• ", "1. " ou "1) " e linhas vazias.
export function limparLista(texto) {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((linha) => linha !== '')
}

// O localStorage pode falhar (janela privada, armazenamento cheio), daí o try/catch
export function carregarLista() {
  try {
    const guardado = localStorage.getItem(CHAVE)
    return guardado ? JSON.parse(guardado) : []
  } catch {
    return []
  }
}

export function guardarLista(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    // Se não der para guardar, a lista fica só em memória até fechares a página
  }
}
