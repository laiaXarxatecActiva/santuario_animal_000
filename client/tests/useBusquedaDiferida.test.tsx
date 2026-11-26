import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ESPERA_BUSQUEDA, useBusquedaDiferida } from '../src/hooks/useBusquedaDiferida';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Buscadores del panel: filtran a medida que se escribe', () => {
  it('aplica el texto (recortado) cuando se deja de escribir, una sola vez', () => {
    const aplicar = vi.fn();
    const { result } = renderHook(() => useBusquedaDiferida('', aplicar));
    act(() => result.current[1]('l'));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current[1]('luc '));
    expect(aplicar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA));
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(aplicar).toHaveBeenCalledWith('luc');
  });

  it('borrar el texto quita el filtro', () => {
    const aplicar = vi.fn();
    const { result } = renderHook(() => useBusquedaDiferida('rufo', aplicar));
    expect(result.current[0]).toBe('rufo');
    act(() => result.current[1]('   '));
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA));
    expect(aplicar).toHaveBeenCalledWith(undefined);
  });

  it('no vuelve a aplicar lo que ya está aplicado (al entrar ni tras aplicarlo)', () => {
    const aplicar = vi.fn();
    const { result, rerender } = renderHook(({ aplicado }) => useBusquedaDiferida(aplicado, aplicar), {
      initialProps: { aplicado: 'rufo' },
    });
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA));
    expect(aplicar).not.toHaveBeenCalled();
    act(() => result.current[1]('brisa'));
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA));
    rerender({ aplicado: 'brisa' });
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA));
    expect(aplicar).toHaveBeenCalledTimes(1);
  });

  it('«ya» aplica al momento lo escrito (Enter), sin esperar', () => {
    const aplicar = vi.fn();
    const { result } = renderHook(() => useBusquedaDiferida('', aplicar));
    act(() => result.current[1]('pablo'));
    act(() => result.current[2]());
    expect(aplicar).toHaveBeenCalledWith('pablo');
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA));
    expect(aplicar).toHaveBeenCalledTimes(1);
  });
});
