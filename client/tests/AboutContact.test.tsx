import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const rellenar = async () => {
  await userEvent.type(await screen.findByLabelText('Nombre'), 'Ana Pérez');
  await userEvent.type(screen.getByLabelText('Email'), 'ana@correo.test');
  await userEvent.type(screen.getByLabelText('Asunto'), 'Visita');
  await userEvent.type(screen.getByLabelText('Mensaje'), '¿Se puede visitar?');
  await userEvent.click(screen.getByRole('checkbox', { name: /política de privacidad/ }));
};
const enviar = () => userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

describe('CU-06 Enviar el formulario de contacto', () => {
  it('2-4: envía el mensaje, avisa y vacía el formulario', async () => {
    const { enviados } = mockApi({
      '/api/contact': { status: 202, body: { message: 'Mensaje enviado. Te responderemos lo antes posible.' } },
    });
    renderRoute('/about');
    expect(await screen.findByRole('heading', { level: 2, name: 'Escríbenos' })).toBeInTheDocument();
    await rellenar();
    await enviar();
    expect(await screen.findByText('Mensaje enviado. Te responderemos lo antes posible.')).toBeInTheDocument();
    expect(enviados('/api/contact')).toEqual([
      {
        name: 'Ana Pérez',
        email: 'ana@correo.test',
        subject: 'Visita',
        message: '¿Se puede visitar?',
        acceptPrivacy: true,
      },
    ]);
    expect(screen.getByLabelText('Mensaje')).toHaveValue('');
  });

  it('3a: los campos obligatorios y la privacidad se comprueban antes de enviar', async () => {
    const { pedidas } = mockApi({});
    renderRoute('/about');
    await screen.findByLabelText('Nombre');
    await enviar();
    expect(await screen.findByText('Escribe tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Debes aceptar la política de privacidad.')).toBeInTheDocument();
    expect(pedidas('/api/contact')).toEqual([]);
  });

  it('3b: demasiados envíos', async () => {
    mockApi({ '/api/contact': errorApi(429, 'TOO_MANY_REQUESTS', 'x') });
    renderRoute('/about');
    await rellenar();
    await enviar();
    expect(await screen.findByText('Has enviado demasiados mensajes; inténtalo más tarde.')).toBeInTheDocument();
  });

  it('3c: si falla el envío, avisa y conserva lo escrito', async () => {
    mockApi({ '/api/contact': errorApi(503, 'EMAIL_NOT_SENT', 'x') });
    renderRoute('/about');
    await rellenar();
    await enviar();
    expect(
      await screen.findByText('No hemos podido enviar tu mensaje. Inténtalo de nuevo más tarde.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje')).toHaveValue('¿Se puede visitar?');
  });
});
