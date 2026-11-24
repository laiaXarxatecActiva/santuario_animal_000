import type { Language } from '@sanctuary/shared';

// Fase 3: los mensajes de validación se escriben una sola vez, en castellano, en
// los esquemas compartidos (shared/src/schemas) y en el servidor. Aquí se
// traducen al mostrarlos. Si falta alguno, se ve en castellano.

type Traduccion = { ca: string; en: string };

const FIJOS: Record<string, Traduccion> = {
  'Escribe el nombre del titular.': { ca: 'Escriu el nom del titular.', en: "Enter the cardholder's name." },
  'El número de tarjeta no es válido.': {
    ca: 'El número de targeta no és vàlid.',
    en: 'The card number is not valid.',
  },
  'Escribe la caducidad como MM/AA.': { ca: 'Escriu la caducitat com a MM/AA.', en: 'Enter the expiry date as MM/YY.' },
  'La tarjeta está caducada.': { ca: 'La targeta està caducada.', en: 'The card has expired.' },
  'El CVC tiene 3 o 4 dígitos.': { ca: 'El CVC té 3 o 4 dígits.', en: 'The CVC has 3 or 4 digits.' },
  'Escribe tus apellidos.': { ca: 'Escriu els teus cognoms.', en: 'Enter your last name.' },
  'Escribe tu NIF.': { ca: 'Escriu el teu NIF.', en: 'Enter your NIF.' },
  'Escribe tu dirección.': { ca: 'Escriu la teua adreça.', en: 'Enter your address.' },
  'Escribe el código postal.': { ca: 'Escriu el codi postal.', en: 'Enter the postcode.' },
  'Escribe la provincia.': { ca: 'Escriu la província.', en: 'Enter the province.' },
  'Escribe el país.': { ca: 'Escriu el país.', en: 'Enter the country.' },
  'El NIF no es válido.': { ca: 'El NIF no és vàlid.', en: 'The NIF is not valid.' },
  'El código postal no es válido.': { ca: 'El codi postal no és vàlid.', en: 'The postcode is not valid.' },
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
  'Elige la forma de pago.': { ca: 'Tria la forma de pagament.', en: 'Choose the payment method.' },
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
  // Trabajo diario del personal (CU-52 en adelante).
  'Escribe la hora como HH:MM.': { ca: 'Escriu l’hora com a HH:MM.', en: 'Enter the time as HH:MM.' },
  'Escribe el nombre de la zona.': { ca: 'Escriu el nom de la zona.', en: 'Enter the name of the area.' },
  'Escribe el nombre de la cualificación.': {
    ca: 'Escriu el nom de la qualificació.',
    en: 'Enter the name of the qualification.',
  },
  'Elige el tipo de tarea.': { ca: 'Tria el tipus de tasca.', en: 'Choose the type of task.' },
  'Añade al menos una hora.': { ca: 'Afig almenys una hora.', en: 'Add at least one time.' },
  'Elige cada cuánto se repite.': { ca: 'Tria cada quant es repeteix.', en: 'Choose how often it repeats.' },
  'Elige la fecha de inicio.': { ca: 'Tria la data d’inici.', en: 'Choose the start date.' },
  'Elige una zona o al menos un animal.': {
    ca: 'Tria una zona o almenys un animal.',
    en: 'Choose an area or at least one animal.',
  },
  'Elige al menos un día de la semana.': {
    ca: 'Tria almenys un dia de la setmana.',
    en: 'Choose at least one day of the week.',
  },
  'Indica cada cuántos días (de 2 a 365).': {
    ca: 'Indica cada quants dies (de 2 a 365).',
    en: 'Enter every how many days (2 to 365).',
  },
  'La fecha de fin no puede ser anterior a la de inicio.': {
    ca: 'La data de fi no pot ser anterior a la d’inici.',
    en: 'The end date cannot be before the start date.',
  },
  'Elige el día.': { ca: 'Tria el dia.', en: 'Choose the day.' },
  'Elige una zona, un animal o una persona.': {
    ca: 'Tria una zona, un animal o una persona.',
    en: 'Choose an area, an animal or a person.',
  },
  'Explica por qué no se ha podido hacer.': {
    ca: 'Explica per què no s’ha pogut fer.',
    en: 'Explain why it could not be done.',
  },
  'Indica los minutos.': { ca: 'Indica els minuts.', en: 'Enter the minutes.' },
  'Entre 0 y 240 minutos.': { ca: 'Entre 0 i 240 minuts.', en: 'Between 0 and 240 minutes.' },
  'Esta zona no existe.': { ca: 'Esta zona no existeix.', en: 'This area does not exist.' },
  'Esta zona está desactivada.': { ca: 'Esta zona està desactivada.', en: 'This area is deactivated.' },
  'Esta zona no existe o está desactivada.': {
    ca: 'Esta zona no existeix o està desactivada.',
    en: 'This area does not exist or is deactivated.',
  },
  'Esta cualificación no existe.': { ca: 'Esta qualificació no existeix.', en: 'This qualification does not exist.' },
  'Estos animales no viven en la misma zona: elige una zona para la tarea.': {
    ca: 'Estos animals no viuen en la mateixa zona: tria una zona per a la tasca.',
    en: 'These animals do not live in the same area: choose an area for the task.',
  },
  'Elige a un trabajador en activo.': { ca: 'Tria un treballador en actiu.', en: 'Choose an active worker.' },
  'Esta persona no tiene la cualificación que exige la tarea.': {
    ca: 'Esta persona no té la qualificació que exigeix la tasca.',
    en: 'This person does not have the qualification the task requires.',
  },
  'No se pueden crear tareas de días pasados.': {
    ca: 'No es poden crear tasques de dies passats.',
    en: 'Tasks cannot be created for past days.',
  },
  'Adjunta una sola foto.': { ca: 'Adjunta una sola foto.', en: 'Attach a single photo.' },
  // Turnos y ausencias (CU-60 a CU-62).
  'Escribe el nombre del turno.': { ca: 'Escriu el nom del torn.', en: 'Enter the shift name.' },
  'La hora de fin debe ser posterior a la de inicio.': {
    ca: 'L’hora de fi ha de ser posterior a la d’inici.',
    en: 'The end time must be after the start time.',
  },
  'De 1 a 20 personas.': { ca: 'D’1 a 20 persones.', en: 'From 1 to 20 people.' },
  'Cada zona solo puede aparecer una vez.': {
    ca: 'Cada zona només pot aparéixer una vegada.',
    en: 'Each zone can only appear once.',
  },
  'Elige el turno.': { ca: 'Tria el torn.', en: 'Choose the shift.' },
  'Elige a una persona.': { ca: 'Tria una persona.', en: 'Choose a person.' },
  'La semana empieza en lunes.': { ca: 'La setmana comença en dilluns.', en: 'The week starts on Monday.' },
  'Elige la semana.': { ca: 'Tria la setmana.', en: 'Choose the week.' },
  'Elige el primer día.': { ca: 'Tria el primer dia.', en: 'Choose the first day.' },
  'Elige el último día.': { ca: 'Tria l’últim dia.', en: 'Choose the last day.' },
  'Elige el motivo.': { ca: 'Tria el motiu.', en: 'Choose the reason.' },
  'El último día no puede ser anterior al primero.': {
    ca: 'L’últim dia no pot ser anterior al primer.',
    en: 'The last day cannot be before the first.',
  },
  'Esta persona está ausente ese día.': {
    ca: 'Aquesta persona està absent aquest dia.',
    en: 'This person is absent that day.',
  },
  'Esta persona ya tiene un turno a esa hora ese día.': {
    ca: 'Aquesta persona ja té un torn a aquesta hora aquest dia.',
    en: 'This person already has a shift at that time that day.',
  },
  'No se pueden asignar turnos de días pasados.': {
    ca: 'No es poden assignar torns de dies passats.',
    en: 'Shifts cannot be assigned on past days.',
  },
  'Este turno no se hace ese día de la semana.': {
    ca: 'Aquest torn no es fa aquest dia de la setmana.',
    en: 'This shift does not run on that day of the week.',
  },
  'Este turno no existe o está desactivado.': {
    ca: 'Aquest torn no existeix o està desactivat.',
    en: 'This shift does not exist or is deactivated.',
  },
  'Ya tiene una ausencia en esas fechas.': {
    ca: 'Ja té una absència en aquestes dates.',
    en: 'They already have an absence on those dates.',
  },
  'Elige a un trabajador.': { ca: 'Tria un treballador.', en: 'Choose a worker.' },
  'Elige la fecha de fin.': { ca: 'Tria la data de fi.', en: 'Choose the end date.' },
  // Alimentación, visitas veterinarias y medicación (CU-65 a CU-69).
  'Escribe el alimento.': { ca: 'Escriu l’aliment.', en: 'Enter the food.' },
  'Escribe la cantidad con dos decimales como máximo.': {
    ca: 'Escriu la quantitat amb dos decimals com a màxim.',
    en: 'Enter the quantity with at most two decimals.',
  },
  'La cantidad debe ser mayor que 0.': {
    ca: 'La quantitat ha de ser més gran que 0.',
    en: 'The quantity must be greater than 0.',
  },
  'Elige la unidad.': { ca: 'Tria la unitat.', en: 'Choose the unit.' },
  'Elige cuánto ha comido.': { ca: 'Tria quant ha menjat.', en: 'Choose how much it ate.' },
  'Esta tarea no es de alimentación.': { ca: 'Aquesta tasca no és d’alimentació.', en: 'This is not a feeding task.' },
  'Este animal no es de esta comida.': {
    ca: 'Aquest animal no és d’aquest menjar.',
    en: 'This animal is not part of this meal.',
  },
  'Escribe el motivo de la visita.': { ca: 'Escriu el motiu de la visita.', en: 'Enter the reason for the visit.' },
  'No se puede programar una visita en un día pasado.': {
    ca: 'No es pot programar una visita en un dia passat.',
    en: 'A visit cannot be scheduled on a past day.',
  },
  'Escribe el medicamento.': { ca: 'Escriu el medicament.', en: 'Enter the medicine.' },
  'Escribe la dosis.': { ca: 'Escriu la dosi.', en: 'Enter the dose.' },
  'Elige la vía.': { ca: 'Tria la via.', en: 'Choose the route.' },
  // CU-70 a CU-73: incidencias, notas de relevo y avisos por email.
  'Elige el tipo de incidencia.': { ca: 'Tria el tipus d’incidència.', en: 'Choose the type of incident.' },
  'Elige la gravedad.': { ca: 'Tria la gravetat.', en: 'Choose the severity.' },
  'Describe lo que pasa.': { ca: 'Descriu què passa.', en: 'Describe what is happening.' },
  'Escribe un título corto.': { ca: 'Escriu un títol curt.', en: 'Write a short title.' },
  'Elige una zona o un animal.': { ca: 'Tria una zona o un animal.', en: 'Choose a zone or an animal.' },
  'Explica cómo se ha resuelto.': { ca: 'Explica com s’ha resolt.', en: 'Explain how it was resolved.' },
  'Elige el estado.': { ca: 'Tria l’estat.', en: 'Choose the status.' },
  'Elige la zona.': { ca: 'Tria la zona.', en: 'Choose the zone.' },
  'Escribe la nota.': { ca: 'Escriu la nota.', en: 'Write the note.' },
  'No tienes turno hoy en esta zona.': {
    ca: 'Hui no tens torn en esta zona.',
    en: 'You have no shift in this zone today.',
  },
  'Este aviso no existe.': { ca: 'Este avís no existix.', en: 'This alert does not exist.' },
};

/** Mensajes con un número (longitudes máximas y mínimas). */
const CON_NUMERO: [RegExp, (n: string) => Traduccion][] = [
  [/^De 1 a (\d+) tomas\.$/, (n) => ({ ca: `D’1 a ${n} preses.`, en: `From 1 to ${n} meals.` })],
  [/^Como máximo (\d+) días\.$/, (n) => ({ ca: `Com a màxim ${n} dies.`, en: `At most ${n} days.` })],
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
    /^Como máximo (\d+) horas al día\.$/,
    (n) => ({ ca: `Com a màxim ${n} hores al dia.`, en: `At most ${n} times a day.` }),
  ],
  [
    /^El título no puede pasar de (\d+) caracteres\.$/,
    (n) => ({
      ca: `El títol no pot passar de ${n} caràcters.`,
      en: `The title cannot be longer than ${n} characters.`,
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
