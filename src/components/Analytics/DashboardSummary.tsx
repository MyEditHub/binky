import SpeakingBalanceBar from './SpeakingBalanceBar';
import { AggregateStats, HostProfile } from '../../hooks/useAnalytics';
import { useTranslation } from 'react-i18next';

interface Props {
  aggregate: AggregateStats;
  hostProfile: HostProfile;
}

export default function DashboardSummary({ aggregate, hostProfile }: Props) {
  const { t } = useTranslation();

  if (aggregate.episodeCount === 0) return null;

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m} Min.`;
  };

  return (
    <div className="analytics-dashboard">
      <h3>{t('pages.analytics.dashboard_title')}</h3>
      <SpeakingBalanceBar
        host0Pct={aggregate.avgHost0Pct}
        host1Pct={aggregate.avgHost1Pct}
        host0Color={hostProfile.host0Color}
        host1Color={hostProfile.host1Color}
        host0Name={hostProfile.host0Name}
        host1Name={hostProfile.host1Name}
      />
      <div className="analytics-stat-row">
        <span style={{ color: hostProfile.host0Color }}>{hostProfile.host0Name}</span>
        <span>{formatMinutes(aggregate.totalHost0Minutes)}</span>
      </div>
      <div className="analytics-stat-row">
        <span style={{ color: hostProfile.host1Color }}>{hostProfile.host1Name}</span>
        <span>{formatMinutes(aggregate.totalHost1Minutes)}</span>
      </div>
      <div className="analytics-stat-row">
        <span style={{ color: 'var(--text-secondary, #888)' }}>
          {t('pages.analytics.episodes_analyzed', { count: aggregate.episodeCount })}
        </span>
      </div>
    </div>
  );
}
