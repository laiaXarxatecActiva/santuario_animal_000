import { describe, expect, it } from 'vitest';
import { marcasEje } from '../src/components/charts/escala';

describe('marcas del eje de los gráficos', () => {
  it('cubren de 0 al máximo con pasos redondos', () => {
    expect(marcasEje(87)).toEqual([0, 25, 50, 75, 100]);
    expect(marcasEje(12)).toEqual([0, 5, 10, 15]);
  });

  it('con un mínimo distinto de 0 (pesos) empiezan cerca del mínimo', () => {
    expect(marcasEje(9.6, 9.1)).toEqual([9, 9.2, 9.4, 9.6]);
  });

  it('si todos los valores son iguales abren un margen; sin datos (0) llegan a 1', () => {
    const marcas = marcasEje(8.4, 8.4);
    expect(marcas[0]).toBeLessThan(8.4);
    expect(marcas.at(-1)).toBeGreaterThan(8.4);
    expect(marcasEje(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
