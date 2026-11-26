import { useState } from 'react'
import { lerExtrato } from './lib/parseExtrato'
import {
  filtrarPeriodo,
  agrupar,
  categoria,
  categoriaAutomatica,
  categoriasPossiveis,
  corrigirCategoria,
  temCorrecao,
  INTERNAS,
} from './lib/categorias'
import { carregarExtrato, guardarExtrato, apagarExtrato } from './lib/extratoGuardado'
import { carregarLista, guardarLista as guardarNoBrowser } from './lib/listaCompras'
import { corDaPosicao } from './lib/cores'
import { percentagem } from './lib/formatos'
import Resumo from './components/Resumo'
import GraficoPizza from './components/GraficoPizza'
import Cabecalho from './components/Cabecalho'
import ImportarLista from './components/ImportarLista'
import Comparacao from './components/Comparacao'
import ComparacaoPeriodos from './components/ComparacaoPeriodos'
import Promocoes from './components/Promocoes'
import OndePoupar from './components/OndePoupar'
import { dividirEmPeriodos, DIA_CORTE } from './lib/periodos'
import styles from './App.module.css'

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const dataPT = (d) => d.toLocaleDateString('pt-PT')

// O <input type="date"> trabalha com texto "2026-11-26"
const paraInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deInput = (texto) => {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a, m - 1, d)
}

// Período por defeito: o último mês do extrato (os movimentos vêm do mais recente para o mais antigo)
function periodoPorDefeito(lista) {
  if (lista.length === 0) return { inicio: '', fim: '' }
  const ultimo = lista[0].data
  // Sem isto, 31 de março menos um mês dava "31 de fevereiro" = 3 de março
  const diasMesAnterior = new Date(ultimo.getFullYear(), ultimo.getMonth(), 0).getDate()
  const umMesAntes = new Date(ultimo.getFullYear(), ultimo.getMonth() - 1, Math.min(ultimo.getDate(), diasMesAnterior))
  return { inicio: paraInput(umMesAntes), fim: paraInput(ultimo) }
}

