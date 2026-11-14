import type { PhotoDto } from '@sanctuary/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhotoViewer } from '../src/components/PhotoViewer';

const foto = (id: number, extra: Partial<PhotoDto> = {}): PhotoDto => ({
  id,
  mediaType: 'image',
  url: `/uploads/animals/1/${id}.jpg`,
  thumbnailUrl: `/uploads/animals/1/thumb_${id}.jpg`,
  altText: `Foto ${id} de Rufo`,
  visibility: 'public',
  ...extra,
});
const FOTOS = [foto(1), foto(2), foto(3)];

function abrir(start = 0, photos = FOTOS) {
  const onClose = vi.fn();
  render(<PhotoViewer photos={photos} start={start} title="Fotos de Rufo" onClose={onClose} />);
  return { onClose };
}

describe('PhotoViewer (DESIGN_SYSTEM §8.4)', () => {
  it('abre la foto elegida a tamaño completo, con el contador', () => {
    abrir(1);
    const visor = screen.getByRole('dialog', { name: 'Fotos de Rufo' });
    expect(visor).toBeVisible();
    expect(screen.getByRole('img', { name: 'Foto 2 de Rufo' })).toHaveAttribute('src', '/uploads/animals/1/2.jpg');
    expect(screen.getByText('2 de 3')).toBeInTheDocument();
  });

  it('las flechas pasan a la foto anterior y a la siguiente, y se desactivan en los extremos', async () => {
    abrir(0);
    expect(screen.getByRole('button', { name: 'Foto anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByText('3 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Foto siguiente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(screen.getByRole('img', { name: 'Foto 2 de Rufo' })).toBeInTheDocument();
  });

  it('también se maneja con las flechas del teclado', () => {
    abrir(0);
    const visor = screen.getByRole('dialog');
    fireEvent.keyDown(visor, { key: 'ArrowRight' });
    expect(screen.getByText('2 de 3')).toBeInTheDocument();
    fireEvent.keyDown(visor, { key: 'ArrowLeft' });
    fireEvent.keyDown(visor, { key: 'ArrowLeft' });
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
  });

  it('el botón ✕ y la tecla Esc lo cierran', async () => {
    const { onClose } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('con una sola foto no muestra flechas ni contador', () => {
    abrir(0, [foto(1)]);
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 de 1')).not.toBeInTheDocument();
  });

  it('los vídeos se ven con los controles del navegador, sin reproducción automática', () => {
    const { container } = render(
      <PhotoViewer
        photos={[foto(5, { mediaType: 'video', url: '/uploads/animals/1/5.mp4', altText: 'Rufo volando' })]}
        start={0}
        title="Fotos de Rufo"
        onClose={() => {}}
      />,
    );
    const video = container.ownerDocument.querySelector('video');
    expect(video).toHaveAttribute('src', '/uploads/animals/1/5.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('aria-label', 'Rufo volando');
  });
});
