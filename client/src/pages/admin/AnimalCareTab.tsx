import { faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  ARCHIVED_ANIMAL_STATUSES,
  dietItemBodySchema,
  FOOD_UNITS,
  medicationPlanBodySchema,
  MEDICATION_ROUTES,
  vetVisitBodySchema,
  type DietItemBody,
  type DietItemDto,
  type FoodUnit,
  type IntakeLevel,
  type MedicationPlanBody,
  type MedicationPlanDto,
  type MedicationRoute,
  type VetVisitBody,
  type VetVisitDto,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { VetRecordForm } from '../../components/admin/VetRecords';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField, TextField } from '../../components/FormFields';
import { TimeField, TimesField } from '../../components/TimeField';

import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import cardStyles from '../../components/work/TaskCard.module.css';
import { adminVetRecordsKey } from '../../hooks/useAdmin';
import { animalCareKey, TASKS_KEY, useAnimalCare, useQualifications } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresPorCampo } from '../../utils/erroresPorCampo';
import { formatDecimal, formatShortDate, todayInSanctuary } from '../../utils/format';
import { useAnimalTab } from './AnimalAdminPage';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };

const TONO_INGESTA: Record<IntakeLevel, 'success' | 'neutral' | 'warning' | 'error'> = {
  all: 'success',
  most: 'neutral',
  little: 'warning',
  none: 'error',
};

const TONO_VISITA = { scheduled: 'primary', done: 'success', cancelled: 'neutral' } as const;

type Ventana =
  | { tipo: 'alimento'; item: DietItemDto | null }
  | { tipo: 'borrarAlimento'; item: DietItemDto }
  | { tipo: 'pauta'; pauta: MedicationPlanDto | null }
  | { tipo: 'terminarPauta'; pauta: MedicationPlanDto }
  | { tipo: 'borrarPauta'; pauta: MedicationPlanDto }
  | { tipo: 'visita'; visita: VetVisitDto | null }
  | { tipo: 'cancelarVisita'; visita: VetVisitDto }
  | { tipo: 'registrarVisita'; visita: VetVisitDto };

