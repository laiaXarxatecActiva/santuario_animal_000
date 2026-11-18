import type { Language, ReceiptDto } from '@sanctuary/shared';
import { ZONA_HORARIA_SANTUARIO } from './reloj.js';

// Textos del certificado (CU-22) y del recibo (CU-19) en PDF, en el idioma del
// usuario (Fase 3). Aquí solo se decide qué se dice; el servicio de PDF decide
// cómo se dibuja.

/** El nombre del santuario es una marca: no se traduce. */
export const NOMBRE_SANTUARIO = 'Santuario de Animales';

export const NOTAS_ACADEMICAS: Record<Language, string> = {
  es: 'Proyecto académico: el santuario y sus datos son ficticios.',
  ca: 'Projecte acadèmic: el santuari i les seues dades són ficticis.',
  en: 'Academic project: the sanctuary and its data are fictitious.',
};
export const NOTA_ACADEMICA = NOTAS_ACADEMICAS.es;

const LOCALES: Record<Language, string> = { es: 'es-ES', ca: 'ca-ES', en: 'en-GB' };

function formatos(idioma: Language) {
  const locale = LOCALES[idioma];
  const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
  const diaLargo = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const diaCorto = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const instante = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ZONA_HORARIA_SANTUARIO,
  });
  const dia = (d: string) => new Date(`${d}T00:00:00Z`);
  return {
    euros: (importe: string) => euros.format(Number(importe)),
    /** `YYYY-MM-DD` → «5 de septiembre de 2025». */
    fechaLarga: (d: string) => diaLargo.format(dia(d)),
    /** `YYYY-MM-DD` → «5 nov 2026». */
    fechaCorta: (d: string) => diaCorto.format(dia(d)),
    /** Instante ISO → día en el santuario, «5 de noviembre de 2026». */
    instante: (iso: string) => instante.format(new Date(iso)),
  };
}

export interface DatosCertificado {
  adopterName: string;
  animalName: string;
  speciesName: string;
  /** `YYYY-MM-DD`. */
  startDate: string;
}

export interface ContenidoCertificado {
  titulo: string;
  /** Líneas centradas; las pares (0, 2, 4…) son el texto de enlace y las impares, los datos. */
  lineas: string[];
  nota: string;
  /** Nota del pie y metadatos del PDF. */
  idioma: Language;
}

/** CU-22 paso 2. */
export function contenidoCertificado(d: DatosCertificado, idioma: Language = 'es'): ContenidoCertificado {
  const f = formatos(idioma);
  const textos = {
    es: {
      titulo: 'Certificado de adopción',
      certifica: `${NOMBRE_SANTUARIO} certifica que`,
      apadrina: 'apadrina simbólicamente a',
      desde: `desde el ${f.fechaLarga(d.startDate)}`,
      nota: 'La adopción es simbólica: el animal sigue viviendo en el santuario. Gracias por ayudarnos a cuidarlo.',
    },
    ca: {
      titulo: "Certificat d'adopció",
      certifica: `${NOMBRE_SANTUARIO} certifica que`,
      apadrina: 'apadrina simbòlicament',
      desde: `des del ${f.fechaLarga(d.startDate)}`,
      nota: "L'adopció és simbòlica: l'animal continua vivint al santuari. Gràcies per ajudar-nos a cuidar-lo.",
    },
    en: {
      titulo: 'Adoption certificate',
      certifica: `${NOMBRE_SANTUARIO} certifies that`,
      apadrina: 'symbolically sponsors',
      desde: `since ${f.fechaLarga(d.startDate)}`,
      nota: 'The adoption is symbolic: the animal keeps living at the sanctuary. Thank you for helping us care for them.',
    },
  }[idioma];
  return {
    titulo: textos.titulo,
    lineas: [textos.certifica, d.adopterName, textos.apadrina, d.animalName, d.speciesName, textos.desde],
    nota: textos.nota,
    idioma,
  };
}

export interface ContenidoRecibo {
  titulo: string;
  filas: [string, string][];
  /** Posición del importe en `filas` (se dibuja más grande). */
  filaImporte: number;
  /** «Pago simulado» (solo con la pasarela simulada). */
  aviso: string | null;
  idioma: Language;
}

