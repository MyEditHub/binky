interface Props {
  host0Pct: number;
  host1Pct: number;
  host0Color: string;
  host1Color: string;
  host0Name: string;
  host1Name: string;
  height?: number;
}

export default function SpeakingBalanceBar({
  host0Pct,
  host1Pct,
  host0Color,
  host1Color,
  host0Name,
  host1Name,
  height = 24,
}: Props) {
  return (
    <div className="balance-bar-container">
      <div
        className="balance-bar"
        style={{ height }}
        aria-label={`${host0Name}: ${host0Pct}%, ${host1Name}: ${host1Pct}%`}
      >
        <div
          className="balance-bar-segment"
          style={{ width: `${host0Pct}%`, backgroundColor: host0Color }}
        />
        <div
          className="balance-bar-segment"
          style={{ width: `${host1Pct}%`, backgroundColor: host1Color }}
        />
      </div>
      <div className="balance-bar-labels">
        <span style={{ color: host0Color }}>
          {host0Name}: {host0Pct}%
        </span>
        <span style={{ color: host1Color }}>
          {host1Name}: {host1Pct}%
        </span>
      </div>
    </div>
  );
}
