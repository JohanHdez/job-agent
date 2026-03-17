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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'profile/setup', element: <ProfileSetupPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'history', element: <ApplicationHistoryPage /> },
      { path: 'report', element: <SessionReportPage /> },
    ],
  },
]);
