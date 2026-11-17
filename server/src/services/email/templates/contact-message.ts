import { htmlParrafos, type EmailContent } from './layout.js';

// CU-06 paso 3: mensaje del formulario de contacto, al buzón del santuario.
export function contactMessageEmail(datos: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): EmailContent {
  const de = `De: ${datos.name} <${datos.email}>`;
  const nota = 'Mensaje enviado desde el formulario de contacto de la web. Responde a este email para contestar.';
  return {
    subject: `Contacto: ${datos.subject}`,
    text: [de, `Asunto: ${datos.subject}`, '', datos.message, '', '—', nota].join('\n'),
    html: htmlParrafos([de, `Asunto: ${datos.subject}`, datos.message, nota]),
  };
}
