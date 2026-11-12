import { describe, expect, it } from 'vitest';
import { ADOPTER_HOME, homeFor, safeNext, WORKER_HOME } from '../src/utils/redirect';
import { sessionUser } from './helpers/fixtures';

describe('redirecciones tras entrar', () => {
  it('safeNext solo acepta rutas internas', () => {
    expect(safeNext('/animals/3')).toBe('/animals/3');
    expect(safeNext('/animals?page=2')).toBe('/animals?page=2');
    expect(safeNext(null)).toBeUndefined();
    expect(safeNext('')).toBeUndefined();
    expect(safeNext('https://malicioso.test')).toBeUndefined();
    expect(safeNext('//malicioso.test')).toBeUndefined();
    expect(safeNext('/\\malicioso.test')).toBeUndefined();
  });

  it('CU-09 paso 5: el adoptante vuelve a la página de origen o a su inicio', () => {
    expect(homeFor(sessionUser(), '/animals/3')).toBe('/animals/3');
    expect(homeFor(sessionUser(), undefined)).toBe(ADOPTER_HOME);
  });

  it('CU-09 paso 5: el trabajador va siempre a su inicio', () => {
    expect(homeFor(sessionUser({ role: 'caretaker' }), '/animals/3')).toBe(WORKER_HOME);
    expect(homeFor(sessionUser({ role: 'admin' }), undefined)).toBe(WORKER_HOME);
  });
});
