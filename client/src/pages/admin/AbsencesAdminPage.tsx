import { faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  ABSENCE_TYPES,
  absenceBodySchema,
  isWorkerRole,
  type AbsenceBody,
  type AbsenceCreatedDto,
  type AbsenceDto,
  type AbsenceType,
  type ShiftAssignmentDto,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { useAdminUsers } from '../../hooks/useAdmin';
import { SHIFTS_KEY, TASKS_KEY, useAbsences } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import { formatShortDate, formatWeekdayDate } from '../../utils/format';
import styles from './AdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

type Aviso = { type: 'success' | 'error'; message: string; creada?: AbsenceCreatedDto };

// CU-62: ausencias del personal (SCREENS §5.7), solo administradores.
export function AbsencesAdminPage() {
  const { t } = useTranslation();
  const ausencias = useAbsences();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [nueva, setNueva] = useState(false);
  const [aBorrar, setABorrar] = useState<AbsenceDto | null>(null);

  // Quitar turnos cambia el calendario y «Mi día».
  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
  };

  const borrar = useMutation({
    mutationFn: (a: AbsenceDto) => workApi.absences.remove(a.id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('work.absences.deleted') });
      await refrescar();
    },
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  const turno = (a: ShiftAssignmentDto) => (
    <li key={a.id}>{t('work.absences.shiftItem', { date: formatWeekdayDate(a.date), shift: a.shift.name })}</li>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.absences.title')}</h1>
        <Button
          icon={faPlus}
          onClick={() => {
            setAviso(null);
            setNueva(true);
          }}
        >
          {t('work.absences.new')}
        </Button>
      </div>
      <PageIntro pagina="absences" />
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          <p>{aviso.message}</p>
          {aviso.creada && aviso.creada.removedAssignments.length > 0 && (
            <>
              <p>{t('work.absences.removed')}</p>
              <ul>{aviso.creada.removedAssignments.map(turno)}</ul>
            </>
          )}
          {aviso.creada && aviso.creada.keptAssignments.length > 0 && (
            <>
              <p>{t('work.absences.kept')}</p>
              <ul>{aviso.creada.keptAssignments.map(turno)}</ul>
            </>
          )}
        </Alert>
      )}

      {ausencias.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void ausencias.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.absences.loadError')}
        </Alert>
      ) : !ausencias.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : ausencias.data.length === 0 ? (
        <p>{t('work.absences.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('work.absences.person')}</th>
              <th scope="col">{t('work.absences.dates')}</th>
              <th scope="col">{t('work.absences.type')}</th>
              <th scope="col">{t('work.absences.notes')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('admin.common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ausencias.data.map((a) => (
              <tr key={a.id}>
                <td className={styles.nameLink}>{a.user.name}</td>
                <td data-label={t('work.absences.dates')}>
                  {t('work.absences.range', { from: formatShortDate(a.startDate), to: formatShortDate(a.endDate) })}
                </td>
                <td data-label={t('work.absences.type')}>{a.type && t(`work.absenceTypes.${a.type}`)}</td>
                <td data-label={t('work.absences.notes')}>
                  {a.notes && <span className={styles.muted}>{a.notes}</span>}
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={iconStyles.iconButton}
                      aria-label={t('work.absences.deleteLabel', { name: a.user.name })}
                      onClick={() => {
                        setAviso(null);
                        setABorrar(a);
                      }}
                    >
                      <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {nueva && (
        <FormularioAusencia
          onClose={() => setNueva(false)}
          onSaved={async (creada) => {
            setNueva(false);
            setAviso({ type: 'success', message: t('work.absences.created'), creada });
            await queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
            await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
          }}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('work.absences.confirmDelete', { name: aBorrar?.user.name })}
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
        <p>{t('work.absences.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

function FormularioAusencia({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (creada: AbsenceCreatedDto) => Promise<void>;
}) {
  const { t } = useTranslation();
  const usuarios = useAdminUsers({ status: 'active', pageSize: 100, sort: 'name' });
  const trabajadores = (usuarios.data?.data ?? []).filter((u) => isWorkerRole(u.role));
  const [campos, setCampos] = useState({ userId: '', startDate: '', endDate: '', type: '', notes: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const cambiar = (campo: keyof typeof campos, valor: string) => setCampos((c) => ({ ...c, [campo]: valor }));

  const guardar = useMutation({
    mutationFn: (datos: AbsenceBody) => workApi.absences.create(datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setError(errorMessage(t, e));
    },
  });

  const formId = 'formulario-ausencia';
  return (
    <Modal
      open
      title={t('work.absences.new')}
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
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const datos: AbsenceBody = {
            userId: Number(campos.userId),
            startDate: campos.startDate,
            endDate: campos.endDate,
            type: campos.type as AbsenceType,
            notes: campos.notes,
          };
          const resultado = absenceBodySchema.safeParse(datos);
          if (!resultado.success) {
            setErrores(erroresPorCampo(resultado.error.issues));
            return;
          }
          setErrores({});
          guardar.mutate(datos);
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        <SelectField
          label={t('work.absences.person')}
          value={campos.userId}
          error={errores.userId}
          onChange={(e) => cambiar('userId', e.target.value)}
        >
          <option value="">{t('form.choose')}</option>
          {trabajadores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </SelectField>
        <div className={styles.formGrid}>
          <TextField
            type="date"
            label={t('work.absences.startDate')}
            value={campos.startDate}
            error={errores.startDate}
            onChange={(e) => cambiar('startDate', e.target.value)}
          />
          <TextField
            type="date"
            label={t('work.absences.endDate')}
            value={campos.endDate}
            error={errores.endDate}
            onChange={(e) => cambiar('endDate', e.target.value)}
          />
        </div>
        <SelectField
          label={t('work.absences.type')}
          value={campos.type}
          error={errores.type}
          onChange={(e) => cambiar('type', e.target.value)}
        >
          <option value="">{t('form.choose')}</option>
          {ABSENCE_TYPES.map((tipo) => (
            <option key={tipo} value={tipo}>
              {t(`work.absenceTypes.${tipo}`)}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label={t('form.optional', { label: t('work.absences.notes') })}
          rows={3}
          maxLength={500}
          value={campos.notes}
          error={errores.notes}
          onChange={(e) => cambiar('notes', e.target.value)}
        />
      </form>
    </Modal>
  );
}
