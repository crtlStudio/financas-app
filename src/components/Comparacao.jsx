// Ecrã "Comparação": produtos nas linhas, lojas nas colunas, com preços reais
import { useCallback, useEffect, useRef, useState } from 'react'
import { LOJAS } from '../lib/listaCompras'
import { carregarAssociacoes, guardarAssociacoes, chaveDoItem, obterPreco, esquecerPreco } from '../lib/precos'
import { sugerirLojas, ordenarLojas } from '../lib/compararLojas'
import { carregarPromocoes, procurarPromocao, precoParaComparar } from '../lib/promocoes'
import EscolherProduto from './EscolherProduto'
import styles from './ListaCompras.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const diaMes = (iso) => new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
const horaDia = (iso) =>
  new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function Comparacao({ lista, irParaImportar }) {
  const [associacoes, setAssociacoes] = useState(carregarAssociacoes)
  // resultados = { "continente|leite-...-8912985": { dados } ou { erro } }
  const [resultados, setResultados] = useState({})
  const [aEscolher, setAEscolher] = useState(null) // { item, loja }
  // Promoções dos folhetos desta semana (null = a carregar)
  const [promocoes, setPromocoes] = useState(null)
  const [erroPromocoes, setErroPromocoes] = useState('')

  useEffect(() => {
    carregarPromocoes()
      .then((dados) => setPromocoes(dados.promocoes))
      .catch((e) => {
        setPromocoes([])
        setErroPromocoes(e.message)
      })
  }, [])

  // Pedidos que já estão a caminho (para não pedir o mesmo preço duas vezes)
  const emCurso = useRef(new Set())

  // Vai buscar os preços dos produtos associados que ainda não temos (2 de cada vez, para ser simpático com o site)
  useEffect(() => {
    const pedidos = []
    for (const item of lista) {
      const porLoja = associacoes[chaveDoItem(item)] ?? {}
      for (const [loja, assoc] of Object.entries(porLoja)) {
        const chave = `${loja}|${assoc.produto}`
        if (!(chave in resultados) && !emCurso.current.has(chave)) {
          emCurso.current.add(chave)
          pedidos.push({ chave, loja, produto: assoc.produto })
        }
      }
    }

    async function trabalhador() {
      while (pedidos.length > 0) {
        const { chave, loja, produto } = pedidos.shift()
        let resultado
        try {
          resultado = { dados: await obterPreco(loja, produto) }
        } catch (e) {
          resultado = { erro: e.message }
        }
        emCurso.current.delete(chave)
        setResultados((anterior) => ({ ...anterior, [chave]: resultado }))
      }
    }
    if (pedidos.length > 0) {
      trabalhador()
      trabalhador()
    }
  }, [lista, associacoes, resultados])

  function mudarAssociacao(item, lojaId, valor) {
    const chave = chaveDoItem(item)
    const novo = { ...associacoes, [chave]: { ...(associacoes[chave] ?? {}) } }
    if (valor) novo[chave][lojaId] = valor
    else delete novo[chave][lojaId]
    setAssociacoes(novo)
    guardarAssociacoes(novo)
    setAEscolher(null)
  }

  function atualizar(lojaId, produto) {
    esquecerPreco(lojaId, produto)
    setResultados((anterior) => {
      const novo = { ...anterior }
      delete novo[`${lojaId}|${produto}`]
      return novo
    })
  }

  const fecharJanela = useCallback(() => setAEscolher(null), [])

  if (lista.length === 0) {
    return (
      <section className={`${styles.painel} ${styles.vazio}`}>
        <h2>Ainda não tens uma lista</h2>
        <p className={styles.ajuda}>Importa a lista de compras para a comparares entre lojas.</p>
        <button className={styles.botaoPrincipal} onClick={irParaImportar}>
          Importar lista
        </button>
      </section>
    )
  }

  // Promoção do folheto (válida hoje) para cada item em cada loja
  const promoDe = (item, loja) => (promocoes ? procurarPromocao(item, promocoes, loja.id) : null)

  // Preço de cada item em cada loja: o mais baixo entre o site e a promoção do folheto válida hoje
  const precoDe = (item, loja) => {
    const assoc = associacoes[chaveDoItem(item)]?.[loja.id]
    const doSite = assoc ? resultados[`${loja.id}|${assoc.produto}`]?.dados?.preco : undefined
    const promo = promoDe(item, loja)
    const doFolheto = promo ? precoParaComparar(promo) : undefined
    const valores = [doSite, doFolheto].filter((v) => typeof v === 'number')
    return valores.length > 0 ? Math.min(...valores) : undefined
  }
  const precos = Object.fromEntries(
    lista.map((item) => [item, Object.fromEntries(LOJAS.map((l) => [l.id, precoDe(item, l)]))]),
  )
  const sugestao = sugerirLojas(lista, precos, LOJAS)
  // Colunas ordenadas: a loja mais barata fica mais à esquerda
  const lojas = ordenarLojas(lista, precos, LOJAS)

  return (
    <section className={styles.painel}>
      <div className={styles.cabecalho}>
        <div>
          <h2>Comparação de preços</h2>
          <p className={styles.ajuda}>
            Escolhe uma vez o produto certo em cada loja; os preços atualizam-se sozinhos (guardados 6 horas).
            São os preços da loja online, que podem ser diferentes dos da loja física.
            As promoções dos folhetos contam quando são válidas hoje (nos preços só com a app Lidl Plus,
            conta o preço sem a app).
          </p>
          {erroPromocoes && <p className={styles.erro}>Promoções dos folhetos indisponíveis: {erroPromocoes}</p>}
        </div>
        <button className={styles.botaoSecundario} onClick={irParaImportar}>
          Editar lista
        </button>
      </div>

      <div className={styles.tabelaScroll}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Produto</th>
              {lojas.map((loja) => (
                <th key={loja.id}>{loja.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((item, i) => {
              const valores = lojas.map((l) => precos[item][l.id]).filter((v) => typeof v === 'number')
              const minimo = valores.length >= 2 ? Math.min(...valores) : null
              return (
                <tr key={i}>
                  <td>{item}</td>
                  {lojas.map((loja) => (
                    <td key={loja.id} className={minimo !== null && precos[item][loja.id] === minimo ? styles.maisBarato : ''}>
                      <Celula
                        loja={loja}
                        promo={promoDe(item, loja)}
                        aCarregarPromocoes={promocoes === null}
                        assoc={associacoes[chaveDoItem(item)]?.[loja.id]}
                        resultados={resultados}
                        aoEscolher={() => setAEscolher({ item, loja })}
                        aoAtualizar={atualizar}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={styles.linhaTotal}>
              <td>Total</td>
              {lojas.map((loja) => {
                const comPreco = lista.filter((item) => typeof precos[item][loja.id] === 'number')
                const total = comPreco.reduce((s, item) => s + precos[item][loja.id], 0)
                return (
                  <td key={loja.id}>
                    {comPreco.length > 0 ? (
                      <>
                        <strong>{euro(total)}</strong>
                        <span className={styles.detalhe}>
                          {comPreco.length} de {lista.length} produtos
                        </span>
                      </>
                    ) : (
                      <span className={styles.semPreco}>—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={`${styles.sugestao} ${sugestao.tipo === 'insuficiente' ? '' : styles.sugestaoAtiva}`}>
        {sugestao.texto}
      </p>

      {aEscolher && (
        <EscolherProduto
          item={aEscolher.item}
          loja={aEscolher.loja}
          atual={associacoes[chaveDoItem(aEscolher.item)]?.[aEscolher.loja.id]}
          aoEscolher={(valor) => mudarAssociacao(aEscolher.item, aEscolher.loja.id, valor)}
          aoRemover={() => mudarAssociacao(aEscolher.item, aEscolher.loja.id, null)}
          aoFechar={fecharJanela}
        />
      )}
    </section>
  )
}

// Promoção de folheto numa célula: preço, etiqueta "Promoção até dd/mm", data e fonte
function BlocoFolheto({ promo }) {
  const [, m, d] = promo.validoAte.split('-')
  return (
    <div className={styles.blocoFolheto}>
      <span className={styles.preco}>
        {euro(promo.preco)}
        {promo.precoAntigo && <s className={styles.precoAntigo}>{euro(promo.precoAntigo)}</s>}
      </span>
      <span className={styles.etiquetaPromo}>
        {promo.precoAntigo ? 'Promoção' : 'Preço do folheto'} até {d}/{m}
      </span>
      {promo.condicao && <span className={styles.condicao}>{promo.condicao}</span>}
      <span className={styles.detalhe}>{[promo.tamanho, promo.precoPorKgL].filter(Boolean).join(' · ')}</span>
      <a className={styles.nomeProduto} href={promo.link} target="_blank" rel="noreferrer" title={promo.fonte}>
        {promo.marca ? `${promo.marca} ` : ''}
        {promo.produto} ↗
      </a>
      <span className={styles.fonte} title={promo.fonte}>
        {/* No Auchan as promoções vêm da categoria do folheto no site, sem número de página */}
        {promo.pagina ? `Folheto · página ${promo.pagina}` : 'Folheto semanal (site)'}
      </span>
    </div>
  )
}

// O conteúdo de uma célula (um produto numa loja)
function Celula({ loja, promo, aCarregarPromocoes, assoc, resultados, aoEscolher, aoAtualizar }) {
  if (loja.estado === 'sem dados') return <span className={styles.semPreco}>sem dados</span>
  if (loja.estado === 'em breve') return <span className={styles.semPreco}>em breve</span>

  // Lojas só com folheto (Lidl): mostra a promoção, se houver
  if (loja.estado === 'folheto') {
    if (aCarregarPromocoes) return <span className={styles.semPreco}>a carregar…</span>
    return promo ? <BlocoFolheto promo={promo} /> : <span className={styles.semPreco}>sem promoção</span>
  }

  if (!assoc) {
    return (
      <div className={styles.celula}>
        {promo && <BlocoFolheto promo={promo} />}
        <button className={styles.botaoEscolher} onClick={aoEscolher}>
          Escolher
        </button>
      </div>
    )
  }

  const resultado = resultados[`${loja.id}|${assoc.produto}`]
  if (!resultado) return <span className={styles.semPreco}>a carregar…</span>

  if (resultado.erro) {
    return (
      <div className={styles.celula}>
        {promo && <BlocoFolheto promo={promo} />}
        <span className={styles.indisponivel} title={resultado.erro}>
          indisponível
        </span>
        <span className={styles.detalhe}>{resultado.erro}</span>
        <span className={styles.acoes}>
          <button onClick={() => aoAtualizar(loja.id, assoc.produto)}>tentar de novo</button>
          <button onClick={aoEscolher}>alterar</button>
        </span>
      </div>
    )
  }

  const d = resultado.dados
  return (
    <div className={styles.celula}>
      {promo && <BlocoFolheto promo={promo} />}
      <span className={styles.preco}>
        {euro(d.preco)}
        {d.precoAntigo && <s className={styles.precoAntigo}>{euro(d.precoAntigo)}</s>}
      </span>
      {d.promocaoAte ? (
        <span className={styles.etiquetaPromo}>Promoção até {diaMes(d.promocaoAte)}</span>
      ) : (
        d.emPromocao && (
          <span className={styles.etiquetaPromo} title="A loja não indica até quando">
            Promoção
          </span>
        )
      )}
      {d.precoPorUnidade && (
        <span className={styles.detalhe}>
          {euro(d.precoPorUnidade.valor)}/{d.precoPorUnidade.unidade}
          {d.tamanho && ` · ${d.tamanho}`}
        </span>
      )}
      <a className={styles.nomeProduto} href={d.link} target="_blank" rel="noreferrer" title={d.nome}>
        {d.nome} ↗
      </a>
      <span className={styles.fonte} title={d.fonte}>
        {new URL(d.link).hostname.replace(/^www\./, '')} · {horaDia(d.obtidoEm)}
      </span>
      <span className={styles.acoes}>
        <button onClick={aoEscolher}>alterar</button>
        <button onClick={() => aoAtualizar(loja.id, assoc.produto)}>atualizar</button>
      </span>
    </div>
  )
}
