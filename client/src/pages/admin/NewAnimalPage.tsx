import type { AnimalData } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import { Alert } from '../../components/Alert';
import { ANIMAL_FIELDS, AnimalForm } from '../../components/admin/AnimalForm';
import { ADMIN_KEY, adminAnimalKey } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { ApiError } from '../../api/client';
import { flashState } from '../../utils/flash';
import styles from './AdminPage.module.css';

// CU-28 alta (pasos 1-3). Tras crearlo se abre su ficha.
export function NewAnimalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({ mutationFn: (datos: AnimalData) => adminApi.animals.create(datos) });

  return (
    <div className={styles.page}>
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.muted}>
        <Link to="/admin/animals">{t('admin.animals.title')}</Link> › {t('admin.animals.new')}
      </nav>
      <h1>{t('admin.animals.new')}</h1>
      {error && <Alert type="error">{error}</Alert>}
      <AnimalForm
        submitLabel={t('admin.animal.create')}
        submittingLabel={t('admin.animal.creating')}
        pending={crear.isPending}
        onSubmit={(datos, setFieldError) =>
          crear.mutate(datos, {
            onSuccess: async (animal) => {
              queryClient.setQueryData(adminAnimalKey(animal.id), animal);
              await queryClient.invalidateQueries({ queryKey: [...ADMIN_KEY, 'animals', 'list'] });
              await navigate(`/admin/animals/${animal.id}`, {
                state: flashState({ type: 'success', message: t('admin.animal.created') }),
              });
            },
            onError: (e) => {
              if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, setFieldError, ANIMAL_FIELDS);
              else setError(errorMessage(t, e));
            },
          })
        }
      />
    </div>
  );
}
