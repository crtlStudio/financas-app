// Gráfico circular (tipo donut) com legenda ao lado, dentro de um painel
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { corDaPosicao, juntarPequenas } from '../lib/cores'
import { percentagem } from '../lib/formatos'
import styles from './GraficoPizza.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

// Caixa do tooltip com as cores do tema (claro ou escuro)
const estiloTooltip = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  boxShadow: 'var(--shadow)',
}

export default function GraficoPizza({ titulo, linhas }) {
  // Sem movimentos no período não há nada para desenhar (evita um gráfico vazio)
  if (linhas.length === 0) return null

  const dados = juntarPequenas(linhas)
  const total = dados.reduce((s, l) => s + l.total, 0)

  return (
    <section className={styles.caixa}>
      <div className={styles.cabecalho}>
        <h2>{titulo}</h2>
        <span className={styles.total}>{euro(total)}</span>
      </div>
      <div className={styles.conteudo}>
        <div className={styles.grafico}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={dados}
                dataKey="total"
                nameKey="nome"
                innerRadius="58%"
                outerRadius="90%"
                paddingAngle={1}
                strokeWidth={2}
              >
                {dados.map((_, i) => (
                  <Cell key={i} fill={corDaPosicao(i)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => euro(v)}
                contentStyle={estiloTooltip}
                itemStyle={{ color: 'var(--text-h)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className={styles.legenda}>
          {dados.map((l, i) => (
            <li key={l.nome}>
              <span className={styles.cor} style={{ background: corDaPosicao(i) }} />
              {l.nome}
              <span className={styles.percentagem}>{percentagem(l.total, total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
