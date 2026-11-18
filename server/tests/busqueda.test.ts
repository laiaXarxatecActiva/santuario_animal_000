import { describe, expect, it } from 'vitest';
import { escaparLike, sinTildes } from '../src/db/busqueda.js';

describe('CU-37 y CU-38 Búsqueda de texto en los listados', () => {
  it('quita mayúsculas y tildes de una expresión SQL', () => {
    expect(sinTildes('u.email')).toBe("translate(lower(u.email), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc')");
  });

  it('escapa los comodines de LIKE', () => {
    expect(escaparLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});
