import { zodResolver } from '@hookform/resolvers/zod';
import { faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { VET_RECORD_TYPES, vetRecordBodySchema, type VetRecordBody, type VetRecordDto } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { adminVetRecordsKey, useVetRecords } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import pageStyles from '../../pages/admin/AdminPage.module.css';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { formatDecimal, formatShortDate } from '../../utils/format';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { LineChart } from '../charts/LineChart';
import { SelectField, TextAreaField, TextField } from '../FormFields';
import iconStyles from '../IconButton.module.css';
import { Modal } from '../Modal';

type Aviso = { type: 'success' | 'error'; message: string };
const CAMPOS = ['recordDate', 'type', 'description', 'weightKg', 'veterinarian'] as const;

/** Hoy en el navegador, como `YYYY-MM-DD` (el servidor lo vuelve a comprobar). */
const hoyLocal = () => new Intl.DateTimeFormat('sv-SE').format(new Date());

// CU-34: historial veterinario de un animal (pestaña «Veterinario» de su ficha).
// Es interno: los adoptantes solo ven el resumen de salud (CU-28).
export function VetRecords({ animalId, animalName }: { animalId: number; animalName: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const registros = useVetRecords(animalId);
  const [editando, setEditando] = useState<VetRecordDto | 'nuevo' | null>(null);
  const [aBorrar, setABorrar] = useState<VetRecordDto | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const borrar = useMutation({
    mutationFn: (id: number) => adminApi.vetRecords.remove(id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('admin.vet.deleted') });
      await queryClient.invalidateQueries({ queryKey: adminVetRecordsKey(animalId) });
    },
    onError: (e) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, e) });
    },
  });

  const guardado = async (mensaje: string) => {
    setEditando(null);
    setAviso({ type: 'success', message: mensaje });
    await queryClient.invalidateQueries({ queryKey: adminVetRecordsKey(animalId) });
  };

  // Paso 2: el gráfico va del más antiguo al más reciente.
  const pesos = (registros.data ?? [])
    .filter((r) => r.weightKg !== null)
    .reverse()
    .map((r) => ({
      label: formatShortDate(r.recordDate),
      value: Number(r.weightKg),
      display: t('admin.vet.kg', { value: formatDecimal(r.weightKg!) }),
    }));

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.header}>
        <h2>{t('admin.vet.title', { name: animalName })}</h2>
        <Button
          icon={faPlus}
          onClick={() => {
            setAviso(null);
            setEditando('nuevo');
          }}
        >
          {t('admin.vet.new')}
        </Button>
      </div>
      <p className={pageStyles.muted}>{t('admin.vet.internal')}</p>

      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {registros.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void registros.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.vet.loadError')}
        </Alert>
      ) : !registros.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : registros.data.length === 0 ? (
        <p>{t('admin.vet.empty')}</p>
      ) : (
        <>
          <section aria-labelledby="peso">
            <h3 id="peso">{t('admin.vet.weightTitle')}</h3>
            <LineChart
              title={t('admin.vet.weightTitle')}
              points={pesos}
              formatAxis={(v) => t('admin.vet.kg', { value: formatDecimal(String(v)) })}
            />
          </section>
          <table className={pageStyles.table}>
            <thead>
              <tr>
                <th scope="col">{t('admin.vet.date')}</th>
                <th scope="col">{t('admin.vet.type')}</th>
                <th scope="col">{t('admin.vet.description')}</th>
                <th scope="col" className={pageStyles.numeric}>
                  {t('admin.vet.weight')}
                </th>
                <th scope="col">{t('admin.vet.veterinarian')}</th>
                <th scope="col">{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {registros.data.map((r) => {
                const nombre = `${t(`admin.vet.types.${r.type}`)} ${formatShortDate(r.recordDate)}`;
                return (
                  <tr key={r.id}>
                    <td>{formatShortDate(r.recordDate)}</td>
                    <td data-label={t('admin.vet.type')}>{t(`admin.vet.types.${r.type}`)}</td>
                    <td data-label={t('admin.vet.description')} className={pageStyles.preWrap}>
                      {r.description}
                    </td>
                    <td data-label={t('admin.vet.weight')} className={pageStyles.numeric}>
                      {r.weightKg === null ? '—' : t('admin.vet.kg', { value: formatDecimal(r.weightKg) })}
                    </td>
                    <td data-label={t('admin.vet.veterinarian')}>{r.veterinarian ?? '—'}</td>
                    <td>
                      <div className={pageStyles.rowActions}>
                        <button
                          type="button"
                          className={iconStyles.iconButton}
                          aria-label={t('admin.common.edit', { name: nombre })}
                          onClick={() => {
                            setAviso(null);
                            setEditando(r);
                          }}
                        >
                          <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                        </button>
                        {/* A2: borrar, solo el administrador (el servidor también lo comprueba). */}
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            className={iconStyles.iconButton}
                            aria-label={t('admin.common.deleteNamed', { name: nombre })}
                            onClick={() => {
                              setAviso(null);
                              setABorrar(r);
                            }}
                          >
                            <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {editando && (
        <FormularioRegistro
          animalId={animalId}
          registro={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={guardado}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('admin.vet.confirmDelete')}
        onClose={() => setABorrar(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button variant="danger" disabled={borrar.isPending} onClick={() => aBorrar && borrar.mutate(aBorrar.id)}>
              {borrar.isPending ? t('admin.common.deleting') : t('admin.common.delete')}
            </Button>
          </>
        }
      >
        {aBorrar && (
          <p>
            {t('admin.vet.deleteSummary', {
              type: t(`admin.vet.types.${aBorrar.type}`),
              date: formatShortDate(aBorrar.recordDate),
            })}
          </p>
        )}
      </Modal>
    </div>
  );
}

/** Pasos 3-4 (alta) y A1 (edición). */
function FormularioRegistro({
  animalId,
  registro,
  onClose,
  onSaved,
}: {
  animalId: number;
  registro: VetRecordDto | null;
  onClose: () => void;
  onSaved: (mensaje: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<VetRecordBody>({
    resolver: zodResolver(vetRecordBodySchema, undefined, { raw: true }),
    defaultValues: registro
      ? {
          recordDate: registro.recordDate,
          type: registro.type,
          description: registro.description,
          weightKg: registro.weightKg ?? '',
          veterinarian: registro.veterinarian ?? '',
        }
      : { recordDate: hoyLocal(), type: 'checkup', description: '', weightKg: '', veterinarian: '' },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const guardar = useMutation({
    mutationFn: (datos: VetRecordBody) =>
      registro ? adminApi.vetRecords.update(registro.id, datos) : adminApi.vetRecords.create(animalId, datos),
    onSuccess: () => onSaved(t(registro ? 'admin.vet.updated' : 'admin.vet.created')),
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, CAMPOS);
      else setError(errorMessage(t, e));
    },
  });

  const formId = 'formulario-veterinario';
  return (
    <Modal
      open
      title={t(registro ? 'admin.vet.editTitle' : 'admin.vet.new')}
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
        className={pageStyles.modalForm}
        onSubmit={handleSubmit((datos) => guardar.mutate(datos))}
      >
        {error && <Alert type="error">{error}</Alert>}
        <TextField
          type="date"
          max={hoyLocal()}
          label={t('admin.vet.date')}
          error={errors.recordDate?.message}
          {...register('recordDate')}
        />
        <SelectField label={t('admin.vet.type')} error={errors.type?.message} {...register('type')}>
          {VET_RECORD_TYPES.map((tipo) => (
            <option key={tipo} value={tipo}>
              {t(`admin.vet.types.${tipo}`)}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label={t('admin.vet.description')}
          rows={4}
          error={errors.description?.message}
          {...register('description')}
        />
        <TextField
          label={t('form.optional', { label: t('admin.vet.weightKg') })}
          inputMode="decimal"
          error={errors.weightKg?.message}
          {...register('weightKg')}
        />
        <TextField
          label={t('form.optional', { label: t('admin.vet.veterinarian') })}
          error={errors.veterinarian?.message}
          {...register('veterinarian')}
        />
      </form>
    </Modal>
  );
}
