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
import { FilterSelect } from '../../components/FilterSelect';
import { Pagination } from '../../components/Pagination';
import { useCatalog, useSpecies } from '../../hooks/usePublicData';
import {
  CATALOG_UI_SORTS,
  countActiveFilters,
  readCatalogFilters,
  toApiQuery,
  writeCatalogFilters,
  type CatalogFilters,
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
  // Un filtro activo por valor: cada especie y cada tramo de edad se quitan por separado.
  const activos: { id: string; label: string; quitar: () => void }[] = [];
  const sinValor = <V,>(lista: V[] | undefined, valor: V) => {
    const resto = (lista ?? []).filter((v) => v !== valor);
    return resto.length ? resto : undefined;
  };
  if (filtros.q)
    activos.push({
      id: 'q',
      label: t('catalog.searchFilter', { q: filtros.q }),
      quitar: () => actualizar({ q: undefined }),
    });
  for (const id of filtros.speciesIds ?? []) {
    activos.push({
      id: `species-${id}`,
      label: nombreEspecie(id),
      quitar: () => actualizar({ speciesIds: sinValor(filtros.speciesIds, id) }),
    });
  }
  if (filtros.sex) {
    activos.push({
      id: 'sex',
      label: t(`catalog.sexOptions.${filtros.sex}`),
      quitar: () => actualizar({ sex: undefined }),
    });
  }
  for (const age of filtros.ages ?? []) {
    activos.push({
      id: `age-${age}`,
      label: t(`catalog.ageRanges.${age}`),
      quitar: () => actualizar({ ages: sinValor(filtros.ages, age) }),
    });
  }
  if (filtros.adoptable) {
    activos.push({
      id: 'adoptable',
      label: t('catalog.adoptable'),
      quitar: () => actualizar({ adoptable: undefined }),
    });
  }
  const numActivos = countActiveFilters(filtros);

  const total = catalogo.data?.meta.total ?? 0;
  const animales = catalogo.data?.data ?? [];

  return (
    <div className="container">
      <h1>{t('catalog.title')}</h1>
      <p className={styles.intro}>{t('catalog.intro')}</p>

      <search aria-label={t('catalog.filtersLabel')} className={styles.toolbar}>
        <div className={styles.searchRow}>
          <div className={`${styles.field} ${styles.searchField}`}>
            <label htmlFor="catalog-q" className={styles.label}>
              {t('catalog.search')}
            </label>
            <div className={styles.searchInput}>
              <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" className={styles.searchIcon} />
              <input
                id="catalog-q"
                type="search"
                className={styles.input}
                placeholder={t('catalog.searchPlaceholder')}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  actualizar({ q: e.target.value.trim() || undefined }, { replace: true });
                }}
              />
            </div>
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
          <FilterSelect
            label={t('catalog.sort')}
            className={`${styles.field} ${styles.sortField}`}
            labelClassName={styles.label}
            value={filtros.sort}
            options={CATALOG_UI_SORTS.map((sort) => ({ value: sort, label: t(`catalog.sorts.${sort}`) }))}
            onChange={(sort) => actualizar({ sort })}
          />
        </div>

        <div id={panelId} className={styles.panel} data-open={panelAbierto}>
          <FilterSelect
            multiple
            label={t('catalog.species')}
            className={styles.field}
            labelClassName={styles.label}
            allLabel={t('catalog.allSpecies')}
            summary={(count) => t('catalog.speciesSelected', { count })}
            value={(filtros.speciesIds ?? []).map(String)}
            options={(especies.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
            onChange={(ids) => actualizar({ speciesIds: ids.length ? ids.map(Number) : undefined })}
          />
          <FilterSelect<AnimalSex | ''>
            label={t('catalog.sex')}
            className={styles.field}
            labelClassName={styles.label}
            value={filtros.sex ?? ''}
            options={[
              { value: '', label: t('catalog.anySex') },
              ...ANIMAL_SEXES.map((sex) => ({ value: sex, label: t(`catalog.sexOptions.${sex}`) })),
            ]}
            onChange={(sex) => actualizar({ sex: sex || undefined })}
          />
          <FilterSelect<AgeRange>
            multiple
            label={t('catalog.age')}
            className={styles.field}
            labelClassName={styles.label}
            allLabel={t('catalog.anyAge')}
            summary={(count) => t('catalog.agesSelected', { count })}
            value={filtros.ages ?? []}
            options={AGE_KEYS.map((age) => ({ value: age, label: t(`catalog.ageRanges.${age}`) }))}
            onChange={(ages) => actualizar({ ages: ages.length ? ages : undefined })}
          />
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
            {activos.map(({ id, label, quitar }) => (
              <li key={id}>
                <span className={styles.chip}>
                  {label}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={t('catalog.removeFilter', { label })}
                    onClick={quitar}
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
