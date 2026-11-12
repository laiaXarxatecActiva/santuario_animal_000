import { describe, expect, it } from 'vitest';
import { paginar } from '../src/dominio/paginacion.js';

describe('paginar', () => {
  it('calcula el desplazamiento y el número de páginas', () => {
    expect(paginar({ page: 2, pageSize: 5 }, 12)).toEqual({
      page: 2,
      pageSize: 5,
      total: 12,
      totalPages: 3,
      offset: 5,
    });
  });

  it('CU-02 4b: una página fuera de rango se convierte en la última', () => {
    expect(paginar({ page: 9, pageSize: 5 }, 12)).toMatchObject({ page: 3, offset: 10 });
  });

  it('sin resultados hay 0 páginas y se queda en la primera', () => {
    expect(paginar({ page: 4, pageSize: 5 }, 0)).toEqual({ page: 1, pageSize: 5, total: 0, totalPages: 0, offset: 0 });
  });
});
