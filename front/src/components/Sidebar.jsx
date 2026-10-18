import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_EQUIPAMENTOS = [
  {
    to: '/equipamentos',
    label: 'Listar equipamentos',
    icon: 'bi-list-ul',
  },
];

const NAV_MANUTENCOES = [
  {
    to: '/manutencoes',
    label: 'Listar manutenções',
    icon: 'bi-list-ul',
  },
];

const NAV_CADASTROS = [
  { to: '/predios', label: 'Prédios', icon: 'bi-buildings' },
  { to: '/locais', label: 'Locais', icon: 'bi-geo-alt' },
  { to: '/grupos', label: 'Grupos', icon: 'bi-collection' },
  { to: '/categorias', label: 'Categorias', icon: 'bi-tags' },
  { to: '/marcas', label: 'Marcas', icon: 'bi-bookmark' },
  { to: '/fornecedores', label: 'Fornecedores', icon: 'bi-truck' },
];

const NAV_ADMINISTRACAO = [
  {
    to: '/usuarios',
    label: 'Usuários',
    icon: 'bi-people',
  },
];

function rotaPertenceAoGrupo(pathname, itens) {
  return itens.some(
    (item) =>
      pathname === item.to ||
      pathname.startsWith(`${item.to}/`)
  );
}

function GrupoExpansivel({
  titulo,
  icone,
  itens,
  fecharMobile,
  recolhido,
}) {
  const { pathname } = useLocation();

  const grupoAtivo = rotaPertenceAoGrupo(pathname, itens);

  const [aberto, setAberto] = useState(grupoAtivo);

  useEffect(() => {
    if (grupoAtivo) {
      setAberto(true);
    }
  }, [grupoAtivo, pathname]);

  return (
    <div className="sidebar-group">
      <button
        type="button"
        className={`sidebar-link sidebar-group-toggle${
          grupoAtivo ? ' sidebar-group-active' : ''
        }`}
        onClick={() => setAberto((anterior) => !anterior)}
        aria-expanded={aberto}
        title={titulo}
        style={{
          width: '100%',
          border: 0,
          textAlign: 'left',
          cursor: 'pointer',
          background: 'transparent',
          color: 'inherit',
        }}
      >
        <i
          className={`bi ${icone} sidebar-link-icon`}
          aria-hidden="true"
        />

        <span className="sidebar-link-text">
          {titulo}
        </span>

        {!recolhido && (
          <i
            className={`bi ${
              aberto ? 'bi-chevron-down' : 'bi-chevron-right'
            }`}
            aria-hidden="true"
            style={{
              marginLeft: 'auto',
              fontSize: '10px',
            }}
          />
        )}
      </button>

      {aberto && !recolhido && (
        <div
          className="sidebar-submenu"
          style={{
            paddingLeft: '14px',
          }}
        >
          {itens.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              onClick={fecharMobile}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
            >
              <i
                className={`bi ${item.icon} sidebar-link-icon`}
                aria-hidden="true"
              />

              <span className="sidebar-link-text">
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  recolhido = false,
  mobileAberto = false,
  fecharMobile = () => {},
}) {
  const { user, logout } = useAuth();

  const isGestor =
    user?.role === 'admin' ||
    user?.role === 'root';

  const nomeUsuario =
    user?.name ||
    user?.username ||
    'Usuário';

  const sair = () => {
    fecharMobile();
    logout();
  };

  return (
    <aside
      className={`sidebar ${
        recolhido ? 'is-collapsed' : ''
      } ${mobileAberto ? 'mobile-open' : ''}`}
      aria-label="Menu principal"
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <i
            className="bi bi-gear-wide-connected"
            aria-hidden="true"
          />
        </div>

        <div className="sidebar-brand-info">
          <div className="sidebar-brand-title">
            Gestão de Equipamentos e Manutenção
          </div>

          <div className="sidebar-brand-sub">
            PI II · UNIVESP
          </div>
        </div>

        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={fecharMobile}
          aria-label="Fechar menu"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <nav
        className="sidebar-nav"
        aria-label="Navegação do sistema"
      >
        <NavLink
          to="/"
          end
          title="Visão geral"
          onClick={fecharMobile}
          className={({ isActive }) =>
            `sidebar-link${isActive ? ' active' : ''}`
          }
        >
          <i
            className="bi bi-speedometer2 sidebar-link-icon"
            aria-hidden="true"
          />
          <span className="sidebar-link-text">
            Visão geral
          </span>
        </NavLink>

        <GrupoExpansivel
          titulo="Equipamentos"
          icone="bi-pc-display"
          itens={NAV_EQUIPAMENTOS}
          fecharMobile={fecharMobile}
          recolhido={recolhido}
        />

        <GrupoExpansivel
          titulo="Manutenções"
          icone="bi-tools"
          itens={NAV_MANUTENCOES}
          fecharMobile={fecharMobile}
          recolhido={recolhido}
        />

        <GrupoExpansivel
          titulo="Cadastros auxiliares"
          icone="bi-folder"
          itens={NAV_CADASTROS}
          fecharMobile={fecharMobile}
          recolhido={recolhido}
        />

        {isGestor && (
          <GrupoExpansivel
            titulo="Administração"
            icone="bi-shield-lock"
            itens={NAV_ADMINISTRACAO}
            fecharMobile={fecharMobile}
            recolhido={recolhido}
          />
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-row">
          <div className="sidebar-user-avatar">
            <i
              className="bi bi-person-circle"
              aria-hidden="true"
            />
          </div>

          <div className="sidebar-user-info">
            <strong title={nomeUsuario}>
              {nomeUsuario}
            </strong>

            <small>
              {user?.role || 'Membro'}
            </small>
          </div>

          <Link
            to="/perfil"
            className="sidebar-profile-link"
            title="Configurações do perfil"
            aria-label="Configurações do perfil"
            onClick={fecharMobile}
          >
            <i className="bi bi-gear" aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          className="btn-signout"
          onClick={sair}
          title="Sair do sistema"
        >
          <i
            className="bi bi-box-arrow-right"
            aria-hidden="true"
          />

          <span className="sidebar-signout-text">
            Sair
          </span>
        </button>
      </div>
    </aside>
  );
}
