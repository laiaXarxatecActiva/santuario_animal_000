import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  planCreateBodySchema,
  planUpdateBodySchema,
  type AdminPlanDto,
  type PlanCreateBody,
  type PlanUpdateBody,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextAreaField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { ADMIN_PLANS_KEY, useAdminPlans } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import styles from './AdminPage.module.css';
import planStyles from './PlansAdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

const CAMPOS = ['name', 'monthlyAmount', 'description', 'isDefault', 'isActive'] as const;

/** `'5.00'` → `'5,00'`, como se escribe en el formulario. */
const importeEnFormulario = (importe: string) => importe.replace('.', ',');

/** Importe normalizado por el mismo esquema que el servidor (`'6'` → `'6.00'`), o `null` si no es válido. */
function importeNormalizado(datos: PlanUpdateBody): string | null {
  const resultado = planUpdateBodySchema.safeParse(datos);
  return resultado.success ? resultado.data.monthlyAmount : null;
}

// CU-40 Gestionar planes de adopción (SCREENS §5.6): una tarjeta editable por plan.
export function PlansAdminPage() {
  const { t } = useTranslation();
  const planes = useAdminPlans();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const guardado = async (mensaje: string) => {
    setAviso(mensaje);
    await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_KEY });
  };

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
        <div className={planStyles.list}>
          {planes.data.map((plan) => (
            <TarjetaPlan
              // Al guardar llegan los datos nuevos: la tarjeta empieza de cero con ellos.
              key={`${plan.id}-${plan.name}-${plan.monthlyAmount}-${plan.isDefault}-${plan.isActive}`}
              plan={plan}
              onSaved={() => guardado(t('admin.plans.saved'))}
            />
          ))}
        </div>
      )}

      {creando && (
        <NuevoPlan
          onClose={() => setCreando(false)}
          onSaved={async () => {
            setCreando(false);
            await guardado(t('admin.plans.created'));
          }}
        />
      )}
    </div>
  );
}

/** 3, 3a y A1: edición en línea de un plan. */
function TarjetaPlan({ plan, onSaved }: { plan: AdminPlanDto; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const tituloId = useId();
  const [error, setError] = useState<string | null>(null);
  // 3a: cambios pendientes de confirmar porque el importe afecta a adopciones activas.
  const [pendiente, setPendiente] = useState<PlanUpdateBody | null>(null);
  const form = useForm<PlanUpdateBody>({
    resolver: zodResolver(planUpdateBodySchema, undefined, { raw: true }),
    defaultValues: {
      name: plan.name,
      monthlyAmount: importeEnFormulario(plan.monthlyAmount),
      description: plan.description ?? '',
      isDefault: plan.isDefault,
      isActive: plan.isActive,
      confirmAmountChange: false,
    },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const guardar = useMutation({
    mutationFn: (datos: PlanUpdateBody) => adminApi.plans.update(plan.id, datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, CAMPOS);
      else setError(errorMessage(t, e));
    },
  });

  const enviar = (datos: PlanUpdateBody) => {
    setError(null);
    const importe = importeNormalizado(datos);
    if (plan.activeAdoptions > 0 && importe !== null && importe !== plan.monthlyAmount) {
      setPendiente(datos);
      return;
    }
    guardar.mutate(datos);
  };

  return (
    <section className={planStyles.card} aria-labelledby={tituloId}>
      <div className={planStyles.cardHeader}>
        <h2 id={tituloId}>{plan.name}</h2>
        <span className={planStyles.count}>{t('admin.plans.activeAdoptions', { count: plan.activeAdoptions })}</span>
      </div>
      <form noValidate className={planStyles.form} onSubmit={handleSubmit(enviar)}>
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
                    guardar.mutate({ ...pendiente, confirmAmountChange: true });
                    setPendiente(null);
                  }}
                >
                  {t('admin.plans.confirmAndSave')}
                </Button>
              </div>
            }
          >
            {t('admin.plans.amountChangeWarning', { count: plan.activeAdoptions })}
          </Alert>
        ) : (
          <div className={planStyles.actions}>
            <Button type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? t('admin.common.saving') : t('admin.common.save')}
            </Button>
          </div>
        )}
      </form>
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
