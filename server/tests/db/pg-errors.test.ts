import { describe, expect, it } from 'vitest';
import { esErrorPg, PG_UNIQUE_VIOLATION } from '../../src/db/pg-errors.js';

describe('esErrorPg', () => {
  const error = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'users_email_lower_key' });

  it('reconoce el código y la restricción', () => {
    expect(esErrorPg(error, PG_UNIQUE_VIOLATION)).toBe(true);
    expect(esErrorPg(error, PG_UNIQUE_VIOLATION, 'users_email_lower_key')).toBe(true);
    expect(esErrorPg(error, PG_UNIQUE_VIOLATION, 'otra')).toBe(false);
    expect(esErrorPg(error, '23503')).toBe(false);
  });

  it('no falla con valores que no son errores', () => {
    expect(esErrorPg(null, PG_UNIQUE_VIOLATION)).toBe(false);
    expect(esErrorPg('23505', PG_UNIQUE_VIOLATION)).toBe(false);
  });
});
