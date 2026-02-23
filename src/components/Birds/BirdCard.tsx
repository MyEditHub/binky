interface BirdCardProps {
  imageUrl: string | null;
  loading: boolean;
  onClick?: () => void;
}

export default function BirdCard({ imageUrl, loading, onClick }: BirdCardProps) {
  if (loading) {
    return (
      <div className="bird-main-area">
        <div className="loading-spinner">...</div>
      </div>
    );
  }
  if (!imageUrl) {
    return (
      <div className="bird-main-area bird-placeholder">
        <div className="bird-placeholder-icon">🦜</div>
        <div>Ziehe einen Vogel!</div>
      </div>
    );
  }
  return (
    <div
      className="bird-main-area"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      title={onClick ? 'Klicken zum Aufdecken' : undefined}
    >
      <img src={imageUrl} alt="Vogel" className="bird-hero-img" />
    </div>
  );
}
