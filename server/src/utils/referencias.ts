import type { ManualPaymentMethod } from '@sanctuary/shared';
import { randomBytes } from 'node:crypto';
import { prefijoReferenciaManual } from '../dominio/adopciones-admin.js';

/** Referencia de un pago registrado a mano (CU-37, CU-38): `CASH-20261118-1A2B3C4D5E` o `TRF-…`. */
export function referenciaManual(metodo: ManualPaymentMethod, hoy: string): string {
  return `${prefijoReferenciaManual(metodo)}-${hoy.replaceAll('-', '')}-${randomBytes(5).toString('hex').toUpperCase()}`;
}
