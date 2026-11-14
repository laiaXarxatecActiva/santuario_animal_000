import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MediaUploader, validarPendientes, type PendingMedia } from '../src/components/admin/MediaUploader';

const archivo = (nombre: string, tipo = 'image/jpeg') => new File(['contenido'], nombre, { type: tipo });

function Envoltorio({
  showVisibility = true,
  inicial = [],
  onChange,
}: {
  showVisibility?: boolean;
  inicial?: PendingMedia[];
  onChange?: (items: PendingMedia[]) => void;
}) {
  const [items, setItems] = useState<PendingMedia[]>(inicial);
  return (
    <MediaUploader
      items={items}
      showVisibility={showVisibility}
      onChange={(nuevos) => {
        setItems(nuevos);
        onChange?.(nuevos);
      }}
    />
  );
}

describe('CU-29 MediaUploader (zona de subida)', () => {
  it('2-3: añade los archivos elegidos, cada uno con su texto alternativo y su visibilidad', async () => {
    const onChange = vi.fn();
    render(<Envoltorio onChange={onChange} />);
    expect(
      screen.getByText('JPEG, PNG o WebP de hasta 5 MB y MP4 de hasta 50 MB. Como máximo 10 archivos.'),
    ).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText('Elegir archivos'), [
      archivo('turia.jpg'),
      archivo('turia.mp4', 'video/mp4'),
    ]);
    const foto = screen.getByRole('group', { name: 'turia.jpg' });
    const video = screen.getByRole('group', { name: 'turia.mp4' });
    await userEvent.type(within(foto).getByLabelText('Texto alternativo'), 'Turia al sol');
    await userEvent.selectOptions(within(video).getByLabelText('Visibilidad'), 'Solo adoptantes');
    const ultimo = onChange.mock.lastCall?.[0] as PendingMedia[];
    expect(ultimo.map((i) => [i.file.name, i.altText, i.visibility])).toEqual([
      ['turia.jpg', 'Turia al sol', 'public'],
      ['turia.mp4', '', 'adopters'],
    ]);
  });

  it('acepta solo los formatos permitidos en el selector de archivos', () => {
    render(<Envoltorio />);
    expect(screen.getByLabelText('Elegir archivos')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,video/mp4',
    );
    expect(screen.getByLabelText('Elegir archivos')).toHaveAttribute('multiple');
  });

  it('sin visibilidad (fotos de una actualización) no se muestra ese campo', async () => {
    render(<Envoltorio showVisibility={false} />);
    await userEvent.upload(screen.getByLabelText('Elegir archivos'), archivo('olmo.jpg'));
    const grupo = screen.getByRole('group', { name: 'olmo.jpg' });
    expect(within(grupo).getByLabelText('Texto alternativo')).toBeInTheDocument();
    expect(within(grupo).queryByLabelText('Visibilidad')).not.toBeInTheDocument();
  });

  it('quita un archivo de la lista', async () => {
    render(<Envoltorio />);
    await userEvent.upload(screen.getByLabelText('Elegir archivos'), [archivo('a.jpg'), archivo('b.jpg')]);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar a.jpg' }));
    expect(screen.queryByRole('group', { name: 'a.jpg' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'b.jpg' })).toBeInTheDocument();
  });

  it('añade los archivos que se arrastran a la zona', () => {
    render(<Envoltorio />);
    const zona = screen.getByText('Arrastra aquí las fotos o vídeos').closest('div')!;
    fireEvent.drop(zona, { dataTransfer: { files: [archivo('arrastrada.png', 'image/png')] } });
    expect(screen.getByRole('group', { name: 'arrastrada.png' })).toBeInTheDocument();
  });

  it('2: como máximo 10 archivos; los que sobran no se añaden y se avisa', async () => {
    render(<Envoltorio />);
    const once = Array.from({ length: 11 }, (_, i) => archivo(`f${i}.jpg`));
    await userEvent.upload(screen.getByLabelText('Elegir archivos'), once);
    expect(screen.getAllByRole('group')).toHaveLength(10);
    expect(screen.getByText('Puedes subir como máximo 10 archivos a la vez.')).toBeInTheDocument();
  });

  it('3a: validarPendientes marca los archivos sin texto alternativo y el error se muestra', () => {
    const items: PendingMedia[] = [
      { id: '1', file: archivo('a.jpg'), altText: 'Bien', visibility: 'public' },
      { id: '2', file: archivo('b.jpg'), altText: '  ', visibility: 'public' },
    ];
    const { items: validados, ok } = validarPendientes(items);
    expect(ok).toBe(false);
    expect(validados.map((i) => i.error)).toEqual([undefined, 'Escribe el texto alternativo.']);
    expect(validarPendientes([items[0]!]).ok).toBe(true);

    render(<Envoltorio inicial={validados} />);
    const grupo = screen.getByRole('group', { name: 'b.jpg' });
    expect(within(grupo).getByLabelText('Texto alternativo')).toHaveAccessibleDescription(
      'Escribe el texto alternativo.',
    );
  });
});
