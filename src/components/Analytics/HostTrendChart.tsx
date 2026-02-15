import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';

interface TrendDataPoint {
  label: string;
  host0Pct: number;
  host1Pct: number;
}

interface Props {
  data: TrendDataPoint[];
  host0Name: string;
  host1Name: string;
  host0Color: string;
  host1Color: string;
}

export default function HostTrendChart({ data, host0Name, host1Name, host0Color, host1Color }: Props) {
  const { t } = useTranslation();

  if (data.length < 2) {
    return (
      <div style={{ color: 'var(--text-secondary, #888)', fontSize: 12, padding: '12px 0' }}>
        {t('pages.analytics.trend_min_episodes')}
      </div>
    );
  }

  return (
    <div className="analytics-trend-section">
      <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary, #888)' }}>
        {t('pages.analytics.trend_title')}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value: number | string | undefined) => [`${value ?? 0}%`]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="host0Pct" name={host0Name} stackId="a" fill={host0Color} />
          <Bar dataKey="host1Pct" name={host1Name} stackId="a" fill={host1Color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
