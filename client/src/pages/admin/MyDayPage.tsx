import { faChevronLeft, faChevronRight, faListCheck } from '@fortawesome/free-solid-svg-icons';
import {
  INTAKE_LEVELS,
  taskNotDoneBodySchema,
  type IntakeLevel,
  type MyDayTaskDto,
  type NamedRef,
  type ShiftAssignmentDto,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { VetRecordForm } from '../../components/admin/VetRecords';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SelectField, TextAreaField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { HandoverNotes } from '../../components/work/HandoverNotes';
import { TaskCard } from '../../components/work/TaskCard';
import { useSession } from '../../hooks/useSession';
import { CARE_KEY, TASKS_KEY, useMyDay, useZones } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { addDays, formatTime, formatWeekdayDate } from '../../utils/format';
import styles from './AdminPage.module.css';
import diaStyles from './MyDayPage.module.css';
import turnoStyles from './ShiftsPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

type Aviso = { type: 'success' | 'error'; message: string };
type Ventana = { tipo: 'completar' | 'noRealizada' | 'visita'; tarea: MyDayTaskDto };
type Ingesta = { animalId: number; intake: IntakeLevel };

/** CU-66: en una comida se anota lo que ha comido cada animal. */
const animalesDeLaComida = (tarea: MyDayTaskDto): NamedRef[] =>
  tarea.type === 'feeding' ? (tarea.feedingAnimals ?? []) : [];

// CU-56 y CU-57: «Mi día» (SCREENS §5.16). Pensada para el móvil.
export function MyDayPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const dia = useMyDay(fecha);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ventana, setVentana] = useState<Ventana | null>(null);
  const zonas = useZones();

  const alTerminar = (clave: string) => async () => {
    setVentana(null);
    setAviso({ type: 'success', message: t(clave) });
    await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
  };
  const alFallar = (error: unknown) => setAviso({ type: 'error', message: errorMessage(t, error) });

  const completar = useMutation({
    mutationFn: ({
      id,
      observations,
      photo,
      intakes,
    }: {
      id: number;
      observations?: string;
      photo?: File;
      intakes?: Ingesta[];
    }) => workApi.tasks.complete(id, { observations, photo, intakes }),
    onSuccess: alTerminar('work.myDay.markedDone'),
    onError: alFallar,
  });
  const noRealizada = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => workApi.tasks.notDone(id, reason),
    onSuccess: alTerminar('work.myDay.markedNotDone'),
    onError: alFallar,
  });
  const deshacer = useMutation({
    mutationFn: (id: number) => workApi.tasks.reopen(id),
    onSuccess: alTerminar('work.myDay.reopened'),
    onError: alFallar,
  });
  // CU-63: fichar la entrada y la salida del turno propio.
  const fichar = useMutation({
    mutationFn: ({ id, tipo }: { id: number; tipo: 'entrada' | 'salida' }) =>
      tipo === 'entrada' ? workApi.shifts.checkIn(id) : workApi.shifts.checkOut(id),
    onSuccess: (_r, { tipo }) =>
      alTerminar(tipo === 'entrada' ? 'work.shifts.checkInDone' : 'work.shifts.checkOutDone')(),
    onError: alFallar,
  });
  const ocupado = completar.isPending || noRealizada.isPending || deshacer.isPending || fichar.isPending;

  const acciones = (tarea: MyDayTaskDto) => {
    if (tarea.status === 'pending') {
      if (tarea.blockedReason) return null;
      const noRealizadaBoton = (
        <Button variant="ghost" onClick={() => setVentana({ tipo: 'noRealizada', tarea })}>
          {t('work.myDay.notDone')}
        </Button>
      );
      // CU-68: una visita veterinaria se registra en el historial.
      if (tarea.vetVisitId) {
        return (
          <>
            <Button onClick={() => setVentana({ tipo: 'visita', tarea })}>{t('work.myDay.registerVisit')}</Button>
            {noRealizadaBoton}
          </>
        );
      }
      // CU-66: en una comida, «Hecha» pregunta lo que ha comido cada animal.
      if (animalesDeLaComida(tarea).length > 0) {
        return (
          <>
            <Button onClick={() => setVentana({ tipo: 'completar', tarea })}>{t('work.myDay.done')}</Button>
            {noRealizadaBoton}
          </>
        );
      }
      return (
        <>
          <Button disabled={ocupado} onClick={() => completar.mutate({ id: tarea.id })}>
            {t('work.myDay.done')}
          </Button>
          <Button variant="outline" onClick={() => setVentana({ tipo: 'completar', tarea })}>
            {t('work.myDay.withNote')}
          </Button>
          <Button variant="ghost" onClick={() => setVentana({ tipo: 'noRealizada', tarea })}>
            {t('work.myDay.notDone')}
          </Button>
        </>
      );
    }
    // A2: el servidor decide si se puede; aquí solo se ofrece a quien la resolvió o al administrador.
    const puedeDeshacer = user?.role === 'admin' || (tarea.resolvedBy !== null && tarea.resolvedBy.id === user?.id);
    return puedeDeshacer ? (
      <Button variant="ghost" disabled={ocupado} onClick={() => deshacer.mutate(tarea.id)}>
        {t('work.myDay.undo')}
      </Button>
    ) : null;
  };

  const tareas = dia.data?.tasks ?? [];
  const mias = tareas.filter((tarea) => tarea.mine);
  const resto = tareas.filter((tarea) => !tarea.mine);
  const fechaActual = dia.data?.date;
  // CU-71: se escribe en las zonas del turno de hoy; el administrador, en cualquiera.
  const zonasDelRelevo =
    user?.role === 'admin'
      ? (zonas.data ?? []).filter((z) => z.isActive).map((z) => ({ id: z.id, name: z.name }))
      : fecha === undefined
        ? [...new Map((dia.data?.shifts ?? []).flatMap((s) => s.zones).map((z) => [z.id, z])).values()]
        : [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.myDay.title')}</h1>
        {fechaActual && (
          <div className={diaStyles.dayNav}>
            <Button
              variant="ghost"
              icon={faChevronLeft}
              aria-label={t('work.myDay.prevDay')}
              onClick={() => setFecha(addDays(fechaActual, -1))}
            >
              <span className="visually-hidden">{t('work.myDay.prevDay')}</span>
            </Button>
            <span className={diaStyles.date}>{formatWeekdayDate(fechaActual)}</span>
            <Button
              variant="ghost"
              icon={faChevronRight}
              aria-label={t('work.myDay.nextDay')}
              onClick={() => setFecha(addDays(fechaActual, 1))}
            >
              <span className="visually-hidden">{t('work.myDay.nextDay')}</span>
            </Button>
            {fecha && (
              <Button variant="outline" onClick={() => setFecha(undefined)}>
                {t('work.myDay.today')}
              </Button>
            )}
          </div>
        )}
      </div>
      <PageIntro pagina="myDay" />
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {dia.data && (dia.data.shifts ?? []).length > 0 && (
        <section aria-labelledby="tu-turno" className={turnoStyles.mine}>
          <h2 id="tu-turno">{t('work.shifts.yourShift')}</h2>
          <div className={diaStyles.list}>
            {(dia.data.shifts ?? []).map((turno) => (
              <TarjetaTurno
                key={turno.id}
                turno={turno}
                // Solo se ficha el día del turno; el servidor lo comprueba igualmente.
                puedeFichar={fecha === undefined}
                ocupado={ocupado}
                onFichar={(tipo) => fichar.mutate({ id: turno.id, tipo })}
              />
            ))}
          </div>
        </section>
      )}

      <HandoverNotes zonas={zonasDelRelevo} />

      {dia.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void dia.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.myDay.loadError')}
        </Alert>
      ) : !dia.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : tareas.length === 0 ? (
        <EmptyState icon={faListCheck} message={t('work.myDay.empty')} />
      ) : (
        <>
          {mias.length > 0 && <Grupo id="asignadas" titulo={t('work.myDay.mine')} tareas={mias} acciones={acciones} />}
          {resto.length > 0 && <Grupo id="del-dia" titulo={t('work.myDay.rest')} tareas={resto} acciones={acciones} />}
        </>
      )}

      {ventana?.tipo === 'completar' && (
        <VentanaCompletar
          tarea={ventana.tarea}
          pendiente={completar.isPending}
          onClose={() => setVentana(null)}
          onSubmit={(observations, photo, intakes) =>
            completar.mutate({ id: ventana.tarea.id, observations, photo, intakes })
          }
        />
      )}
      {ventana?.tipo === 'visita' && (
        <VetRecordForm
          titulo={t('work.care.visits.registerTitle')}
          valores={{ description: ventana.tarea.title }}
          enviar={(registro) => workApi.care.completeVisit(ventana.tarea.vetVisitId ?? 0, registro)}
          onClose={() => setVentana(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: CARE_KEY });
            await alTerminar('work.care.visits.registered')();
          }}
        />
      )}
      {ventana?.tipo === 'noRealizada' && (
        <VentanaNoRealizada
          tarea={ventana.tarea}
          pendiente={noRealizada.isPending}
          onClose={() => setVentana(null)}
          onSubmit={(reason) => noRealizada.mutate({ id: ventana.tarea.id, reason })}
        />
      )}
    </div>
  );
}

