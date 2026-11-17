import { describe, expect, it } from 'vitest';
import { adoptionClosedEmail } from '../../../src/services/email/templates/adoption-closed.js';
import { monthlyDigestEmail } from '../../../src/services/email/templates/monthly-digest.js';
import { newUpdateEmail } from '../../../src/services/email/templates/new-update.js';

const url = 'http://localhost:5173/my-animals/2';

describe('plantillas de email de la Fase 2: avisos', () => {
  it('CU-31 new-update: título, extracto y enlace a la ficha ampliada', () => {
    const email = newUpdateEmail({
      firstName: 'Pablo',
      animalName: 'Greta',
      title: 'Greta <y> la lluvia',
      excerpt: 'Hoy ha llovido.',
      url,
    });
    expect(email.subject).toBe('Nueva actualización de Greta');
    expect(email.text).toContain('Hola, Pablo:');
    expect(email.text).toContain('Greta <y> la lluvia');
    expect(email.text).toContain('Hoy ha llovido.');
    expect(email.text).toContain(url);
    expect(email.html).toContain('Greta &lt;y&gt; la lluvia');
    expect(email.html).toContain(`href="${url}"`);
  });

  it('CU-33 adoption-closed (fallecimiento): el mensaje redactado, tal cual, y el enlace al catálogo', () => {
    const email = adoptionClosedEmail({
      firstName: 'Elena',
      animalName: 'Lupe',
      reason: 'animal_deceased',
      message: 'Lupe se fue tranquila.\nGracias por acompañarla.',
      catalogUrl: 'http://localhost:5173/animals',
    });
    expect(email.subject).toBe('Despedimos a Lupe');
    expect(email.text).toContain('Lupe se fue tranquila.\nGracias por acompañarla.');
    expect(email.text).toContain('http://localhost:5173/animals');
    expect(email.html).toContain('Lupe se fue tranquila.<br>Gracias por acompañarla.');
    expect(email.html).toContain('href="http://localhost:5173/animals"');
  });

  it('CU-33 adoption-closed (traslado): aviso sin mensaje redactado', () => {
    const email = adoptionClosedEmail({
      firstName: 'Elena',
      animalName: 'Nieve',
      reason: 'animal_transferred',
      message: null,
      catalogUrl: 'http://localhost:5173/animals',
    });
    expect(email.subject).toBe('Nieve se traslada a otro centro');
    expect(email.text).toContain('Nieve se ha trasladado a otro centro');
    expect(email.text).toContain('no se te volverá a cobrar');
  });

  it('CU-46 monthly-digest: actualizaciones agrupadas por animal, con extracto y enlace', () => {
    const email = monthlyDigestEmail({
      firstName: 'Elena',
      monthName: 'enero de 2030',
      animals: [
        {
          name: 'Greta',
          updates: [
            { title: 'Primera', excerpt: 'Uno.', url: 'http://localhost:5173/my-animals/2' },
            { title: 'Segunda', excerpt: 'Dos.', url: 'http://localhost:5173/my-animals/2' },
          ],
        },
      ],
      settingsUrl: 'http://localhost:5173/profile',
    });
    expect(email.subject).toBe('Novedades de enero de 2030');
    expect(email.text).toContain('Greta');
    expect(email.text.indexOf('Primera')).toBeLessThan(email.text.indexOf('Segunda'));
    expect(email.text).toContain('Uno.');
    expect(email.html).toContain('href="http://localhost:5173/my-animals/2"');
    expect(email.text).toContain('http://localhost:5173/profile');
  });
});
