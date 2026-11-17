import { describe, expect, it } from 'vitest';
import { animalStatusBodySchema } from '../src/index.js';

describe('CU-33 Registrar el fallecimiento o traslado: cuerpo de la petición', () => {
  it('3: acepta el mensaje para los adoptantes, sin espacios alrededor', () => {
    const datos = animalStatusBodySchema.parse({ status: 'deceased', message: '  Nos despedimos de Lupe.  ' });
    expect(datos.message).toBe('Nos despedimos de Lupe.');
  });

  it('un mensaje vacío o solo con espacios cuenta como que no hay mensaje', () => {
    expect(animalStatusBodySchema.parse({ status: 'deceased', message: '   ' }).message).toBeUndefined();
    expect(animalStatusBodySchema.parse({ status: 'transferred' }).message).toBeUndefined();
  });

  it('el mensaje tiene como máximo 10 000 caracteres, como el texto de una actualización', () => {
    expect(animalStatusBodySchema.safeParse({ status: 'deceased', message: 'a'.repeat(10000) }).success).toBe(true);
    expect(animalStatusBodySchema.safeParse({ status: 'deceased', message: 'a'.repeat(10001) }).success).toBe(false);
  });
});
