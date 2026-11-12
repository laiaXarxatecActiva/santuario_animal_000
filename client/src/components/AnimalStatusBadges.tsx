import type { AnimalStatus } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeTone } from './Badge';

const TONO: Record<AnimalStatus, BadgeTone> = {
  in_sanctuary: 'success',
  in_treatment: 'info',
  deceased: 'neutral',
  transferred: 'neutral',
};

/** Estado del animal en el panel, con «Oculto» si no está publicado (SCREENS §5.3). */
export function AnimalStatusBadges({ status, isPublished }: { status: AnimalStatus; isPublished: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <Badge tone={TONO[status]}>{t(`admin.animalStatus.${status}`)}</Badge>
      {!isPublished && <Badge tone="warning">{t('admin.animals.hidden')}</Badge>}
    </>
  );
}
