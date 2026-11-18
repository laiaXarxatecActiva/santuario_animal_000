import { describe, expect, it } from 'vitest';
import { generarCsv, importeCsv } from '../src/utils/csv.js';

describe('CU-38 Exportación CSV', () => {
  it('UTF-8 con BOM, separador «;» y fin de línea CRLF', () => {
    const csv = generarCsv(['Nombre', 'Importe'], [['Lucía', '5,00']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿Nombre;Importe\r\nLucía;5,00\r\n');
  });

  it('entrecomilla los campos con «;», comillas o saltos de línea', () => {
    const csv = generarCsv(['Texto'], [['a;b'], ['dijo "hola"'], ['dos\nlíneas']]);
    expect(csv.split('\r\n').slice(1, 4)).toEqual(['"a;b"', '"dijo ""hola"""', '"dos\nlíneas"']);
  });

  it('un valor vacío queda como campo vacío', () => {
    expect(generarCsv(['A', 'B'], [[null, '']])).toBe('﻿A;B\r\n;\r\n');
  });

  it('neutraliza las fórmulas para que la hoja de cálculo no las ejecute', () => {
    const filas = generarCsv(['X'], [['=SUMA(A1)'], ['+34'], ['-1'], ['@x']])
      .split('\r\n')
      .slice(1, 5);
    expect(filas).toEqual(["'=SUMA(A1)", "'+34", "'-1", "'@x"]);
  });

  it('importes con coma decimal', () => {
    expect(importeCsv('12.50')).toBe('12,50');
    expect(importeCsv('1000.00')).toBe('1000,00');
  });
});
