import { faGear, faPlus, faTrashCan, faUserPen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  ARCHIVED_ANIMAL_STATUSES,
  TASK_STATUSES,
  TASK_TYPES,
  isWorkerRole,
  oneOffTaskBodySchema,
  workSettingsBodySchema,
  type OneOffTaskBody,
  type TaskDto,
  type TaskStatus,
  type TaskType,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { CheckboxGroup } from '../../components/work/CheckboxGroup';
import { TaskBadges } from '../../components/work/TaskBadges';
import { Resolucion } from '../../components/work/TaskCard';
import { useAdminAnimals, useAdminUsers } from '../../hooks/useAdmin';
import { useAdminTasks, useQualifications, useWorkSettings, useZones, WORK_KEY } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { todayInSanctuary } from '../../utils/format';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
type Errores = Record<string, string>;

/** El primer error de cada campo. */
function erroresPorCampo(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Errores {
  const errores: Errores = {};
  for (const issue of issues) errores[String(issue.path[0] ?? '')] ??= issue.message;
  return errores;
}

/** Errores del servidor: por campo si los hay; si no, el mensaje general. */
function erroresDelServidor(e: unknown): Errores | null {
  if (e instanceof ApiError && e.details.length > 0) {
    return erroresPorCampo(e.details.map((d) => ({ path: [d.field], message: d.message })));
  }
  return null;
}

/** Trabajadores en activo, para asignar tareas. */
function useTrabajadores() {
  const usuarios = useAdminUsers({ status: 'active', pageSize: 100, sort: 'name' });
  return (usuarios.data?.data ?? [])
    .filter((u) => isWorkerRole(u.role))
    .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
}

// CU-55 y CU-73: tareas del día para el administrador (SCREENS §5.18).
export function TasksAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const zonas = useZones();
  const [fecha, setFecha] = useState(todayInSanctuary());
  const [zona, setZona] = useState('');
  const [estado, setEstado] = useState<TaskStatus | ''>('');
  const tareas = useAdminTasks({
    date: fecha || undefined,
    zoneId: zona ? Number(zona) : undefined,
    status: estado || undefined,
  });
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [nueva, setNueva] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [aReasignar, setAReasignar] = useState<TaskDto | null>(null);
  const [aBorrar, setABorrar] = useState<TaskDto | null>(null);

  const terminar = (clave: string) => async () => {
    setNueva(false);
    setAjustes(false);
    setAReasignar(null);
    setABorrar(null);
    setAviso({ type: 'success', message: t(clave) });
    await queryClient.invalidateQueries({ queryKey: WORK_KEY });
  };

  const borrar = useMutation({
    mutationFn: (tarea: TaskDto) => workApi.tasks.remove(tarea.id),
    onSuccess: terminar('work.tasks.deleted'),
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.tasks.title')}</h1>
        <div className={styles.headerActions}>
          <Button variant="outline" icon={faGear} onClick={() => setAjustes(true)}>
            {t('work.tasks.settings')}
          </Button>
          <Button icon={faPlus} onClick={() => setNueva(true)}>
            {t('work.tasks.new')}
          </Button>
        </div>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      <div className={styles.filters}>
        <TextField type="date" label={t('work.tasks.day')} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <SelectField label={t('work.tasks.zone')} value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">{t('work.tasks.all')}</option>
          {zonas.data?.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('work.tasks.status')}
          value={estado}
          onChange={(e) => setEstado(e.target.value as TaskStatus | '')}
        >
          <option value="">{t('work.tasks.allStatuses')}</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`work.status.${s}`)}
            </option>
          ))}
        </SelectField>
      </div>

      {tareas.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void tareas.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.tasks.loadError')}
        </Alert>
      ) : !tareas.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : tareas.data.length === 0 ? (
        <p>{t('work.tasks.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('work.tasks.time')}</th>
              <th scope="col">{t('work.tasks.task')}</th>
              <th scope="col">{t('work.tasks.zone')}</th>
              <th scope="col">{t('work.tasks.status')}</th>
              <th scope="col">{t('work.tasks.assignee')}</th>
              <th scope="col">{t('work.tasks.result')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('admin.common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tareas.data.map((tarea) => (
              <tr key={tarea.id}>
                <td className={styles.numeric}>{tarea.dueTime}</td>
                <td className={styles.nameLink}>{tarea.title}</td>
                <td data-label={t('work.tasks.zone')}>{tarea.zone?.name ?? '—'}</td>
                <td data-label={t('work.tasks.status')}>
                  <TaskBadges tarea={tarea} />
                </td>
                <td data-label={t('work.tasks.assignee')}>{tarea.assignedTo?.name ?? '—'}</td>
                <td data-label={t('work.tasks.result')}>
                  {tarea.status !== 'pending' && <Resolucion tarea={tarea} />}
                </td>
                <td>
                  {tarea.status === 'pending' && (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={iconStyles.iconButton}
                        aria-label={t('work.tasks.reassign', { title: tarea.title })}
                        onClick={() => setAReasignar(tarea)}
                      >
                        <FontAwesomeIcon icon={faUserPen} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={iconStyles.iconButton}
                        aria-label={t('admin.common.deleteNamed', { name: tarea.title })}
                        onClick={() => {
                          setAviso(null);
                          setABorrar(tarea);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {nueva && <NuevaTarea onClose={() => setNueva(false)} onSaved={terminar('work.tasks.created')} />}
      {aReasignar && (
        <Reasignar tarea={aReasignar} onClose={() => setAReasignar(null)} onSaved={terminar('work.tasks.reassigned')} />
      )}
      {ajustes && <Ajustes onClose={() => setAjustes(false)} onSaved={terminar('work.settings.saved')} />}

      <Modal
        open={aBorrar !== null}
        title={t('work.tasks.confirmDelete', { title: aBorrar?.title })}
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
        <p>{t('work.tasks.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

/** Ventana con un formulario y los botones Cancelar y Guardar. */
function VentanaFormulario({
  id,
  titulo,
  pendiente,
  error,
  onClose,
  onSubmit,
  children,
}: {
  id: string;
  titulo: string;
  pendiente: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open
      title={titulo}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={id} disabled={pendiente}>
            {pendiente ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id={id}
        noValidate
        className={styles.modalForm}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        {children}
      </form>
    </Modal>
  );
}

/** CU-55 pasos 1-2: tarea puntual. */
function NuevaTarea({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const zonas = useZones();
  const cualificaciones = useQualifications();
  const animales = useAdminAnimals({ pageSize: 100, sort: 'name' });
  const trabajadores = useTrabajadores();
  const [campos, setCampos] = useState({
    type: TASK_TYPES[0] as TaskType,
    title: '',
    description: '',
    zoneId: '',
    animalIds: [] as number[],
    qualificationId: '',
    dueDate: todayInSanctuary(),
    dueTime: '',
    assignedTo: '',
  });
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const cambiar = <K extends keyof typeof campos>(campo: K, valor: (typeof campos)[K]) =>
    setCampos((c) => ({ ...c, [campo]: valor }));
  const opcionesAnimal = (animales.data?.data ?? [])
    .filter((a) => !(ARCHIVED_ANIMAL_STATUSES as readonly string[]).includes(a.status))
    .map((a) => ({ value: a.id, label: a.name }));

  const crear = useMutation({
    mutationFn: (datos: OneOffTaskBody) => workApi.tasks.create(datos),
    onSuccess: onSaved,
    onError: (e) => {
      const porCampo = erroresDelServidor(e);
      if (porCampo) setErrores(porCampo);
      else setError(errorMessage(t, e));
    },
  });

  const enviar = () => {
    setError(null);
    const datos: OneOffTaskBody = {
      ...campos,
      zoneId: campos.zoneId ? Number(campos.zoneId) : null,
      qualificationId: campos.qualificationId ? Number(campos.qualificationId) : null,
      assignedTo: campos.assignedTo ? Number(campos.assignedTo) : null,
    };
    const resultado = oneOffTaskBodySchema.safeParse(datos);
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error.issues));
      return;
    }
    setErrores({});
    crear.mutate(datos);
  };

  const opcional = (clave: string) => t('form.optional', { label: t(clave) });
  return (
    <VentanaFormulario
      id="nueva-tarea"
      titulo={t('work.tasks.new')}
      pendiente={crear.isPending}
      error={error}
      onClose={onClose}
      onSubmit={enviar}
    >
      <SelectField
        label={t('work.tasks.type')}
        value={campos.type}
        error={errores.type}
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
        value={campos.title}
        error={errores.title}
        onChange={(e) => cambiar('title', e.target.value)}
      />
      <TextAreaField
        label={opcional('work.tasks.description')}
        rows={3}
        value={campos.description}
        error={errores.description}
        onChange={(e) => cambiar('description', e.target.value)}
      />
      <SelectField
        label={t('work.tasks.zone')}
        value={campos.zoneId}
        error={errores.zoneId}
        onChange={(e) => cambiar('zoneId', e.target.value)}
      >
        <option value="">{t('form.choose')}</option>
        {zonas.data
          ?.filter((z) => z.isActive)
          .map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
      </SelectField>
      <CheckboxGroup
        id="tarea-animales"
        legend={opcional('work.tasks.animals')}
        options={opcionesAnimal}
        value={campos.animalIds}
        error={errores.animalIds}
        onChange={(v) => cambiar('animalIds', v)}
      />
      <SelectField
        label={opcional('work.tasks.qualification')}
        value={campos.qualificationId}
        error={errores.qualificationId}
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
        type="date"
        label={t('work.tasks.day')}
        value={campos.dueDate}
        error={errores.dueDate}
        onChange={(e) => cambiar('dueDate', e.target.value)}
      />
      <TextField
        label={t('work.tasks.time')}
        inputMode="numeric"
        placeholder="HH:MM"
        value={campos.dueTime}
        error={errores.dueTime}
        onChange={(e) => cambiar('dueTime', e.target.value)}
      />
      <SelectField
        label={opcional('work.tasks.person')}
        value={campos.assignedTo}
        error={errores.assignedTo}
        onChange={(e) => cambiar('assignedTo', e.target.value)}
      >
        <option value="">{t('work.tasks.noPerson')}</option>
        {trabajadores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
    </VentanaFormulario>
  );
}

/** CU-55 paso 3: reasignar (o volver a la asignación por zona). */
function Reasignar({ tarea, onClose, onSaved }: { tarea: TaskDto; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const trabajadores = useTrabajadores();
  const [persona, setPersona] = useState(tarea.assignedTo ? String(tarea.assignedTo.id) : '');
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: () => workApi.tasks.setAssignee(tarea.id, { userId: persona ? Number(persona) : null }),
    onSuccess: onSaved,
    onError: (e) => {
      const porCampo = erroresDelServidor(e);
      if (porCampo) setErrores(porCampo);
      else setError(errorMessage(t, e));
    },
  });
  return (
    <VentanaFormulario
      id="reasignar-tarea"
      titulo={t('work.tasks.reassignTitle', { title: tarea.title })}
      pendiente={guardar.isPending}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        setError(null);
        setErrores({});
        guardar.mutate();
      }}
    >
      <SelectField
        label={t('work.tasks.person')}
        value={persona}
        error={errores.userId}
        onChange={(e) => setPersona(e.target.value)}
      >
        <option value="">{t('work.tasks.noPerson')}</option>
        {trabajadores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
    </VentanaFormulario>
  );
}

/** CU-73: margen para considerar atrasada una tarea. */
function Ajustes({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const ajustes = useWorkSettings();
  const [margen, setMargen] = useState<string | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const valor = margen ?? (ajustes.data ? String(ajustes.data.lateMarginMinutes) : '');
  const guardar = useMutation({
    mutationFn: (lateMarginMinutes: number) => workApi.settings.update({ lateMarginMinutes }),
    onSuccess: onSaved,
    onError: (e) => {
      const porCampo = erroresDelServidor(e);
      if (porCampo) setErrores(porCampo);
      else setError(errorMessage(t, e));
    },
  });
  return (
    <VentanaFormulario
      id="ajustes-trabajo"
      titulo={t('work.settings.title')}
      pendiente={guardar.isPending}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        setError(null);
        const resultado = workSettingsBodySchema.safeParse({ lateMarginMinutes: valor });
        if (!resultado.success) {
          setErrores(erroresPorCampo(resultado.error.issues));
          return;
        }
        setErrores({});
        guardar.mutate(resultado.data.lateMarginMinutes);
      }}
    >
      <TextField
        type="number"
        min={0}
        max={240}
        label={t('work.settings.lateMargin')}
        value={valor}
        error={errores.lateMarginMinutes}
        onChange={(e) => setMargen(e.target.value)}
      />
    </VentanaFormulario>
  );
}
