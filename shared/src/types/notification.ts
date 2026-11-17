import type { NotificationType } from '../constants/status.js';
import type { PageMeta } from './api.js';

// Notificaciones de la campana (CU-18, TECH_SPEC §10.5).

export interface NotificationDto {
  id: number;
  type: NotificationType;
  message: string;
  /** Ruta interna a la que lleva, p. ej. `/my-animals/3`. */
  link: string | null;
  isRead: boolean;
  /** ISO 8601. */
  createdAt: string;
}

export interface NotificationsResponse {
  data: NotificationDto[];
  /** `unreadCount`: no leídas en total, para el contador de la campana. */
  meta: PageMeta & { unreadCount: number };
}
