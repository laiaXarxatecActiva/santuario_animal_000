import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import i18n from '../src/i18n';

// jsdom dice que el navegador está en inglés; las pruebas se escriben en castellano.
void i18n.changeLanguage('es');

// Con todos los archivos en paralelo, 1 s (el valor por defecto) se queda corto
// para las esperas de findBy* y waitFor.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  void i18n.changeLanguage('es');
  document.documentElement.removeAttribute('data-theme');
});

// jsdom no implementa showModal() ni close() de <dialog> (DESIGN_SYSTEM §8.4).
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
