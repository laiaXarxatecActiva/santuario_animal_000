import { faFeather, faMagnifyingGlass, faSliders, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AGE_RANGES, ANIMAL_SEXES, type AgeRange, type AnimalSex } from '@sanctuary/shared';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/Alert';
import { AnimalCard } from '../../components/AnimalCard';
import { Button } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import { useCatalog, useSpecies } from '../../hooks/usePublicData';
import {
  CATALOG_UI_SORTS,
  countActiveFilters,
  readCatalogFilters,
  toApiQuery,
  writeCatalogFilters,
  type CatalogFilters,
  type CatalogUiSort,
} from '../../utils/catalogParams';
import styles from './CatalogPage.module.css';

const PAGE_SIZE = 12;
const AGE_KEYS = Object.keys(AGE_RANGES) as AgeRange[];

// CU-02 Consultar el catálogo de animales (SCREENS §3.2).
export function CatalogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtros = useMemo(() => readCatalogFilters(searchParams), [searchParams]);
  const catalogo = useCatalog(toApiQuery(filtros, PAGE_SIZE));
  const especies = useSpecies();
  const [panelAbierto, setPanelAbierto] = useState(false);
  const panelId = useId();

  // La búsqueda tiene estado propio para poder escribir espacios; se sincroniza con la URL.
  const [texto, setTexto] = useState(filtros.q ?? '');
  useEffect(() => {
    setTexto((actual) => (actual.trim() === (filtros.q ?? '') ? actual : (filtros.q ?? '')));
  }, [filtros.q]);

  /** Cambia filtros y vuelve a la primera página (salvo que se cambie la página). */
  const actualizar = (cambios: Partial<CatalogFilters>, opciones: { replace?: boolean } = {}) => {
    const siguiente: CatalogFilters = { ...filtros, page: 1, ...cambios };
    setSearchParams(writeCatalogFilters(siguiente), opciones);
  };
  const limpiar = () => setSearchParams(writeCatalogFilters({ sort: filtros.sort, page: 1 }));

  const nombreEspecie = (id: number) => especies.data?.find((s) => s.id === id)?.name ?? `#${id}`;
  const activos: { key: keyof CatalogFilters; label: string }[] = [];
  if (filtros.q) activos.push({ key: 'q', label: t('catalog.searchFilter', { q: filtros.q }) });
  if (filtros.speciesId) activos.push({ key: 'speciesId', label: nombreEspecie(filtros.speciesId) });
  if (filtros.sex) activos.push({ key: 'sex', label: t(`catalog.sexOptions.${filtros.sex}`) });
  if (filtros.age) activos.push({ key: 'age', label: t(`catalog.ageRanges.${filtros.age}`) });
  if (filtros.adoptable) activos.push({ key: 'adoptable', label: t('catalog.adoptable') });
  const numActivos = countActiveFilters(filtros);

  const total = catalogo.data?.meta.total ?? 0;
  const animales = catalogo.data?.data ?? [];

  return (
    <div className="container">
      <h1>{t('catalog.title')}</h1>
      <p className={styles.intro}>{t('catalog.intro')}</p>

      <search aria-label={t('catalog.filtersLabel')} className={styles.toolbar}>
        <div className={styles.searchRow}>
          <div className={styles.searchField}>
            <label htmlFor="catalog-q" className="visually-hidden">
              {t('catalog.search')}
            </label>
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" className={styles.searchIcon} />
            <input
              id="catalog-q"
              type="search"
              className={styles.input}
              placeholder={t('catalog.search')}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                actualizar({ q: e.target.value.trim() || undefined }, { replace: true });
              }}
            />
          </div>
          <button
            type="button"
            className={styles.filtersButton}
            aria-expanded={panelAbierto}
            aria-controls={panelId}
            onClick={() => setPanelAbierto((a) => !a)}
          >
            <FontAwesomeIcon icon={faSliders} aria-hidden="true" />
            {numActivos > 0 ? t('catalog.filtersCount', { count: numActivos }) : t('catalog.filters')}
          </button>
          <div className={styles.field}>
            <label htmlFor="catalog-sort" className={styles.label}>
              {t('catalog.sort')}
            </label>
            <select
              id="catalog-sort"
              className={styles.select}
              value={filtros.sort}
              onChange={(e) => actualizar({ sort: e.target.value as CatalogUiSort })}
            >
              {CATALOG_UI_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`catalog.sorts.${sort}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div id={panelId} className={styles.panel} data-open={panelAbierto}>
          <div className={styles.field}>
            <label htmlFor="catalog-species" className={styles.label}>
              {t('catalog.species')}
            </label>
            <select
              id="catalog-species"
              className={styles.select}
              value={filtros.speciesId ?? ''}
              onChange={(e) => actualizar({ speciesId: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">{t('catalog.allSpecies')}</option>
              {especies.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="catalog-sex" className={styles.label}>
              {t('catalog.sex')}
            </label>
            <select
              id="catalog-sex"
              className={styles.select}
              value={filtros.sex ?? ''}
              onChange={(e) => actualizar({ sex: (e.target.value || undefined) as AnimalSex | undefined })}
            >
              <option value="">{t('catalog.anySex')}</option>
              {ANIMAL_SEXES.map((sex) => (
                <option key={sex} value={sex}>
                  {t(`catalog.sexOptions.${sex}`)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="catalog-age" className={styles.label}>
              {t('catalog.age')}
            </label>
            <select
              id="catalog-age"
              className={styles.select}
              value={filtros.age ?? ''}
              onChange={(e) => actualizar({ age: (e.target.value || undefined) as AgeRange | undefined })}
            >
              <option value="">{t('catalog.anyAge')}</option>
              {AGE_KEYS.map((age) => (
                <option key={age} value={age}>
                  {t(`catalog.ageRanges.${age}`)}
                </option>
              ))}
            </select>
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={filtros.adoptable === true}
              onChange={(e) => actualizar({ adoptable: e.target.checked ? true : undefined })}
            />
            {t('catalog.adoptable')}
          </label>
          <div className={styles.panelActions}>
            <Button block onClick={() => setPanelAbierto(false)}>
              {t('catalog.showResults', { count: total })}
            </Button>
          </div>
        </div>
      </search>

      {activos.length > 0 && (
        <div className={styles.active}>
          <span>{t('catalog.activeFilters')}</span>
          <ul className={styles.chips}>
            {activos.map(({ key, label }) => (
              <li key={key}>
                <span className={styles.chip}>
                  {label}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={t('catalog.removeFilter', { label })}
                    onClick={() => actualizar({ [key]: undefined })}
                  >
                    <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={limpiar}>
            {t('catalog.clearFilters')}
          </Button>
        </div>
      )}

      <p className={styles.count} aria-live="polite">
        {catalogo.data && t('catalog.results', { count: total })}
      </p>

      {catalogo.isPending && <CardSkeletons count={8} />}

      {catalogo.isError && (
        <Alert
          type="error"
          title={t('catalog.errorLoading')}
          action={
            <Button variant="outline" onClick={() => void catalogo.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}

      {catalogo.isSuccess && animales.length === 0 && (
        <EmptyState
          icon={faFeather}
          message={t('catalog.empty')}
          action={
            <Button variant="outline" onClick={limpiar}>
              {t('catalog.clearFilters')}
            </Button>
          }
        />
      )}

      {animales.length > 0 && (
        <>
          <ul className="card-grid">
            {animales.map((animal) => (
              <li key={animal.id}>
                <AnimalCard animal={animal} />
              </li>
            ))}
          </ul>
          <div className={styles.pagination}>
            <Pagination
              page={catalogo.data?.meta.page ?? 1}
              totalPages={catalogo.data?.meta.totalPages ?? 0}
              onChange={(page) => {
                actualizar({ page });
                window.scrollTo?.({ top: 0 });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
