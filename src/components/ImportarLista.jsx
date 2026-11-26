// Ecrã "Importar lista": escrever/colar a lista ou abrir um .txt
import { useState } from 'react'
import { limparLista } from '../lib/listaCompras'
import styles from './ListaCompras.module.css'

export default function ImportarLista({ lista, guardarLista, irParaComparacao }) {
  // Começa com a lista já guardada, para poderes editá-la
  const [texto, setTexto] = useState(lista.join('\n'))
  const [erro, setErro] = useState('')

  const produtos = limparLista(texto)

  async function aoAbrirFicheiro(evento) {
    const ficheiro = evento.target.files[0]
    evento.target.value = '' // para poderes abrir o mesmo ficheiro outra vez
    if (!ficheiro) return
    try {
      setTexto(await ficheiro.text())
      setErro('')
    } catch {
      setErro('Não consegui ler o ficheiro.')
    }
  }

  return (
    <section className={styles.painel}>
      <div className={styles.cabecalho}>
        <div>
          <h2>Importar lista de compras</h2>
          <p className={styles.ajuda}>
            Um produto por linha. Marcadores como "- " ou "1. " são retirados.
          </p>
        </div>
        <label className={styles.botaoSecundario}>
          Abrir ficheiro .txt
          <input type="file" accept=".txt,text/plain" onChange={aoAbrirFicheiro} hidden />
        </label>
      </div>

      <textarea
        className={styles.caixaTexto}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={'- Leite meio-gordo\n- Pão de forma\n- Ovos (12)\n- Bananas'}
        rows={12}
      />

      {erro && <p className={styles.erro}>{erro}</p>}

      <div className={styles.rodape}>
        <span className={styles.ajuda}>{produtos.length} produtos</span>
        <button
          className={styles.botaoPrincipal}
          onClick={() => {
            guardarLista(produtos)
            irParaComparacao()
          }}
          disabled={produtos.length === 0}
        >
          Guardar e comparar
        </button>
      </div>
    </section>
  )
}
