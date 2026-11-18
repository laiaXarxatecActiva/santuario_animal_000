// Reglas de los planes de adopción (CU-40, RN-04).

export type ProblemaPlan = 'DEFAULT_MUST_BE_ACTIVE' | 'DEFAULT_NEEDS_REPLACEMENT' | 'AMOUNT_CHANGE_UNCONFIRMED';

/** Importe (`'5'`, `'5.5'`, `'5.00'`) en céntimos, sin pasar por floats. */
function aCentimos(importe: string): number {
  const [enteros = '0', decimales = ''] = importe.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

/** `true` si los dos importes son distintos. */
export function cambiaImporte(actual: string, nuevo: string): boolean {
  return aCentimos(actual) !== aCentimos(nuevo);
}

/** A2: un plan nuevo; el de por defecto tiene que estar activo. */
export function comprobarAltaPlan(plan: { isDefault: boolean; isActive: boolean }): ProblemaPlan | null {
  return plan.isDefault && !plan.isActive ? 'DEFAULT_MUST_BE_ACTIVE' : null;
}

/**
 * 3 y A1: edición de un plan.
 * - El plan por defecto no deja de serlo sin elegir antes otro (siempre hay uno).
 * - El plan por defecto tiene que estar activo.
 * - 3a: un nuevo importe con adopciones activas se cobrará en su siguiente cuota,
 *   así que hay que confirmarlo.
 */
export function comprobarEdicionPlan(
  actual: { isDefault: boolean; monthlyAmount: string; activeAdoptions: number },
  cambios: { isDefault: boolean; isActive: boolean; monthlyAmount: string; confirmAmountChange: boolean },
): ProblemaPlan | null {
  if (actual.isDefault && !cambios.isDefault) return 'DEFAULT_NEEDS_REPLACEMENT';
  const problemaAlta = comprobarAltaPlan(cambios);
  if (problemaAlta) return problemaAlta;
  if (
    actual.activeAdoptions > 0 &&
    !cambios.confirmAmountChange &&
    cambiaImporte(actual.monthlyAmount, cambios.monthlyAmount)
  ) {
    return 'AMOUNT_CHANGE_UNCONFIRMED';
  }
  return null;
}
