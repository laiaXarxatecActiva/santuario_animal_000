import { describe, expect, it } from 'vitest';
import { flashState, readFlash } from '../src/utils/flash';

describe('avisos entre páginas', () => {
  it('lee el aviso que deja flashState', () => {
    expect(readFlash(flashState({ type: 'success', message: 'Hecho' }))).toEqual({ type: 'success', message: 'Hecho' });
  });

  it('ignora estados que no son un aviso válido', () => {
    for (const estado of [null, undefined, 'x', {}, { flash: null }, { flash: { type: 'raro', message: 'x' } }]) {
      expect(readFlash(estado)).toBeUndefined();
    }
    expect(readFlash({ flash: { type: 'info', message: 3 } })).toBeUndefined();
  });
});
