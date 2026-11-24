import type { Language, TodayDto } from '@sanctuary/shared';
import { formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, saludo } from './textos.js';

// CU-74: resumen del día para los administradores, con los datos del panel «Hoy».

const T = {
  es: {
    asunto: (f: string) => `Resumen del día ${f}`,
    intro: 'Así ha ido hoy el trabajo en el santuario:',
    tareas: (t: TodayDto['tasks']) =>
      `Tareas: ${t.completed} hechas, ${t.notDone} no realizadas y ${t.pending} pendientes de ${t.total}.`,
    dosis: 'Medicación no dada:',
    ninguna: 'ninguna.',
    incidencias: (a: number, c: number) => `Incidencias abiertas: ${a}; en curso: ${c}.`,
    comenPoco: 'Animales que comen poco:',
    ninguno: 'ninguno.',
    huecos: (n: number) => `Zonas sin cubrir en los turnos que quedan: ${n}.`,
    boton: 'Ver el panel «Hoy»',
  },
  ca: {
    asunto: (f: string) => `Resum del dia ${f}`,
    intro: 'Així ha anat hui la faena al santuari:',
    tareas: (t: TodayDto['tasks']) =>
      `Tasques: ${t.completed} fetes, ${t.notDone} no fetes i ${t.pending} pendents de ${t.total}.`,
    dosis: 'Medicació no donada:',
    ninguna: 'cap.',
    incidencias: (a: number, c: number) => `Incidències obertes: ${a}; en curs: ${c}.`,
    comenPoco: 'Animals que mengen poc:',
    ninguno: 'cap.',
    huecos: (n: number) => `Zones sense cobrir en els torns que queden: ${n}.`,
    boton: 'Veure el panell «Hui»',
  },
  en: {
    asunto: (f: string) => `Daily summary ${f}`,
    intro: 'This is how work went at the sanctuary today:',
    tareas: (t: TodayDto['tasks']) =>
      `Tasks: ${t.completed} done, ${t.notDone} not done and ${t.pending} pending out of ${t.total}.`,
    dosis: 'Missed medication:',
    ninguna: 'none.',
    incidencias: (a: number, c: number) => `Open incidents: ${a}; in progress: ${c}.`,
    comenPoco: 'Animals eating little:',
    ninguno: 'none.',
    huecos: (n: number) => `Uncovered zones in the remaining shifts: ${n}.`,
    boton: 'See the "Today" panel',
  },
} satisfies Record<Language, unknown>;

export function dailySummaryEmail(datos: {
  hoy: TodayDto;
  url: string;
  firstName: string;
  language: Language;
}): EmailContent {
  const idioma = datos.language;
  const t = T[idioma];
  const { hoy } = datos;
  const dosis =
    hoy.missedDoses.length === 0
      ? `${t.dosis} ${t.ninguna}`
      : [
          t.dosis,
          ...hoy.missedDoses.map(
            (d) => `- ${formatFecha(d.dueDate)} ${d.dueTime} ${d.animals.map((a) => a.name).join(', ')}: ${d.title}`,
          ),
        ].join('\n');
  const comenPoco =
    hoy.lowIntake.length === 0
      ? `${t.comenPoco} ${t.ninguno}`
      : `${t.comenPoco} ${hoy.lowIntake.map((l) => l.animal.name).join(', ')}.`;
  const parrafos = [
    saludo(idioma, datos.firstName),
    t.intro,
    t.tareas(hoy.tasks),
    dosis,
    t.incidencias(hoy.incidents.open, hoy.incidents.inProgress),
    comenPoco,
    t.huecos(hoy.gaps.length),
  ];
  return {
    subject: t.asunto(formatFecha(hoy.date)),
    text: [...parrafos.flatMap((p) => [p, '']), datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      parrafos.flatMap((p) => p.split('\n')),
      { url: datos.url, texto: t.boton },
      [],
      undefined,
      idioma,
    ),
  };
}
