interface BirdCardProps {
  imageUrl: string | null;
  loading: boolean;
}

export default function BirdCard({ imageUrl, loading }: BirdCardProps) {
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
    <div className="bird-main-area">
      <img src={imageUrl} alt="Vogel" className="bird-hero-img" />
    </div>
  );
}
