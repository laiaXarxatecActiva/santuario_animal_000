import { faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  ARCHIVED_ANIMAL_STATUSES,
  TASK_RECURRENCES,
  TASK_TYPES,
  WEEKDAYS,
  taskTemplateBodySchema,
  type TaskRecurrence,
  type TaskTemplateBody,
  type TaskTemplateDto,
  type TaskType,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { CheckboxGroup } from '../../components/work/CheckboxGroup';
import { useAdminAnimals } from '../../hooks/useAdmin';
import { TEMPLATES_KEY, useQualifications, useTaskTemplates, useZones, WORK_KEY } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { todayInSanctuary } from '../../utils/format';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };

// CU-54: plantillas de tareas recurrentes (SCREENS §5.17).
export function TaskTemplatesAdminPage() {
  const { t } = useTranslation();
  const plantillas = useTaskTemplates();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [editando, setEditando] = useState<TaskTemplateDto | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<TaskTemplateDto | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: WORK_KEY });

  const borrar = useMutation({
    mutationFn: (plantilla: TaskTemplateDto) => workApi.templates.remove(plantilla.id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('work.templates.deleted') });
      await refrescar();
    },
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  /** 6: con tareas resueltas no se puede borrar; se avisa sin preguntar. */
  const pedirBorrado = (plantilla: TaskTemplateDto) => {
    if (plantilla.hasHistory) {
      setAviso({ type: 'error', message: t('errors.TEMPLATE_HAS_HISTORY') });
    } else {
      setAviso(null);
      setABorrar(plantilla);
    }
  };

  const cuando = (p: TaskTemplateDto) => {
    const horas = p.times.join(', ');
    if (p.recurrence === 'daily') return t('work.templates.scheduleDaily', { times: horas });
    if (p.recurrence === 'every_n_days')
      return t('work.templates.scheduleEvery', { count: p.intervalDays ?? 0, times: horas });
    const dias = (p.weekdays ?? []).map((d) => t(`work.weekdayShort.${d}`)).join(', ');
    return t('work.templates.scheduleWeekdays', { days: dias, times: horas });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.templates.title')}</h1>
        <Button icon={faPlus} onClick={() => setEditando(null)}>
          {t('work.templates.new')}
        </Button>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {plantillas.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void plantillas.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.templates.loadError')}
        </Alert>
      ) : !plantillas.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : plantillas.data.length === 0 ? (
        <p>{t('work.templates.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('work.tasks.titleField')}</th>
              <th scope="col">{t('work.tasks.type')}</th>
              <th scope="col">{t('work.tasks.zone')}</th>
              <th scope="col">{t('work.templates.when')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('admin.common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plantillas.data.map((p) => (
              <tr key={p.id}>
                <td className={styles.nameLink}>{p.title}</td>
                <td data-label={t('work.tasks.type')}>
                  <div className={styles.badges}>
                    <Badge>{t(`work.types.${p.type}`)}</Badge>
                    {!p.isActive && <Badge>{t('work.templates.inactive')}</Badge>}
                  </div>
                </td>
                <td data-label={t('work.tasks.zone')}>{p.zone?.name ?? '—'}</td>
                <td data-label={t('work.templates.when')}>{cuando(p)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={iconStyles.iconButton}
                      aria-label={t('admin.common.edit', { name: p.title })}
                      onClick={() => setEditando(p)}
                    >
                      <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={iconStyles.iconButton}
                      aria-label={t('admin.common.deleteNamed', { name: p.title })}
                      onClick={() => pedirBorrado(p)}
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
        <FormularioPlantilla
          plantilla={editando}
          onClose={() => setEditando(undefined)}
          onSaved={async () => {
            setEditando(undefined);
            setAviso({ type: 'success', message: t('work.templates.saved') });
            await queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
            await refrescar();
          }}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('work.templates.confirmDelete', { title: aBorrar?.title })}
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
        <p>{t('work.templates.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

interface Campos {
  type: TaskType;
  title: string;
  description: string;
  zoneId: string;
  animalIds: number[];
  qualificationId: string;
  times: string;
  recurrence: TaskRecurrence;
  weekdays: number[];
  intervalDays: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const iniciales = (p: TaskTemplateDto | null): Campos => ({
  type: p?.type ?? TASK_TYPES[0],
  title: p?.title ?? '',
  description: p?.description ?? '',
  zoneId: p?.zone ? String(p.zone.id) : '',
  animalIds: p?.animals.map((a) => a.id) ?? [],
  qualificationId: p?.qualification ? String(p.qualification.id) : '',
  times: p?.times.join(', ') ?? '',
  recurrence: p?.recurrence ?? 'daily',
  weekdays: p?.weekdays ?? [],
  intervalDays: p?.intervalDays ? String(p.intervalDays) : '',
  startDate: p?.startDate ?? todayInSanctuary(),
  endDate: p?.endDate ?? '',
  isActive: p?.isActive ?? true,
});

/** Lo que se envía: las horas escritas separadas por comas pasan a una lista. */
const cuerpo = (c: Campos, animalesValidos: Set<number> | null): TaskTemplateBody => ({
  type: c.type,
  title: c.title,
  description: c.description,
  zoneId: c.zoneId ? Number(c.zoneId) : null,
  animalIds: animalesValidos ? c.animalIds.filter((id) => animalesValidos.has(id)) : c.animalIds,
  qualificationId: c.qualificationId ? Number(c.qualificationId) : null,
  times: c.times
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
  recurrence: c.recurrence,
  weekdays: c.recurrence === 'weekdays' ? c.weekdays : null,
  intervalDays: c.recurrence === 'every_n_days' && c.intervalDays !== '' ? Number(c.intervalDays) : null,
  startDate: c.startDate,
  endDate: c.endDate || null,
  isActive: c.isActive,
});

/** El primer error de cada campo (las horas sueltas, `times.0`, cuentan como `times`). */
function erroresPorCampo(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errores: Record<string, string> = {};
  for (const issue of issues) {
    const campo = String(issue.path[0] ?? '');
    errores[campo] ??= issue.message;
  }
  return errores;
}

function FormularioPlantilla({
  plantilla,
  onClose,
  onSaved,
}: {
  plantilla: TaskTemplateDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const zonas = useZones();
  const cualificaciones = useQualifications();
  const animales = useAdminAnimals({ pageSize: 100, sort: 'name' });
  const [campos, setCampos] = useState<Campos>(() => iniciales(plantilla));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Solo los animales que siguen en el santuario.
  const opcionesAnimal = (animales.data?.data ?? [])
    .filter((a) => !(ARCHIVED_ANIMAL_STATUSES as readonly string[]).includes(a.status))
    .map((a) => ({ value: a.id, label: a.name }));
  const opcionesZona = (zonas.data ?? []).filter((z) => z.isActive || z.id === plantilla?.zone?.id);

  const cambiar = <K extends keyof Campos>(campo: K, valor: Campos[K]) => setCampos((c) => ({ ...c, [campo]: valor }));

  const guardar = useMutation({
    mutationFn: (datos: TaskTemplateBody) =>
      plantilla ? workApi.templates.update(plantilla.id, datos) : workApi.templates.create(datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) {
        setErrores(erroresPorCampo(e.details.map((d) => ({ path: [d.field], message: d.message }))));
      } else setError(errorMessage(t, e));
    },
  });

  const enviar = () => {
    setError(null);
    const datos = cuerpo(campos, animales.data ? new Set(opcionesAnimal.map((o) => o.value)) : null);
    const resultado = taskTemplateBodySchema.safeParse(datos);
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error.issues));
      return;
    }
    setErrores({});
    guardar.mutate(datos);
  };

  const formId = 'formulario-plantilla';
  const opcional = (clave: string) => t('form.optional', { label: t(clave) });
  return (
    <Modal
      open
      title={plantilla ? t('work.templates.editTitle') : t('work.templates.new')}
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
        {plantilla && <Alert type="info">{t('work.templates.regenerateNotice')}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        <SelectField
          label={t('work.tasks.type')}
          error={errores.type}
          value={campos.type}
          onChange={(e) => cambiar('type', e.target.value as TaskType)}
        >
          {TASK_TYPES.map((tipo) => (
            <option key={tipo} value={tipo}>
              {t(`work.types.${tipo}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('work.tasks.titleField')}
          error={errores.title}
          value={campos.title}
          onChange={(e) => cambiar('title', e.target.value)}
        />
        <TextAreaField
          label={opcional('work.tasks.description')}
          rows={3}
          error={errores.description}
          value={campos.description}
          onChange={(e) => cambiar('description', e.target.value)}
        />
        <SelectField
          label={t('work.tasks.zone')}
          error={errores.zoneId}
          value={campos.zoneId}
          onChange={(e) => cambiar('zoneId', e.target.value)}
        >
          <option value="">{t('work.templates.zoneFromAnimals')}</option>
          {opcionesZona.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </SelectField>
        <CheckboxGroup
          id="plantilla-animales"
          legend={opcional('work.tasks.animals')}
          options={opcionesAnimal}
          value={campos.animalIds}
          error={errores.animalIds}
          onChange={(v) => cambiar('animalIds', v)}
        />
        <SelectField
          label={opcional('work.tasks.qualification')}
          error={errores.qualificationId}
          value={campos.qualificationId}
          onChange={(e) => cambiar('qualificationId', e.target.value)}
        >
          <option value="">{t('work.tasks.none')}</option>
          {cualificaciones.data?.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('work.templates.times')}
          inputMode="numeric"
          placeholder="09:00, 17:00"
          error={errores.times}
          value={campos.times}
          onChange={(e) => cambiar('times', e.target.value)}
        />
        <SelectField
          label={t('work.templates.recurrence')}
          error={errores.recurrence}
          value={campos.recurrence}
          onChange={(e) => cambiar('recurrence', e.target.value as TaskRecurrence)}
        >
          {TASK_RECURRENCES.map((r) => (
            <option key={r} value={r}>
              {t(`work.templates.recurrences.${r}`)}
            </option>
          ))}
        </SelectField>
        {campos.recurrence === 'weekdays' && (
          <CheckboxGroup
            id="plantilla-dias"
            legend={t('work.templates.weekdays')}
            options={WEEKDAYS.map((d) => ({ value: d, label: t(`work.weekdayLong.${d}`) }))}
            value={campos.weekdays}
            error={errores.weekdays}
            onChange={(v) => cambiar('weekdays', v)}
          />
        )}
        {campos.recurrence === 'every_n_days' && (
          <TextField
            type="number"
            min={2}
            max={365}
            label={t('work.templates.intervalDays')}
            error={errores.intervalDays}
            value={campos.intervalDays}
            onChange={(e) => cambiar('intervalDays', e.target.value)}
          />
        )}
        <TextField
          type="date"
          label={t('work.templates.startDate')}
          error={errores.startDate}
          value={campos.startDate}
          onChange={(e) => cambiar('startDate', e.target.value)}
        />
        <TextField
          type="date"
          label={opcional('work.templates.endDate')}
          error={errores.endDate}
          value={campos.endDate}
          onChange={(e) => cambiar('endDate', e.target.value)}
        />
        <Switch
          label={t('work.templates.active')}
          checked={campos.isActive}
          onChange={(e) => cambiar('isActive', e.target.checked)}
        />
      </form>
    </Modal>
  );
}
