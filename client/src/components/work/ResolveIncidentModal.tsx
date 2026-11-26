import { incidentStatusBodySchema, type IncidentDto, type IncidentStatusBody } from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { TextAreaField } from '../FormFields';
import { Modal } from '../Modal';
import styles from '../../pages/admin/AdminPage.module.css';

/** CU-70: cualquier trabajador da por resuelta una incidencia explicando cómo. */
export function ResolveIncidentModal({
  incidencia,
  onClose,
  onSaved,
}: {
  incidencia: IncidentDto;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  // CU-70: al resolverla, su tarea pendiente se cierra sola.
  const pendiente = incidencia.tasks.find((tarea) => tarea.status === 'pending');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: (datos: IncidentStatusBody) => workApi.incidents.setStatus(incidencia.id, datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setError(errorMessage(t, e));
    },
  });
  const formId = 'resolver-incidencia';
  return (
    <Modal
      open
      title={t('work.incidents.resolveTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={guardar.isPending}>
            {guardar.isPending ? t('admin.common.saving') : t('work.incidents.resolveSubmit')}
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
          const datos: IncidentStatusBody = { status: 'resolved', note: nota };
          const resultado = incidentStatusBodySchema.safeParse(datos);
          if (!resultado.success) {
            setErrores(erroresPorCampo(resultado.error.issues));
            return;
          }
          setErrores({});
          guardar.mutate(datos);
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        <p>
          <strong>{incidencia.title}</strong>
        </p>
        <p className={styles.preWrap}>{incidencia.description}</p>
        {pendiente && <Alert type="info">{t('work.incidents.pendingTaskWillClose', { title: pendiente.title })}</Alert>}
        <TextAreaField
          label={t('work.incidents.resolveNote')}
          rows={3}
          maxLength={2000}
          value={nota}
          error={errores.note}
          onChange={(e) => setNota(e.target.value)}
        />
      </form>
    </Modal>
  );
}
