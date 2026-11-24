import { faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  qualificationBodySchema,
  zoneBodySchema,
  type QualificationBody,
  type QualificationDto,
  type ZoneBody,
  type ZoneDto,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { TextAreaField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { useQualifications, useZones, WORK_KEY } from '../../hooks/useWork';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import styles from './AdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

type Aviso = { type: 'success' | 'error'; message: string };
type Elemento = { id: number; name: string };

// CU-52 y CU-53: zonas y cualificaciones (SCREENS §5.15).
export function ZonesAdminPage() {
  const { t } = useTranslation();
  const zonas = useZones();
  const cualificaciones = useQualifications();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [zona, setZona] = useState<ZoneDto | null | undefined>(undefined);
  const [cualificacion, setCualificacion] = useState<QualificationDto | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<{ tipo: 'zone' | 'qualification'; elemento: Elemento } | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: WORK_KEY });

  const borrar = useMutation({
    mutationFn: ({ tipo, elemento }: NonNullable<typeof aBorrar>) =>
      tipo === 'zone' ? workApi.zones.remove(elemento.id) : workApi.qualifications.remove(elemento.id),
    onSuccess: async (_r, { tipo }) => {
      setABorrar(null);
      setAviso({ type: 'success', message: t(tipo === 'zone' ? 'work.zones.deleted' : 'work.qualifications.deleted') });
      await refrescar();
    },
    onError: (error) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  const guardado = (clave: string) => async () => {
    setZona(undefined);
    setCualificacion(undefined);
    setAviso({ type: 'success', message: t(clave) });
    await refrescar();
  };

  const acciones = (tipo: 'zone' | 'qualification', elemento: Elemento, editar: () => void) => (
    <div className={styles.rowActions}>
      <button
        type="button"
        className={iconStyles.iconButton}
        aria-label={t('admin.common.edit', { name: elemento.name })}
        onClick={editar}
      >
        <FontAwesomeIcon icon={faPen} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={iconStyles.iconButton}
        aria-label={t('admin.common.deleteNamed', { name: elemento.name })}
        onClick={() => {
          setAviso(null);
          setABorrar({ tipo, elemento });
        }}
      >
        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className={styles.page}>
      <h1>{t('work.zones.title')}</h1>
      <PageIntro pagina="zones" />
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      <section aria-labelledby="zonas" className={styles.page}>
        <div className={styles.header}>
          <h2 id="zonas">{t('work.zones.zonesTitle')}</h2>
          <Button icon={faPlus} onClick={() => setZona(null)}>
            {t('work.zones.new')}
          </Button>
        </div>
        <Listado
          consulta={zonas}
          vacio={t('work.zones.empty')}
          error={t('work.zones.loadError')}
          columnas={[t('work.zones.name'), t('work.zones.animalCount')]}
          fila={(z) => (
            <tr key={z.id}>
              <td className={styles.nameLink}>{z.name}</td>
              <td data-label={t('work.zones.animalCount')} className={styles.numeric}>
                {z.animalCount}
              </td>
              <td>{!z.isActive && <Badge>{t('work.zones.inactive')}</Badge>}</td>
              <td>{acciones('zone', z, () => setZona(z))}</td>
            </tr>
          )}
        />
      </section>

      <section aria-labelledby="cualificaciones" className={styles.page}>
        <div className={styles.header}>
          <h2 id="cualificaciones">{t('work.qualifications.title')}</h2>
          <Button icon={faPlus} onClick={() => setCualificacion(null)}>
            {t('work.qualifications.new')}
          </Button>
        </div>
        <Listado
          consulta={cualificaciones}
          vacio={t('work.qualifications.empty')}
          error={t('work.qualifications.loadError')}
          columnas={[t('work.zones.name'), t('work.qualifications.workerCount')]}
          fila={(q) => (
            <tr key={q.id}>
              <td className={styles.nameLink}>{q.name}</td>
              <td data-label={t('work.qualifications.workerCount')} className={styles.numeric}>
                {q.workerCount}
              </td>
              <td>{q.description && <span className={styles.muted}>{q.description}</span>}</td>
              <td>{acciones('qualification', q, () => setCualificacion(q))}</td>
            </tr>
          )}
        />
      </section>

      {zona !== undefined && (
        <FormularioZona zona={zona} onClose={() => setZona(undefined)} onSaved={guardado('work.zones.saved')} />
      )}
      {cualificacion !== undefined && (
        <FormularioCualificacion
          cualificacion={cualificacion}
          onClose={() => setCualificacion(undefined)}
          onSaved={guardado('work.qualifications.saved')}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t(aBorrar?.tipo === 'qualification' ? 'work.qualifications.confirmDelete' : 'work.zones.confirmDelete', {
          name: aBorrar?.elemento.name,
        })}
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
        <p>{t('work.zones.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}

/** Tabla con su carga, error y estado vacío. */
function Listado<T>({
  consulta,
  vacio,
  error,
  columnas,
  fila,
}: {
  consulta: { data?: T[]; isError: boolean; refetch: () => unknown };
  vacio: string;
  error: string;
  columnas: [string, string];
  fila: (elemento: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (consulta.isError) {
    return (
      <Alert
        type="error"
        action={
          <Button variant="outline" onClick={() => void consulta.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }
  if (!consulta.data) return <p aria-busy="true">{t('common.loading')}</p>;
  if (consulta.data.length === 0) return <p>{vacio}</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{columnas[0]}</th>
          <th scope="col" className={styles.numeric}>
            {columnas[1]}
          </th>
          <th scope="col">
            <span className="visually-hidden">{t('admin.common.actions')}</span>
          </th>
          <th scope="col">
            <span className="visually-hidden">{t('admin.common.actions')}</span>
          </th>
        </tr>
      </thead>
      <tbody>{consulta.data.map(fila)}</tbody>
    </table>
  );
}

/** Ventana con el formulario de alta o edición; los errores de un campo se muestran junto a él. */
function VentanaFormulario<T extends FieldValues>({
  id,
  titulo,
  form,
  campos,
  enviar,
  onClose,
  children,
}: {
  id: string;
  titulo: string;
  form: UseFormReturn<T>;
  campos: readonly Path<T>[];
  enviar: (datos: T) => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: enviar,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, campos);
      else setError(errorMessage(t, e));
    },
  });
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
          <Button type="submit" form={id} disabled={guardar.isPending}>
            {guardar.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id={id}
        noValidate
        className={styles.modalForm}
        onSubmit={form.handleSubmit((datos) => guardar.mutate(datos))}
      >
        {error && <Alert type="error">{error}</Alert>}
        {children}
      </form>
    </Modal>
  );
}

function FormularioZona({
  zona,
  onClose,
  onSaved,
}: {
  zona: ZoneDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const form = useForm<ZoneBody>({
    resolver: zodResolver(zoneBodySchema, undefined, { raw: true }),
    defaultValues: { name: zona?.name ?? '', description: zona?.description ?? '', isActive: zona?.isActive ?? true },
  });
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <VentanaFormulario
      id="formulario-zona"
      titulo={zona ? t('work.zones.editTitle') : t('work.zones.new')}
      form={form}
      campos={['name', 'description']}
      enviar={async (datos) => {
        await (zona ? workApi.zones.update(zona.id, datos) : workApi.zones.create(datos));
        await onSaved();
      }}
      onClose={onClose}
    >
      <TextField label={t('work.zones.name')} error={errors.name?.message} {...register('name')} />
      <TextAreaField
        label={t('form.optional', { label: t('work.zones.description') })}
        rows={3}
        error={errors.description?.message}
        {...register('description')}
      />
      <Switch label={t('work.zones.active')} {...register('isActive')} />
    </VentanaFormulario>
  );
}

function FormularioCualificacion({
  cualificacion,
  onClose,
  onSaved,
}: {
  cualificacion: QualificationDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const form = useForm<QualificationBody>({
    resolver: zodResolver(qualificationBodySchema, undefined, { raw: true }),
    defaultValues: { name: cualificacion?.name ?? '', description: cualificacion?.description ?? '' },
  });
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <VentanaFormulario
      id="formulario-cualificacion"
      titulo={cualificacion ? t('work.qualifications.editTitle') : t('work.qualifications.new')}
      form={form}
      campos={['name', 'description']}
      enviar={async (datos) => {
        await (cualificacion
          ? workApi.qualifications.update(cualificacion.id, datos)
          : workApi.qualifications.create(datos));
        await onSaved();
      }}
      onClose={onClose}
    >
      <TextField label={t('work.zones.name')} error={errors.name?.message} {...register('name')} />
      <TextAreaField
        label={t('form.optional', { label: t('work.zones.description') })}
        rows={3}
        error={errors.description?.message}
        {...register('description')}
      />
    </VentanaFormulario>
  );
}
