// Os 4 cartões do topo: entradas, saídas, resultado do extrato e resultado real
import styles from './Resumo.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const comSinal = (v) => (v > 0 ? '+' : '') + euro(v)

export default function Resumo({ entradas, saidas, entradasReais, saidasReais }) {
  const resultado = entradas - saidas
  const resultadoReal = entradasReais - saidasReais

  return (
    <div className={styles.grelha}>
      <Cartao titulo="Entradas" valor={euro(entradas)} detalhe={`${euro(entradasReais)} sem internas`} />
      <Cartao titulo="Saídas" valor={euro(saidas)} detalhe={`${euro(saidasReais)} sem internas`} />
      <Cartao
        titulo="Resultado (extrato)"
        valor={comSinal(resultado)}
        positivo={resultado >= 0}
        detalhe="Entradas − saídas"
      />
      <Cartao
        titulo="Resultado real"
        valor={comSinal(resultadoReal)}
        positivo={resultadoReal >= 0}
        detalhe="Sem poupança, resgates e transf. da app CGD"
      />
    </div>
  )
}

function Cartao({ titulo, valor, positivo, detalhe }) {
  // positivo: true = verde, false = vermelho, undefined = neutro
  let cor = styles.neutro
  if (positivo === true) cor = styles.positivo
  if (positivo === false) cor = styles.negativo

  return (
    <div className={`${styles.cartao} ${cor}`}>
      <span className={styles.titulo}>{titulo}</span>
      <strong className={styles.valor}>{valor}</strong>
      {detalhe && <span className={styles.detalhe}>{detalhe}</span>}
    </div>
  )
}
