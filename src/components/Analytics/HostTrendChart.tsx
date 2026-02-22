import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface TrendDataPoint {
  label: string;
  title: string;
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

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  payload?: TrendDataPoint;
}

const TrendTooltip: React.FC<{ active?: boolean; payload?: TooltipEntry[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const episodeTitle = payload[0]?.payload?.title;

  return (
    <div
      style={{
        background: 'var(--color-surface, #fff)',
        border: '1px solid var(--color-border, #ddd)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        maxWidth: 240,
      }}
    >
      {episodeTitle && (
        <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-word' }}>
          {episodeTitle}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color, lineHeight: 1.6 }}>
          {entry.name}: {entry.value ?? 0}%
        </div>
      ))}
    </div>
  );
};

export default function HostTrendChart({ data, host0Name, host1Name, host0Color, host1Color }: Props) {
  const { t } = useTranslation();

  if (data.length < 2) {
    return (
      <div style={{ color: 'var(--text-secondary, #888)', fontSize: 12, padding: '12px 0' }}>
        {t('pages.analytics.trend_empty')}
      </div>
    );
  }

  const chartWidth = Math.max(600, data.length * 24);

  return (
    <div className="analytics-trend-section">
      <h3
        style={{
          margin: '0 0 12px 0',
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-secondary, #888)',
        }}
      >
        {t('pages.analytics.trend_title')}
      </h3>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <LineChart
          width={chartWidth}
          height={200}
          data={data}
          margin={{ top: 8, right: 16, left: -20, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            tick={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={(props) => (
              <TrendTooltip
                active={props.active}
                payload={props.payload as TooltipEntry[] | undefined}
              />
            )}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={50} stroke="var(--color-border)" strokeDasharray="4 4" />
          <Line
            dataKey="host0Pct"
            name={host0Name}
            stroke={host0Color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Line
            dataKey="host1Pct"
            name={host1Name}
            stroke={host1Color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </div>
    </div>
  );
}
