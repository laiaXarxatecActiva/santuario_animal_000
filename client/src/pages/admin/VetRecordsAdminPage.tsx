import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { VetRecords } from '../../components/admin/VetRecords';
import { SelectField } from '../../components/FormFields';
import { useAdminAnimals } from '../../hooks/useAdmin';
import styles from './AdminPage.module.css';

// CU-34 desde el menú «Veterinario» (SCREENS §5.1): se elige el animal y se
// muestra el mismo historial que en la pestaña de su ficha.
export function VetRecordsAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const animales = useAdminAnimals({ pageSize: 100, sort: 'name' });
  const elegido = Number(params.get('animalId')) || undefined;
  const animal = animales.data?.data.find((a) => a.id === elegido);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.vet.pageTitle')}</h1>
      </div>
      <div className={styles.filters}>
        <SelectField
          label={t('admin.vet.animal')}
          value={elegido ? String(elegido) : ''}
          onChange={(e) => setParams(e.target.value ? { animalId: e.target.value } : {})}
        >
          <option value="">{t('admin.vet.chooseAnimal')}</option>
          {(animales.data?.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      </div>
      {animal ? <VetRecords animalId={animal.id} animalName={animal.name} /> : <p>{t('admin.vet.pickAnimal')}</p>}
    </div>
  );
}
