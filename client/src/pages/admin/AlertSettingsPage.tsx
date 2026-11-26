import {
  alertSettingsBodySchema,
  STAFF_EMAIL_ALERT_TYPES,
  type AlertSettingsBody,
  type AlertSettingsDto,
  type StaffEmailAlertType,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/FormFields';
import { TimeField } from '../../components/TimeField';

import { useAlertSettings, WORK_KEY } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import styles from './AdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

// CU-73 y CU-74: qué avisos del personal van también por email y el resumen diario (SCREENS §5.7).
export function AlertSettingsPage() {
  const { t } = useTranslation();
  const ajustes = useAlertSettings();
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.alertSettings.title')}</h1>
      </div>
      <PageIntro pagina="alertSettings" />
      {ajustes.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void ajustes.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.alertSettings.loadError')}
        </Alert>
      ) : !ajustes.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <Formulario inicial={ajustes.data} />
      )}
    </div>
  );
}

function Formulario({ inicial }: { inicial: AlertSettingsDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tipos, setTipos] = useState<StaffEmailAlertType[]>(inicial.emailAlertTypes);
  const [resumen, setResumen] = useState(inicial.dailySummaryEnabled);
  const [hora, setHora] = useState(inicial.dailySummaryTime);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const guardar = useMutation({
    mutationFn: (datos: AlertSettingsBody) => workApi.alertSettings.update(datos),
    onSuccess: async () => {
      setAviso({ type: 'success', message: t('work.alertSettings.saved') });
      await queryClient.invalidateQueries({ queryKey: [...WORK_KEY, 'alert-settings'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setAviso({ type: 'error', message: errorMessage(t, e) });
    },
  });

  const alternar = (tipo: StaffEmailAlertType) =>
    setTipos((actuales) => (actuales.includes(tipo) ? actuales.filter((x) => x !== tipo) : [...actuales, tipo]));

  return (
    <form
      noValidate
      className={styles.modalForm}
      onSubmit={(e) => {
        e.preventDefault();
        setAviso(null);
        // Siempre en el orden de la lista, como lo guarda el servidor.
        const datos: AlertSettingsBody = {
          emailAlertTypes: STAFF_EMAIL_ALERT_TYPES.filter((x) => tipos.includes(x)),
          dailySummaryEnabled: resumen,
          dailySummaryTime: hora,
        };
        const resultado = alertSettingsBodySchema.safeParse(datos);
        if (!resultado.success) {
          setErrores(erroresPorCampo(resultado.error.issues));
          return;
        }
        setErrores({});
        guardar.mutate(datos);
      }}
    >
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      <fieldset>
        <legend>{t('work.alertSettings.emailLegend')}</legend>
        <p className={styles.muted}>{t('work.alertSettings.emailHelp')}</p>
        {STAFF_EMAIL_ALERT_TYPES.map((tipo) => (
          <Checkbox
            key={tipo}
            label={t(`work.alertSettings.types.${tipo}`)}
            checked={tipos.includes(tipo)}
            onChange={() => alternar(tipo)}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('work.alertSettings.summaryLegend')}</legend>
        <p className={styles.muted}>{t('work.alertSettings.summaryHelp')}</p>
        <Checkbox
          label={t('work.alertSettings.summaryEnabled')}
          checked={resumen}
          onChange={(e) => setResumen(e.target.checked)}
        />
        <TimeField
          label={t('work.alertSettings.summaryTime')}
          value={hora}
          error={errores.dailySummaryTime}
          onChange={setHora}
        />
      </fieldset>
      <div>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? t('admin.common.saving') : t('admin.common.save')}
        </Button>
      </div>
    </form>
  );
}
