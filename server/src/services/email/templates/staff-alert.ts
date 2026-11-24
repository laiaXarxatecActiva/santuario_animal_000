import type { Language, StaffEmailAlertType } from '@sanctuary/shared';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, saludo } from './textos.js';

// CU-73: un aviso del personal por email (el mismo texto que en la campana).

const ASUNTOS: Record<StaffEmailAlertType, Record<Language, string>> = {
  coverage_gap: {
    es: 'Turno sin personal suficiente',
    ca: 'Torn sense prou personal',
    en: 'Shift without enough staff',
  },
  low_intake: { es: 'Un animal come poco', ca: 'Un animal menja poc', en: 'An animal is eating little' },
  medication_missed: { es: 'Medicación no dada', ca: 'Medicació no donada', en: 'Missed medication' },
  vet_visit_today: { es: 'Visita veterinaria hoy', ca: 'Visita veterinària hui', en: 'Vet visit today' },
  incident_reported: { es: 'Incidencia grave', ca: 'Incidència greu', en: 'Serious incident' },
};

const ABRIR: Record<Language, string> = { es: 'Abrir en el panel', ca: 'Obrir al panell', en: 'Open in the panel' };

const POR_QUE: Record<Language, string> = {
  es: 'Recibes este email porque el santuario envía este aviso también por correo. Lo tienes igualmente en la campana del panel.',
  ca: 'Reps aquest correu perquè el santuari envia aquest avís també per correu. El tens igualment a la campana del panell.',
  en: 'You are receiving this email because the sanctuary also sends this alert by email. You can also find it in the panel bell.',
};

export function staffAlertEmail(datos: {
  type: StaffEmailAlertType;
  message: string;
  url: string;
  firstName: string;
  language: Language;
}): EmailContent {
  const { language: idioma } = datos;
  const hola = saludo(idioma, datos.firstName);
  return {
    subject: ASUNTOS[datos.type][idioma],
    text: [hola, '', datos.message, datos.url, '', POR_QUE[idioma], '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, datos.message],
      { url: datos.url, texto: ABRIR[idioma] },
      [POR_QUE[idioma]],
      undefined,
      idioma,
    ),
  };
}
