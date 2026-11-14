import type { AdminPhotoDto } from '@sanctuary/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhotoGrid } from '../src/components/admin/PhotoGrid';

const foto = (overrides: Partial<AdminPhotoDto>): AdminPhotoDto => ({
  id: 1,
  mediaType: 'image',
  url: '/uploads/animals/1/a.webp',
  thumbnailUrl: '/uploads/animals/1/a_thumb.webp',
  altText: 'Rufo en su rampa',
  visibility: 'public',
  sortOrder: 0,
  isCover: false,
  ...overrides,
});

const fotos = [
  foto({ id: 1, altText: 'Rufo en su rampa', isCover: true }),
  foto({ id: 16, altText: 'Rufo comiendo', sortOrder: 1 }),
  foto({ id: 17, altText: 'Rufo de cerca', sortOrder: 2, visibility: 'adopters' }),
  foto({ id: 21, altText: 'Vídeo de Rufo', sortOrder: 3, mediaType: 'video', thumbnailUrl: null, url: '/v.mp4' }),
];

function pintar() {
  const handlers = { onReorder: vi.fn(), onSetCover: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<PhotoGrid photos={fotos} {...handlers} />);
  const items = screen.getAllByRole('listitem');
  return { handlers, items };
}

describe('CU-29 PhotoGrid (galería del panel)', () => {
  it('muestra cada foto con su visibilidad, la portada y los vídeos marcados', () => {
    const { items } = pintar();
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText('Portada')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Pública')).toBeInTheDocument();
    expect(within(items[2]!).getByText('Solo adoptantes')).toBeInTheDocument();
    expect(within(items[3]!).getByText('Vídeo')).toBeInTheDocument();
    expect(within(items[1]!).getByRole('img', { name: 'Rufo comiendo' })).toBeInTheDocument();
  });

  it('5 y 5a: solo una imagen pública puede ser la portada', async () => {
    const { handlers } = pintar();
    expect(screen.getByRole('button', { name: 'Portada: Rufo en su rampa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Elegir como portada: Rufo de cerca' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Elegir como portada: Vídeo de Rufo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Elegir como portada: Rufo comiendo' }));
    expect(handlers.onSetCover).toHaveBeenCalledWith(fotos[1]);
  });

  it('5: cambia el orden con los botones subir y bajar', async () => {
    const { handlers } = pintar();
    expect(screen.getByRole('button', { name: 'Subir Rufo en su rampa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Vídeo de Rufo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Rufo en su rampa' }));
    expect(handlers.onReorder).toHaveBeenLastCalledWith([16, 1, 17, 21]);
    await userEvent.click(screen.getByRole('button', { name: 'Subir Vídeo de Rufo' }));
    expect(handlers.onReorder).toHaveBeenLastCalledWith([1, 16, 21, 17]);
  });

  it('5: cambia el orden arrastrando una foto sobre otra', () => {
    const { handlers, items } = pintar();
    expect(items[0]).toHaveAttribute('draggable', 'true');
    fireEvent.dragStart(items[0]!);
    fireEvent.dragOver(items[2]!);
    fireEvent.drop(items[2]!);
    expect(handlers.onReorder).toHaveBeenCalledWith([16, 17, 1, 21]);
  });

  it('A1 y A2: los botones de editar y borrar avisan con la foto', async () => {
    const { handlers } = pintar();
    await userEvent.click(screen.getByRole('button', { name: 'Editar Rufo comiendo' }));
    expect(handlers.onEdit).toHaveBeenCalledWith(fotos[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Borrar Rufo de cerca' }));
    expect(handlers.onDelete).toHaveBeenCalledWith(fotos[2]);
  });
});
