import type { AdminAnimalDto, AnimalData } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { ANIMAL_FIELDS, AnimalForm } from '../../components/admin/AnimalForm';
import { Switch } from '../../components/Switch';
import { ADMIN_KEY, adminAnimalKey } from '../../hooks/useAdmin';
import { esArchivado } from '../../utils/animal';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { formatDate } from '../../utils/format';
import { useAnimalTab } from './AnimalAdminPage';
import pageStyles from './AdminPage.module.css';

// CU-28 pasos 2-3 de la edición: pestaña «Datos». RN-22: la de un fallecido o
// trasladado solo se consulta.
export function AnimalDataTab() {
  const { t } = useTranslation();
  const { animal, avisar } = useAnimalTab();
  const queryClient = useQueryClient();
  const guardar = useMutation({ mutationFn: (datos: AnimalData) => adminApi.animals.update(animal.id, datos) });

  if (esArchivado(animal.status)) return <DatosSoloConsulta animal={animal} />;

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

/** Los datos recabados mientras estuvo en el santuario y, si ha fallecido, «En memoria» (CU-12). */
function DatosSoloConsulta({ animal }: { animal: AdminAnimalDto }) {
  const { t } = useTranslation();
  const { avisar } = useAnimalTab();
  const queryClient = useQueryClient();
  const memoria = useMutation({
    mutationFn: (mostrar: boolean) => adminApi.animals.setMemorial(animal.id, mostrar),
    onSuccess: async (actualizado) => {
      queryClient.setQueryData(adminAnimalKey(animal.id), actualizado);
      avisar({ type: 'success', message: t('admin.animal.saved') });
      await queryClient.invalidateQueries({ queryKey: [...ADMIN_KEY, 'animals', 'list'] });
    },
    onError: (e) => avisar({ type: 'error', message: errorMessage(t, e) }),
  });
  const vacio = '—';
  const datos: [string, string][] = [
    [t('admin.animal.name'), animal.name],
    [t('admin.animal.species'), animal.species.name],
    [t('admin.animal.sex'), t(`animal.sex.${animal.sex}`)],
    [t('admin.animal.zone'), animal.zone?.name ?? vacio],
    [t('admin.animal.approxBirthDate'), animal.approxBirthDate ? formatDate(animal.approxBirthDate) : vacio],
    [t('admin.animal.arrivalDate'), formatDate(animal.arrivalDate)],
    [t('admin.animal.rescueStory'), animal.rescueStory ?? vacio],
    [t('admin.animal.temperament'), animal.temperament ?? vacio],
    [t('admin.animal.specialNeeds'), animal.specialNeeds ?? vacio],
    [t('admin.animal.healthSummary'), animal.healthSummary ?? vacio],
  ];
  return (
    <div className={pageStyles.page}>
      <dl className={pageStyles.details}>
        {datos.map(([etiqueta, valor]) => (
          <Fragment key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd className={pageStyles.preWrap}>{valor}</dd>
          </Fragment>
        ))}
      </dl>
      {animal.status === 'deceased' && (
        <Switch
          label={t('admin.animal.showInMemorial')}
          help={t('admin.animal.showInMemorialHelp')}
          checked={animal.showInMemorial}
          disabled={memoria.isPending}
          onChange={(e) => memoria.mutate(e.target.checked)}
        />
      )}
    </div>
  );
}
