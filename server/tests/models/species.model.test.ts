import { describe, expect, it } from 'vitest';
import { mapRow } from '../../src/models/species.model.js';

describe('species.model', () => {
  it('mapRow pasa a camelCase', () => {
    expect(mapRow({ id: 2, name: 'Buitre negro', scientific_name: null })).toEqual({
      id: 2,
      name: 'Buitre negro',
      scientificName: null,
    });
  });
});