/** CU-63: el turno de la persona, sus zonas y su fichaje. */
function TarjetaTurno({
  turno,
  puedeFichar,
  ocupado,
  onFichar,
}: {
  turno: ShiftAssignmentDto;
  puedeFichar: boolean;
  ocupado: boolean;
  onFichar: (tipo: 'entrada' | 'salida') => void;
}) {
  const { t } = useTranslation();
  const { shift } = turno;
  return (
    <article
      className={turnoStyles.shift}
      aria-label={t('work.shifts.shiftLabel', { name: shift.name, start: shift.startTime, end: shift.endTime })}
    >
      <div className={turnoStyles.shiftHeader}>
        <h3>{shift.name}</h3>
        <span className={styles.muted}>
          {shift.startTime}–{shift.endTime}
        </span>
      </div>
      {turno.zones.length > 0 && <p className={styles.muted}>{turno.zones.map((z) => z.name).join(', ')}</p>}
      {turno.checkedInAt && <p>{t('work.shifts.checkedInAt', { time: formatTime(turno.checkedInAt) })}</p>}
      {turno.checkedOutAt && <p>{t('work.shifts.checkedOutAt', { time: formatTime(turno.checkedOutAt) })}</p>}
      {puedeFichar && !turno.checkedInAt && (
        <Button disabled={ocupado} onClick={() => onFichar('entrada')}>
          {t('work.shifts.checkIn')}
        </Button>
      )}
      {puedeFichar && turno.checkedInAt && !turno.checkedOutAt && (
        <Button variant="outline" disabled={ocupado} onClick={() => onFichar('salida')}>
          {t('work.shifts.checkOut')}
        </Button>
      )}
    </article>
  );
}

