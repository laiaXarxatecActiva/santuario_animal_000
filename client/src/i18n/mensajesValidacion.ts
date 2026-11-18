import type { Language } from '@sanctuary/shared';

// Fase 3: los mensajes de validación se escriben una sola vez, en castellano, en
// los esquemas compartidos (shared/src/schemas) y en el servidor. Aquí se
// traducen al mostrarlos. Si falta alguno, se ve en castellano.

type Traduccion = { ca: string; en: string };

const FIJOS: Record<string, Traduccion> = {
  'Debes aceptar la política de privacidad.': {
    ca: 'Has d’acceptar la política de privadesa.',
    en: 'You must accept the privacy policy.',
  },
  'Tienes que aceptar la política de privacidad.': {
    ca: 'Has d’acceptar la política de privadesa.',
    en: 'You must accept the privacy policy.',
  },
  'El asunto debe ocupar una sola línea.': {
    ca: 'L’assumpte ha d’ocupar una sola línia.',
    en: 'The subject must fit on a single line.',
  },
  'El email es demasiado largo.': { ca: 'El correu és massa llarg.', en: 'The email is too long.' },
  'El importe debe ser mayor que 0.': {
    ca: 'L’import ha de ser més gran que 0.',
    en: 'The amount must be greater than 0.',
  },
  'El peso debe ser mayor que 0.': { ca: 'El pes ha de ser més gran que 0.', en: 'The weight must be greater than 0.' },
  'Elige cómo se ha pagado.': { ca: 'Tria com s’ha pagat.', en: 'Choose how it was paid.' },
  'Elige el adoptante.': { ca: 'Tria l’adoptant.', en: 'Choose the adopter.' },
  'Elige el animal.': { ca: 'Tria l’animal.', en: 'Choose the animal.' },
  'Elige el plan.': { ca: 'Tria el pla.', en: 'Choose the plan.' },
  'Elige el rol.': { ca: 'Tria el rol.', en: 'Choose the role.' },
  'Elige el sexo.': { ca: 'Tria el sexe.', en: 'Choose the sex.' },
  'Elige el tipo.': { ca: 'Tria el tipus.', en: 'Choose the type.' },
  'Elige la adopción.': { ca: 'Tria l’adopció.', en: 'Choose the adoption.' },
  'Elige la especie.': { ca: 'Tria l’espècie.', en: 'Choose the species.' },
  'Elige la fecha.': { ca: 'Tria la data.', en: 'Choose the date.' },
  'Elige la visibilidad.': { ca: 'Tria la visibilitat.', en: 'Choose the visibility.' },
  'Elige un estado.': { ca: 'Tria un estat.', en: 'Choose a status.' },
  'Elige un idioma de la lista.': { ca: 'Tria un idioma de la llista.', en: 'Choose a language from the list.' },
  'Escribe el asunto.': { ca: 'Escriu l’assumpte.', en: 'Enter the subject.' },
  'Escribe el motivo.': { ca: 'Escriu el motiu.', en: 'Write the reason.' },
  'Escribe el nombre.': { ca: 'Escriu el nom.', en: 'Enter the name.' },
  'Escribe el nombre de la especie.': { ca: 'Escriu el nom de l’espècie.', en: 'Enter the name of the species.' },
  'Escribe el nombre del animal.': { ca: 'Escriu el nom de l’animal.', en: 'Enter the animal’s name.' },
  'Escribe el nombre del plan.': { ca: 'Escriu el nom del pla.', en: 'Enter the plan’s name.' },
  'Escribe el peso en kg, con dos decimales como máximo.': {
    ca: 'Escriu el pes en kg, amb dos decimals com a màxim.',
    en: 'Enter the weight in kg, with at most two decimals.',
  },
  'Escribe el texto.': { ca: 'Escriu el text.', en: 'Write the text.' },
  'Escribe el texto alternativo.': { ca: 'Escriu el text alternatiu.', en: 'Write the alternative text.' },
  'Escribe el título.': { ca: 'Escriu el títol.', en: 'Enter the title.' },
  'Escribe la descripción.': { ca: 'Escriu la descripció.', en: 'Write the description.' },
  'Escribe los apellidos.': { ca: 'Escriu els cognoms.', en: 'Enter the surname.' },
  'Escribe tu contraseña.': { ca: 'Escriu la teua contrasenya.', en: 'Enter your password.' },
  'Escribe tu mensaje.': { ca: 'Escriu el teu missatge.', en: 'Write your message.' },
  'Escribe tu nombre.': { ca: 'Escriu el teu nom.', en: 'Enter your name.' },
  'Faltan los datos de los archivos.': { ca: 'Falten les dades dels fitxers.', en: 'The file details are missing.' },
  'Indica la fecha de llegada.': { ca: 'Indica la data d’arribada.', en: 'Enter the arrival date.' },
  'Indica solo uno de los cambios: el estado o el rol.': {
    ca: 'Indica només un dels canvis: l’estat o el rol.',
    en: 'Make only one of the changes: the status or the role.',
  },
  'Introduce tu contraseña.': { ca: 'Introdueix la teua contrasenya.', en: 'Enter your password.' },
  'Introduce tu contraseña actual.': {
    ca: 'Introdueix la teua contrasenya actual.',
    en: 'Enter your current password.',
  },
  'Introduce tu email.': { ca: 'Introdueix el teu correu.', en: 'Enter your email.' },
  'Introduce tu nombre.': { ca: 'Introdueix el teu nom.', en: 'Enter your first name.' },
  'Introduce tus apellidos.': { ca: 'Introdueix els teus cognoms.', en: 'Enter your surname.' },
  'Introduce un email válido.': { ca: 'Introdueix un correu vàlid.', en: 'Enter a valid email.' },
  'Introduce un importe válido, con dos decimales como máximo.': {
    ca: 'Introdueix un import vàlid, amb dos decimals com a màxim.',
    en: 'Enter a valid amount, with at most two decimals.',
  },
  'Introduce un móvil español de 9 dígitos que empiece por 6 o 7, sin el prefijo +34.': {
    ca: 'Introdueix un mòbil espanyol de 9 xifres que comence per 6 o 7, sense el prefix +34.',
    en: 'Enter a 9-digit Spanish mobile number starting with 6 or 7, without the +34 prefix.',
  },
  'La edad máxima no puede ser menor que la mínima.': {
    ca: 'L’edat màxima no pot ser menor que la mínima.',
    en: 'The maximum age cannot be lower than the minimum.',
  },
  'La fecha de nacimiento no puede ser posterior a la de llegada.': {
    ca: 'La data de naixement no pot ser posterior a la d’arribada.',
    en: 'The date of birth cannot be later than the arrival date.',
  },
  'La fecha final no puede ser anterior a la inicial.': {
    ca: 'La data final no pot ser anterior a la inicial.',
    en: 'The end date cannot be earlier than the start date.',
  },
  'La fecha no es válida.': { ca: 'La data no és vàlida.', en: 'The date is not valid.' },
  'La lista de fotos no es válida.': { ca: 'La llista de fotos no és vàlida.', en: 'The photo list is not valid.' },
  'La nueva contraseña debe ser distinta de la actual.': {
    ca: 'La contrasenya nova ha de ser diferent de l’actual.',
    en: 'The new password must be different from the current one.',
  },
  'Las contraseñas no coinciden.': { ca: 'Les contrasenyes no coincideixen.', en: 'The passwords do not match.' },
  'No hay cambios que guardar.': { ca: 'No hi ha canvis per guardar.', en: 'There are no changes to save.' },
  'Solo admite el valor 1': { ca: 'Només admet el valor 1', en: 'Only the value 1 is allowed' },
  'Solo se devuelve al cancelar.': {
    ca: 'Només es retorna en cancel·lar.',
    en: 'It is only refunded when cancelling.',
  },
  'Usa el formato AAAA-MM-DD.': { ca: 'Fes servir el format AAAA-MM-DD.', en: 'Use the YYYY-MM-DD format.' },
  // Del servidor (errores por campo en `details`).
  'Campo de archivo no esperado.': { ca: 'Camp de fitxer no esperat.', en: 'Unexpected file field.' },
  'Escribe el mensaje para los adoptantes.': {
    ca: 'Escriu el missatge per als adoptants.',
    en: 'Write the message for the adopters.',
  },
  'Esta especie no existe.': { ca: 'Esta espècie no existeix.', en: 'This species does not exist.' },
  'Este animal no existe.': { ca: 'Este animal no existeix.', en: 'This animal does not exist.' },
  'Indica el texto alternativo de cada archivo.': {
    ca: 'Indica el text alternatiu de cada fitxer.',
    en: 'Enter the alternative text for each file.',
  },
  'La fecha de llegada no puede ser futura.': {
    ca: 'La data d’arribada no pot ser futura.',
    en: 'The arrival date cannot be in the future.',
  },
  'La fecha no puede ser futura.': { ca: 'La data no pot ser futura.', en: 'The date cannot be in the future.' },
  'La subida no es válida.': { ca: 'La pujada no és vàlida.', en: 'The upload is not valid.' },
};

