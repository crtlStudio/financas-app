// Barra de topo (efeito vidro): título à esquerda, controlos e menu "Lista de Compras" à direita
import { useEffect, useRef, useState } from 'react'
import styles from './Cabecalho.module.css'

// children = o que a página atual quer mostrar no topo (datas, botão de importar extrato)
export default function Cabecalho({ subtitulo, vista, mudarVista, children }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef(null)

  // Fecha o menu ao clicar fora dele ou ao carregar em Esc
  useEffect(() => {
    if (!menuAberto) return

    function aoClicar(evento) {
      if (menuRef.current && !menuRef.current.contains(evento.target)) setMenuAberto(false)
    }
    function aoTeclar(evento) {
      if (evento.key === 'Escape') setMenuAberto(false)
    }

    document.addEventListener('mousedown', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    // Quando o menu fecha, deixamos de ouvir os cliques
    return () => {
      document.removeEventListener('mousedown', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [menuAberto])

  function escolher(novaVista) {
    mudarVista(novaVista)
    setMenuAberto(false)
  }

  const naLista = vista === 'importarLista' || vista === 'comparacao' || vista === 'promocoes'

  return (
    <header className={styles.topo}>
      <div className={styles.interior}>
        {/* Clicar no título volta às finanças */}
        <button className={styles.marca} onClick={() => mudarVista('financas')}>
          {/* O logo está em public/, por isso o caminho começa em "/" */}
          <img className={styles.logo} src="/logo.png" alt="" width="40" height="40" />
          <span className={styles.textos}>
            <span className={styles.titulo}>As minhas finanças</span>
            <span className={styles.subtitulo}>{subtitulo}</span>
          </span>
        </button>

        <div className={styles.direita}>
          {children}

          <div className={styles.menu} ref={menuRef}>
            <button
              className={`${styles.botaoMenu} ${naLista ? styles.ativo : ''}`}
              onClick={() => setMenuAberto(!menuAberto)}
              aria-haspopup="menu"
              aria-expanded={menuAberto}
            >
              Lista de Compras
              <span className={`${styles.seta} ${menuAberto ? styles.setaAberta : ''}`}>▾</span>
            </button>

            {menuAberto && (
              <div className={styles.dropdown} role="menu">
                <button
                  role="menuitem"
                  className={vista === 'importarLista' ? styles.opcaoAtiva : ''}
                  onClick={() => escolher('importarLista')}
                >
                  Importar lista
                </button>
                <button
                  role="menuitem"
                  className={vista === 'comparacao' ? styles.opcaoAtiva : ''}
                  onClick={() => escolher('comparacao')}
                >
                  Comparação
                </button>
                <button
                  role="menuitem"
                  className={vista === 'promocoes' ? styles.opcaoAtiva : ''}
                  onClick={() => escolher('promocoes')}
                >
                  Promoções da semana
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
