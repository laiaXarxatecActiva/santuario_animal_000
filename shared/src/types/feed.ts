import type { PageMeta } from './api.js';
import type { AnimalUpdateDto, PhotoDto } from './public.js';

// Muro de actualizaciones del adoptante (CU-17, TECH_SPEC §10.4).

export interface FeedItemDto extends AnimalUpdateDto {
  animal: { id: number; name: string; coverPhoto: PhotoDto | null };
  isRead: boolean;
}

export interface FeedResponse {
  data: FeedItemDto[];
  /** `unreadCount`: no leídas de todo el muro, para el contador del menú. */
  meta: PageMeta & { unreadCount: number };
}
