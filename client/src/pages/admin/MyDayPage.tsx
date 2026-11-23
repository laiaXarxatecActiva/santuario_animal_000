import { faChevronLeft, faChevronRight, faListCheck } from '@fortawesome/free-solid-svg-icons';
import { taskNotDoneBodySchema, type MyDayTaskDto } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TextAreaField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { TaskCard } from '../../components/work/TaskCard';
import { useSession } from '../../hooks/useSession';
import { TASKS_KEY, useMyDay } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { addDays, formatWeekdayDate } from '../../utils/format';
import styles from './AdminPage.module.css';
import diaStyles from './MyDayPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
type Ventana = { tipo: 'completar' | 'noRealizada'; tarea: MyDayTaskDto };

// CU-56 y CU-57: «Mi día» (SCREENS §5.16). Pensada para el móvil.
export function MyDayPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const dia = useMyDay(fecha);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ventana, setVentana] = useState<Ventana | null>(null);

  const alTerminar = (clave: string) => async () => {
    setVentana(null);
    setAviso({ type: 'success', message: t(clave) });
    await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
  };
  const alFallar = (error: unknown) => setAviso({ type: 'error', message: errorMessage(t, error) });

  const completar = useMutation({
    mutationFn: ({ id, observations, photo }: { id: number; observations?: string; photo?: File }) =>
      workApi.tasks.complete(id, { observations, photo }),
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
  const ocupado = completar.isPending || noRealizada.isPending || deshacer.isPending;

  const acciones = (tarea: MyDayTaskDto) => {
    if (tarea.status === 'pending') {
      if (tarea.blockedReason) return null;
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
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

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
          onSubmit={(observations, photo) => completar.mutate({ id: ventana.tarea.id, observations, photo })}
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

/** CU-57 paso 3: observaciones y foto opcionales. */
function VentanaCompletar({
  tarea,
  pendiente,
  onClose,
  onSubmit,
}: {
  tarea: MyDayTaskDto;
  pendiente: boolean;
  onClose: () => void;
  onSubmit: (observations: string | undefined, photo: File | undefined) => void;
}) {
  const { t } = useTranslation();
  const [observaciones, setObservaciones] = useState('');
  const [foto, setFoto] = useState<File | undefined>(undefined);
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
          onSubmit(observaciones.trim() === '' ? undefined : observaciones, foto);
        }}
      >
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
