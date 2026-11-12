import { zodResolver } from '@hookform/resolvers/zod';
import {
  ANIMAL_SEXES,
  animalBodySchema,
  type AdminAnimalDto,
  type AnimalBody,
  type AnimalData,
} from '@sanctuary/shared';
import { Controller, useForm, type UseFormSetError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAdminSpecies } from '../../hooks/useAdmin';
import { Button } from '../Button';
import { SelectField, TextAreaField, TextField } from '../FormFields';
import { Switch } from '../Switch';
import styles from './AnimalForm.module.css';

export const ANIMAL_FIELDS = [
  'name',
  'speciesId',
  'breed',
  'sex',
  'approxBirthDate',
  'arrivalDate',
  'rescueStory',
  'temperament',
  'specialNeeds',
  'healthSummary',
  'isAdoptable',
  'isPublished',
] as const;

interface AnimalFormProps {
  animal?: AdminAnimalDto;
  submitLabel: string;
  submittingLabel: string;
  pending: boolean;
  onSubmit: (datos: AnimalData, setError: UseFormSetError<AnimalBody>) => void;
}

const valoresIniciales = (a?: AdminAnimalDto): AnimalBody => ({
  name: a?.name ?? '',
  speciesId: a?.species.id ?? '',
  breed: a?.breed ?? '',
  sex: a?.sex ?? 'unknown',
  approxBirthDate: a?.approxBirthDate ?? '',
  arrivalDate: a?.arrivalDate ?? '',
  rescueStory: a?.rescueStory ?? '',
  temperament: a?.temperament ?? '',
  specialNeeds: a?.specialNeeds ?? '',
  healthSummary: a?.healthSummary ?? '',
  isAdoptable: a?.isAdoptable ?? true,
  isPublished: a?.isPublished ?? false,
});

// Formulario de alta y edición de un animal (CU-28, SCREENS §5.4 pestaña «Datos»).
export function AnimalForm({ animal, submitLabel, submittingLabel, pending, onSubmit }: AnimalFormProps) {
  const { t } = useTranslation();
  const especies = useAdminSpecies();
  const archivado = animal?.status === 'deceased' || animal?.status === 'transferred';
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AnimalBody, unknown, AnimalData>({
    resolver: zodResolver(animalBodySchema),
    defaultValues: valoresIniciales(animal),
  });
  const opcional = (clave: string) => t('form.optional', { label: t(clave) });

  return (
    <form noValidate className={styles.form} onSubmit={handleSubmit((datos) => onSubmit(datos, setError))}>
      <div className={styles.columns}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('admin.animal.identification')}</legend>
          <TextField label={t('admin.animal.name')} error={errors.name?.message} {...register('name')} />
          <SelectField label={t('admin.animal.species')} error={errors.speciesId?.message} {...register('speciesId')}>
            <option value="">{t('form.choose')}</option>
            {especies.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TextField label={opcional('admin.animal.breed')} error={errors.breed?.message} {...register('breed')} />
          <SelectField label={t('admin.animal.sex')} error={errors.sex?.message} {...register('sex')}>
            {ANIMAL_SEXES.map((s) => (
              <option key={s} value={s}>
                {t(s === 'unknown' ? 'admin.animal.sexUnknown' : `animal.sex.${s}`)}
              </option>
            ))}
          </SelectField>
          <TextField
            type="date"
            label={opcional('admin.animal.approxBirthDate')}
            error={errors.approxBirthDate?.message}
            {...register('approxBirthDate')}
          />
          <TextField
            type="date"
            label={t('admin.animal.arrivalDate')}
            error={errors.arrivalDate?.message}
            {...register('arrivalDate')}
          />
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('admin.animal.publication')}</legend>
          <Controller
            control={control}
            name="isPublished"
            render={({ field }) => (
              <Switch
                label={t('admin.animal.isPublished')}
                help={t('admin.animal.isPublishedHelp')}
                name={field.name}
                ref={field.ref}
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />
          <Controller
            control={control}
            name="isAdoptable"
            render={({ field }) => (
              <Switch
                label={t('admin.animal.isAdoptable')}
                help={archivado ? t('admin.animal.archivedHelp') : t('admin.animal.isAdoptableHelp')}
                name={field.name}
                ref={field.ref}
                disabled={archivado}
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />
          {errors.isAdoptable?.message && (
            <p className={styles.error} role="alert">
              {errors.isAdoptable.message}
            </p>
          )}
        </fieldset>
      </div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('admin.animal.texts')}</legend>
        <TextAreaField
          label={opcional('admin.animal.rescueStory')}
          error={errors.rescueStory?.message}
          {...register('rescueStory')}
        />
        <TextAreaField
          label={opcional('admin.animal.temperament')}
          rows={4}
          error={errors.temperament?.message}
          {...register('temperament')}
        />
        <TextAreaField
          label={opcional('admin.animal.specialNeeds')}
          rows={4}
          error={errors.specialNeeds?.message}
          {...register('specialNeeds')}
        />
        <TextAreaField
          label={opcional('admin.animal.healthSummary')}
          help={t('admin.animal.healthHelp')}
          rows={4}
          error={errors.healthSummary?.message}
          {...register('healthSummary')}
        />
      </fieldset>
      <div className={styles.submit}>
        <Button type="submit" disabled={pending}>
          {pending ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
