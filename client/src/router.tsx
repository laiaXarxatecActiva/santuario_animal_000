import { WORKER_ROLES } from '@sanctuary/shared';
import type { RouteObject } from 'react-router';
import { RequireRole } from './components/RequireRole';
import { AdminLayout } from './layouts/AdminLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { AdoptedAnimalPage } from './pages/adopter/AdoptedAnimalPage';
import { AdoptPage } from './pages/adopter/AdoptPage';
import { FeedPage } from './pages/adopter/FeedPage';
import { MyAnimalsPage } from './pages/adopter/MyAnimalsPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { AnimalPage } from './pages/public/AnimalPage';
import { CatalogPage } from './pages/public/CatalogPage';
import { HomePage } from './pages/public/HomePage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';

// Rutas del navegador (TECH_SPEC §12.1). Las demás llegarán con sus casos de uso.
export const routes: RouteObject[] = [
  {
    // Panel de gestión (SCREENS §5), solo para trabajadores.
    path: 'admin',
    element: <RequireRole roles={WORKER_ROLES} />,
    children: [
      {
        element: <AdminLayout />,
        children: [{ index: true, element: <DashboardPage /> }],
      },
    ],
  },
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'animals', element: <CatalogPage /> },
      { path: 'animals/:id', element: <AnimalPage /> },
      { path: 'how-it-works', element: <HowItWorksPage /> },
      { path: 'adopt/:animalId', element: <AdoptPage /> },
      {
        // Área del adoptante (SCREENS §4).
        element: <RequireRole roles={['adopter']} />,
        children: [
          { path: 'my-animals', element: <MyAnimalsPage /> },
          { path: 'my-animals/:animalId', element: <AdoptedAnimalPage /> },
          { path: 'feed', element: <FeedPage /> },
        ],
      },
      {
        // Cualquier usuario con sesión.
        element: <RequireRole />,
        children: [{ path: 'profile', element: <ProfilePage /> }],
      },
      { path: 'register', element: <RegisterPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
