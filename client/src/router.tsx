import { WORKER_ROLES } from '@sanctuary/shared';
import type { RouteObject } from 'react-router';
import { RequireRole } from './components/RequireRole';
import { AdminLayout } from './layouts/AdminLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ActivityAdminPage } from './pages/admin/ActivityAdminPage';
import { StatsAdminPage } from './pages/admin/StatsAdminPage';
import { AnimalAdminPage } from './pages/admin/AnimalAdminPage';
import { AnimalDataTab } from './pages/admin/AnimalDataTab';
import { AnimalPhotosTab } from './pages/admin/AnimalPhotosTab';
import { AnimalUpdatesTab } from './pages/admin/AnimalUpdatesTab';
import { AnimalVetTab } from './pages/admin/AnimalVetTab';
import { VetRecordsAdminPage } from './pages/admin/VetRecordsAdminPage';
import { UpdateFormPage } from './pages/admin/UpdateFormPage';
import { UpdatesAdminPage } from './pages/admin/UpdatesAdminPage';
import { AnimalsAdminPage } from './pages/admin/AnimalsAdminPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { AdoptionAdminPage } from './pages/admin/AdoptionAdminPage';
import { AdoptionsAdminPage } from './pages/admin/AdoptionsAdminPage';
import { NewAdoptionPage } from './pages/admin/NewAdoptionPage';
import { NewAnimalPage } from './pages/admin/NewAnimalPage';
import { NewWorkerPage } from './pages/admin/NewWorkerPage';
import { DonationsAdminPage } from './pages/admin/DonationsAdminPage';
import { NewDonationPage } from './pages/admin/NewDonationPage';
import { PaymentsAdminPage } from './pages/admin/PaymentsAdminPage';
import { PlansAdminPage } from './pages/admin/PlansAdminPage';
import { UserAdminPage } from './pages/admin/UserAdminPage';
import { UsersAdminPage } from './pages/admin/UsersAdminPage';
import { SpeciesAdminPage } from './pages/admin/SpeciesAdminPage';
import { AdoptedAnimalPage } from './pages/adopter/AdoptedAnimalPage';
import { AdoptPage } from './pages/adopter/AdoptPage';
import { ContributionsPage } from './pages/adopter/ContributionsPage';
import { FeedPage } from './pages/adopter/FeedPage';
import { MyAnimalsPage } from './pages/adopter/MyAnimalsPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { AboutPage } from './pages/public/AboutPage';
import { AnimalPage } from './pages/public/AnimalPage';
import { CatalogPage } from './pages/public/CatalogPage';
import { CookiesPage } from './pages/public/CookiesPage';
import { DonatePage } from './pages/public/DonatePage';
import { HomePage } from './pages/public/HomePage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { MemorialAnimalPage } from './pages/public/MemorialAnimalPage';
import { MemorialPage } from './pages/public/MemorialPage';
import { PrivacyPage } from './pages/public/PrivacyPage';

// Rutas del navegador (TECH_SPEC §12.1). Las demás llegarán con sus casos de uso.
export const routes: RouteObject[] = [
  {
    // Panel de gestión (SCREENS §5), solo para trabajadores.
    path: 'admin',
    element: <RequireRole roles={WORKER_ROLES} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'animals', element: <AnimalsAdminPage /> },
          { path: 'animals/new', element: <NewAnimalPage /> },
          {
            path: 'animals/:id',
            element: <AnimalAdminPage />,
            children: [
              { index: true, element: <AnimalDataTab /> },
              { path: 'photos', element: <AnimalPhotosTab /> },
              { path: 'updates', element: <AnimalUpdatesTab /> },
              { path: 'vet', element: <AnimalVetTab /> },
            ],
          },
          { path: 'species', element: <SpeciesAdminPage /> },
          { path: 'vet-records', element: <VetRecordsAdminPage /> },
          { path: 'updates', element: <UpdatesAdminPage /> },
          { path: 'updates/new', element: <UpdateFormPage /> },
          { path: 'updates/:id', element: <UpdateFormPage /> },
          {
            // Administración (TECH_SPEC §10.7): solo administradores.
            element: <RequireRole roles={['admin']} />,
            children: [
              { path: 'users', element: <UsersAdminPage /> },
              { path: 'users/new', element: <NewWorkerPage /> },
              { path: 'users/:id', element: <UserAdminPage /> },
              { path: 'adoptions', element: <AdoptionsAdminPage /> },
              { path: 'adoptions/new', element: <NewAdoptionPage /> },
              { path: 'adoptions/:id', element: <AdoptionAdminPage /> },
              { path: 'payments', element: <PaymentsAdminPage /> },
              { path: 'donations', element: <DonationsAdminPage /> },
              { path: 'donations/new', element: <NewDonationPage /> },
              { path: 'plans', element: <PlansAdminPage /> },
              { path: 'stats', element: <StatsAdminPage /> },
              { path: 'activity', element: <ActivityAdminPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
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
      { path: 'about', element: <AboutPage /> },
      { path: 'donate', element: <DonatePage /> },
      { path: 'memorial', element: <MemorialPage /> },
      { path: 'memorial/:id', element: <MemorialAnimalPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'cookies', element: <CookiesPage /> },
      { path: 'adopt/:animalId', element: <AdoptPage /> },
      {
        // Área del adoptante (SCREENS §4).
        element: <RequireRole roles={['adopter']} />,
        children: [
          { path: 'my-animals', element: <MyAnimalsPage /> },
          { path: 'my-animals/:animalId', element: <AdoptedAnimalPage /> },
          { path: 'feed', element: <FeedPage /> },
          { path: 'my-contributions', element: <ContributionsPage /> },
        ],
      },
      {
        // Cualquier usuario con sesión.
        element: <RequireRole />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'notifications', element: <NotificationsPage /> },
        ],
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
