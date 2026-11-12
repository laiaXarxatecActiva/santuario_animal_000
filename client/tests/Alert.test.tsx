import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert } from '../src/components/Alert';

afterEach(() => {
  vi.useRealTimers();
});

describe('Alert', () => {
  it('los errores usan role="alert" y el resto role="status"', () => {
    render(
      <>
        <Alert type="error">Mal</Alert>
        <Alert type="info">Info</Alert>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Mal');
    expect(screen.getByRole('status')).toHaveTextContent('Info');
  });

  it('con onClose muestra el botón «Cerrar aviso»', async () => {
    const onClose = vi.fn();
    render(
      <Alert type="warning" onClose={onClose}>
        Aviso
      </Alert>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('un aviso de éxito se cierra solo a los 6 segundos', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Alert type="success" onClose={onClose}>
        Hecho
      </Alert>,
    );
    act(() => vi.advanceTimersByTime(5999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('la cuenta atrás se detiene mientras el ratón está encima', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Alert type="success" onClose={onClose}>
        Hecho
      </Alert>,
    );
    const aviso = screen.getByRole('status');
    fireEvent.mouseEnter(aviso);
    act(() => vi.advanceTimersByTime(10000));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseLeave(aviso);
    act(() => vi.advanceTimersByTime(6000));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('los errores no se cierran solos', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Alert type="error" onClose={onClose}>
        Mal
      </Alert>,
    );
    act(() => vi.advanceTimersByTime(60000));
    expect(onClose).not.toHaveBeenCalled();
  });
});
