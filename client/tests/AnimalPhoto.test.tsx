import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimalPhoto } from '../src/components/AnimalPhoto';
import { card } from './helpers/fixtures';

const foto = card().coverPhoto!;

describe('AnimalPhoto', () => {
  it('usa la foto grande o la miniatura', () => {
    const { rerender } = render(<AnimalPhoto photo={foto} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', foto.url);
    rerender(<AnimalPhoto photo={foto} thumbnail />);
    expect(screen.getByRole('img')).toHaveAttribute('src', foto.thumbnailUrl);
  });

  it('sin foto muestra el recuadro con la pluma, oculto a los lectores de pantalla', () => {
    const { container } = render(<AnimalPhoto photo={null} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[data-placeholder]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('si la imagen no carga, muestra el recuadro conservando el texto alternativo', () => {
    render(<AnimalPhoto photo={foto} />);
    fireEvent.error(screen.getByRole('img'));
    const sustituto = screen.getByRole('img', { name: foto.altText });
    expect(sustituto.tagName).not.toBe('IMG');
  });
});
