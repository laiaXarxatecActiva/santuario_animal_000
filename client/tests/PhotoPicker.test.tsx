import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PhotoPicker } from '../src/components/PhotoPicker';

const foto = (nombre: string, tipo = 'image/jpeg', bytes = 2048) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

function Prueba() {
  const [archivos, setArchivos] = useState<File[]>([]);
  return (
    <>
      <PhotoPicker label="Fotos (opcional)" value={archivos} onChange={setArchivos} max={5} />
      <p data-testid="elegidas">{archivos.map((a) => a.name).join(', ') || 'ninguna'}</p>
    </>
  );
}

describe('CU-70 Selector de fotos', () => {
  it('sin fotos, invita a arrastrarlas o elegirlas y dice los formatos y el máximo', () => {
    render(<Prueba />);
    expect(screen.getByRole('group', { name: 'Fotos (opcional)' })).toBeInTheDocument();
    expect(screen.getByText(/Arrastra aquí las fotos/)).toBeInTheDocument();
    const campo = screen.getByLabelText('Elegir fotos');
    expect(campo).toHaveAttribute('multiple');
    expect(campo).toHaveAccessibleDescription('Hasta 5 fotos JPG, PNG o WebP de hasta 5 MB cada una.');
  });

  it('se eligen varias, se ven con su nombre y tamaño, se añaden más y se quita una', async () => {
    render(<Prueba />);
    await userEvent.upload(screen.getByLabelText('Elegir fotos'), [foto('malla.jpg'), foto('techo.jpg')]);
    expect(screen.getByTestId('elegidas')).toHaveTextContent('malla.jpg, techo.jpg');
    const lista = within(screen.getByRole('list', { name: 'Fotos elegidas' }));
    expect(lista.getAllByRole('listitem')).toHaveLength(2);
    expect(lista.getByText('malla.jpg')).toBeInTheDocument();
    expect(lista.getAllByText('2 KB')).toHaveLength(2);

    await userEvent.upload(screen.getByLabelText('Añadir fotos'), foto('poste.jpg'));
    expect(screen.getByTestId('elegidas')).toHaveTextContent('malla.jpg, techo.jpg, poste.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Quitar malla.jpg' }));
    expect(screen.getByTestId('elegidas')).toHaveTextContent('techo.jpg, poste.jpg');
  });

  it('como mucho 5: las que sobran no se añaden y, con 5, ya no se pueden añadir más', async () => {
    render(<Prueba />);
    const seis = ['1', '2', '3', '4', '5', '6'].map((n) => foto(`foto-${n}.jpg`));
    await userEvent.upload(screen.getByLabelText('Elegir fotos'), seis);
    expect(screen.getByTestId('elegidas')).toHaveTextContent(
      'foto-1.jpg, foto-2.jpg, foto-3.jpg, foto-4.jpg, foto-5.jpg',
    );
    expect(screen.getByText('Como mucho 5 fotos.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Añadir fotos')).not.toBeInTheDocument();
  });

  it('rechaza otros formatos y las de más de 5 MB, y se queda con las buenas', async () => {
    render(<Prueba />);
    const campo = screen.getByLabelText('Elegir fotos');
    await userEvent.upload(campo, [foto('informe.gif', 'image/gif'), foto('bien.jpg')], { applyAccept: false });
    expect(screen.getByText('Elige una foto JPG, PNG o WebP.')).toBeInTheDocument();
    expect(screen.getByTestId('elegidas')).toHaveTextContent('bien.jpg');
    await userEvent.upload(
      screen.getByLabelText('Añadir fotos'),
      foto('enorme.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1),
    );
    expect(screen.getByText('La foto ocupa más de 5 MB.')).toBeInTheDocument();
    expect(screen.getByTestId('elegidas')).toHaveTextContent('bien.jpg');
  });
});
