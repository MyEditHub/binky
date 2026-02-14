interface QueueBadgeProps {
  isActive: boolean;
  count: number;
}

export default function QueueBadge({ isActive, count }: QueueBadgeProps) {
  if (!isActive && count === 0) return null;

  return (
    <span className={`queue-badge${isActive ? ' queue-badge-pulse' : ''}`}>
      {count > 0 ? count : ''}
    </span>
  );
}
