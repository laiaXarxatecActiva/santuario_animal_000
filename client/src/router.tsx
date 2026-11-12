import type { RouteObject } from 'react-router';
import { PublicLayout } from './layouts/PublicLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { AnimalPage } from './pages/public/AnimalPage';
import { CatalogPage } from './pages/public/CatalogPage';
import { HomePage } from './pages/public/HomePage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';

// Rutas del navegador (TECH_SPEC §12.1). Las demás llegarán con sus casos de uso.
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'animals', element: <CatalogPage /> },
      { path: 'animals/:id', element: <AnimalPage /> },
      { path: 'how-it-works', element: <HowItWorksPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
