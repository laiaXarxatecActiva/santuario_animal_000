import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { mockApi } from './helpers/render';

describe('App', () => {
  it('arranca en la página de inicio con el enlace para saltar al contenido', () => {
    mockApi({ '/api/home': { body: { shelteredCount: 0, featured: [] } } });
    render(<App />);
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});
