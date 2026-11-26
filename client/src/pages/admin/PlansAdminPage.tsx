import { faPlus } from '@fortawesome/free-solid-svg-icons';
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

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
        <Alert type="success" onClose={() => setAviso(null)}>
          {aviso}
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
          onSaved={async (guardados) => {
            // `useAdminPlans` guarda la lista tal cual (sin `{ data }`).
            queryClient.setQueryData<AdminPlanDto[]>(ADMIN_PLANS_KEY, guardados);
            setAviso(t('admin.plans.savedAll'));
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
            setAviso(t('admin.plans.created'));
            await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_KEY });
          }}
        />
      )}
    </div>
  );
}

/** 3, 3a y A1: todas las tarjetas son un solo formulario. */
function FormularioPlanes({
  planes,
  onCambio,
  onSaved,
}: {
  planes: AdminPlanDto[];
  onCambio: () => void;
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
            aviso={avisoPlan?.indice === indice ? avisoPlan.tipo : null}
            onInterruptor={interruptor}
          />
        ))}
      </div>

      {error && <Alert type="error">{error}</Alert>}
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
      )}

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
  aviso,
  onInterruptor,
}: {
  plan: AdminPlanDto;
  indice: number;
  nombre: string;
  control: Control<PlansUpdateBody>;
  register: UseFormRegister<PlansUpdateBody>;
  errors: FieldErrors<PlansUpdateBody>;
  aviso: AvisoPlan | null;
  onInterruptor: (indice: number, campo: 'isDefault' | 'isActive', valor: boolean) => void;
}) {
  const { t } = useTranslation();
  const tituloId = useId();
  const fallos = errors.plans?.[indice];
  return (
    <section className={planStyles.card} aria-labelledby={tituloId}>
      <div className={planStyles.cardHeader}>
        <h2 id={tituloId}>{nombre.trim() || plan.name}</h2>
        <span className={planStyles.count}>{t('admin.plans.activeAdoptions', { count: plan.activeAdoptions })}</span>
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
      {(['isDefault', 'isActive'] as const).map((campo) => (
        <Controller
          key={campo}
          control={control}
          name={`plans.${indice}.${campo}`}
          render={({ field }) => (
            <Switch
              label={t(`admin.plans.${campo}`)}
              name={field.name}
              checked={Boolean(field.value)}
              onChange={(e) => onInterruptor(indice, campo, e.target.checked)}
              onBlur={field.onBlur}
            />
          )}
        />
      ))}
      {fallos?.isDefault?.message && <Alert type="error">{fallos.isDefault.message}</Alert>}
      {fallos?.isActive?.message && <Alert type="error">{fallos.isActive.message}</Alert>}
      {aviso && <Alert type={AVISO_TIPO[aviso]}>{t(`admin.plans.${aviso}`)}</Alert>}
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
