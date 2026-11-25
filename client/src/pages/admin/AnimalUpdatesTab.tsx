import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { UpdatesList } from '../../components/admin/UpdatesList';
import { ButtonLink } from '../../components/Button';
import { esArchivado } from '../../utils/animal';
import { useAnimalTab } from './AnimalAdminPage';
import styles from './AnimalPhotosTab.module.css';

// CU-31: pestaña «Actualizaciones» de la ficha del animal (SCREENS §5.4). Las de
// un animal fallecido o trasladado solo se consultan (RN-22): ni nuevas ni
// cambios (el servidor devuelve `canEdit: false`).
export function AnimalUpdatesTab() {
  const { t } = useTranslation();
  const { animal } = useAnimalTab();
  const archivado = esArchivado(animal.status);
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
