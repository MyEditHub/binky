import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBirds } from '../../hooks/useBirds';
import BirdCard from '../Birds/BirdCard';
import BirdInfoPanel from '../Birds/BirdInfoPanel';
import BirdHistory from '../Birds/BirdHistory';
import EpisodeDropdown from '../Birds/EpisodeDropdown';

export default function BirdPage() {
  const { t } = useTranslation();
  const {
    currentBird,
    currentBirdMarked,
    history,
    poolStatus,
    loading,
    fetching,
    poolExhausted,
    error,
    drawBird,
    markAsUsed,
    undoMarkUsed,
    resetPool,
    refreshPool,
  } = useBirds();

  const [panelOpen, setPanelOpen] = useState(false);
  const [showEpisodeDropdown, setShowEpisodeDropdown] = useState(false);

  const handleDrawBird = async () => {
    const canDraw = await drawBird();
    if (!canDraw) {
      // currentBird exists and not marked — ask user to confirm
      const confirmed = window.confirm(t('pages.bird.confirm_new_draw'));
      if (confirmed) {
        await drawBird(true); // force draw
        setPanelOpen(false);
      }
    } else {
      // Successful draw — close panel (new bird)
      setPanelOpen(false);
    }
  };

  const handleMarkUsed = async (episodeTitle: string | null) => {
    setShowEpisodeDropdown(false);
    await markAsUsed(episodeTitle);
  };

  return (
    <div className="page bird-page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.bird.title')}</h2>
        <div className="bird-toolbar">
          <button
            className="btn-outline"
            onClick={handleDrawBird}
            disabled={loading || fetching}
          >
            {loading ? t('pages.bird.drawing') : t('pages.bird.draw_new')}
          </button>
          {currentBird && !panelOpen && (
            <button
              className="btn-primary btn-reveal"
              onClick={() => setPanelOpen(true)}
            >
              {t('pages.bird.reveal')}
            </button>
          )}
          {currentBird && (
            <div style={{ position: 'relative' }}>
              {currentBirdMarked ? (
                <button className="btn-outline" onClick={undoMarkUsed}>
                  {t('pages.bird.undo_used')}
                </button>
              ) : (
                <button
                  className="btn-outline"
                  onClick={() => setShowEpisodeDropdown(v => !v)}
                >
                  {t('pages.bird.mark_used')}
                </button>
              )}
              {showEpisodeDropdown && (
                <EpisodeDropdown
                  onSelect={handleMarkUsed}
                  onCancel={() => setShowEpisodeDropdown(false)}
                />
              )}
            </div>
          )}
          <button
            className="btn-outline"
            onClick={refreshPool}
            disabled={fetching}
            title={t('pages.bird.refresh_pool')}
          >
            {fetching ? t('pages.bird.refreshing') : t('pages.bird.refresh_pool')}
          </button>
          {poolStatus && (
            <span className="bird-pool-count">
              {poolStatus.available}/{poolStatus.total}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ padding: '0 20px 8px', color: 'var(--color-text)', fontSize: '0.85rem', opacity: 0.7 }}>
          {error}
        </div>
      )}

      <div className="bird-content">
        <div className="bird-main">
          {poolExhausted ? (
            <div className="bird-pool-exhausted">
              <p>{t('pages.bird.pool_exhausted')}</p>
              <button className="btn-primary" onClick={resetPool}>
                {t('pages.bird.reset')}
              </button>
            </div>
          ) : (
            <BirdCard imageUrl={currentBird?.image_url ?? null} loading={loading || fetching} />
          )}
        </div>
        <BirdInfoPanel
          bird={currentBird}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
      </div>

      <BirdHistory history={history} onReset={resetPool} />
    </div>
  );
}
