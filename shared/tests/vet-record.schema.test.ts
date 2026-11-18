import { describe, expect, it } from 'vitest';
import { VET_RECORD_TYPES } from '../src/constants/animals.js';
import { vetRecordBodySchema } from '../src/schemas/vet-record.schema.js';

const base = { recordDate: '2026-11-01', type: 'checkup', description: 'Revisión mensual.' };

describe('CU-34 esquema del registro veterinario', () => {
  it('los tipos coinciden con el CHECK de vet_records.type en seedsql.sql', () => {
    expect(VET_RECORD_TYPES).toEqual(['checkup', 'vaccine', 'treatment', 'surgery']);
  });

  it('3: fecha, tipo, descripción, peso opcional (con coma o punto) y veterinario', () => {
    expect(vetRecordBodySchema.parse({ ...base, weightKg: '8,4', veterinarian: ' Dra. Sendra ' })).toEqual({
      ...base,
      weightKg: '8.40',
      veterinarian: 'Dra. Sendra',
    });
    expect(vetRecordBodySchema.parse({ ...base, weightKg: '' })).toMatchObject({ weightKg: null, veterinarian: null });
    expect(vetRecordBodySchema.parse(base)).toMatchObject({ weightKg: null });
  });

  it('4a: un peso menor o igual a 0 es un error en el campo', () => {
    for (const weightKg of ['0', '0,00', '-3', 'mucho', '12345']) {
      const r = vetRecordBodySchema.safeParse({ ...base, weightKg });
      expect(r.error?.issues[0]?.path).toEqual(['weightKg']);
    }
  });

  it('pide la descripción, un tipo válido y una fecha', () => {
    const r = vetRecordBodySchema.safeParse({ recordDate: 'ayer', type: 'otro', description: '  ' });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(['description', 'recordDate', 'type']);
  });
});
