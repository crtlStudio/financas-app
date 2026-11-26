// Gera o relatório PDF no próprio browser: nada é enviado para fora do computador.
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { categoria } from './categorias'
import { corDaPosicao, juntarPequenas } from './cores'
import { gastosPorCategoria, totaisDoPeriodo, periodosParaMedia } from './periodos'
import { sugestoesDePoupanca } from './sugestoes'
import { percentagem } from './formatos'

// Página A4 em milímetros
const LARGURA = 210
const ALTURA = 297
const MARGEM = 15
const UTIL = LARGURA - 2 * MARGEM

const AZUL = '#2a78d6'
const VERDE = '#1a8a55'
const VERMELHO = '#c23b3b'
const TEXTO = '#111318'
const CINZA = '#8a909c'
const BORDA = '#e3e6eb'

// As fontes base do PDF não têm alguns espaços e sinais que o JavaScript usa ao formatar números.
// Esta função troca-os por equivalentes simples.
const t = (s) =>
  String(s)
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/\u2212/g, '-')

const euro = (v) => t(v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }))
const comSinal = (v) => (v > 0 ? '+' : '') + euro(v)
const dataPT = (d) => d.toLocaleDateString('pt-PT')

// Mesma lógica do gráfico de períodos da app: período mais antigo mais claro
function corDoPeriodo(i, total) {
  const opacidade = total === 1 ? 1 : 0.3 + (0.7 * i) / (total - 1)
  const misturar = (c) => Math.round(255 - (255 - c) * opacidade)
  return [misturar(42), misturar(120), misturar(214)]
}

// Lê o logo (que está na própria app) para o pôr no cabeçalho
async function carregarLogo() {
  try {
    const resposta = await fetch('/logo.png')
    const blob = await resposta.blob()
    return await new Promise((resolver, falhar) => {
      const leitor = new FileReader()
      leitor.onload = () => resolver(leitor.result)
      leitor.onerror = falhar
      leitor.readAsDataURL(blob)
    })
  } catch {
    return null // sem logo, o relatório faz-se na mesma
  }
}

// Desenha uma fatia de donut como um polígono (arco de fora + arco de dentro ao contrário)
function desenharFatia(doc, cx, cy, raioFora, raioDentro, anguloInicio, anguloFim, cor) {
  const passos = Math.max(2, Math.ceil((anguloFim - anguloInicio) / (Math.PI / 90)))
  const pontos = []
  for (let k = 0; k <= passos; k++) {
    const a = anguloInicio + ((anguloFim - anguloInicio) * k) / passos
    pontos.push([cx + raioFora * Math.cos(a), cy + raioFora * Math.sin(a)])
  }
  for (let k = passos; k >= 0; k--) {
    const a = anguloInicio + ((anguloFim - anguloInicio) * k) / passos
    pontos.push([cx + raioDentro * Math.cos(a), cy + raioDentro * Math.sin(a)])
  }
  // O jsPDF quer as linhas como deslocamentos a partir do ponto anterior
  const deslocamentos = pontos.slice(1).map((p, i) => [p[0] - pontos[i][0], p[1] - pontos[i][1]])
  doc.setFillColor(cor)
  doc.lines(deslocamentos, pontos[0][0], pontos[0][1], [1, 1], 'F', true)
}

/**
 * dados = {
 *   inicioTexto, fimTexto ("2026-10-26"), movimentos (do período), todosMovimentos,
 *   saidas, entradas (listas agrupadas), totalEntradas, totalSaidas,
 *   entradasReais, saidasReais, periodos
 * }
 */
