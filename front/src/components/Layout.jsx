
import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ title, actions, children }) {
  const [menuRecolhido, setMenuRecolhido] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  return (
    <div
      className={`app-shell ${
        menuRecolhido ? 'sidebar-collapsed' : ''
      }`}
    >
      <Sidebar
        recolhido={menuRecolhido}
        mobileAberto={menuMobileAberto}
        fecharMobile={() => setMenuMobileAberto(false)}
      />

      {menuMobileAberto && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Fechar menu de navegação"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}

      <div className="main">
        <header className="topbar">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary sidebar-toggle-desktop"
              onClick={() => setMenuRecolhido(!menuRecolhido)}
              aria-label={
                menuRecolhido
                  ? 'Expandir menu lateral'
                  : 'Recolher menu lateral'
              }
              aria-expanded={!menuRecolhido}
              title="Recolher ou expandir menu"
            >
              <i className="bi bi-list" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary sidebar-toggle-mobile"
              onClick={() => setMenuMobileAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={menuMobileAberto}
            >
              <i className="bi bi-list" aria-hidden="true" />
            </button>

            <div className="topbar-title">{title}</div>
          </div>

          <div>{actions}</div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
