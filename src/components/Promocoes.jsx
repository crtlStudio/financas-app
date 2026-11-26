// Ecrã "Promoções da semana": as promoções dos folhetos de todas as lojas, com filtro e pesquisa
import { useEffect, useMemo, useState } from 'react'
import { carregarPromocoes, promocaoValida, promocaoFutura } from '../lib/promocoes'
import { palavrasDe } from '../lib/procurarProduto'
import styles from './Promocoes.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const diaMes = (iso) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
const quando = (iso) => new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function Promocoes() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [loja, setLoja] = useState('todas')
  const [pesquisa, setPesquisa] = useState('')

  useEffect(() => {
    carregarPromocoes()
      .then(setDados)
      .catch((e) => setErro(e.message))
  }, [])

  // Só as promoções em vigor ou que ainda vão começar, filtradas pela loja e pela pesquisa
  const lista = useMemo(() => {
    if (!dados) return []
    const termos = palavrasDe(pesquisa)
    return dados.promocoes
      .filter((p) => promocaoValida(p) || promocaoFutura(p))
      .filter((p) => loja === 'todas' || p.loja === loja)
      .filter((p) => {
        if (termos.length === 0) return true
        const palavras = palavrasDe(`${p.marca ?? ''} ${p.produto}`)
        return termos.every((t) => palavras.some((w) => w.startsWith(t.length >= 4 && t.endsWith('s') ? t.slice(0, -1) : t)))
      })
  }, [dados, loja, pesquisa])

  if (erro) return <p className={styles.erro}>{erro}</p>
  if (!dados) return <p className={styles.ajuda}>A carregar as promoções…</p>

  const nomeLoja = Object.fromEntries(dados.lojas.map((l) => [l.id, l.nome]))
  const lojasComPromocoes = dados.lojas.filter((l) => dados.promocoes.some((p) => p.loja === l.id))

  return (
    <section className={styles.painel}>
      <div className={styles.cabecalho}>
        <div>
          <h2>Promoções da semana</h2>
          <p className={styles.ajuda}>Lidas dos folhetos das lojas. Cada preço indica o folheto e a página de onde vem.</p>
        </div>
        <span className={styles.contagem}>{lista.length} promoções</span>
      </div>

      {/* Estado de cada loja: folheto lido, indisponível ou sem folheto */}
      <ul className={styles.estados}>
        {dados.lojas.map((l) => (
          <li key={l.id} className={l.estado === 'ok' ? styles.estadoOk : styles.estadoOutro}>
            <strong>{l.nome}</strong>
            {l.estado === 'ok'
              ? ` · ${l.folhetos.map((f) => `${f.nome}: ${diaMes(f.validoDe)} a ${diaMes(f.validoAte)}`).join(' · ')} · lido a ${quando(l.atualizadoEm)}`
              : ` · ${l.mensagem}`}
          </li>
        ))}
      </ul>

      <div className={styles.filtros}>
        <div className={styles.chips}>
          <button className={loja === 'todas' ? styles.chipAtivo : styles.chip} onClick={() => setLoja('todas')}>
            Todas
          </button>
          {lojasComPromocoes.map((l) => (
            <button key={l.id} className={loja === l.id ? styles.chipAtivo : styles.chip} onClick={() => setLoja(l.id)}>
              {l.nome}
            </button>
          ))}
        </div>
        <input
          className={styles.pesquisa}
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Pesquisar (ex.: azeite, leite, frango)"
        />
      </div>

      {lista.length === 0 ? (
        <p className={styles.ajuda}>Nenhuma promoção encontrada.</p>
      ) : (
        <div className={styles.grelha}>
          {lista.map((p, i) => (
            <article key={`${p.loja}-${p.codigo}-${p.pagina}-${i}`} className={styles.cartao}>
              <div className={styles.topo}>
                <span className={styles.loja}>{nomeLoja[p.loja] ?? p.loja}</span>
                {p.desconto && <span className={styles.desconto}>{p.desconto}</span>}
              </div>
              {p.marca && <span className={styles.marca}>{p.marca}</span>}
              <h3>{p.produto}</h3>
              <span className={styles.detalhe}>
                {[p.tamanho, p.precoPorKgL].filter(Boolean).join(' · ')}
              </span>
              <div className={styles.precos}>
                <strong>{euro(p.preco)}</strong>
                {p.precoAntigo && <s>{euro(p.precoAntigo)}</s>}
              </div>
              {p.condicao && <span className={styles.condicao}>{p.condicao}</span>}
              <span className={promocaoFutura(p) ? styles.futura : styles.validade}>
                {promocaoFutura(p)
                  ? `Começa a ${diaMes(p.validoDe)}`
                  : // Com preço antigo é uma promoção; sem ele, é o preço anunciado no folheto
                    `${p.precoAntigo ? 'Promoção' : 'Preço do folheto'} até ${diaMes(p.validoAte)}`}
              </span>
              <a className={styles.fonte} href={p.link} target="_blank" rel="noreferrer" title={p.fonte}>
                {p.fonte} ↗
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
