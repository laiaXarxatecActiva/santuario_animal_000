import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { IncidentSeverity, IncidentStatus } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeTone } from '../Badge';

// CU-70: gravedad y estado de una incidencia (DESIGN_SYSTEM §8.6).
const TONO_GRAVEDAD: Record<IncidentSeverity, BadgeTone> = { low: 'neutral', medium: 'warning', high: 'error' };
const TONO_ESTADO: Record<IncidentStatus, BadgeTone> = { open: 'warning', in_progress: 'info', resolved: 'success' };

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONO_GRAVEDAD[severity]} icon={severity === 'high' ? faTriangleExclamation : undefined}>
      {t(`work.incidents.severities.${severity}`)}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const { t } = useTranslation();
  return <Badge tone={TONO_ESTADO[status]}>{t(`work.incidents.statuses.${status}`)}</Badge>;
}
