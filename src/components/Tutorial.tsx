import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { markFirstLaunchComplete, setSetting } from '../lib/settings';

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  const { t } = useTranslation();
  const [screen, setScreen] = useState(0);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  const TOTAL_SCREENS = 4;

  const handleFinish = useCallback(async () => {
    await markFirstLaunchComplete();
    await setSetting('launchAtLogin', launchAtLogin ? 'true' : 'false');
    onClose();
  }, [launchAtLogin, onClose]);

  const handleNext = useCallback(() => {
    if (screen < TOTAL_SCREENS - 1) {
      setScreen((s) => s + 1);
    } else {
      void handleFinish();
    }
  }, [screen, handleFinish]);

  const handleSkip = useCallback(async () => {
    await markFirstLaunchComplete();
    onClose();
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') void handleSkip();
      else if (e.key === 'Enter') handleNext();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handleSkip]);

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">

        {screen === 0 && (
          <div className="tutorial-screen">
            <div className="tutorial-icon">🎙️</div>
            <h2 className="tutorial-title">{t('tutorial.welcome_title')}</h2>
            <p className="tutorial-text">{t('tutorial.welcome_text')}</p>
          </div>
        )}

        {screen === 1 && (
          <div className="tutorial-screen">
            <div className="tutorial-icon">🐦</div>
            <h2 className="tutorial-title">{t('tutorial.bird_title')}</h2>
            <p className="tutorial-text">{t('tutorial.bird_text')}</p>
          </div>
        )}

        {screen === 2 && (
          <div className="tutorial-screen">
            <div className="tutorial-icon">📊</div>
            <h2 className="tutorial-title">{t('tutorial.tracker_title')}</h2>
            <p className="tutorial-text">{t('tutorial.tracker_text')}</p>
          </div>
        )}

        {screen === 3 && (
          <div className="tutorial-screen">
            <div className="tutorial-icon">⚙️</div>
            <h2 className="tutorial-title">{t('tutorial.setup_title')}</h2>
            <div className="tutorial-setting-row">
              <span className="tutorial-setting-label">{t('tutorial.launch_at_login')}</span>
              <button
                className={`tutorial-toggle${launchAtLogin ? ' tutorial-toggle-on' : ''}`}
                onClick={() => setLaunchAtLogin((v) => !v)}
                aria-pressed={launchAtLogin}
                type="button"
              >
                <span className="tutorial-toggle-thumb" />
              </button>
            </div>
          </div>
        )}

        <div className="tutorial-dots">
          {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
            <span key={i} className={`tutorial-dot${i === screen ? ' tutorial-dot-active' : ''}`} />
          ))}
        </div>

        <div className="tutorial-actions">
          <button className="tutorial-btn-skip" onClick={() => void handleSkip()} type="button">
            {t('tutorial.skip')}
          </button>
          <button className="tutorial-btn-next" onClick={handleNext} type="button">
            {screen === TOTAL_SCREENS - 1 ? t('tutorial.start') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
