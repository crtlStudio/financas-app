// Secção "Onde poupar": um cartão por sugestão, com o gasto mensal e a poupança estimada
import { sugestoesDePoupanca } from '../lib/sugestoes'
import { periodosParaMedia } from '../lib/periodos'
import styles from './OndePoupar.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

export default function OndePoupar({ periodos }) {
  if (periodos.length === 0) return null

  const sugestoes = sugestoesDePoupanca(periodos)
  const totalPoupanca = sugestoes.reduce((s, x) => s + x.poupancaMensal, 0)
  const nPeriodos = periodosParaMedia(periodos).length

  return (
    <section className={styles.painel}>
      <div className={styles.cabecalho}>
        <div>
          <h2>Onde poupar</h2>
          <p className={styles.ajuda}>
            Médias de {nPeriodos} {nPeriodos === 1 ? 'período' : 'períodos'}. As poupanças são estimativas.
          </p>
        </div>
        {sugestoes.length > 0 && (
          <div className={styles.total}>
            <span>Poupança possível</span>
            <strong>até {euro(totalPoupanca)}/mês</strong>
          </div>
        )}
      </div>

      {sugestoes.length === 0 ? (
        <p className={styles.vazio}>Não encontrei gastos fora do normal neste extrato.</p>
      ) : (
        <div className={styles.grelha}>
          {sugestoes.map((s) => (
            <article key={s.titulo} className={styles.cartao}>
              <h3>{s.titulo}</h3>
              <p>{s.texto}</p>
              <div className={styles.numeros}>
                <span>
                  Gastas <strong>{euro(s.gastoMensal)}</strong>/mês
                </span>
                <span className={styles.poupanca}>Poupas ~{euro(s.poupancaMensal)}/mês</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
