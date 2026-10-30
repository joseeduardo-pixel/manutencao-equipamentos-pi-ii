import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, rolesPermitidos }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="login-screen">
        <div
          style={{
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
          }}
        >
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === 'banned' || user.status === 'deactivated') {
    return <Navigate to="/login" replace />;
  }

  const contaPendente =
    user.status !== 'active' || user.isVerified !== true;

  if (contaPendente && location.pathname !== '/perfil') {
    return <Navigate to="/perfil" replace />;
  }

  if (
    !contaPendente &&
    rolesPermitidos &&
    !rolesPermitidos.includes(user.role)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}