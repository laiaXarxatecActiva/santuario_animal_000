import { z } from 'zod';
import { emailValido, textoObligatorio } from './fields.js';

// CU-06: formulario de contacto. El asunto va a la cabecera del email, así que
// no puede tener saltos de línea.
export const contactSchema = z.object({
  name: textoObligatorio(100, 'Escribe tu nombre.'),
  email: emailValido,
  subject: textoObligatorio(150, 'Escribe el asunto.').refine((v) => !/[\r\n]/.test(v), {
    error: 'El asunto debe ocupar una sola línea.',
  }),
  message: textoObligatorio(5000, 'Escribe tu mensaje.'),
  acceptPrivacy: z.literal(true, { error: 'Debes aceptar la política de privacidad.' }),
});
export type ContactInput = z.infer<typeof contactSchema>;
