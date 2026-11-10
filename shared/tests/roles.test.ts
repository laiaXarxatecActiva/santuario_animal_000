import { describe, expect, it } from 'vitest';
import { isWorkerRole } from '../src/constants/roles.js';

describe('roles', () => {
  it('cuidadores y administradores son trabajadores', () => {
    expect(isWorkerRole('caretaker')).toBe(true);
    expect(isWorkerRole('admin')).toBe(true);
  });

  it('un adoptante no es trabajador', () => {
    expect(isWorkerRole('adopter')).toBe(false);
  });
});