/** Mensajes con un número (longitudes máximas y mínimas). */
const CON_NUMERO: [RegExp, (n: string) => Traduccion][] = [
  [
    /^La contraseña debe tener al menos (\d+) caracteres\.$/,
    (n) => ({
      ca: `La contrasenya ha de tindre almenys ${n} caràcters.`,
      en: `The password must be at least ${n} characters long.`,
    }),
  ],
  [
    /^La contraseña no puede tener más de (\d+) caracteres\.$/,
    (n) => ({
      ca: `La contrasenya no pot tindre més de ${n} caràcters.`,
      en: `The password cannot be longer than ${n} characters.`,
    }),
  ],
  [
    /^No puede tener más de (\d+) caracteres\.$/,
    (n) => ({ ca: `No pot tindre més de ${n} caràcters.`, en: `It cannot be longer than ${n} characters.` }),
  ],
];

/** Mensaje de validación en el idioma de la web; en castellano o si no se conoce, tal cual. */
export function traducirMensaje(mensaje: string, idioma: Language): string {
  if (idioma === 'es') return mensaje;
  const fijo = FIJOS[mensaje];
  if (fijo) return fijo[idioma];
  for (const [patron, traducir] of CON_NUMERO) {
    const n = patron.exec(mensaje)?.[1];
    if (n) return traducir(n)[idioma];
  }
  return mensaje;
}
