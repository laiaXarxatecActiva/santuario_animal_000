// Primero los estilos globales, para que los CSS Modules de los componentes los puedan sobrescribir.
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito-sans';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';
import './styles/utilities.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el elemento #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
