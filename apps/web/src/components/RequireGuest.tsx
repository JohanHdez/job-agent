import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Wraps public-only routes (e.g. /login).
 * - While the initial auth check is pending → renders nothing (avoids flash of login page).
 * - If already authenticated → redirects to /config.
 * - If unauthenticated → renders children via <Outlet />.
 */
const RequireGuest: React.FC = () => {
  const { accessToken, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return null;
  }

  if (accessToken) {
    return <Navigate to="/config" replace />;
  }

  return <Outlet />;
};

export default RequireGuest;
