import type { UserAccountStatus } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeTone } from '../Badge';

const TONOS: Record<UserAccountStatus, BadgeTone> = {
  active: 'success',
  inactive: 'warning',
  anonymized: 'neutral',
};

/** CU-35: estado de una cuenta (activa, inactiva o anonimizada). */
export function UserStatusBadge({ status }: { status: UserAccountStatus }) {
  const { t } = useTranslation();
  return <Badge tone={TONOS[status]}>{t(`admin.users.statuses.${status}`)}</Badge>;
}
