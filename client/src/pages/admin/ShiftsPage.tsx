import { faChevronLeft, faChevronRight, faCopy, faUserPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  isWorkerRole,
  shiftAssignmentBodySchema,
  type CopyWeekResultDto,
  type ShiftAssignmentDto,
  type ShiftsCalendarDto,
  type ShiftTemplateDto,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { CheckboxGroup } from '../../components/work/CheckboxGroup';
import { useAdminUsers } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { SHIFTS_KEY, TASKS_KEY, useShiftCalendar, useZones } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import { addDays, formatShortDate, formatWeekdayDate } from '../../utils/format';
import styles from './AdminPage.module.css';
import turnoStyles from './ShiftsPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string; copia?: CopyWeekResultDto };
type Hueco = { shift: ShiftTemplateDto; date: string };

/** Día de la semana de una fecha `YYYY-MM-DD` (1 = lunes … 7 = domingo); solo para mostrar. */
const diaDeLaSemana = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getUTCDay() || 7;

// CU-61 y CU-62: calendario semanal de turnos (SCREENS §5.7). Lo ve todo el
// personal; el administrador asigna, quita y copia la semana anterior.
export function ShiftsPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const esAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const semana = params.get('week') ?? undefined;
  const calendario = useShiftCalendar(semana, semana ? addDays(semana, 6) : undefined);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [asignar, setAsignar] = useState<Hueco | null>(null);
  const [quitar, setQuitar] = useState<ShiftAssignmentDto | null>(null);
  const [copiar, setCopiar] = useState(false);

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
  };
  const irA = (lunes: string) => {
    setAviso(null);
    setParams({ week: lunes });
  };

  const borrar = useMutation({
    mutationFn: (a: ShiftAssignmentDto) => workApi.shifts.unassign(a.id),
    onSuccess: async () => {
      setQuitar(null);
      setAviso({ type: 'success', message: t('work.shifts.unassigned') });
      await refrescar();
    },
    onError: (error) => {
      setQuitar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  const copia = useMutation({
    mutationFn: (lunes: string) => workApi.shifts.copyWeek(lunes),
    onSuccess: async (resultado) => {
      setCopiar(false);
      setAviso({
        type: 'success',
        message: t('work.shifts.copied', { count: resultado.created }),
        copia: resultado,
      });
      await refrescar();
    },
    onError: (error) => {
      setCopiar(false);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  const datos = calendario.data;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.shifts.title')}</h1>
        {esAdmin && datos && (
          <Button variant="outline" icon={faCopy} onClick={() => setCopiar(true)}>
            {t('work.shifts.copyWeek')}
          </Button>
        )}
      </div>

      {datos && (
        <div className={turnoStyles.weekNav}>
          <Button
            variant="ghost"
            icon={faChevronLeft}
            aria-label={t('work.shifts.prevWeek')}
            onClick={() => irA(addDays(datos.from, -7))}
          >
            <span className="visually-hidden">{t('work.shifts.prevWeek')}</span>
          </Button>
          <span className={turnoStyles.weekLabel}>
            {t('work.shifts.weekLabel', { from: formatShortDate(datos.from), to: formatShortDate(datos.to) })}
          </span>
          <Button
            variant="ghost"
            icon={faChevronRight}
            aria-label={t('work.shifts.nextWeek')}
            onClick={() => irA(addDays(datos.from, 7))}
          >
            <span className="visually-hidden">{t('work.shifts.nextWeek')}</span>
          </Button>
          {semana && (
            <Button
              variant="outline"
              onClick={() => {
                setAviso(null);
                setParams({});
              }}
            >
              {t('work.shifts.thisWeek')}
            </Button>
          )}
        </div>
      )}

      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          <p>{aviso.message}</p>
          {aviso.copia && aviso.copia.skipped.length > 0 && (
            <>
              <p>{t('work.shifts.skippedTitle')}</p>
              <ul>
                {aviso.copia.skipped.map((s) => (
                  <li key={`${s.date}-${s.shift.id}-${s.user.id}`}>
                    {t('work.shifts.skippedItem', {
                      name: s.user.name,
                      shift: s.shift.name,
                      date: formatWeekdayDate(s.date),
                      reason: t(`work.shifts.skipReasons.${s.reason}`),
                    })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Alert>
      )}

      {calendario.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void calendario.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.shifts.loadError')}
        </Alert>
      ) : !datos ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <>
          {datos.gaps.length > 0 && <Alert type="warning">{t('work.shifts.gaps', { count: datos.gaps.length })}</Alert>}
          <div className={turnoStyles.days}>
            {Array.from({ length: 7 }, (_, i) => addDays(datos.from, i)).map((fecha) => (
              <Dia
                key={fecha}
                fecha={fecha}
                datos={datos}
                esAdmin={esAdmin}
                onAsignar={(shift) => {
                  setAviso(null);
                  setAsignar({ shift, date: fecha });
                }}
                onQuitar={(a) => {
                  setAviso(null);
                  setQuitar(a);
                }}
              />
            ))}
          </div>
        </>
      )}

      {asignar && (
        <VentanaAsignar
          hueco={asignar}
          onClose={() => setAsignar(null)}
          onSaved={async () => {
            setAsignar(null);
            setAviso({ type: 'success', message: t('work.shifts.assigned') });
            await refrescar();
          }}
        />
      )}

      <Modal
        open={quitar !== null}
        title={t('work.shifts.unassignTitle', { name: quitar?.user.name, shift: quitar?.shift.name })}
        onClose={() => setQuitar(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setQuitar(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={borrar.isPending} onClick={() => quitar && borrar.mutate(quitar)}>
              {borrar.isPending ? t('work.shifts.unassigning') : t('work.shifts.unassign')}
            </Button>
          </>
        }
      >
        <p>{t('work.shifts.unassignText')}</p>
      </Modal>

      <Modal
        open={copiar}
        title={t('work.shifts.copyTitle')}
        onClose={() => setCopiar(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCopiar(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={copia.isPending} onClick={() => datos && copia.mutate(datos.from)}>
              {copia.isPending ? t('work.shifts.copying') : t('work.shifts.copy')}
            </Button>
          </>
        }
      >
        <p>{t('work.shifts.copyText')}</p>
      </Modal>
    </div>
  );
}

/** Un día: sus turnos (los que se hacen ese día o tienen a alguien), sus huecos y quién está ausente. */
function Dia({
  fecha,
  datos,
  esAdmin,
  onAsignar,
  onQuitar,
}: {
  fecha: string;
  datos: ShiftsCalendarDto;
  esAdmin: boolean;
  onAsignar: (turno: ShiftTemplateDto) => void;
  onQuitar: (a: ShiftAssignmentDto) => void;
}) {
  const { t } = useTranslation();
  const delDia = datos.assignments.filter((a) => a.date === fecha);
  const turnos = datos.shifts.filter(
    (s) => (s.isActive && s.weekdays.includes(diaDeLaSemana(fecha))) || delDia.some((a) => a.shift.id === s.id),
  );
  const ausentes = datos.absences.filter((a) => a.startDate <= fecha && fecha <= a.endDate);
  const id = `dia-${fecha}`;
  return (
    <section aria-labelledby={id} className={turnoStyles.day}>
      <h2 id={id} className={turnoStyles.dayTitle}>
        {formatWeekdayDate(fecha)}
      </h2>
      {turnos.length === 0 && <p className={styles.muted}>{t('work.shifts.noShifts')}</p>}
      {turnos.map((turno) => {
        const personas = delDia.filter((a) => a.shift.id === turno.id);
        const huecos = datos.gaps.filter((g) => g.date === fecha && g.shift.id === turno.id);
        return (
          <article
            key={turno.id}
            className={turnoStyles.shift}
            aria-label={t('work.shifts.shiftLabel', { name: turno.name, start: turno.startTime, end: turno.endTime })}
          >
            <div className={turnoStyles.shiftHeader}>
              <h3>{turno.name}</h3>
              <span className={styles.muted}>
                {turno.startTime}–{turno.endTime}
              </span>
            </div>
            {personas.length === 0 ? (
              <p className={styles.muted}>{t('work.shifts.nobody')}</p>
            ) : (
              <ul className={turnoStyles.people}>
                {personas.map((a) => (
                  <li key={a.id} className={turnoStyles.person}>
                    <div>
                      <span className={turnoStyles.personName}>{a.user.name}</span>
                      {a.checkedInAt && <Badge tone="success">{t('work.shifts.checkedIn')}</Badge>}
                      {a.zones.length > 0 && <p className={styles.muted}>{a.zones.map((z) => z.name).join(', ')}</p>}
                    </div>
                    {esAdmin && (
                      <button
                        type="button"
                        className={iconStyles.iconButton}
                        aria-label={t('work.shifts.unassignLabel', { name: a.user.name, shift: turno.name })}
                        onClick={() => onQuitar(a)}
                      >
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {huecos.map((g) => (
              <p key={g.zone.id} className={turnoStyles.gap}>
                {t('work.shifts.gap', { zone: g.zone.name, assigned: g.assigned, required: g.required })}
              </p>
            ))}
            {esAdmin && turno.isActive && (
              <Button
                variant="ghost"
                icon={faUserPlus}
                aria-label={t('work.shifts.assignLabel', { shift: turno.name })}
                onClick={() => onAsignar(turno)}
              >
                {t('work.shifts.assign')}
              </Button>
            )}
          </article>
        );
      })}
      {ausentes.map((a) => (
        <p key={a.id} className={styles.muted}>
          {a.type
            ? t('work.shifts.absentWithType', { name: a.user.name, type: t(`work.absenceTypes.${a.type}`) })
            : t('work.shifts.absent', { name: a.user.name })}
        </p>
      ))}
    </section>
  );
}

/** CU-61 paso 3: persona y zonas; las del turno vienen marcadas. */
function VentanaAsignar({
  hueco,
  onClose,
  onSaved,
}: {
  hueco: Hueco;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const zonas = useZones();
  const usuarios = useAdminUsers({ status: 'active', pageSize: 100, sort: 'name' });
  const trabajadores = (usuarios.data?.data ?? []).filter((u) => isWorkerRole(u.role));
  const [persona, setPersona] = useState('');
  const [zonasElegidas, setZonasElegidas] = useState<number[]>(() =>
    hueco.shift.requirements.map((r) => r.zone.id).sort((a, b) => a - b),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: workApi.shifts.assign,
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) {
        const porCampo = erroresDeApi(e.details);
        setErrores(porCampo);
        // El día y el turno no tienen campo en la ventana.
        const otro = porCampo.date ?? porCampo.shiftTemplateId;
        if (otro) setError(otro);
      } else setError(errorMessage(t, e));
    },
  });

  const formId = 'asignar-turno';
  return (
    <Modal
      open
      title={t('work.shifts.assignTitle', { shift: hueco.shift.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={guardar.isPending}>
            {guardar.isPending ? t('admin.common.saving') : t('work.shifts.assign')}
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
          const cuerpo = {
            shiftTemplateId: hueco.shift.id,
            date: hueco.date,
            userId: Number(persona),
            zoneIds: zonasElegidas,
          };
          const resultado = shiftAssignmentBodySchema.safeParse(cuerpo);
          if (!resultado.success) {
            setErrores(erroresPorCampo(resultado.error.issues));
            return;
          }
          setErrores({});
          guardar.mutate(cuerpo);
        }}
      >
        <p>{formatWeekdayDate(hueco.date)}</p>
        {error && <Alert type="error">{error}</Alert>}
        <SelectField
          label={t('work.shifts.person')}
          value={persona}
          error={errores.userId}
          onChange={(e) => setPersona(e.target.value)}
        >
          <option value="">{t('form.choose')}</option>
          {trabajadores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </SelectField>
        <CheckboxGroup
          id="zonas-turno"
          legend={t('work.shifts.zones')}
          options={(zonas.data ?? [])
            .filter((z) => z.isActive || zonasElegidas.includes(z.id))
            .map((z) => ({ value: z.id, label: z.name }))}
          value={zonasElegidas}
          error={errores.zoneIds}
          onChange={setZonasElegidas}
        />
      </form>
    </Modal>
  );
}
