import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Wraps protected routes.
 * - While the initial auth check is pending → renders a full-screen spinner.
 * - If unauthenticated after check → redirects to /login.
 * - If authenticated → renders children via <Outlet />.
 */
const RequireAuth: React.FC = () => {
  const { accessToken, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0f0f14' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.4)', borderTopColor: '#6366f1' }}
        />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