// CU-65 a CU-69: pestaña «Cuidados» de la ficha del animal (SCREENS §5.4):
// dieta, comidas de los últimos días, medicación y visitas veterinarias.
export function AnimalCareTab() {
  const { t } = useTranslation();
  const { animal } = useAnimalTab();
  const queryClient = useQueryClient();
  const cuidados = useAnimalCare(animal.id);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ventana, setVentana] = useState<Ventana | null>(null);
  const archivado = (ARCHIVED_ANIMAL_STATUSES as readonly string[]).includes(animal.status);

  const hecho = async (clave: string) => {
    setVentana(null);
    setAviso({ type: 'success', message: t(clave) });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: animalCareKey(animal.id) }),
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
    ]);
  };
  const fallo = (e: unknown) => {
    setVentana(null);
    setAviso({ type: 'error', message: errorMessage(t, e) });
  };

  const accion = useMutation({
    mutationFn: ({ llamada }: { llamada: () => Promise<unknown>; clave: string }) => llamada(),
    onSuccess: (_r, { clave }) => hecho(clave),
    onError: fallo,
  });

  const abrir = (v: Ventana) => {
    setAviso(null);
    setVentana(v);
  };

  if (cuidados.isError) {
    return (
      <Alert
        type="error"
        action={
          <Button variant="outline" onClick={() => void cuidados.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {t('work.care.loadError')}
      </Alert>
    );
  }
  if (!cuidados.data) return <p aria-busy="true">{t('common.loading')}</p>;
  const datos = cuidados.data;

  return (
    <div className={styles.page}>
      <h2>{t('work.care.title', { name: animal.name })}</h2>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      {datos.lowIntakeStreak > 0 && (
        <Alert type="warning">{t('work.care.lowIntakeWarning', { count: datos.lowIntakeStreak })}</Alert>
      )}

      <Seccion
        id="dieta"
        titulo={t('work.care.diet.title')}
        boton={
          !archivado && (
            <Button icon={faPlus} onClick={() => abrir({ tipo: 'alimento', item: null })}>
              {t('work.care.diet.new')}
            </Button>
          )
        }
      >
        {datos.diet.length === 0 ? (
          <p>{t('work.care.diet.empty')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('work.care.diet.food')}</th>
                <th scope="col">{t('work.care.diet.quantity')}</th>
                <th scope="col">{t('work.care.diet.schedule')}</th>
                <th scope="col">{t('work.care.diet.notes')}</th>
                <th scope="col">{t('work.care.period')}</th>
                <th scope="col">{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {datos.diet.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.food} {!item.isCurrent && <Badge>{t('work.care.ended')}</Badge>}
                  </td>
                  <td data-label={t('work.care.diet.quantity')}>
                    {formatDecimal(item.quantity)} {t(`work.care.units.${item.unit}`)}
                  </td>
                  <td data-label={t('work.care.diet.schedule')}>{item.schedule ?? '—'}</td>
                  <td data-label={t('work.care.diet.notes')} className={styles.preWrap}>
                    {item.notes ?? '—'}
                  </td>
                  <td data-label={t('work.care.period')}>
                    <Periodo desde={item.startDate} hasta={item.endDate} />
                  </td>
                  <td>
                    {!archivado && (
                      <Acciones
                        nombre={item.food}
                        onEditar={() => abrir({ tipo: 'alimento', item })}
                        onBorrar={() => abrir({ tipo: 'borrarAlimento', item })}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>

      <Seccion id="comidas" titulo={t('work.care.feedings.title')}>
        {datos.feedings.length === 0 ? (
          <p>{t('work.care.feedings.empty')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('work.care.feedings.date')}</th>
                <th scope="col">{t('work.care.feedings.time')}</th>
                <th scope="col">{t('work.care.feedings.intake')}</th>
                <th scope="col">{t('work.care.feedings.recordedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {datos.feedings.map((f) => (
                <tr key={f.taskId}>
                  <td>{formatShortDate(f.date)}</td>
                  <td data-label={t('work.care.feedings.time')}>{f.time}</td>
                  <td data-label={t('work.care.feedings.intake')}>
                    <Badge tone={TONO_INGESTA[f.intake]}>{t(`work.care.intakes.${f.intake}`)}</Badge>
                  </td>
                  <td data-label={t('work.care.feedings.recordedBy')}>{f.recordedBy?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>

      <Seccion
        id="medicacion"
        titulo={t('work.care.medication.title')}
        boton={
          !archivado && (
            <Button icon={faPlus} onClick={() => abrir({ tipo: 'pauta', pauta: null })}>
              {t('work.care.medication.new')}
            </Button>
          )
        }
      >
        {datos.medicationPlans.length === 0 ? (
          <p>{t('work.care.medication.empty')}</p>
        ) : (
          datos.medicationPlans.map((p) => (
            <TarjetaPauta
              key={p.id}
              pauta={p}
              editable={!archivado}
              onEditar={() => abrir({ tipo: 'pauta', pauta: p })}
              onTerminar={() => abrir({ tipo: 'terminarPauta', pauta: p })}
              onBorrar={() => abrir({ tipo: 'borrarPauta', pauta: p })}
            />
          ))
        )}
      </Seccion>

      <Seccion
        id="visitas"
        titulo={t('work.care.visits.title')}
        boton={
          !archivado && (
            <Button icon={faPlus} onClick={() => abrir({ tipo: 'visita', visita: null })}>
              {t('work.care.visits.new')}
            </Button>
          )
        }
      >
        {datos.vetVisits.length === 0 ? (
          <p>{t('work.care.visits.empty')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('work.care.visits.date')}</th>
                <th scope="col">{t('work.care.visits.reason')}</th>
                <th scope="col">{t('work.care.visits.veterinarian')}</th>
                <th scope="col">{t('work.care.visits.status')}</th>
                <th scope="col">{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {datos.vetVisits.map((v) => (
                <tr key={v.id}>
                  <td>
                    {formatShortDate(v.date)} · {v.time}
                  </td>
                  <td data-label={t('work.care.visits.reason')}>{v.reason}</td>
                  <td data-label={t('work.care.visits.veterinarian')}>{v.veterinarian ?? '—'}</td>
                  <td data-label={t('work.care.visits.status')}>
                    <Badge tone={TONO_VISITA[v.status]}>{t(`work.care.visits.statuses.${v.status}`)}</Badge>
                  </td>
                  <td>
                    {v.status === 'scheduled' && !archivado && (
                      <div className={styles.rowActions}>
                        {v.date <= todayInSanctuary() && (
                          <Button variant="outline" onClick={() => abrir({ tipo: 'registrarVisita', visita: v })}>
                            {t('work.care.visits.register')}
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => abrir({ tipo: 'visita', visita: v })}>
                          {t('work.care.visits.change')}
                        </Button>
                        <Button variant="ghost" onClick={() => abrir({ tipo: 'cancelarVisita', visita: v })}>
                          {t('work.care.visits.cancel')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>

      {ventana?.tipo === 'alimento' && (
        <FormularioAlimento
          animalId={animal.id}
          item={ventana.item}
          onClose={() => setVentana(null)}
          onSaved={() => hecho(ventana.item ? 'work.care.diet.updated' : 'work.care.diet.created')}
        />
      )}
      {ventana?.tipo === 'pauta' && (
        <FormularioPauta
          animalId={animal.id}
          pauta={ventana.pauta}
          onClose={() => setVentana(null)}
          onSaved={() => hecho('work.care.medication.saved')}
        />
      )}
      {ventana?.tipo === 'visita' && (
        <FormularioVisita
          animalId={animal.id}
          visita={ventana.visita}
          onClose={() => setVentana(null)}
          onSaved={() => hecho(ventana.visita ? 'work.care.visits.updated' : 'work.care.visits.created')}
        />
      )}
      {ventana?.tipo === 'registrarVisita' && (
        <VetRecordForm
          titulo={t('work.care.visits.registerTitle')}
          valores={{ description: ventana.visita.reason, veterinarian: ventana.visita.veterinarian ?? '' }}
          enviar={(registro) => workApi.care.completeVisit(ventana.visita.id, registro)}
          onClose={() => setVentana(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: adminVetRecordsKey(animal.id) });
            await hecho('work.care.visits.registered');
          }}
        />
      )}
      {ventana?.tipo === 'borrarAlimento' && (
        <Confirmar
          titulo={t('work.care.diet.confirmDelete', { name: ventana.item.food })}
          texto={t('work.care.diet.deleteHelp')}
          boton={t('admin.common.delete')}
          pendiente={accion.isPending}
          onClose={() => setVentana(null)}
          onConfirm={() =>
            accion.mutate({
              llamada: () => workApi.care.removeDietItem(ventana.item.id),
              clave: 'work.care.diet.deleted',
            })
          }
        />
      )}
      {ventana?.tipo === 'terminarPauta' && (
        <Confirmar
          titulo={t('work.care.medication.confirmEnd', { name: ventana.pauta.medication })}
          texto={t('work.care.medication.confirmEndText')}
          boton={t('work.care.medication.end')}
          pendiente={accion.isPending}
          onClose={() => setVentana(null)}
          onConfirm={() =>
            accion.mutate({
              llamada: () => workApi.care.endPlan(ventana.pauta.id),
              clave: 'work.care.medication.ended',
            })
          }
        />
      )}
      {ventana?.tipo === 'borrarPauta' && (
        <Confirmar
          titulo={t('work.care.medication.confirmDelete', { name: ventana.pauta.medication })}
          texto={t('work.care.medication.deleteText')}
          boton={t('admin.common.delete')}
          pendiente={accion.isPending}
          onClose={() => setVentana(null)}
          onConfirm={() =>
            accion.mutate({
              llamada: () => workApi.care.removePlan(ventana.pauta.id),
              clave: 'work.care.medication.deleted',
            })
          }
        />
      )}
      {ventana?.tipo === 'cancelarVisita' && (
        <Confirmar
          titulo={t('work.care.visits.confirmCancel', { date: formatShortDate(ventana.visita.date) })}
          texto={t('work.care.visits.confirmCancelText')}
          boton={t('work.care.visits.cancel')}
          pendiente={accion.isPending}
          onClose={() => setVentana(null)}
          onConfirm={() =>
            accion.mutate({
              llamada: () => workApi.care.cancelVisit(ventana.visita.id),
              clave: 'work.care.visits.cancelled',
            })
          }
        />
      )}
    </div>
  );
}

function Seccion({
  id,
  titulo,
  boton,
  children,
}: {
  id: string;
  titulo: string;
  boton?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.page}>
      <div className={styles.header}>
        <h3 id={id}>{titulo}</h3>
        {boton}
      </div>
      {children}
    </section>
  );
}

function Periodo({ desde, hasta }: { desde: string; hasta: string | null }) {
  const { t } = useTranslation();
  return hasta
    ? t('work.care.fromUntil', { from: formatShortDate(desde), until: formatShortDate(hasta) })
    : t('work.care.since', { from: formatShortDate(desde) });
}

function Acciones({ nombre, onEditar, onBorrar }: { nombre: string; onEditar: () => void; onBorrar?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.rowActions}>
      <button
        type="button"
        className={iconStyles.iconButton}
        aria-label={t('admin.common.edit', { name: nombre })}
        onClick={onEditar}
      >
        <FontAwesomeIcon icon={faPen} aria-hidden="true" />
      </button>
      {onBorrar && (
        <button
          type="button"
          className={iconStyles.iconButton}
          aria-label={t('admin.common.deleteNamed', { name: nombre })}
          onClick={onBorrar}
        >
          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** CU-69: una pauta, con sus dosis dadas y no dadas. */
function TarjetaPauta({
  pauta,
  editable,
  onEditar,
  onTerminar,
  onBorrar,
}: {
  pauta: MedicationPlanDto;
  editable: boolean;
  onEditar: () => void;
  onTerminar: () => void;
  onBorrar: () => void;
}) {
  const { t } = useTranslation();
  const tituloId = `pauta-${pauta.id}`;
  const empezada = pauta.startDate <= todayInSanctuary();
  return (
    <article aria-labelledby={tituloId} className={cardStyles.card}>
      <div className={cardStyles.top}>
        <h4 id={tituloId} className={cardStyles.title}>
          {pauta.medication}
        </h4>
        {!pauta.isActive && <Badge>{t('work.care.ended')}</Badge>}
      </div>
      <p className={cardStyles.meta}>
        {[pauta.dose, t(`work.care.routes.${pauta.route}`), pauta.times.join(', ')].join(' · ')}
      </p>
      <p className={cardStyles.meta}>
        <span>
          <Periodo desde={pauta.startDate} hasta={pauta.endDate} />
        </span>
        {pauta.qualification && <span>{t('work.requires', { name: pauta.qualification.name })}</span>}
      </p>
      {pauta.notes && <p>{pauta.notes}</p>}
      <p>{t('work.care.medication.doses', { given: pauta.dosesGiven, missed: pauta.dosesMissed })}</p>
      {editable && (
        <div className={cardStyles.actions}>
          <Button variant="outline" icon={faPen} onClick={onEditar}>
            {t('work.care.edit')}
          </Button>
          {pauta.isActive && empezada && (
            <Button variant="ghost" onClick={onTerminar}>
              {t('work.care.medication.end')}
            </Button>
          )}
          {!pauta.hasHistory && (
            <Button variant="ghost" icon={faTrashCan} onClick={onBorrar}>
              {t('admin.common.delete')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function Confirmar({
  titulo,
  texto,
  boton,
  pendiente,
  onClose,
  onConfirm,
}: {
  titulo: string;
  texto: string;
  boton: string;
  pendiente: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
            {t('work.care.back')}
          </Button>
          <Button disabled={pendiente} onClick={onConfirm}>
            {boton}
          </Button>
        </>
      }
    >
      <p>{texto}</p>
    </Modal>
  );
}

/** Ventana con un formulario: el botón «Guardar» lo envía. */
function VentanaFormulario({
  id,
  titulo,
  error,
  pendiente,
  aviso,
  onClose,
  onSubmit,
  children,
}: {
  id: string;
  titulo: string;
  error: string | null;
  pendiente: boolean;
  aviso?: string;
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
        {aviso && <Alert type="info">{aviso}</Alert>}
        {children}
      </form>
    </Modal>
  );
}

/**
 * Valida con el esquema compartido y envía; los errores del servidor también
 * van a su campo.
 */
function useFormulario<B>(
  esquema: {
    safeParse: (
      d: unknown,
    ) => { success: true } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
  },
  enviar: (cuerpo: B) => Promise<unknown>,
  onSaved: () => Promise<void> | void,
) {
  const { t } = useTranslation();
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: enviar,
    onSuccess: () => onSaved(),
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) {
        setErrores(erroresPorCampo(e.details.map((d) => ({ path: [d.field], message: d.message }))));
      } else setError(errorMessage(t, e));
    },
  });
  const validarYEnviar = (cuerpo: B) => {
    setError(null);
    const resultado = esquema.safeParse(cuerpo);
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error.issues));
      return;
    }
    setErrores({});
    guardar.mutate(cuerpo);
  };
  return { errores, error, pendiente: guardar.isPending, validarYEnviar };
}

/** CU-65: alta y edición de un alimento de la dieta. */
function FormularioAlimento({
  animalId,
  item,
  onClose,
  onSaved,
}: {
  animalId: number;
  item: DietItemDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [campos, setCampos] = useState({
    food: item?.food ?? '',
    quantity: item ? formatDecimal(item.quantity) : '',
    unit: (item?.unit ?? 'g') as FoodUnit,
    schedule: item?.schedule ?? '',
    notes: item?.notes ?? '',
    startDate: item?.startDate ?? todayInSanctuary(),
    endDate: item?.endDate ?? '',
  });
  const cambiar = <K extends keyof typeof campos>(campo: K, valor: (typeof campos)[K]) =>
    setCampos((c) => ({ ...c, [campo]: valor }));
  const f = useFormulario<DietItemBody>(
    dietItemBodySchema,
    (cuerpo) => (item ? workApi.care.updateDietItem(item.id, cuerpo) : workApi.care.createDietItem(animalId, cuerpo)),
    onSaved,
  );
  const opcional = (clave: string) => t('form.optional', { label: t(clave) });
  return (
    <VentanaFormulario
      id="formulario-alimento"
      titulo={t(item ? 'work.care.diet.editTitle' : 'work.care.diet.new')}
      error={f.error}
      pendiente={f.pendiente}
      onClose={onClose}
      onSubmit={() => f.validarYEnviar({ ...campos, endDate: campos.endDate || null })}
    >
      <TextField
        label={t('work.care.diet.food')}
        maxLength={150}
        value={campos.food}
        error={f.errores.food}
        onChange={(e) => cambiar('food', e.target.value)}
      />
      <div className={styles.formGrid}>
        <TextField
          label={t('work.care.diet.quantity')}
          inputMode="decimal"
          value={campos.quantity}
          error={f.errores.quantity}
          onChange={(e) => cambiar('quantity', e.target.value)}
        />
        <SelectField
          label={t('work.care.diet.unit')}
          value={campos.unit}
          error={f.errores.unit}
          onChange={(e) => cambiar('unit', e.target.value as FoodUnit)}
        >
          {FOOD_UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`work.care.units.${u}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        label={opcional('work.care.diet.schedule')}
        help={t('work.care.diet.scheduleHelp')}
        maxLength={100}
        value={campos.schedule}
        error={f.errores.schedule}
        onChange={(e) => cambiar('schedule', e.target.value)}
      />
      <TextAreaField
        label={opcional('work.care.diet.notes')}
        rows={2}
        maxLength={1000}
        value={campos.notes}
        error={f.errores.notes}
        onChange={(e) => cambiar('notes', e.target.value)}
      />
      <div className={styles.formGrid}>
        <TextField
          type="date"
          label={t('work.care.from')}
          value={campos.startDate}
          error={f.errores.startDate}
          onChange={(e) => cambiar('startDate', e.target.value)}
        />
        <TextField
          type="date"
          label={opcional('work.care.until')}
          help={t('work.care.diet.untilHelp')}
          value={campos.endDate}
          error={f.errores.endDate}
          onChange={(e) => cambiar('endDate', e.target.value)}
        />
      </div>
    </VentanaFormulario>
  );
}

/** CU-69: alta y edición de una pauta de medicación. */
function FormularioPauta({
  animalId,
  pauta,
  onClose,
  onSaved,
}: {
  animalId: number;
  pauta: MedicationPlanDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const cualificaciones = useQualifications();
  const [campos, setCampos] = useState({
    medication: pauta?.medication ?? '',
    dose: pauta?.dose ?? '',
    route: (pauta?.route ?? 'oral') as MedicationRoute,
    times: pauta?.times ?? [],
    startDate: pauta?.startDate ?? todayInSanctuary(),
    endDate: pauta?.endDate ?? '',
    qualificationId: pauta?.qualification ? String(pauta.qualification.id) : '',
    notes: pauta?.notes ?? '',
  });
  const cambiar = <K extends keyof typeof campos>(campo: K, valor: (typeof campos)[K]) =>
    setCampos((c) => ({ ...c, [campo]: valor }));
  const f = useFormulario<MedicationPlanBody>(
    medicationPlanBodySchema,
    (cuerpo) => (pauta ? workApi.care.updatePlan(pauta.id, cuerpo) : workApi.care.createPlan(animalId, cuerpo)),
    onSaved,
  );
  const opcional = (clave: string) => t('form.optional', { label: t(clave) });
  return (
    <VentanaFormulario
      id="formulario-pauta"
      titulo={t(pauta ? 'work.care.medication.editTitle' : 'work.care.medication.new')}
      error={f.error}
      pendiente={f.pendiente}
      aviso={pauta ? t('work.care.medication.editHelp') : undefined}
      onClose={onClose}
      onSubmit={() =>
        f.validarYEnviar({
          ...campos,
          times: campos.times,
          endDate: campos.endDate || null,
          qualificationId: campos.qualificationId ? Number(campos.qualificationId) : null,
        })
      }
    >
      <TextField
        label={t('work.care.medication.medication')}
        maxLength={150}
        value={campos.medication}
        error={f.errores.medication}
        onChange={(e) => cambiar('medication', e.target.value)}
      />
      <div className={styles.formGrid}>
        <TextField
          label={t('work.care.medication.dose')}
          maxLength={100}
          value={campos.dose}
          error={f.errores.dose}
          onChange={(e) => cambiar('dose', e.target.value)}
        />
        <SelectField
          label={t('work.care.medication.route')}
          value={campos.route}
          error={f.errores.route}
          onChange={(e) => cambiar('route', e.target.value as MedicationRoute)}
        >
          {MEDICATION_ROUTES.map((r) => (
            <option key={r} value={r}>
              {t(`work.care.routes.${r}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <TimesField
        label={t('work.care.medication.times')}
        value={campos.times}
        error={f.errores.times}
        onChange={(v) => cambiar('times', v)}
      />
      <div className={styles.formGrid}>
        <TextField
          type="date"
          label={t('work.care.from')}
          value={campos.startDate}
          error={f.errores.startDate}
          onChange={(e) => cambiar('startDate', e.target.value)}
        />
        <TextField
          type="date"
          label={opcional('work.care.until')}
          value={campos.endDate}
          error={f.errores.endDate}
          onChange={(e) => cambiar('endDate', e.target.value)}
        />
      </div>
      <SelectField
        label={t('work.care.medication.qualification')}
        help={t('work.care.medication.qualificationHelp')}
        value={campos.qualificationId}
        error={f.errores.qualificationId}
        onChange={(e) => cambiar('qualificationId', e.target.value)}
      >
        <option value="">{t('work.care.medication.noQualification')}</option>
        {(cualificaciones.data ?? []).map((q) => (
          <option key={q.id} value={q.id}>
            {q.name}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label={opcional('work.care.medication.notes')}
        rows={2}
        maxLength={1000}
        value={campos.notes}
        error={f.errores.notes}
        onChange={(e) => cambiar('notes', e.target.value)}
      />
    </VentanaFormulario>
  );
}

/** CU-68: programar o cambiar una visita veterinaria. */
function FormularioVisita({
  animalId,
  visita,
  onClose,
  onSaved,
}: {
  animalId: number;
  visita: VetVisitDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [campos, setCampos] = useState({
    date: visita?.date ?? todayInSanctuary(),
    time: visita?.time ?? '',
    reason: visita?.reason ?? '',
    veterinarian: visita?.veterinarian ?? '',
  });
  const cambiar = <K extends keyof typeof campos>(campo: K, valor: (typeof campos)[K]) =>
    setCampos((c) => ({ ...c, [campo]: valor }));
  const f = useFormulario<VetVisitBody>(
    vetVisitBodySchema,
    (cuerpo) => (visita ? workApi.care.updateVisit(visita.id, cuerpo) : workApi.care.createVisit(animalId, cuerpo)),
    onSaved,
  );
  return (
    <VentanaFormulario
      id="formulario-visita"
      titulo={t(visita ? 'work.care.visits.editTitle' : 'work.care.visits.new')}
      error={f.error}
      pendiente={f.pendiente}
      onClose={onClose}
      onSubmit={() => f.validarYEnviar(campos)}
    >
      <div className={styles.formGrid}>
        <TextField
          type="date"
          label={t('work.care.visits.date')}
          min={todayInSanctuary()}
          value={campos.date}
          error={f.errores.date}
          onChange={(e) => cambiar('date', e.target.value)}
        />
        <TimeField
          label={t('work.care.visits.time')}
          value={campos.time}
          error={f.errores.time}
          onChange={(v) => cambiar('time', v)}
        />
      </div>
      <TextAreaField
        label={t('work.care.visits.reason')}
        rows={2}
        maxLength={500}
        value={campos.reason}
        error={f.errores.reason}
        onChange={(e) => cambiar('reason', e.target.value)}
      />
      <TextField
        label={t('form.optional', { label: t('work.care.visits.veterinarian') })}
        maxLength={150}
        value={campos.veterinarian}
        error={f.errores.veterinarian}
        onChange={(e) => cambiar('veterinarian', e.target.value)}
      />
    </VentanaFormulario>
  );
}
