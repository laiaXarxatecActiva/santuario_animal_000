import {
  ARCHIVED_ANIMAL_STATUSES,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  incidentBodySchema,
  type IncidentBody,
  type IncidentCategory,
  type IncidentDto,
  type IncidentSeverity,
} from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { useAdminAnimals } from '../../hooks/useAdmin';
import { useZones } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { SelectField, TextAreaField } from '../FormFields';
import { PhotoPicker } from '../PhotoPicker';
import { Modal } from '../Modal';
import styles from '../../pages/admin/AdminPage.module.css';

/** CU-70: cualquier trabajador comunica una incidencia (desde «Incidencias» o «Mi día»). */
export function IncidentFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (incidencia: IncidentDto) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const zonas = useZones();
  const animales = useAdminAnimals({ pageSize: 100, sort: 'name' });
  const [campos, setCampos] = useState({
    category: INCIDENT_CATEGORIES[0] as IncidentCategory,
    severity: 'medium' as IncidentSeverity,
    description: '',
    zoneId: '',
    animalId: '',
  });
  const [foto, setFoto] = useState<File | undefined>(undefined);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const cambiar = <K extends keyof typeof campos>(campo: K, valor: (typeof campos)[K]) =>
    setCampos((c) => ({ ...c, [campo]: valor }));

  const enviar = useMutation({
    mutationFn: (datos: IncidentBody) => workApi.incidents.create(datos, foto),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setError(errorMessage(t, e));
    },
  });

  const formId = 'comunicar-incidencia';
  return (
    <Modal
      open
      title={t('work.incidents.report')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={enviar.isPending}>
            {enviar.isPending ? t('work.incidents.sending') : t('work.incidents.send')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className={styles.modalForm}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const datos: IncidentBody = {
            category: campos.category,
            severity: campos.severity,
            description: campos.description,
            zoneId: campos.zoneId ? Number(campos.zoneId) : null,
            animalId: campos.animalId ? Number(campos.animalId) : null,
          };
          const resultado = incidentBodySchema.safeParse(datos);
          if (!resultado.success) {
            setErrores(erroresPorCampo(resultado.error.issues));
            return;
          }
          setErrores({});
          enviar.mutate(datos);
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        <SelectField
          label={t('work.incidents.category')}
          value={campos.category}
          error={errores.category}
          onChange={(e) => cambiar('category', e.target.value as IncidentCategory)}
        >
          {INCIDENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`work.incidents.categories.${c}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('work.incidents.severity')}
          value={campos.severity}
          error={errores.severity}
          help={campos.severity === 'high' ? t('work.incidents.highHelp') : undefined}
          onChange={(e) => cambiar('severity', e.target.value as IncidentSeverity)}
        >
          {INCIDENT_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {t(`work.incidents.severities.${s}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('work.incidents.zone')}
          value={campos.zoneId}
          error={errores.zoneId}
          onChange={(e) => cambiar('zoneId', e.target.value)}
        >
          <option value="">{t('form.choose')}</option>
          {zonas.data
            ?.filter((z) => z.isActive)
            .map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          label={t('form.optional', { label: t('work.incidents.animal') })}
          value={campos.animalId}
          error={errores.animalId}
          onChange={(e) => cambiar('animalId', e.target.value)}
        >
          <option value="">{t('work.incidents.noAnimal')}</option>
          {(animales.data?.data ?? [])
            .filter((a) => !(ARCHIVED_ANIMAL_STATUSES as readonly string[]).includes(a.status))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </SelectField>
        <TextAreaField
          label={t('work.incidents.description')}
          rows={4}
          maxLength={2000}
          value={campos.description}
          error={errores.description}
          onChange={(e) => cambiar('description', e.target.value)}
        />
        <PhotoPicker label={t('form.optional', { label: t('work.photo') })} value={foto} onChange={setFoto} />
      </form>
    </Modal>
  );
}
