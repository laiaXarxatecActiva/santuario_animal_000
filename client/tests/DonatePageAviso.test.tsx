import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { caretaker, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const AVISO =
  'Si no nos das tu email y no has entrado con tu cuenta de adoptante, no podremos avisarte de nada sobre esta donación (por ejemplo, si hubiera que devolverla).';

describe('CU-05 y CU-39 Aviso sobre los avisos de la donación', () => {
  it('sin sesión se avisa de que sin email no se le podrá avisar', async () => {
    mockApi({});
    renderRoute('/donate');
    expect(await screen.findByText(AVISO)).toBeInTheDocument();
  });

  it('con la sesión de un trabajador también (su donación no se vincula a la cuenta)', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/donate');
    expect(await screen.findByText(AVISO)).toBeInTheDocument();
  });

  it('un adoptante con sesión no lo ve: se le avisa en la web', async () => {
    mockApi({ '/api/auth/me': { body: { user: sessionUser() } } });
    renderRoute('/donate');
    await screen.findByRole('heading', { level: 1, name: 'Donar' });
    expect(await screen.findByLabelText('Email (opcional)')).toHaveValue(sessionUser().email);
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});