export default function App() {
  // O último extrato analisado fica guardado no browser: carrega-o ao abrir a app
  const [extratoGuardado] = useState(carregarExtrato)
  const [guardadoEm, setGuardadoEm] = useState(extratoGuardado?.guardadoEm ?? null)
  const [movimentos, setMovimentos] = useState(extratoGuardado?.movimentos ?? [])
  const [erro, setErro] = useState('')
  const [aCarregar, setACarregar] = useState(false)
  const [inicio, setInicio] = useState(() => periodoPorDefeito(extratoGuardado?.movimentos ?? []).inicio)
  const [fim, setFim] = useState(() => periodoPorDefeito(extratoGuardado?.movimentos ?? []).fim)

  // Quando corriges uma categoria, isto obriga a app a recalcular tudo (resumo, gráficos, períodos)
  const [, setVersaoCorrecoes] = useState(0)
  function mudarCategoria(movimento, nome) {
    // Escolher a categoria automática apaga a correção
    corrigirCategoria(movimento, nome === categoriaAutomatica(movimento) ? null : nome)
    setVersaoCorrecoes((v) => v + 1)
  }

  function esquecerExtrato() {
    apagarExtrato()
    setMovimentos([])
    setGuardadoEm(null)
    setInicio('')
    setFim('')
  }

  // Dia em que começa cada período mensal (dia 26 = de 26 a 25)
  const [diaCorte, setDiaCorte] = useState(DIA_CORTE)
  function mudarDiaCorte(texto) {
    const dia = Number(texto)
    // Só aceita dias de 1 a 28, para existirem em todos os meses
    if (dia >= 1 && dia <= 28) setDiaCorte(dia)
  }

  // Que ecrã está aberto: 'financas', 'importarLista', 'comparacao' ou 'promocoes'
  const [vista, setVista] = useState('financas')

  // A lista de compras fica guardada no browser (localStorage), para não se perder
  const [lista, setLista] = useState(carregarLista)
  function guardarLista(novaLista) {
    setLista(novaLista)
    guardarNoBrowser(novaLista)
  }

  async function aoEscolherFicheiro(evento) {
    const ficheiro = evento.target.files[0]
    // Limpa o input para que escolher o mesmo ficheiro outra vez volte a disparar onChange
    evento.target.value = ''
    if (!ficheiro) return
    setErro('')
    setMovimentos([])
    setACarregar(true)
    try {
      const lista = await lerExtrato(await ficheiro.arrayBuffer())
      if (lista.length === 0) setErro('Não encontrei movimentos neste PDF.')
      setMovimentos(lista)

      if (lista.length > 0) {
        const periodo = periodoPorDefeito(lista)
        setInicio(periodo.inicio)
        setFim(periodo.fim)
        // Guarda só os movimentos neste browser, para a próxima vez
        setGuardadoEm(guardarExtrato(lista) ? new Date().toISOString() : null)
      }
    } catch (e) {
      setErro('Não consegui ler o PDF: ' + (e?.message ?? e))
    } finally {
      setACarregar(false)
    }
  }

  const doPeriodo = inicio && fim ? filtrarPeriodo(movimentos, deInput(inicio), deInput(fim)) : []
  const saidas = agrupar(doPeriodo.filter((m) => m.valor < 0))
  const entradas = agrupar(doPeriodo.filter((m) => m.valor > 0))
  const totalSaidas = saidas.reduce((s, c) => s + c.total, 0)
  const totalEntradas = entradas.reduce((s, c) => s + c.total, 0)

  // Para o resultado real, tiramos as categorias internas (dinheiro entre contas tuas)
  const somaSemInternas = (linhas) =>
    linhas.filter((l) => !INTERNAS.includes(l.nome)).reduce((s, l) => s + l.total, 0)

  // Períodos mensais do extrato completo (não dependem das datas De/Até)
  const periodos = dividirEmPeriodos(movimentos, diaCorte)

  // O jsPDF só é carregado quando clicas no botão, para a app abrir mais depressa
  const [aExportar, setAExportar] = useState(false)
  async function aoExportarPdf() {
    setAExportar(true)
    setErro('')
    try {
      const { exportarPdf } = await import('./lib/exportarPdf')
      await exportarPdf({
        inicioTexto: inicio,
        fimTexto: fim,
        movimentos: doPeriodo,
        saidas,
        entradas,
        totalEntradas,
        totalSaidas,
        entradasReais: somaSemInternas(entradas),
        saidasReais: somaSemInternas(saidas),
        periodos,
      })
    } catch (e) {
      setErro('Não consegui gerar o PDF: ' + (e?.message ?? e))
    } finally {
      setAExportar(false)
    }
  }

  const temDados = movimentos.length > 0
  const botaoImportar = (
    <label className={styles.upload}>
      {temDados ? 'Importar outro extrato' : 'Importar extrato PDF'}
      <input type="file" accept="application/pdf" onChange={aoEscolherFicheiro} hidden />
    </label>
  )

  const subtitulo = temDados ? `Extrato CGD · ${movimentos.length} movimentos importados` : 'Extrato CGD'

  return (
    <>
      <Cabecalho subtitulo={subtitulo} vista={vista} mudarVista={setVista}>
        {/* As datas e o botão de importar só aparecem no ecrã das finanças */}
        {vista === 'financas' && temDados && (
          <>
            <label className={styles.campoData}>
              De <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </label>
            <label className={styles.campoData}>
              Até <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </label>
            <button
              className={styles.botaoSecundario}
              onClick={aoExportarPdf}
              disabled={aExportar || doPeriodo.length === 0}
            >
              {aExportar ? 'A gerar…' : 'Exportar PDF'}
            </button>
            {botaoImportar}
          </>
        )}
      </Cabecalho>

      <main className={styles.conteudo}>
        {vista === 'importarLista' && (
          <ImportarLista
            lista={lista}
            guardarLista={guardarLista}
            irParaComparacao={() => setVista('comparacao')}
          />
        )}

        {vista === 'comparacao' && (
          <Comparacao lista={lista} irParaImportar={() => setVista('importarLista')} />
        )}

        {vista === 'promocoes' && <Promocoes />}

        {/* O ecrã das finanças fica escondido em vez de ser removido,
            para não perderes o extrato importado quando mudas de ecrã */}
        <div className={styles.financas} hidden={vista !== 'financas'}>
          {aCarregar && <p className={styles.aviso}>A ler o extrato…</p>}
          {erro && <p className={styles.erro}>{erro}</p>}

          {!temDados && !aCarregar && (
            <div className={styles.vazio}>
              <h2>Ainda não há dados</h2>
              <p>Importa o PDF de "Consultar saldos e movimentos à ordem" da CGD para veres o resumo.</p>
              {botaoImportar}
            </div>
          )}

          {temDados && guardadoEm && (
            <p className={styles.guardado}>
              Extrato guardado neste browser a {new Date(guardadoEm).toLocaleString('pt-PT')} (só os movimentos, não o PDF).
              <button className={styles.ligacao} onClick={esquecerExtrato}>
                Apagar do browser
              </button>
            </p>
          )}

          {temDados && (
            <>
              <Resumo
                entradas={totalEntradas}
                saidas={totalSaidas}
                entradasReais={somaSemInternas(entradas)}
                saidasReais={somaSemInternas(saidas)}
              />

              <div className={styles.grelha2}>
                <GraficoPizza titulo="Saídas por categoria" linhas={saidas} />
                <GraficoPizza titulo="Entradas por origem" linhas={entradas} />
              </div>

              <div className={styles.grelha2}>
                <TabelaCategorias titulo="Saídas por categoria" linhas={saidas} total={totalSaidas} />
                <TabelaCategorias titulo="Entradas por origem" linhas={entradas} total={totalEntradas} />
              </div>

              <ComparacaoPeriodos periodos={periodos} diaCorte={diaCorte} mudarDiaCorte={mudarDiaCorte} />
              <OndePoupar periodos={periodos} />

              <section className={styles.painel}>
                <div className={styles.painelCabecalho}>
                  <h2>Movimentos do período</h2>
                  <span className={styles.painelInfo}>{doPeriodo.length} movimentos</span>
                </div>
                <p className={styles.dica}>
                  Categoria errada? Muda-a na lista: a correção fica guardada e vale para todos os movimentos
                  com a mesma descrição, também nas próximas importações. As corrigidas têm um ✎.
                </p>
                <div className={styles.tabelaScroll}>
                  <table className={styles.tabela}>
                    <thead>
                      <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr>
                    </thead>
                    <tbody>
                      {doPeriodo.map((m, i) => (
                        <tr key={i}>
                          <td className={styles.data}>{dataPT(m.data)}</td>
                          <td>{m.descricao}</td>
                          <td>
                            <SeletorCategoria movimento={m} aoMudar={mudarCategoria} />
                          </td>
                          <td className={m.valor < 0 ? styles.saida : styles.entrada}>{euro(m.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

// Lista de escolha da categoria de um movimento (a corrigida fica marcada com ✎)
function SeletorCategoria({ movimento, aoMudar }) {
  const corrigida = temCorrecao(movimento)
  const automatica = categoriaAutomatica(movimento)
  return (
    <select
      className={`${styles.etiqueta} ${styles.seletor} ${corrigida ? styles.corrigida : ''}`}
      value={categoria(movimento)}
      onChange={(e) => aoMudar(movimento, e.target.value)}
      title={corrigida ? `Corrigida por ti (automática: ${automatica})` : 'Categoria automática'}
      aria-label={`Categoria de ${movimento.descricao}`}
    >
      {categoriasPossiveis(movimento).map((nome) => (
        <option key={nome} value={nome}>
          {`${corrigida && nome === categoria(movimento) ? '✎ ' : ''}${nome}${nome === automatica ? ' (automática)' : ''}`}
        </option>
      ))}
    </select>
  )
}

// Painel com a tabela de categorias (usado para as saídas e para as entradas)
function TabelaCategorias({ titulo, linhas, total }) {
  if (linhas.length === 0) return null

  return (
    <section className={styles.painel}>
      <div className={styles.painelCabecalho}>
        <h2>{titulo}</h2>
        <span className={styles.painelInfo}>
          {linhas.length} {linhas.length === 1 ? 'categoria' : 'categorias'}
        </span>
      </div>
      <table className={styles.tabela}>
        <thead>
          <tr><th>Categoria</th><th>Peso</th><th>Valor</th></tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const pct = (l.total / total) * 100
            return (
              <tr key={l.nome}>
                <td>{l.nome}</td>
                <td className={styles.barraCelula}>
                  <div className={styles.barra}>
                    <div className={styles.barraFundo}>
                      <div
                        className={styles.barraValor}
                        style={{ width: `${pct}%`, background: corDaPosicao(i) }}
                      />
                    </div>
                    <span className={styles.barraTexto}>{percentagem(l.total, total)}</span>
                  </div>
                </td>
                <td>{euro(l.total)}</td>
              </tr>
            )
          })}
          <tr className={styles.total}>
            <td>Total</td>
            <td />
            <td>{euro(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
