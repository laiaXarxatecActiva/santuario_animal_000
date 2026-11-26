import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminAdoptionCreateSchema,
  MANUAL_PAYMENT_METHOD,
  type AdminAdoptionCreateBody,
  type AdminAdoptionCreateInput,
} from '@sanctuary/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { FieldError, RadioGroup, SelectField, TextAreaField, TextField } from '../../components/FormFields';
import { ADMIN_ADOPTIONS_KEY, ADMIN_USERS_KEY, useAdminAnimals, useAdminPlans } from '../../hooks/useAdmin';
import { errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { formatCurrency } from '../../utils/format';
import { useBusquedaDiferida } from '../../hooks/useBusquedaDiferida';
import styles from './AdminPage.module.css';

// CU-37 alta manual (SCREENS §5.3): por ejemplo, un pago en efectivo en una
// jornada de puertas abiertas. El servidor comprueba de nuevo todas las reglas.
export function NewAdoptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const animales = useAdminAnimals({ adoptable: true, published: true, pageSize: 100, sort: 'name' });
  const planes = useAdminPlans();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminAdoptionCreateBody, unknown, AdminAdoptionCreateInput>({
    resolver: zodResolver(adminAdoptionCreateSchema),
    defaultValues: { userId: '', animalId: '', planId: '', method: MANUAL_PAYMENT_METHOD, notes: '' },
  });

  const crear = useMutation({
    mutationFn: (datos: AdminAdoptionCreateInput) => adminApi.adoptions.create(datos),
    onSuccess: async (adopcion) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ADOPTIONS_KEY });
      void navigate(`/admin/adoptions/${adopcion.id}`, {
        state: flashState({ type: 'success', message: t('admin.adoptions.created') }),
      });
    },
    onError: (e) => {
      // Algunos errores se explican de otra forma que al adoptante (CU-13).
      const clave = e instanceof ApiError ? `admin.adoptions.errors.${e.code}` : '';
      setError(clave && t(clave) !== clave ? t(clave) : errorMessage(t, e));
    },
  });

  return (
    <div className={styles.page}>
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.count}>
        <Link to="/admin/adoptions">{t('admin.adoptions.title')}</Link> › {t('admin.adoptions.new')}
      </nav>
      <h1>{t('admin.adoptions.new')}</h1>
      <form noValidate className={styles.modalForm} onSubmit={handleSubmit((datos) => crear.mutate(datos))}>
        {error && <Alert type="error">{error}</Alert>}

        <BuscarAdoptante
          elegido={String(watch('userId') ?? '')}
          error={errors.userId?.message}
          onElegir={(id) => setValue('userId', id, { shouldValidate: true })}
        />

        <SelectField label={t('admin.adoptions.animal')} error={errors.animalId?.message} {...register('animalId')}>
          <option value="">{t('form.choose')}</option>
          {animales.data?.data.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.name}
            </option>
          ))}
        </SelectField>

        <SelectField label={t('admin.adoptions.plan')} error={errors.planId?.message} {...register('planId')}>
          <option value="">{t('form.choose')}</option>
          {planes.data
            ?.filter((plan) => plan.isActive)
            .map((plan) => (
              <option key={plan.id} value={plan.id}>
                {t('admin.adoptions.planOption', { name: plan.name, amount: formatCurrency(plan.monthlyAmount) })}
              </option>
            ))}
        </SelectField>

        {/* El primer pago de un alta manual siempre es por transferencia (no se acepta efectivo). */}
        <p>{t('admin.adoptions.firstPaymentTransfer')}</p>

        <TextAreaField
          label={t('form.optional', { label: t('admin.adoptions.notes') })}
          rows={3}
          error={errors.notes?.message}
          {...register('notes')}
        />
        <p className={styles.count}>{t('admin.adoptions.newHelp')}</p>
        <div className={styles.headerActions}>
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? t('admin.common.saving') : t('admin.adoptions.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Paso 2: el adoptante debe tener cuenta; se busca entre los adoptantes activos. */
function BuscarAdoptante({
  elegido,
  error,
  onElegir,
}: {
  elegido: string;
  error: string | undefined;
  onElegir: (id: string) => void;
}) {
  const { t } = useTranslation();
  const errorId = useId();
  const [buscado, setBuscado] = useState<string | null>(null);
  // Busca a medida que se escribe (DESIGN_SYSTEM §8.5).
  const [texto, setTexto, buscarYa] = useBusquedaDiferida(buscado ?? '', (q) => setBuscado(q ?? null));
  const resultados = useQuery({
    queryKey: [...ADMIN_USERS_KEY, 'adopters', buscado],
    queryFn: () => adminApi.users.list({ role: 'adopter', status: 'active', q: buscado ?? '', pageSize: 10 }),
    enabled: buscado !== null,
  });

  return (
    <div className={styles.page}>
      {/* No es un <form>: no se puede anidar dentro del formulario de la adopción. */}
      <div className={styles.search}>
        <TextField
          type="search"
          label={t('admin.adoptions.searchAdopter')}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              buscarYa();
            }
          }}
        />
      </div>
      {resultados.data &&
        (resultados.data.data.length === 0 ? (
          <p>{t('admin.adoptions.noAdopters')}</p>
        ) : (
          <RadioGroup
            legend={t('admin.adoptions.adopter')}
            name="userId"
            value={elegido}
            onChange={onElegir}
            options={resultados.data.data.map((u) => ({
              value: String(u.id),
              label: `${u.firstName} ${u.lastName} · ${u.email}`,
            }))}
          />
        ))}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
