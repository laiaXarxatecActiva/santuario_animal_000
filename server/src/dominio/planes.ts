// Reglas de los planes de adopción (CU-40, RN-04).

export type ProblemaPlan =
  'DEFAULT_MUST_BE_ACTIVE' | 'DEFAULT_NEEDS_REPLACEMENT' | 'DEFAULT_NOT_UNIQUE' | 'AMOUNT_CHANGE_UNCONFIRMED';

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

export interface PlanGuardado {
  id: number;
  isDefault: boolean;
  isActive: boolean;
  monthlyAmount: string;
  activeAdoptions: number;
}
export type CambioPlan = Omit<PlanGuardado, 'activeAdoptions'>;
export interface ProblemaPlanes {
  problema: ProblemaPlan;
  /** El plan al que se refiere el problema. */
  planId: number;
  /** Solo en AMOUNT_CHANGE_UNCONFIRMED. */
  activeAdoptions?: number;
}

/**
 * 3, 3a y A1 al guardar todos los planes a la vez: se comprueba cómo quedarían
 * (los que no se envían siguen igual).
 * - Siempre hay exactamente un plan por defecto, y está activo.
 * - 3a: un nuevo importe con adopciones activas hay que confirmarlo (una vez para todos).
 */
export function comprobarPlanes(
  guardados: readonly PlanGuardado[],
  cambios: readonly CambioPlan[],
  confirmAmountChange: boolean,
): ProblemaPlanes | null {
  const final = guardados.map((p) => ({ ...p, ...cambios.find((c) => c.id === p.id) }));
  const porDefecto = final.filter((p) => p.isDefault);
  if (porDefecto.length === 0) {
    const anterior = guardados.find((p) => p.isDefault) ?? guardados[0];
    return { problema: 'DEFAULT_NEEDS_REPLACEMENT', planId: anterior?.id ?? 0 };
  }
  if (porDefecto.length > 1) {
    // Se señala el que se ha marcado de nuevo (o, si no, el segundo).
    const nuevo = porDefecto.find((p) => !guardados.find((g) => g.id === p.id)?.isDefault) ?? porDefecto[1]!;
    return { problema: 'DEFAULT_NOT_UNIQUE', planId: nuevo.id };
  }
  const elegido = porDefecto[0]!;
  if (!elegido.isActive) return { problema: 'DEFAULT_MUST_BE_ACTIVE', planId: elegido.id };
  if (!confirmAmountChange) {
    const afectado = guardados.find((g) => {
      const cambio = cambios.find((c) => c.id === g.id);
      return g.activeAdoptions > 0 && cambio !== undefined && cambiaImporte(g.monthlyAmount, cambio.monthlyAmount);
    });
    if (afectado) {
      return { problema: 'AMOUNT_CHANGE_UNCONFIRMED', planId: afectado.id, activeAdoptions: afectado.activeAdoptions };
    }
  }
  return null;
}
