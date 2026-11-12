import type { AnimalData } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { ANIMAL_FIELDS, AnimalForm } from '../../components/admin/AnimalForm';
import { ADMIN_KEY, adminAnimalKey } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { useAnimalTab } from './AnimalAdminPage';

// CU-28 pasos 2-3 de la edición: pestaña «Datos».
export function AnimalDataTab() {
  const { t } = useTranslation();
  const { animal, avisar } = useAnimalTab();
  const queryClient = useQueryClient();
  const guardar = useMutation({ mutationFn: (datos: AnimalData) => adminApi.animals.update(animal.id, datos) });

  return (
    <AnimalForm
      // Se vuelve a montar con los datos guardados (por ejemplo, tras cambiar el estado).
      key={`${animal.id}-${animal.status}`}
      animal={animal}
      submitLabel={t('admin.animal.save')}
      submittingLabel={t('admin.animal.saving')}
      pending={guardar.isPending}
      onSubmit={(datos, setFieldError) =>
        guardar.mutate(datos, {
          onSuccess: async (actualizado) => {
            queryClient.setQueryData(adminAnimalKey(animal.id), actualizado);
            avisar({ type: 'success', message: t('admin.animal.saved') });
            await queryClient.invalidateQueries({ queryKey: [...ADMIN_KEY, 'animals', 'list'] });
          },
          onError: (e) => {
            if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, setFieldError, ANIMAL_FIELDS);
            avisar({ type: 'error', message: errorMessage(t, e) });
          },
        })
      }
    />
  );
}
