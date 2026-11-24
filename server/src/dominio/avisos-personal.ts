// CU-73 y CU-74: avisos del personal por email y resumen diario. Sin dependencias externas.
import type { NotificationType } from '@sanctuary/shared';

/** Un aviso va también por email si su tipo está elegido en los ajustes. */
export function debeIrPorEmail(tipo: NotificationType, elegidos: readonly string[]): boolean {
  return elegidos.includes(tipo);
}

/** El resumen sale si está activado y ya ha llegado su hora (`HH:MM` de Madrid). */
export function tocaElResumen(
  ajustes: { dailySummaryEnabled: boolean; dailySummaryTime: string },
  horaActual: string,
): boolean {
  return ajustes.dailySummaryEnabled && horaActual >= ajustes.dailySummaryTime;
}
