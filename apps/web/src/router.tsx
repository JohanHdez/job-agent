import { createBrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import LandingPage from './features/landing/LandingPage.tsx';
import LoginPage from './features/auth/LoginPage.tsx';
import AuthCallbackPage from './features/auth/AuthCallbackPage.tsx';
import ProfilePage from './features/profile/ProfilePage.tsx';
import ProfileSetupPage from './features/profile/ProfileSetupPage.tsx';
import ConfigPage from './features/config/ConfigPage.tsx';
import ApplicationHistoryPage from './features/history/ApplicationHistoryPage.tsx';
import SessionReportPage from './features/history/SessionReportPage.tsx';
import RequireAuth from './components/RequireAuth.tsx';
import RequireGuest from './components/RequireGuest.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      // /auth/callback is its own flow — no guard needed
      { path: 'auth/callback', element: <AuthCallbackPage /> },

      // Public-only: redirect to /config if already authenticated
      {
        element: <RequireGuest />,
        children: [
          { path: 'login', element: <LoginPage /> },
        ],
      },

      // Protected: redirect to /login if not authenticated
      {
        element: <RequireAuth />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'profile/setup', element: <ProfileSetupPage /> },
          { path: 'config', element: <ConfigPage /> },
          { path: 'history', element: <ApplicationHistoryPage /> },
          { path: 'report', element: <SessionReportPage /> },
        ],
      },
    ],
  },
]);