function Grupo({
  id,
  titulo,
  tareas,
  acciones,
}: {
  id: string;
  titulo: string;
  tareas: MyDayTaskDto[];
  acciones: (tarea: MyDayTaskDto) => ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={diaStyles.group}>
      <h2 id={id}>{titulo}</h2>
      <div className={diaStyles.list}>
        {tareas.map((tarea) => (
          <TaskCard key={tarea.id} tarea={tarea} acciones={acciones(tarea)} />
        ))}
      </div>
    </section>
  );
}

/** CU-57 paso 3: observaciones y foto opcionales; en las comidas, lo que ha comido cada animal (CU-66). */
function VentanaCompletar({
  tarea,
  pendiente,
  onClose,
  onSubmit,
}: {
  tarea: MyDayTaskDto;
  pendiente: boolean;
  onClose: () => void;
  onSubmit: (observations: string | undefined, photo: File | undefined, intakes: Ingesta[] | undefined) => void;
}) {
  const { t } = useTranslation();
  const [observaciones, setObservaciones] = useState('');
  const [foto, setFoto] = useState<File | undefined>(undefined);
  const animales = animalesDeLaComida(tarea);
  const [ingestas, setIngestas] = useState<Record<number, IntakeLevel>>(() =>
    Object.fromEntries(animales.map((a) => [a.id, 'all' as IntakeLevel])),
  );
  const formId = 'completar-tarea';
  return (
    <Modal
      open
      title={tarea.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pendiente}>
            {pendiente ? t('admin.common.saving') : t('work.myDay.completeSubmit')}
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
          onSubmit(
            observaciones.trim() === '' ? undefined : observaciones,
            foto,
            animales.length > 0
              ? animales.map((a) => ({ animalId: a.id, intake: ingestas[a.id] ?? 'all' }))
              : undefined,
          );
        }}
      >
        {animales.length > 0 && (
          <fieldset className={styles.modalForm}>
            <legend>{t('work.myDay.intakesLegend')}</legend>
            {animales.map((a) => (
              <SelectField
                key={a.id}
                label={a.name}
                value={ingestas[a.id] ?? 'all'}
                onChange={(e) => setIngestas((actual) => ({ ...actual, [a.id]: e.target.value as IntakeLevel }))}
              >
                {INTAKE_LEVELS.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {t(`work.care.intakes.${nivel}`)}
                  </option>
                ))}
              </SelectField>
            ))}
          </fieldset>
        )}
        <TextAreaField
          label={t('form.optional', { label: t('work.myDay.observations') })}
          rows={3}
          maxLength={1000}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
        <TextField
          type="file"
          accept="image/jpeg,image/png,image/webp"
          label={t('form.optional', { label: t('work.photo') })}
          onChange={(e) => setFoto(e.target.files?.[0])}
        />
      </form>
    </Modal>
  );
}

/** CU-57 A1: el motivo es obligatorio. */
function VentanaNoRealizada({
  tarea,
  pendiente,
  onClose,
  onSubmit,
}: {
  tarea: MyDayTaskDto;
  pendiente: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const formId = 'tarea-no-realizada';
  return (
    <Modal
      open
      title={tarea.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pendiente}>
            {pendiente ? t('admin.common.saving') : t('admin.common.save')}
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
          const resultado = taskNotDoneBodySchema.safeParse({ reason: motivo });
          if (!resultado.success) {
            setError(resultado.error.issues[0]?.message);
            return;
          }
          onSubmit(resultado.data.reason);
        }}
      >
        <TextAreaField
          label={t('work.myDay.reason')}
          rows={3}
          maxLength={1000}
          value={motivo}
          error={error}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </form>
    </Modal>
  );
}
