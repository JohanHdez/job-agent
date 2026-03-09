import { createBrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import LandingPage from './features/landing/LandingPage.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
    ],
  },
]);
