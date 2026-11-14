import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { ARCHIVED_ANIMAL_STATUSES, type AnimalStatus } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { UpdatesList } from '../../components/admin/UpdatesList';
import { ButtonLink } from '../../components/Button';
import { useAnimalTab } from './AnimalAdminPage';
import styles from './AnimalPhotosTab.module.css';

// CU-31: pestaña «Actualizaciones» de la ficha del animal (SCREENS §5.4). Un
// animal fallecido o trasladado ya no admite nuevas (su último aviso es de CU-33).
export function AnimalUpdatesTab() {
  const { t } = useTranslation();
  const { animal } = useAnimalTab();
  const archivado = (ARCHIVED_ANIMAL_STATUSES as readonly AnimalStatus[]).includes(animal.status);
  return (
    <div className={styles.tab}>
      {!archivado && (
        <div>
          <ButtonLink to={`/admin/updates/new?animalId=${animal.id}`} icon={faPlus}>
            {t('admin.updates.new')}
          </ButtonLink>
        </div>
      )}
      <UpdatesList animalId={animal.id} />
    </div>
  );
}
