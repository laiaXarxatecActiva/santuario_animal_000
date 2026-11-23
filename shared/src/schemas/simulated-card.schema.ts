import { z } from 'zod';
import { textoObligatorio } from './fields.js';

// Pago simulado (TECH_SPEC §11.1): la ventana pide una tarjeta para que el pago
// se parezca a uno real, pero solo se comprueba su formato y los datos nunca se
// envían al servidor ni se guardan.

/** Comprobación de Luhn: el último dígito de una tarjeta controla los demás. */
function pasaLuhn(digitos: string): boolean {
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

const CADUCIDAD_RE = /^(0[1-9]|1[0-2])\/?(\d{2})$/;

/** Esquema de la tarjeta; `hoy` decide si la caducidad ya ha pasado. */
export function tarjetaSimuladaSchema(hoy: Date) {
  const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
  return z.object({
    holder: textoObligatorio(100, 'Escribe el nombre del titular.'),
    number: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .refine((v) => /^\d{13,19}$/.test(v) && pasaLuhn(v), { error: 'El número de tarjeta no es válido.' }),
    expiry: z
      .string()
      .trim()
      .regex(CADUCIDAD_RE, { error: 'Escribe la caducidad como MM/AA.' })
      .refine(
        (v) => {
          const [, mes = '0', anio = '0'] = CADUCIDAD_RE.exec(v) ?? [];
          return (2000 + Number(anio)) * 12 + Number(mes) - 1 >= mesActual;
        },
        { error: 'La tarjeta está caducada.' },
      ),
    cvc: z
      .string()
      .trim()
      .regex(/^\d{3,4}$/, { error: 'El CVC tiene 3 o 4 dígitos.' }),
  });
}
export type TarjetaSimuladaInput = z.input<ReturnType<typeof tarjetaSimuladaSchema>>;
