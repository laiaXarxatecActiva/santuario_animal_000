import { faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { shiftTemplateBodySchema, type ShiftTemplateBody, type ShiftTemplateDto } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { FieldError, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { CheckboxGroup } from '../../components/work/CheckboxGroup';
import { SHIFTS_KEY, useShiftTemplates, useZones } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
const DIAS = [1, 2, 3, 4, 5, 6, 7] as const;

// CU-60: plantillas de turno (SCREENS §5.7), solo administradores.
export function ShiftTemplatesAdminPage() {
  const { t } = useTranslation();
  const turnos = useShiftTemplates();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [editando, setEditando] = useState<ShiftTemplateDto | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<ShiftTemplateDto | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });

  const borrar = useMutation({
    mutationFn: (turno: ShiftTemplateDto) => workApi.shiftTemplates.remove(turno.id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('work.shiftTemplates.deleted') });
      await refrescar();
    },
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  const dias = (turno: ShiftTemplateDto) =>
    turno.weekdays.length === 7
      ? t('work.shiftTemplates.everyDay')
      : turno.weekdays.map((d) => t(`work.weekdayShort.${d}`)).join(', ');
  const minimos = (turno: ShiftTemplateDto) =>
    turno.requirements.length === 0
      ? t('work.shiftTemplates.noNeeds')
      : turno.requirements.map((r) => `${r.zone.name} (${r.minWorkers})`).join(', ');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.shiftTemplates.title')}</h1>
        <Button
          icon={faPlus}
          onClick={() => {
            setAviso(null);
            setEditando(null);
          }}
        >
          {t('work.shiftTemplates.new')}
        </Button>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {turnos.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void turnos.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.shiftTemplates.loadError')}
        </Alert>
      ) : !turnos.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : turnos.data.length === 0 ? (
        <p>{t('work.shiftTemplates.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('work.shiftTemplates.name')}</th>
              <th scope="col">{t('work.shiftTemplates.hours')}</th>
              <th scope="col">{t('work.shiftTemplates.days')}</th>
              <th scope="col">{t('work.shiftTemplates.needs')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('admin.common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {turnos.data.map((turno) => (
              <tr key={turno.id}>
                <td className={styles.nameLink}>
                  {turno.name} {!turno.isActive && <Badge>{t('work.shiftTemplates.inactive')}</Badge>}
                </td>
                <td data-label={t('work.shiftTemplates.hours')}>
                  {turno.startTime}–{turno.endTime}
                </td>
                <td data-label={t('work.shiftTemplates.days')}>{dias(turno)}</td>
                <td data-label={t('work.shiftTemplates.needs')}>{minimos(turno)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={iconStyles.iconButton}
                      aria-label={t('admin.common.edit', { name: turno.name })}
                      onClick={() => {
                        setAviso(null);
                        setEditando(turno);
                      }}
                    >
                      <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={iconStyles.iconButton}
                      aria-label={t('admin.common.deleteNamed', { name: turno.name })}
                      onClick={() => {
                        setAviso(null);
                        setABorrar(turno);
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

      {editando !== undefined && (
        <FormularioTurno
          turno={editando}
          onClose={() => setEditando(undefined)}
          onSaved={async () => {
            setEditando(undefined);
            setAviso({ type: 'success', message: t('work.shiftTemplates.saved') });
            await refrescar();
          }}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('work.shiftTemplates.confirmDelete', { name: aBorrar?.name })}
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
        <p>{t('work.shiftTemplates.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

interface Campos {
  name: string;
  startTime: string;
  endTime: string;
  weekdays: number[];
  /** Personas por zona, como se escriben; en blanco, la zona no se exige. */
  minimos: Record<number, string>;
  isActive: boolean;
}

const iniciales = (turno: ShiftTemplateDto | null): Campos => ({
  name: turno?.name ?? '',
  startTime: turno?.startTime ?? '',
  endTime: turno?.endTime ?? '',
  weekdays: turno?.weekdays ?? [],
  minimos: Object.fromEntries((turno?.requirements ?? []).map((r) => [r.zone.id, String(r.minWorkers)])),
  isActive: turno?.isActive ?? true,
});

function FormularioTurno({
  turno,
  onClose,
  onSaved,
}: {
  turno: ShiftTemplateDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const zonas = useZones();
  const [campos, setCampos] = useState<Campos>(() => iniciales(turno));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const cambiar = <K extends keyof Campos>(campo: K, valor: Campos[K]) => setCampos((c) => ({ ...c, [campo]: valor }));

  // Las zonas activas y las que ya exige el turno, en el orden de la lista de zonas.
  const opcionesZona = (zonas.data ?? []).filter((z) => z.isActive || campos.minimos[z.id] !== undefined);

  const guardar = useMutation({
    mutationFn: (datos: ShiftTemplateBody) =>
      turno ? workApi.shiftTemplates.update(turno.id, datos) : workApi.shiftTemplates.create(datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setError(errorMessage(t, e));
    },
  });

  const enviar = () => {
    setError(null);
    const datos: ShiftTemplateBody = {
      name: campos.name,
      startTime: campos.startTime,
      endTime: campos.endTime,
      weekdays: campos.weekdays,
      requirements: opcionesZona
        .filter((z) => (campos.minimos[z.id] ?? '').trim() !== '')
        .map((z) => ({ zoneId: z.id, minWorkers: Number(campos.minimos[z.id]) })),
      isActive: campos.isActive,
    };
    const resultado = shiftTemplateBodySchema.safeParse(datos);
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error.issues));
      return;
    }
    setErrores({});
    guardar.mutate(datos);
  };

  const formId = 'formulario-turno';
  return (
    <Modal
      open
      title={turno ? t('work.shiftTemplates.editTitle') : t('work.shiftTemplates.new')}
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
          enviar();
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        <TextField
          label={t('work.shiftTemplates.name')}
          maxLength={80}
          value={campos.name}
          error={errores.name}
          onChange={(e) => cambiar('name', e.target.value)}
        />
        <div className={styles.formGrid}>
          <TextField
            type="time"
            label={t('work.shiftTemplates.startTime')}
            value={campos.startTime}
            error={errores.startTime}
            onChange={(e) => cambiar('startTime', e.target.value)}
          />
          <TextField
            type="time"
            label={t('work.shiftTemplates.endTime')}
            value={campos.endTime}
            error={errores.endTime}
            onChange={(e) => cambiar('endTime', e.target.value)}
          />
        </div>
        <CheckboxGroup
          id="dias-turno"
          legend={t('work.shiftTemplates.days')}
          options={DIAS.map((d) => ({ value: d, label: t(`work.weekdayLong.${d}`) }))}
          value={campos.weekdays}
          error={errores.weekdays}
          onChange={(v) => cambiar('weekdays', v)}
        />
        <fieldset className={styles.modalForm} aria-describedby={errores.requirements ? 'minimos-error' : undefined}>
          <legend>{t('work.shiftTemplates.needs')}</legend>
          <p className={styles.muted}>{t('work.shiftTemplates.needsHelp')}</p>
          <div className={styles.formGrid}>
            {opcionesZona.map((z) => (
              <TextField
                key={z.id}
                type="number"
                min={1}
                max={20}
                inputMode="numeric"
                label={t('work.shiftTemplates.peopleIn', { zone: z.name })}
                value={campos.minimos[z.id] ?? ''}
                onChange={(e) => cambiar('minimos', { ...campos.minimos, [z.id]: e.target.value })}
              />
            ))}
          </div>
          {errores.requirements && <FieldError id="minimos-error">{errores.requirements}</FieldError>}
        </fieldset>
        <Switch
          label={t('work.shiftTemplates.active')}
          checked={campos.isActive}
          onChange={(e) => cambiar('isActive', e.target.checked)}
        />
      </form>
    </Modal>
  );
}
