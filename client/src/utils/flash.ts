import type { AlertType } from '../components/Alert';

// Aviso que una página deja a la siguiente al navegar (`navigate(ruta, { state: { flash } })`).
export interface Flash {
  type: AlertType;
  message: string;
}

const TIPOS: readonly string[] = ['info', 'success', 'warning', 'error'];

export function flashState(flash: Flash): { flash: Flash } {
  return { flash };
}

/** Lee el aviso del estado de la navegación, que puede ser cualquier cosa. */
export function readFlash(state: unknown): Flash | undefined {
  if (typeof state !== 'object' || state === null || !('flash' in state)) return undefined;
  const { flash } = state;
  if (typeof flash !== 'object' || flash === null || !('type' in flash) || !('message' in flash)) return undefined;
  const { type, message } = flash;
  if (typeof type !== 'string' || !TIPOS.includes(type) || typeof message !== 'string') return undefined;
  return { type: type as AlertType, message };
}
