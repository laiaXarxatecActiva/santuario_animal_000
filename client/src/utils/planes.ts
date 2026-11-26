// CU-40: lo que pasa al tocar los interruptores de un plan en «Planes», antes de
// guardar. Repite las reglas del servidor (`dominio/planes.ts`) para avisar al
// momento; el servidor las vuelve a comprobar al guardar.

export interface BorradorPlan {
  id: number;
  name: string;
  monthlyAmount: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
}

/** Aviso que se muestra en la tarjeta del plan tocado. */
export type AvisoPlan = 'defaultRequired' | 'defaultMustBeActive' | 'activatedAsDefault';

/**
 * - Marcar un plan por defecto desmarca el anterior y, si estaba desactivado, lo activa.
 * - El plan por defecto no se desmarca ni se desactiva: hay que marcar antes otro.
 */
export function cambiarInterruptor(
  planes: readonly BorradorPlan[],
  indice: number,
  campo: 'isDefault' | 'isActive',
  valor: boolean,
): { planes: readonly BorradorPlan[]; aviso: AvisoPlan | null } {
  const plan = planes[indice];
  if (!plan) return { planes, aviso: null };
  if (plan.isDefault && !valor) {
    return { planes, aviso: campo === 'isDefault' ? 'defaultRequired' : 'defaultMustBeActive' };
  }
  if (campo === 'isDefault' && valor) {
    return {
      planes: planes.map((p, i) =>
        i === indice ? { ...p, isDefault: true, isActive: true } : { ...p, isDefault: false },
      ),
      aviso: plan.isActive ? null : 'activatedAsDefault',
    };
  }
  return { planes: planes.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)), aviso: null };
}
