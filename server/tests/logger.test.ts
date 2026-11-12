import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/utils/logger.js';

function memoria() {
  const lineas: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, done) {
      lineas.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { stream, lineas };
}

describe('createLogger', () => {
  it('no escribe nada en el entorno de pruebas', () => {
    const { stream, lineas } = memoria();
    createLogger('test', stream).error('algo');
    expect(lineas).toEqual([]);
  });

  it('escribe en JSON en desarrollo', () => {
    const { stream, lineas } = memoria();
    createLogger('development', stream).info('hola');
    expect(lineas[0]).toMatchObject({ msg: 'hola', level: 30 });
  });

  it('nunca registra cookies, cabeceras de autorización ni contraseñas', () => {
    const { stream, lineas } = memoria();
    createLogger('production', stream).info(
      { req: { headers: { cookie: 'sid=secreto', authorization: 'Bearer x' } }, body: { password: 'p' } },
      'petición',
    );
    const texto = JSON.stringify(lineas[0]);
    expect(texto).not.toContain('secreto');
    expect(texto).not.toContain('Bearer');
    expect(texto).not.toContain('"p"');
  });
});
