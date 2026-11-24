import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell,
  faCircleExclamation,
  faCircleInfo,
  faFeather,
  faHandHoldingHeart,
  faHeart,
  faNewspaper,
  faPills,
  faStethoscope,
  faUtensils,
  faReceipt,
  faUserClock,
} from '@fortawesome/free-solid-svg-icons';
import type { NotificationType } from '@sanctuary/shared';

// Icono de cada tipo de notificación (DESIGN_SYSTEM §8.8, iconos de referencia de §5).
const ICONOS: Record<NotificationType, IconDefinition> = {
  new_update: faNewspaper,
  adoption_welcome: faHandHoldingHeart,
  payment_completed: faReceipt,
  payment_failed: faCircleExclamation,
  plan_changed: faReceipt,
  adoption_cancelled: faCircleInfo,
  adoption_closed: faFeather,
  donation_thanks: faHeart,
  update_reminder: faNewspaper,
  coverage_gap: faUserClock,
  low_intake: faUtensils,
  medication_missed: faPills,
  vet_visit_today: faStethoscope,
  system: faBell,
};

export const notificationIcon = (type: NotificationType): IconDefinition => ICONOS[type];