export async function exportarPdf(dados) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGEM

  // ---------- Ajudas de paginação ----------
  // Se o bloco seguinte não couber, muda de página
  function espaco(altura) {
    if (y + altura > ALTURA - MARGEM - 8) {
      doc.addPage()
      y = MARGEM
    }
  }

  function titulo(texto) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(TEXTO)
    doc.text(t(texto), MARGEM, y + 5)
    y += 9
  }

  function tabela(opcoes) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM, bottom: MARGEM + 8 },
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, textColor: TEXTO },
      headStyles: { fillColor: AZUL, textColor: '#ffffff', fontStyle: 'bold' },
      footStyles: { fillColor: '#f1f3f6', textColor: TEXTO, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: '#f8f9fb' },
      ...opcoes,
    })
    y = doc.lastAutoTable.finalY + 8
  }

  const inicio = new Date(dados.inicioTexto + 'T00:00')
  const fim = new Date(dados.fimTexto + 'T00:00')

  // ---------- Cabeçalho ----------
  const logo = await carregarLogo()
  if (logo) doc.addImage(logo, 'PNG', MARGEM, y, 14, 14)
  const xTitulo = logo ? MARGEM + 18 : MARGEM
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(TEXTO)
  doc.text(t('Análise de movimentos'), xTitulo, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(CINZA)
  doc.text(
    t(`Período: ${dataPT(inicio)} a ${dataPT(fim)} · ${dados.movimentos.length} movimentos · Fonte: extrato CGD`),
    xTitulo,
    y + 12,
  )
  doc.text(t(`Gerado em ${dataPT(new Date())}`), LARGURA - MARGEM, y + 6, { align: 'right' })
  y += 22

  // ---------- Cartões ----------
  const resultado = dados.totalEntradas - dados.totalSaidas
  const resultadoReal = dados.entradasReais - dados.saidasReais
  const cartoes = [
    ['Entradas', euro(dados.totalEntradas), `${euro(dados.entradasReais)} sem internas`, AZUL, false],
    ['Saídas', euro(dados.totalSaidas), `${euro(dados.saidasReais)} sem internas`, AZUL, false],
    ['Resultado (extrato)', comSinal(resultado), 'Entradas - saídas', resultado >= 0 ? VERDE : VERMELHO, true],
    ['Resultado real', comSinal(resultadoReal), 'Sem mov. entre contas tuas', resultadoReal >= 0 ? VERDE : VERMELHO, true],
  ]
  const larguraCartao = (UTIL - 3 * 4) / 4
  cartoes.forEach(([nome, valor, detalhe, cor, valorColorido], i) => {
    const x = MARGEM + i * (larguraCartao + 4)
    doc.setDrawColor(BORDA)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, larguraCartao, 22, 2, 2, 'S')
    doc.setFillColor(cor)
    doc.rect(x, y + 2, 1.2, 18, 'F') // faixa de cor à esquerda

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(CINZA)
    doc.text(t(nome), x + 4, y + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(valorColorido ? cor : TEXTO)
    doc.text(valor, x + 4, y + 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(CINZA)
    doc.text(t(detalhe), x + 4, y + 18.5)
  })
  y += 30

  // ---------- Gráficos circulares ----------
  function graficoCircular(nome, linhas) {
    if (linhas.length === 0) return
    const fatias = juntarPequenas(linhas)
    const total = fatias.reduce((s, l) => s + l.total, 0)
    const altura = Math.max(50, fatias.length * 6 + 4)
    espaco(altura + 9)
    titulo(nome)

    const cx = MARGEM + 25
    const cy = y + 23
    const raio = 22
    let angulo = -Math.PI / 2 // começa no topo
    const limites = []
    fatias.forEach((l, i) => {
      const abertura = (l.total / total) * 2 * Math.PI
      desenharFatia(doc, cx, cy, raio, raio * 0.58, angulo, angulo + abertura, corDaPosicao(i))
      limites.push(angulo)
      angulo += abertura
    })
    // Linhas brancas a separar as fatias
    if (fatias.length > 1) {
      doc.setDrawColor('#ffffff')
      doc.setLineWidth(0.6)
      for (const a of limites) {
        doc.line(cx + raio * 0.58 * Math.cos(a), cy + raio * 0.58 * Math.sin(a), cx + raio * Math.cos(a), cy + raio * Math.sin(a))
      }
    }

    // Legenda à direita
    let yLegenda = y + 4
    doc.setFontSize(9)
    fatias.forEach((l, i) => {
      doc.setFillColor(corDaPosicao(i))
      doc.rect(MARGEM + 60, yLegenda - 2.7, 3, 3, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(TEXTO)
      doc.text(t(l.nome), MARGEM + 66, yLegenda)
      doc.setTextColor(CINZA)
      doc.text(percentagem(l.total, total), MARGEM + UTIL - 30, yLegenda, { align: 'right' })
      doc.setTextColor(TEXTO)
      doc.text(euro(l.total), MARGEM + UTIL, yLegenda, { align: 'right' })
      yLegenda += 6
    })
    y += altura + 4
  }

  graficoCircular('Saídas por categoria', dados.saidas)
  graficoCircular('Entradas por origem', dados.entradas)

  // ---------- Tabelas por categoria ----------
  function tabelaCategorias(nome, linhas, total) {
    if (linhas.length === 0) return
    espaco(30)
    titulo(nome)
    tabela({
      head: [['Categoria', '%', 'Valor']],
      body: linhas.map((l) => [t(l.nome), percentagem(l.total, total), euro(l.total)]),
      foot: [['Total', '100,0%', euro(total)]],
      columnStyles: { 1: { halign: 'right', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 32 } },
      headStyles: { fillColor: AZUL, textColor: '#ffffff', halign: 'left' },
    })
  }

  tabelaCategorias('Saídas por categoria', dados.saidas, dados.totalSaidas)
  tabelaCategorias('Entradas por origem', dados.entradas, dados.totalEntradas)

  // ---------- Comparação entre períodos (extrato completo) ----------
  const periodos = dados.periodos
  if (periodos.length > 0) {
    const categorias = gastosPorCategoria(periodos)
    const totais = periodos.map(totaisDoPeriodo)
    const usados = periodosParaMedia(periodos)
    const mediaDe = (campo) =>
      periodos.reduce((s, p, i) => (usados.includes(p) ? s + totais[i][campo] : s), 0) / usados.length
    const tamanhoLetra = periodos.length <= 5 ? 8 : 6.5

    doc.addPage()
    y = MARGEM
    titulo('Comparação entre períodos (extrato completo)')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(CINZA)
    for (const p of periodos.filter((x) => x.avisos.length > 0)) {
      const linhas = doc.splitTextToSize(t(`* ${p.nome}: ${p.avisos.join(' ')} Não entra nas médias.`), UTIL)
      doc.text(linhas, MARGEM, y)
      y += linhas.length * 4
    }
    y += 2

    const linhaTotal = (nome, campo, comSinalNoValor) => [
      nome,
      ...totais.map((tt) => (comSinalNoValor ? comSinal(tt[campo]) : euro(tt[campo]))),
      comSinalNoValor ? comSinal(mediaDe(campo)) : euro(mediaDe(campo)),
    ]

    tabela({
      head: [['Categoria', ...periodos.map((p) => t(p.nome) + (p.completo ? '' : ' *')), 'Média']],
      body: categorias.map((c) => [t(c.nome), ...c.valores.map((v) => (v > 0 ? euro(v) : '-')), euro(c.media)]),
      foot: [
        linhaTotal('Saídas', 'saidas'),
        linhaTotal('Entradas', 'entradas'),
        linhaTotal('Resultado', 'resultado', true),
      ],
      styles: { font: 'helvetica', fontSize: tamanhoLetra, cellPadding: 1.4, textColor: TEXTO, halign: 'right' },
      columnStyles: { 0: { halign: 'left', cellWidth: 38 } },
    })

    // Barras horizontais: 7 maiores categorias, uma barra por período
    const maiores = categorias.slice(0, 7)
    if (maiores.length > 0) {
      const n = periodos.length
      const alturaBarra = Math.min(3, 14 / n)
      const alturaGrupo = n * alturaBarra + 3
      espaco(maiores.length * alturaGrupo + 30)
      titulo('7 maiores categorias por período')

      const xBarras = MARGEM + 48
      const larguraBarras = UTIL - 48 - 22
      const maximo = Math.max(1, ...maiores.flatMap((c) => c.valores))

      maiores.forEach((c, ci) => {
        const yGrupo = y + ci * alturaGrupo
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(TEXTO)
        doc.text(t(c.nome), MARGEM, yGrupo + (n * alturaBarra) / 2 + 1, { maxWidth: 46 })
        c.valores.forEach((v, pi) => {
          const largura = (v / maximo) * larguraBarras
          if (largura <= 0) return
          doc.setFillColor(...corDoPeriodo(pi, n))
          doc.rect(xBarras, yGrupo + pi * alturaBarra, largura, alturaBarra * 0.85, 'F')
        })
        // Média à direita
        doc.setFontSize(7.5)
        doc.setTextColor(CINZA)
        doc.text(`média ${euro(c.media)}`, MARGEM + UTIL, yGrupo + (n * alturaBarra) / 2 + 1, { align: 'right' })
      })
      y += maiores.length * alturaGrupo + 2

      // Legenda dos períodos
      let xLegenda = MARGEM
      doc.setFontSize(7.5)
      periodos.forEach((p, i) => {
        const texto = t(p.nome) + (p.completo ? '' : ' *')
        const largura = doc.getTextWidth(texto) + 9
        if (xLegenda + largura > MARGEM + UTIL) {
          xLegenda = MARGEM
          y += 5
        }
        doc.setFillColor(...corDoPeriodo(i, n))
        doc.rect(xLegenda, y - 2.6, 3, 3, 'F')
        doc.setTextColor(TEXTO)
        doc.text(texto, xLegenda + 4.5, y)
        xLegenda += largura
      })
      y += 10
    }

    // ---------- Onde poupar ----------
    const sugestoes = sugestoesDePoupanca(periodos)
    if (sugestoes.length > 0) {
      const totalPoupanca = sugestoes.reduce((s, x) => s + x.poupancaMensal, 0)
      espaco(40)
      titulo(`Onde poupar (até ${euro(totalPoupanca)}/mês)`)
      tabela({
        head: [['Sugestão', 'Gasto/mês', 'Poupança/mês']],
        body: sugestoes.map((s) => [
          { content: t(`${s.titulo}\n${s.texto}`) },
          euro(s.gastoMensal),
          euro(s.poupancaMensal),
        ]),
        columnStyles: {
          1: { halign: 'right', cellWidth: 26 },
          2: { halign: 'right', cellWidth: 28, textColor: VERDE, fontStyle: 'bold' },
        },
      })
    }
  }

  // ---------- Anexo: movimentos por categoria ----------
  doc.addPage()
  y = MARGEM
  titulo('Anexo: movimentos do período por categoria')

  // Agrupa os movimentos do período pela categoria, pela mesma ordem das tabelas
  const grupos = new Map()
  for (const m of dados.movimentos) {
    const chave = (m.valor < 0 ? 'Saídas · ' : 'Entradas · ') + categoria(m)
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(m)
  }
  const ordem = [
    ...dados.saidas.map((l) => 'Saídas · ' + l.nome),
    ...dados.entradas.map((l) => 'Entradas · ' + l.nome),
  ]

  for (const chave of ordem) {
    const lista = grupos.get(chave)
    if (!lista) continue
    const total = lista.reduce((s, m) => s + m.valor, 0)
    espaco(22)
    tabela({
      head: [
        [{ content: t(`${chave} (${lista.length} mov.)`), colSpan: 2 }, { content: euro(total), styles: { halign: 'right' } }],
        ['Data', 'Descrição', 'Valor'],
      ],
      body: lista.map((m) => [dataPT(m.data), t(m.descricao), euro(m.valor)]),
      columnStyles: { 0: { cellWidth: 22 }, 2: { halign: 'right', cellWidth: 28 } },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.3, textColor: TEXTO },
    })
    y -= 3
  }

  // ---------- Rodapé em todas as páginas ----------
  const nPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= nPaginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(CINZA)
    doc.text(t('As minhas finanças · Análise de movimentos'), MARGEM, ALTURA - 8)
    doc.text(`Página ${i} de ${nPaginas}`, LARGURA - MARGEM, ALTURA - 8, { align: 'right' })
  }

  doc.save(`Analise_movimentos_${dados.inicioTexto}_${dados.fimTexto}.pdf`)
}
