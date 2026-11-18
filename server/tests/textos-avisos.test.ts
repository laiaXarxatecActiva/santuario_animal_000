import { describe, expect, it } from 'vitest';
import { avisos } from '../src/servicios/textos-avisos.js';

describe('Fase 3 Textos de los avisos de la campana', () => {
  it('cada aviso tiene texto en castellano, valenciano e inglés, distintos y con el nombre del animal', () => {
    const ejemplos = [
      avisos.adopcionActiva('Rufo'),
      avisos.cuotaFallida('Rufo'),
      avisos.cambioDePlan('Rufo', '2030-02-01', '10.00', 'Plata'),
      avisos.bajaSolicitada('Rufo', '2030-02-28'),
      avisos.cuotaDevuelta('Rufo', '5.00'),
      avisos.fallecido('Rufo'),
      avisos.nuevaActualizacion('Rufo', 'Hola'),
      avisos.sinActualizar('Rufo', 30),
    ];
    for (const t of ejemplos) {
      expect(new Set([t.es, t.ca, t.en]).size).toBe(3);
      for (const texto of [t.es, t.ca, t.en]) expect(texto).toContain('Rufo');
    }
  });

  it('los importes van con el formato de cada idioma', () => {
    const t = avisos.gracias('10');
    expect(t.es).toBe('Gracias por tu donación de 10,00 €.');
    expect(t.en).toBe('Thank you for your donation of €10.00.');
    expect(t.ca).toContain('10,00 €');
  });

  it('el castellano no cambia respecto a la Fase 2', () => {
    expect(avisos.caducada('Rufo').es).toBe(
      'Tu adopción de Rufo se ha cancelado porque no se completó el pago en 7 días. Puedes intentarlo de nuevo cuando quieras.',
    );
  });
});
