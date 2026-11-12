import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { animal, page, plans, sessionUser, update } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

function api(overrides: Parameters<typeof animal>[0] = {}, updates = [update]) {
  return mockApi({
    '/api/animals/1': { body: animal(overrides) },
    '/api/animals/1/updates': { body: page(updates) },
    '/api/plans': { body: { data: plans } },
  });
}

describe('CU-03 Consultar la ficha pública de un animal', () => {
  it('muestra los datos del animal', async () => {
    api();
    renderRoute('/animals/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Rufo' })).toBeInTheDocument();
    expect(screen.getByText('Buitre leonado · Macho')).toBeInTheDocument();
    expect(screen.getByText('Unos 12 años · En el santuario desde 2021')).toBeInTheDocument();
    expect(screen.getByText('Llegó tras electrocutarse en un tendido eléctrico.')).toBeInTheDocument();
    expect(screen.getByText('Tranquilo y observador.')).toBeInTheDocument();
    expect(screen.getByText('Posaderos bajos y rampas.')).toBeInTheDocument();
    const migas = screen.getByRole('navigation', { name: 'Migas de pan' });
    expect(migas).toHaveTextContent('Animales›Rufo');
  });

  it('galería: las miniaturas cambian la foto principal', async () => {
    api();
    renderRoute('/animals/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver foto 2 de 2' }));
    expect(screen.getByRole('img', { name: 'Rufo comiendo junto a otros buitres' })).toHaveAttribute(
      'src',
      '/uploads/animals/1/02.jpg',
    );
    expect(screen.getByRole('button', { name: 'Ver foto 2 de 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('muestra los adoptantes y quién ha permitido aparecer', async () => {
    api({ adopterCount: 2, publicAdopterNames: ['Lucía', 'Irene'] });
    renderRoute('/animals/1');
    expect(await screen.findByText('2 personas adoptan a Rufo')).toBeInTheDocument();
    expect(screen.getByText('Con el apoyo de Lucía e Irene')).toBeInTheDocument();
  });

  it('3a: sin adoptantes invita a ser el primero', async () => {
    api({ adopterCount: 0, publicAdopterNames: [] });
    renderRoute('/animals/1');
    expect(await screen.findByText('Todavía nadie ha adoptado a Rufo. ¿Quieres ser el primero?')).toBeInTheDocument();
  });

  it('5: si es adoptable, explica la adopción simbólica y enlaza a adoptar desde el plan más barato', async () => {
    api();
    renderRoute('/animals/1');
    expect(await screen.findByRole('link', { name: 'Adoptar a Rufo' })).toHaveAttribute('href', '/adopt/1');
    expect(
      screen.getByText('Rufo seguirá viviendo aquí y recibirás noticias suyas cada dos semanas.'),
    ).toBeInTheDocument();
    expect(await screen.findByText(/^Desde 1,00\s€ al mes\.$/)).toBeInTheDocument();
  });

  it('5a: si no es adoptable no hay botón y se explica', async () => {
    api({ isAdoptable: false });
    renderRoute('/animals/1');
    expect(await screen.findByText('Ahora mismo no admite adopciones.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Adoptar a Rufo' })).not.toBeInTheDocument();
  });

  it('insignia «En tratamiento»', async () => {
    api({ status: 'in_treatment' });
    renderRoute('/animals/1');
    expect(await screen.findByText('En tratamiento')).toBeInTheDocument();
  });

  it('4: muestra las últimas actualizaciones públicas', async () => {
    api();
    renderRoute('/animals/1');
    expect(await screen.findByRole('heading', { name: 'Rufo estrena posadero' })).toBeInTheDocument();
    expect(screen.getByText('13 de octubre de 2026')).toBeInTheDocument();
  });

  it('sin actualizaciones públicas lo dice', async () => {
    api({}, []);
    renderRoute('/animals/1');
    expect(await screen.findByText('Todavía no hay noticias públicas de Rufo.')).toBeInTheDocument();
  });

  it('1a: un animal no disponible muestra el aviso y enlaza al catálogo', async () => {
    mockApi({
      '/api/animals/12': {
        status: 404,
        body: { error: { code: 'ANIMAL_NOT_AVAILABLE', message: 'Este animal no está disponible.', details: [] } },
      },
      '/api/plans': { body: { data: plans } },
    });
    renderRoute('/animals/12');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este animal no está disponible' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/animals');
  });

  it('un id no numérico también se trata como no disponible', async () => {
    mockApi({ '/api/plans': { body: { data: plans } } });
    renderRoute('/animals/abc');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este animal no está disponible' }),
    ).toBeInTheDocument();
  });

  it('CU-16: si ya lo adopta, enlaza a su ficha completa en lugar de adoptar', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/animals/1': { body: animal({ exclusiveAccess: true, healthSummary: 'Bien.' }) },
      '/api/animals/1/updates': { body: page([]) },
      '/api/plans': { body: { data: plans } },
    });
    renderRoute('/animals/1');
    expect(await screen.findByText('Ya adoptas a Rufo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver su ficha completa' })).toHaveAttribute('href', '/my-animals/1');
    expect(screen.queryByRole('link', { name: 'Adoptar a Rufo' })).not.toBeInTheDocument();
  });
});
