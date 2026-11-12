import { faMagnifyingGlass, faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ADMIN_ANIMAL_SORTS, ANIMAL_STATUSES, type AdminAnimalSort, type AnimalStatus } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { AdminAnimalsParams } from '../../api/admin';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { AnimalStatusBadges } from '../../components/AnimalStatusBadges';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { Pagination } from '../../components/Pagination';
import { useAdminAnimals, useAdminSpecies } from '../../hooks/useAdmin';
import styles from './AdminPage.module.css';

const PAGE_SIZE = 20;
// Orden fijo de los parámetros en la URL.
const CLAVES = ['q', 'speciesId', 'status', 'published', 'adoptable', 'sort', 'page'] as const;

const entero = (valor: string | null) => (valor && /^\d+$/.test(valor) ? Number(valor) : undefined);
const booleano = (valor: string | null) => (valor === 'true' ? true : valor === 'false' ? false : undefined);

/** Filtros válidos de la URL; lo que no se reconoce se ignora. */
function leerFiltros(params: URLSearchParams): AdminAnimalsParams {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    q: params.get('q') || undefined,
    speciesId: entero(params.get('speciesId')),
    status: (ANIMAL_STATUSES as readonly string[]).includes(status ?? '') ? (status as AnimalStatus) : undefined,
    published: booleano(params.get('published')),
    adoptable: booleano(params.get('adoptable')),
    sort: (ADMIN_ANIMAL_SORTS as readonly string[]).includes(sort ?? '') ? (sort as AdminAnimalSort) : undefined,
    page: entero(params.get('page')),
  };
}

// CU-28 Gestionar animales: listado (SCREENS §5.3).
export function AnimalsAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const animales = useAdminAnimals({ ...filtros, pageSize: PAGE_SIZE });
  const especies = useAdminSpecies();
  const [busqueda, setBusqueda] = useState(filtros.q ?? '');

  /** Cambia un filtro y vuelve a la primera página. */
  const cambiar = (cambios: Partial<Record<(typeof CLAVES)[number], string | undefined>>) => {
    const actuales = Object.fromEntries(CLAVES.map((c) => [c, params.get(c) ?? undefined]));
    const nuevos: Record<string, string | undefined> = { ...actuales, page: undefined, ...cambios };
    const siguiente = new URLSearchParams();
    for (const clave of CLAVES) {
      const valor = nuevos[clave];
      if (valor) siguiente.set(clave, valor);
    }
    setParams(siguiente);
  };

  const selectBooleano = (clave: 'published' | 'adoptable', etiqueta: string) => (
    <SelectField
      label={etiqueta}
      value={params.get(clave) ?? ''}
      onChange={(e) => cambiar({ [clave]: e.target.value || undefined })}
    >
      <option value="">{t('form.any')}</option>
      <option value="true">{t('form.yes')}</option>
      <option value="false">{t('form.no')}</option>
    </SelectField>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.animals.title')}</h1>
        <ButtonLink to="/admin/animals/new" icon={faPlus}>
          {t('admin.animals.new')}
        </ButtonLink>
      </div>

      <search className={styles.filters}>
        <form
          role="search"
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            cambiar({ q: busqueda.trim() || undefined });
          }}
        >
          <TextField
            type="search"
            label={t('admin.animals.searchLabel')}
            placeholder={t('admin.animals.searchPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Button type="submit" variant="outline" icon={faMagnifyingGlass}>
            {t('admin.common.search')}
          </Button>
        </form>
        <SelectField
          label={t('admin.animals.species')}
          value={params.get('speciesId') ?? ''}
          onChange={(e) => cambiar({ speciesId: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {especies.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('admin.animals.status')}
          value={params.get('status') ?? ''}
          onChange={(e) => cambiar({ status: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {ANIMAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.animalStatus.${s}`)}
            </option>
          ))}
        </SelectField>
        {selectBooleano('published', t('admin.animals.published'))}
        {selectBooleano('adoptable', t('admin.animals.adoptable'))}
      </search>

      {animales.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void animales.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.animals.loadError')}
        </Alert>
      ) : !animales.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : animales.data.data.length === 0 ? (
        <p>{t('admin.animals.empty')}</p>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            {t('admin.common.results', { count: animales.data.meta.total })}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('admin.animals.photo')}</th>
                <th scope="col">{t('admin.animals.name')}</th>
                <th scope="col">{t('admin.animals.species')}</th>
                <th scope="col">{t('admin.animals.status')}</th>
                <th scope="col">{t('admin.animals.adoptable')}</th>
                <th scope="col" className={styles.numeric}>
                  {t('admin.animals.activeAdopters')}
                </th>
                <th scope="col">
                  <span className="visually-hidden">{t('admin.common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {animales.data.data.map((animal) => (
                <tr key={animal.id}>
                  <td>
                    <div className={styles.thumb}>
                      <AnimalPhoto photo={animal.coverPhoto} thumbnail ratio="1/1" />
                    </div>
                  </td>
                  <td>
                    <Link to={`/admin/animals/${animal.id}`} className={styles.nameLink}>
                      {animal.name}
                    </Link>
                  </td>
                  <td data-label={t('admin.animals.species')}>{animal.species.name}</td>
                  <td data-label={t('admin.animals.status')}>
                    <div className={styles.badges}>
                      <AnimalStatusBadges status={animal.status} isPublished={animal.isPublished} />
                    </div>
                  </td>
                  <td data-label={t('admin.animals.adoptable')}>{animal.isAdoptable ? t('form.yes') : t('form.no')}</td>
                  <td data-label={t('admin.animals.activeAdopters')} className={styles.numeric}>
                    {animal.activeAdopters}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        to={`/admin/animals/${animal.id}`}
                        className={iconStyles.iconButton}
                        aria-label={t('admin.common.edit', { name: animal.name })}
                      >
                        <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={animales.data.meta.page}
            totalPages={animales.data.meta.totalPages}
            onChange={(p) => cambiar({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
