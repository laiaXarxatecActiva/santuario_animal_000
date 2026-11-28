import { faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  planCreateBodySchema,
  plansUpdateBodySchema,
  type AdminPlanDto,
  type PlanCreateBody,
  type PlansUpdateBody,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
  type FieldErrors,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import iconStyles from '../../components/IconButton.module.css';
import { Button } from '../../components/Button';
import { Switch } from '../../components/Switch';
import { TextAreaField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { ADMIN_PLANS_KEY, useAdminPlans } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { cambiarInterruptor, type AvisoPlan, type BorradorPlan } from '../../utils/planes';
import styles from './AdminPage.module.css';
import planStyles from './PlansAdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

const CAMPOS = ['name', 'monthlyAmount', 'description', 'isDefault', 'isActive'] as const;

/** `'5.00'` → `'5,00'`, como se escribe en el formulario. */
const importeEnFormulario = (importe: string) => importe.replace('.', ',');

/** Los planes guardados, como empieza el formulario. */
const borradores = (planes: readonly AdminPlanDto[]): PlansUpdateBody => ({
  plans: planes.map((plan) => ({
    id: plan.id,
    name: plan.name,
    monthlyAmount: importeEnFormulario(plan.monthlyAmount),
    description: plan.description ?? '',
    isDefault: plan.isDefault,
    isActive: plan.isActive,
  })),
  confirmAmountChange: false,
});

// CU-40 Gestionar planes de adopción (SCREENS §5.6): una tarjeta editable por plan
// y un único «Guardar cambios» para todos.
export function PlansAdminPage() {
  const { t } = useTranslation();
  const planes = useAdminPlans();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [aBorrar, setABorrar] = useState<AdminPlanDto | null>(null);

  // A3: borrar para siempre un plan que nunca se ha usado.
  const borrar = useMutation({
    mutationFn: (plan: AdminPlanDto) => adminApi.plans.remove(plan.id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('admin.plans.deleted') });
      await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_KEY });
    },
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.plans.title')}</h1>
        <Button icon={faPlus} onClick={() => setCreando(true)}>
          {t('admin.plans.new')}
        </Button>
      </div>
      <PageIntro pagina="plans" />
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {planes.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void planes.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.plans.loadError')}
        </Alert>
      ) : !planes.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <FormularioPlanes
          planes={planes.data}
          onCambio={() => setAviso(null)}
          onBorrar={(plan) => {
            setAviso(null);
            setABorrar(plan);
          }}
          onSaved={async (guardados) => {
            // `useAdminPlans` guarda la lista tal cual (sin `{ data }`).
            queryClient.setQueryData<AdminPlanDto[]>(ADMIN_PLANS_KEY, guardados);
            setAviso({ type: 'success', message: t('admin.plans.savedAll') });
            // La respuesta ya trae los planes guardados: se vuelven a pedir sin esperar
            // (el botón no se queda en «Guardando…» si el servidor tarda).
            void queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_KEY });
          }}
        />
      )}

      {creando && (
        <NuevoPlan
          onClose={() => setCreando(false)}
          onSaved={async () => {
            setCreando(false);
            setAviso({ type: 'success', message: t('admin.plans.created') });
            await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_KEY });
          }}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('admin.plans.confirmDelete', { name: aBorrar?.name })}
        onClose={() => setABorrar(null)}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={() => setABorrar(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={borrar.isPending} onClick={() => aBorrar && borrar.mutate(aBorrar)}>
              {borrar.isPending ? t('admin.common.deleting') : t('admin.common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('admin.plans.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

/** 3, 3a y A1: todas las tarjetas son un solo formulario. */
function FormularioPlanes({
  planes,
  onCambio,
  onBorrar,
  onSaved,
}: {
  planes: AdminPlanDto[];
  onCambio: () => void;
  onBorrar: (plan: AdminPlanDto) => void;
  onSaved: (guardados: AdminPlanDto[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  // Aviso al momento en la tarjeta del interruptor tocado.
  const [avisoPlan, setAvisoPlan] = useState<{ indice: number; tipo: AvisoPlan } | null>(null);
  // 3a: cambios pendientes de confirmar porque algún importe afecta a adopciones activas.
  const [pendiente, setPendiente] = useState<{ datos: PlansUpdateBody; afectados: AdminPlanDto[] } | null>(null);
  const form = useForm<PlansUpdateBody>({
    resolver: zodResolver(plansUpdateBodySchema, undefined, { raw: true }),
    defaultValues: borradores(planes),
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    getValues,
    setValue,
    clearErrors,
    setFocus,
    formState: { errors, isDirty },
  } = form;
  const actuales = useWatch({ control, name: 'plans' });

  // Si cambian los planes guardados (por ejemplo, al crear uno), se conserva lo que se está editando.
  useEffect(() => {
    reset(borradores(planes), { keepDirtyValues: true });
  }, [planes, reset]);

  const guardar = useMutation({
    mutationFn: adminApi.plans.updateAll,
    onSuccess: async ({ data }) => {
      reset(borradores(data));
      setAvisoPlan(null);
      await onSaved(data);
    },
    onError: (e) => {
      const campos = planes.flatMap((_, i) => CAMPOS.map((c) => `plans.${i}.${c}` as Path<PlansUpdateBody>));
      if (e instanceof ApiError && e.details.some((d) => campos.includes(d.field as Path<PlansUpdateBody>))) {
        applyFieldErrors(e, form.setError, campos);
      } else setError(errorMessage(t, e));
    },
  });

  // Salir de la página con cambios sin guardar pide confirmación.
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !guardar.isPending && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [isDirty]);

  const interruptor = (indice: number, campo: 'isDefault' | 'isActive', valor: boolean) => {
    onCambio();
    const { planes: nuevos, aviso } = cambiarInterruptor(getValues('plans') as BorradorPlan[], indice, campo, valor);
    nuevos.forEach((plan, i) => {
      setValue(`plans.${i}.isDefault`, plan.isDefault, { shouldDirty: true });
      setValue(`plans.${i}.isActive`, plan.isActive, { shouldDirty: true });
    });
    setAvisoPlan(aviso ? { indice, tipo: aviso } : null);
  };

  const enviar = (datos: PlansUpdateBody) => {
    setError(null);
    onCambio();
    // Importes normalizados por el mismo esquema que el servidor (`'6'` → `'6.00'`).
    const normalizados = plansUpdateBodySchema.safeParse(datos);
    const afectados = normalizados.success
      ? planes.filter((plan) => {
          const nuevo = normalizados.data.plans.find((p) => p.id === plan.id);
          return plan.activeAdoptions > 0 && nuevo !== undefined && nuevo.monthlyAmount !== plan.monthlyAmount;
        })
      : [];
    if (afectados.length > 0) {
      setPendiente({ datos, afectados });
      return;
    }
    guardar.mutate({ ...datos, confirmAmountChange: false });
  };

  // Nombre de cada plan tal como se está escribiendo, para el título de sus avisos.
  const nombreDe = (indice: number) => actuales?.[indice]?.name?.trim() || planes[indice]!.name;
  // El título del aviso lleva a la tarjeta: foco en el interruptor y la tarjeta a la vista.
  const titulo = (indice: number, campo: 'isDefault' | 'isActive') => (
    <button
      type="button"
      className={planStyles.planLink}
      onClick={() => {
        setFocus(`plans.${indice}.${campo}`);
        if (document.activeElement instanceof HTMLElement) document.activeElement.scrollIntoView?.({ block: 'center' });
      }}
    >
      {nombreDe(indice)}
    </button>
  );
  const avisos = [
    ...planes.flatMap((plan, indice) =>
      (['isDefault', 'isActive'] as const).flatMap((campo) => {
        const mensaje = errors.plans?.[indice]?.[campo]?.message;
        return mensaje
          ? [
              <Alert
                key={`${plan.id}-${campo}`}
                type="error"
                title={titulo(indice, campo)}
                onClose={() => clearErrors(`plans.${indice}.${campo}`)}
              >
                {mensaje}
              </Alert>,
            ]
          : [];
      }),
    ),
    ...(avisoPlan
      ? [
          // Los informativos se cierran solos; las advertencias, con su ✕.
          <Alert
            key={`aviso-${avisoPlan.indice}-${avisoPlan.tipo}`}
            type={AVISO_TIPO[avisoPlan.tipo]}
            title={titulo(avisoPlan.indice, CAMPO_AVISO[avisoPlan.tipo])}
            autoClose={AVISO_TIPO[avisoPlan.tipo] === 'info'}
            onClose={() => setAvisoPlan(null)}
          >
            {t(`admin.plans.${avisoPlan.tipo}`)}
          </Alert>,
        ]
      : []),
    ...(error
      ? [
          <Alert key="error" type="error" onClose={() => setError(null)}>
            {error}
          </Alert>,
        ]
      : []),
  ];

  return (
    <form noValidate className={planStyles.form} onSubmit={handleSubmit(enviar)}>
      <div className={planStyles.list}>
        {planes.map((plan, indice) => (
          <TarjetaPlan
            key={plan.id}
            plan={plan}
            indice={indice}
            nombre={actuales?.[indice]?.name ?? plan.name}
            control={control}
            register={register}
            errors={errors}
            onInterruptor={interruptor}
            borrable={plan.deletable}
            hayCambios={isDirty}
            onBorrar={() => onBorrar(plan)}
          />
        ))}
      </div>

      {/* Siempre a la vista y pegada abajo mientras se recorren las tarjetas (SCREENS §5.6, DESIGN_SYSTEM §8.9). */}
      <div role="region" aria-label={t('admin.plans.saveBarLabel')} className={planStyles.saveBar}>
        {pendiente ? (
          <Alert
            type="warning"
            action={
              <div className={planStyles.actions}>
                <Button variant="outline" onClick={() => setPendiente(null)}>
                  {t('admin.common.cancel')}
                </Button>
                <Button
                  disabled={guardar.isPending}
                  onClick={() => {
                    guardar.mutate({ ...pendiente.datos, confirmAmountChange: true });
                    setPendiente(null);
                  }}
                >
                  {t('admin.plans.confirmAndSave')}
                </Button>
              </div>
            }
          >
            {pendiente.afectados.map((plan) => (
              <p key={plan.id}>
                {t('admin.plans.amountChangePlan', {
                  name: actuales?.[planes.indexOf(plan)]?.name || plan.name,
                  count: plan.activeAdoptions,
                })}
              </p>
            ))}
          </Alert>
        ) : (
          // Los avisos, fuera de las tarjetas: a la izquierda de los botones.
          <div className={planStyles.footer}>
            {avisos.length > 0 && <div className={planStyles.messages}>{avisos}</div>}
            <div className={planStyles.actions}>
              <Button
                variant="outline"
                disabled={!isDirty || guardar.isPending}
                onClick={() => {
                  reset(borradores(planes));
                  setAvisoPlan(null);
                  setError(null);
                }}
              >
                {t('admin.plans.discard')}
              </Button>
              <Button type="submit" disabled={!isDirty || guardar.isPending}>
                {guardar.isPending ? t('admin.common.saving') : t('admin.plans.saveAll')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={bloqueo.state === 'blocked'}
        title={t('admin.plans.unsavedTitle')}
        onClose={() => bloqueo.reset?.()}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={() => bloqueo.reset?.()}>
              {t('admin.plans.unsavedStay')}
            </Button>
            <Button onClick={() => bloqueo.proceed?.()}>{t('admin.plans.unsavedLeave')}</Button>
          </>
        }
      >
        <p>{t('admin.plans.unsavedText')}</p>
      </Modal>
    </form>
  );
}

// Interruptor al que se refiere cada aviso (al que lleva su título).
const CAMPO_AVISO: Record<AvisoPlan, 'isDefault' | 'isActive'> = {
  defaultRequired: 'isDefault',
  defaultMustBeActive: 'isActive',
  activatedAsDefault: 'isActive',
};

const AVISO_TIPO: Record<AvisoPlan, 'warning' | 'info'> = {
  defaultRequired: 'warning',
  defaultMustBeActive: 'warning',
  activatedAsDefault: 'info',
};

/** Una tarjeta del formulario; el título sigue al nombre que se escribe. */
function TarjetaPlan({
  plan,
  indice,
  nombre,
  control,
  register,
  errors,
  onInterruptor,
  borrable,
  hayCambios,
  onBorrar,
}: {
  plan: AdminPlanDto;
  indice: number;
  nombre: string;
  control: Control<PlansUpdateBody>;
  register: UseFormRegister<PlansUpdateBody>;
  errors: FieldErrors<PlansUpdateBody>;
  onInterruptor: (indice: number, campo: 'isDefault' | 'isActive', valor: boolean) => void;
  /** A3: nunca se ha usado y no es el de por defecto; los demás se desactivan con «Activo». */
  borrable: boolean;
  hayCambios: boolean;
  onBorrar: () => void;
}) {
  const { t } = useTranslation();
  const tituloId = useId();
  const ayudaBorrarId = useId();
  const fallos = errors.plans?.[indice];
  return (
    <section className={planStyles.card} aria-labelledby={tituloId}>
      <div className={planStyles.cardHeader}>
        <div className={planStyles.cardTitle}>
          <h2 id={tituloId}>{nombre.trim() || plan.name}</h2>
          {borrable && (
            // Con cambios sin guardar no se borra: las tarjetas se descolocarían.
            <button
              type="button"
              className={iconStyles.iconButton}
              aria-label={t('admin.common.deleteNamed', { name: plan.name })}
              aria-describedby={hayCambios ? ayudaBorrarId : undefined}
              disabled={hayCambios}
              onClick={onBorrar}
            >
              <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
            </button>
          )}
        </div>
        <span className={planStyles.count}>{t('admin.plans.activeAdoptions', { count: plan.activeAdoptions })}</span>
        {borrable && hayCambios && (
          <span id={ayudaBorrarId} className={planStyles.count}>
            {t('admin.plans.deleteBlocked')}
          </span>
        )}
      </div>
      <TextField label={t('admin.plans.name')} error={fallos?.name?.message} {...register(`plans.${indice}.name`)} />
      <TextField
        label={t('admin.plans.monthlyAmount')}
        inputMode="decimal"
        error={fallos?.monthlyAmount?.message}
        {...register(`plans.${indice}.monthlyAmount`)}
      />
      <TextAreaField
        label={t('form.optional', { label: t('admin.plans.description') })}
        rows={3}
        error={fallos?.description?.message}
        {...register(`plans.${indice}.description`)}
      />
      {/* Al fondo de la tarjeta, para que queden al mismo nivel en toda la fila. */}
      <div className={planStyles.switches}>
        {(['isDefault', 'isActive'] as const).map((campo) => (
          <Controller
            key={campo}
            control={control}
            name={`plans.${indice}.${campo}`}
            render={({ field }) => (
              <Switch
                label={t(`admin.plans.${campo}`)}
                name={field.name}
                ref={field.ref}
                checked={Boolean(field.value)}
                onChange={(e) => onInterruptor(indice, campo, e.target.checked)}
                onBlur={field.onBlur}
              />
            )}
          />
        ))}
      </div>
    </section>
  );
}

function Interruptor<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Switch
          label={label}
          name={field.name}
          checked={Boolean(field.value)}
          onChange={(e) => field.onChange(e.target.checked)}
          onBlur={field.onBlur}
        />
      )}
    />
  );
}

/** A2: plan nuevo, siempre mensual. */
function NuevoPlan({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PlanCreateBody>({
    resolver: zodResolver(planCreateBodySchema, undefined, { raw: true }),
    defaultValues: { name: '', monthlyAmount: '', description: '', isDefault: false, isActive: true },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const crear = useMutation({
    mutationFn: adminApi.plans.create,
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, CAMPOS);
      else setError(errorMessage(t, e));
    },
  });

  const formId = 'formulario-plan';
  return (
    <Modal
      open
      title={t('admin.plans.new')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={crear.isPending}>
            {crear.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate className={styles.modalForm} onSubmit={handleSubmit((datos) => crear.mutate(datos))}>
        {error && <Alert type="error">{error}</Alert>}
        <TextField label={t('admin.plans.name')} error={errors.name?.message} {...register('name')} />
        <TextField
          label={t('admin.plans.monthlyAmount')}
          inputMode="decimal"
          error={errors.monthlyAmount?.message}
          {...register('monthlyAmount')}
        />
        <TextAreaField
          label={t('form.optional', { label: t('admin.plans.description') })}
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
        <Interruptor control={control} name="isDefault" label={t('admin.plans.isDefault')} />
        {errors.isDefault?.message && <Alert type="error">{errors.isDefault.message}</Alert>}
        <Interruptor control={control} name="isActive" label={t('admin.plans.isActive')} />
        {errors.isActive?.message && <Alert type="error">{errors.isActive.message}</Alert>}
      </form>
    </Modal>
  );
}
