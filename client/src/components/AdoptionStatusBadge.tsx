import type { AdoptionStatus } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeTone } from './Badge';

// Insignia del estado de una adopción (DESIGN_SYSTEM §8.6).
const TONOS: Record<AdoptionStatus, BadgeTone> = {
  active: 'success',
  pending: 'warning',
  paused: 'warning',
  cancelled: 'neutral',
  finished: 'neutral',
};

export function AdoptionStatusBadge({ status }: { status: AdoptionStatus }) {
  const { t } = useTranslation();
  return <Badge tone={TONOS[status]}>{t(`adoption.status.${status}`)}</Badge>;
}