const RECIBO = {
  es: {
    titulo: 'Recibo',
    pagador: 'Pagado por',
    concepto: 'Concepto',
    importe: 'Importe',
    fecha: 'Fecha del pago',
    forma: 'Forma de pago',
    referencia: 'Referencia',
    estado: 'Estado',
    cobrado: 'Cobrado',
    devuelto: (fecha: string) => `Devuelto el ${fecha}`,
    donacion: 'Donación',
    cuota: (animal: string) => `Cuota de ${animal}`,
    plan: (plan: string) => `Plan ${plan}`,
    periodo: (desde: string, hasta: string) => `del ${desde} al ${hasta}`,
    formas: { simulated: 'Pago simulado', cash: 'Efectivo', bank_transfer: 'Transferencia', card: 'Tarjeta' },
    aviso: 'Pago simulado: no se ha realizado ningún cargo real.',
  },
  ca: {
    titulo: 'Rebut',
    pagador: 'Pagat per',
    concepto: 'Concepte',
    importe: 'Import',
    fecha: 'Data del pagament',
    forma: 'Forma de pagament',
    referencia: 'Referència',
    estado: 'Estat',
    cobrado: 'Cobrat',
    devuelto: (fecha: string) => `Retornat el ${fecha}`,
    donacion: 'Donació',
    cuota: (animal: string) => `Quota de ${animal}`,
    plan: (plan: string) => `Pla ${plan}`,
    periodo: (desde: string, hasta: string) => `del ${desde} al ${hasta}`,
    formas: { simulated: 'Pagament simulat', cash: 'Efectiu', bank_transfer: 'Transferència', card: 'Targeta' },
    aviso: "Pagament simulat: no s'ha fet cap càrrec real.",
  },
  en: {
    titulo: 'Receipt',
    pagador: 'Paid by',
    concepto: 'Concept',
    importe: 'Amount',
    fecha: 'Payment date',
    forma: 'Payment method',
    referencia: 'Reference',
    estado: 'Status',
    cobrado: 'Paid',
    devuelto: (fecha: string) => `Refunded on ${fecha}`,
    donacion: 'Donation',
    cuota: (animal: string) => `${animal}'s fee`,
    plan: (plan: string) => `${plan} plan`,
    periodo: (desde: string, hasta: string) => `${desde} to ${hasta}`,
    formas: { simulated: 'Simulated payment', cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card' },
    aviso: 'Simulated payment: no real charge has been made.',
  },
} satisfies Record<Language, unknown>;

/** CU-19 paso 5 y 4b. */
export function contenidoRecibo(r: ReceiptDto, idioma: Language = 'es'): ContenidoRecibo {
  const t = RECIBO[idioma];
  const f = formatos(idioma);
  let concepto = t.donacion;
  if (r.kind === 'payment' && r.animalName) {
    const partes = [t.cuota(r.animalName)];
    if (r.planName) partes.push(t.plan(r.planName));
    if (r.periodStart && r.periodEnd) partes.push(t.periodo(f.fechaCorta(r.periodStart), f.fechaCorta(r.periodEnd)));
    concepto = partes.join(' · ');
  }
  return {
    titulo: t.titulo,
    filas: [
      [t.pagador, `${r.payer.fullName}\n${r.payer.email}`],
      [t.concepto, concepto],
      [t.importe, f.euros(r.amount)],
      [t.fecha, f.instante(r.paidAt)],
      [t.forma, t.formas[r.method]],
      [t.referencia, r.reference],
      [t.estado, r.refundedAt ? t.devuelto(f.instante(r.refundedAt)) : t.cobrado],
    ],
    filaImporte: 2,
    aviso: r.method === 'simulated' ? t.aviso : null,
    idioma,
  };
}

/** «certificado-ebano.pdf»: sin tildes, espacios ni signos, para cualquier sistema. */
export function nombreArchivo(prefijo: string, nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio ? `${prefijo}-${limpio}.pdf` : `${prefijo}.pdf`;
}

/** Prefijo del nombre del archivo en cada idioma. */
export const PREFIJOS: Record<Language, { certificado: string; recibo: string }> = {
  es: { certificado: 'certificado', recibo: 'recibo' },
  ca: { certificado: 'certificat', recibo: 'rebut' },
  en: { certificado: 'certificate', recibo: 'receipt' },
};
