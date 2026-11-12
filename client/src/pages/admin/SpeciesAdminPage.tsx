import { faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { zodResolver } from '@hookform/resolvers/zod';
import { speciesBodySchema, type SpeciesAdminDto, type SpeciesBody } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextAreaField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { ADMIN_KEY, useAdminSpecies } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
const CAMPOS = ['name', 'scientificName', 'description'] as const;

// CU-30 Gestionar especies (SCREENS §5.3).
export function SpeciesAdminPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const especies = useAdminSpecies();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // `null`: nueva especie; `undefined`: ventana cerrada.
  const [editando, setEditando] = useState<SpeciesAdminDto | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<SpeciesAdminDto | null>(null);
  const esAdmin = user?.role === 'admin';

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY });

  const borrar = useMutation({
    mutationFn: (especie: SpeciesAdminDto) => adminApi.species.remove(especie.id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('admin.species.deleted') });
      await refrescar();
    },
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  /** A1: con animales no se puede borrar; se avisa sin preguntar. */
  const pedirBorrado = (especie: SpeciesAdminDto) => {
    if (especie.animalCount > 0) {
      setAviso({ type: 'error', message: t('admin.species.inUse', { count: especie.animalCount }) });
    } else {
      setAviso(null);
      setABorrar(especie);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.species.title')}</h1>
        <Button icon={faPlus} onClick={() => setEditando(null)}>
          {t('admin.species.new')}
        </Button>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {especies.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void especies.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.species.loadError')}
        </Alert>
      ) : !especies.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : especies.data.length === 0 ? (
        <p>{t('admin.species.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('admin.species.name')}</th>
              <th scope="col">{t('admin.species.scientificName')}</th>
              <th scope="col" className={styles.numeric}>
                {t('admin.species.animalCount')}
              </th>
              <th scope="col">
                <span className="visually-hidden">{t('admin.common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {especies.data.map((especie) => (
              <tr key={especie.id}>
                <td className={styles.nameLink}>{especie.name}</td>
                <td data-label={t('admin.species.scientificName')}>
                  <i>{especie.scientificName}</i>
                </td>
                <td data-label={t('admin.species.animalCount')} className={styles.numeric}>
                  {especie.animalCount}
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={iconStyles.iconButton}
                      aria-label={t('admin.common.edit', { name: especie.name })}
                      onClick={() => setEditando(especie)}
                    >
                      <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </button>
                    {esAdmin && (
                      <button
                        type="button"
                        className={iconStyles.iconButton}
                        aria-label={t('admin.common.deleteNamed', { name: especie.name })}
                        onClick={() => pedirBorrado(especie)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editando !== undefined && (
        <FormularioEspecie
          especie={editando}
          onClose={() => setEditando(undefined)}
          onSaved={async () => {
            setEditando(undefined);
            setAviso({ type: 'success', message: t('admin.species.saved') });
            await refrescar();
          }}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('admin.species.confirmDelete', { name: aBorrar?.name })}
        onClose={() => setABorrar(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={borrar.isPending} onClick={() => aBorrar && borrar.mutate(aBorrar)}>
              {borrar.isPending ? t('admin.common.deleting') : t('admin.common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('admin.species.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

function FormularioEspecie({
  especie,
  onClose,
  onSaved,
}: {
  especie: SpeciesAdminDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SpeciesBody>({
    resolver: zodResolver(speciesBodySchema, undefined, { raw: true }),
    defaultValues: {
      name: especie?.name ?? '',
      scientificName: especie?.scientificName ?? '',
      description: especie?.description ?? '',
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const guardar = useMutation({
    mutationFn: (datos: SpeciesBody) =>
      especie ? adminApi.species.update(especie.id, datos) : adminApi.species.create(datos),
    onSuccess: onSaved,
    onError: (e) => {
      // Los errores de un campo se muestran junto a él; los demás, arriba.
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, CAMPOS);
      else setError(errorMessage(t, e));
    },
  });

  const formId = 'formulario-especie';
  return (
    <Modal
      open
      title={especie ? t('admin.species.editTitle') : t('admin.species.new')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={guardar.isPending}>
            {guardar.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className={styles.modalForm}
        onSubmit={handleSubmit((datos) => guardar.mutate(datos))}
      >
        {error && <Alert type="error">{error}</Alert>}
        <TextField label={t('admin.species.name')} error={errors.name?.message} {...register('name')} />
        <TextField
          label={t('form.optional', { label: t('admin.species.scientificName') })}
          error={errors.scientificName?.message}
          {...register('scientificName')}
        />
        <TextAreaField
          label={t('form.optional', { label: t('admin.species.description') })}
          rows={4}
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Modal>
  );
}
