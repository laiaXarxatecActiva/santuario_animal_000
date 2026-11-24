import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PhotoPicker } from '../src/components/PhotoPicker';

const foto = (nombre: string, tipo = 'image/jpeg', bytes = 2048) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

function Prueba() {
  const [archivo, setArchivo] = useState<File | undefined>(undefined);
  return (
    <>
      <PhotoPicker label="Foto (opcional)" value={archivo} onChange={setArchivo} />
      <p data-testid="elegida">{archivo?.name ?? 'ninguna'}</p>
    </>
  );
}

describe('CU-70, CU-57 Selector de una foto', () => {
  it('sin foto, invita a arrastrarla o elegirla y dice los formatos', () => {
    render(<Prueba />);
    expect(screen.getByRole('group', { name: 'Foto (opcional)' })).toBeInTheDocument();
    expect(screen.getByText(/Arrastra aquí una foto/)).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir foto')).toHaveAccessibleDescription('JPG, PNG o WebP de hasta 5 MB.');
  });

  it('muestra la foto elegida con su nombre y se puede quitar', async () => {
    render(<Prueba />);
    await userEvent.upload(screen.getByLabelText('Elegir foto'), foto('malla.jpg'));
    expect(screen.getByTestId('elegida')).toHaveTextContent('malla.jpg');
    const grupo = within(screen.getByRole('group', { name: 'Foto (opcional)' }));
    expect(grupo.getByText('malla.jpg')).toBeInTheDocument();
    expect(grupo.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByLabelText('Cambiar foto')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar la foto' }));
    expect(screen.getByTestId('elegida')).toHaveTextContent('ninguna');
    expect(screen.getByLabelText('Elegir foto')).toBeInTheDocument();
  });

  it('rechaza otros formatos y las de más de 5 MB', async () => {
    render(<Prueba />);
    const campo = screen.getByLabelText('Elegir foto');
    await userEvent.upload(campo, foto('informe.gif', 'image/gif'), { applyAccept: false });
    expect(screen.getByText('Elige una foto JPG, PNG o WebP.')).toBeInTheDocument();
    await userEvent.upload(campo, foto('enorme.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1));
    expect(screen.getByText('La foto ocupa más de 5 MB.')).toBeInTheDocument();
    expect(screen.getByTestId('elegida')).toHaveTextContent('ninguna');
  });
});
