// Janela para escolher que produto do site corresponde a um item da lista
import { useEffect, useMemo, useState } from 'react'
import { carregarIndice, procurar, nomeDoSlug, nomeDaCategoria, urlDoProduto } from '../lib/procurarProduto'
import styles from './EscolherProduto.module.css'

export default function EscolherProduto({ item, loja, atual, aoEscolher, aoRemover, aoFechar }) {
  const [pesquisa, setPesquisa] = useState(item)
  const [indice, setIndice] = useState(null)
  const [erro, setErro] = useState('')

  // Carrega o índice de produtos (só da primeira vez; depois fica em memória)
  useEffect(() => {
    let cancelado = false
    carregarIndice(loja.id)
      .then((dados) => {
        if (!cancelado) setIndice(dados)
      })
      .catch((e) => {
        if (!cancelado) setErro(e.message)
      })
    return () => {
      cancelado = true
    }
  }, [loja.id])

  // Fecha com a tecla Esc
  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const resultados = useMemo(
    () => (indice ? procurar(indice.produtos, pesquisa) : []),
    [indice, pesquisa],
  )

  return (
    // Clicar no fundo escuro fecha a janela
    <div className={styles.fundo} onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={styles.janela} role="dialog" aria-modal="true" aria-label={`Escolher produto para ${item}`}>
        <div className={styles.cabecalho}>
          <div>
            <h2>Escolher no {loja.nome}</h2>
            <p className={styles.ajuda}>
              Para "<strong>{item}</strong>". A escolha fica guardada para as próximas vezes.
            </p>
          </div>
          <button className={styles.fechar} onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <input
          className={styles.pesquisa}
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Ex.: leite meio gordo mimosa"
          autoFocus
        />
        <p className={styles.dica}>
          Dica: acrescenta a marca ou o tipo (ex.: "ovos classe m") para afinar. Os tamanhos não contam na pesquisa.
        </p>

        <div className={styles.lista}>
          {erro && <p className={styles.erro}>{erro}</p>}
          {!indice && !erro && <p className={styles.ajuda}>A carregar produtos…</p>}
          {indice && indice.produtos.length === 0 && (
            <p className={styles.erro}>O índice de produtos está vazio. Corre "npm run indice" e tenta outra vez.</p>
          )}
          {indice && indice.produtos.length > 0 && resultados.length === 0 && (
            <p className={styles.ajuda}>Nenhum produto encontrado. Experimenta outras palavras.</p>
          )}

          {resultados.map((r) => (
            <div
              key={r.produto}
              className={`${styles.opcao} ${atual?.produto === r.produto ? styles.escolhida : ''}`}
            >
              <button className={styles.escolher} onClick={() => aoEscolher({ produto: r.produto, nome: nomeDoSlug(r.slug) })}>
                <span>
                  {nomeDoSlug(r.slug)}
                  {r.categoria && <span className={styles.categoria}>{nomeDaCategoria(r.categoria)}</span>}
                </span>
                <span className={styles.ref}>ref. {r.produto.split('-').at(-1)}</span>
              </button>
              <a className={styles.verSite} href={urlDoProduto(loja.id, r.produto)} target="_blank" rel="noreferrer">
                ver no site ↗
              </a>
            </div>
          ))}
        </div>

        <div className={styles.rodape}>
          {indice?.geradoEm && (
            <span className={styles.ajuda}>
              Produtos do sitemap de {new Date(indice.geradoEm).toLocaleDateString('pt-PT')}
            </span>
          )}
          {atual && (
            <button className={styles.remover} onClick={aoRemover}>
              Remover escolha
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
