// Comparação entre períodos mensais: tabela (categorias × períodos) e barras horizontais
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { gastosPorCategoria, totaisDoPeriodo, periodosParaMedia } from '../lib/periodos'
import styles from './ComparacaoPeriodos.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const euroCurto = (v) => v.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + ' €'

// Cor de cada período no gráfico: o mais antigo mais claro, o mais recente mais forte
const corDoPeriodo = (i, total) => {
  const opacidade = total === 1 ? 1 : 0.3 + (0.7 * i) / (total - 1)
  return `rgba(42, 120, 214, ${opacidade.toFixed(2)})`
}

export default function ComparacaoPeriodos({ periodos, diaCorte, mudarDiaCorte }) {
  if (periodos.length === 0) return null

  const categorias = gastosPorCategoria(periodos)
  const totais = periodos.map(totaisDoPeriodo)
  const nMedia = periodosParaMedia(periodos).length
  const mediaDe = (campo) =>
    periodos.reduce((s, p, i) => (periodosParaMedia(periodos).includes(p) ? s + totais[i][campo] : s), 0) / nMedia

  // Dados do gráfico: 7 maiores categorias, uma barra por período
  const dadosGrafico = categorias.slice(0, 7).map((c) => {
    const linha = { nome: c.nome }
    c.valores.forEach((v, i) => (linha[`p${i}`] = Math.round(v * 100) / 100))
    return linha
  })
  const alturaGrafico = 60 + dadosGrafico.length * (16 + periodos.length * 10)

  const comAvisos = periodos.filter((p) => p.avisos.length > 0)

  return (
    <section className={styles.painel}>
      <div className={styles.cabecalho}>
        <div>
          <h2>Comparação entre períodos</h2>
          <p className={styles.ajuda}>
            Extrato completo, dividido de dia {diaCorte} a dia {diaCorte - 1 || 'fim do mês'}. Sem
            movimentos entre contas tuas.
          </p>
        </div>
        <label className={styles.campoCorte}>
          Dia de corte
          <input
            type="number"
            min="1"
            max="28"
            value={diaCorte}
            onChange={(e) => mudarDiaCorte(e.target.value)}
          />
        </label>
      </div>

      {comAvisos.map((p) => (
        <p key={p.nome} className={styles.aviso}>
          <strong>{p.nome}:</strong> {p.avisos.join(' ')} Não entra nas médias.
        </p>
      ))}

      <div className={styles.tabelaScroll}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Categoria</th>
              {periodos.map((p) => (
                <th key={p.nome} className={p.completo ? '' : styles.incompleto}>
                  {p.nome}
                  {!p.completo && ' *'}
                </th>
              ))}
              <th className={styles.colMedia}>Média</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.nome}>
                <td>{c.nome}</td>
                {c.valores.map((v, i) => (
                  <td key={i} className={periodos[i].completo ? '' : styles.incompleto}>
                    {v > 0 ? euro(v) : '—'}
                  </td>
                ))}
                <td className={styles.colMedia}>{euro(c.media)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <LinhaTotal nome="Saídas" valores={totais.map((t) => t.saidas)} media={mediaDe('saidas')} periodos={periodos} />
            <LinhaTotal nome="Entradas" valores={totais.map((t) => t.entradas)} media={mediaDe('entradas')} periodos={periodos} />
            <LinhaTotal
              nome="Resultado"
              valores={totais.map((t) => t.resultado)}
              media={mediaDe('resultado')}
              periodos={periodos}
              comCor
            />
          </tfoot>
        </table>
      </div>

      <h3 className={styles.subtitulo}>7 maiores categorias por período</h3>
      <ResponsiveContainer width="100%" height={alturaGrafico}>
        <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickFormatter={euroCurto} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
          <YAxis
            type="category"
            dataKey="nome"
            width={150}
            tick={{ fontSize: 12, fill: 'var(--text-h)' }}
          />
          <Tooltip
            formatter={(v) => euro(v)}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
            cursor={{ fill: 'var(--surface-2)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {periodos.map((p, i) => (
            <Bar
              key={p.nome}
              dataKey={`p${i}`}
              name={p.completo ? p.nome : `${p.nome} *`}
              fill={corDoPeriodo(i, periodos.length)}
              radius={[0, 3, 3, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </section>
  )
}

function LinhaTotal({ nome, valores, media, periodos, comCor }) {
  const cor = (v) => (comCor ? (v >= 0 ? styles.positivo : styles.negativo) : '')
  return (
    <tr className={styles.linhaTotal}>
      <td>{nome}</td>
      {valores.map((v, i) => (
        <td key={i} className={`${cor(v)} ${periodos[i].completo ? '' : styles.incompleto}`}>
          {euro(v)}
        </td>
      ))}
      <td className={`${styles.colMedia} ${cor(media)}`}>{euro(media)}</td>
    </tr>
  )
}
