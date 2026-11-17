import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-31 paso 4.2: nueva actualización de un animal apadrinado (si el adoptante la quiere por email).
export function newUpdateEmail(datos: {
  firstName: string;
  animalName: string;
  title: string;
  excerpt: string;
  url: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const cuerpo = `Hay una nueva actualización de ${datos.animalName}: «${datos.title}».`;
  return {
    subject: `Nueva actualización de ${datos.animalName}`,
    text: [saludo, '', cuerpo, '', datos.excerpt, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, datos.excerpt], { url: datos.url, texto: 'Leer la actualización' }),
  };
}
