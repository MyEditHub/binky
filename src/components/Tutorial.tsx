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

  const TOTAL_SCREENS = 3;

  const handleFinish = useCallback(async () => {
    await markFirstLaunchComplete();
    await setSetting('launchAtLogin', launchAtLogin ? 'true' : 'false');
    onClose();
  }, [launchAtLogin, onClose]);

  const handleNext = useCallback(() => {
    if (screen < TOTAL_SCREENS - 1) {
      setScreen((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [screen, handleFinish]);

  const handleSkip = useCallback(async () => {
    await markFirstLaunchComplete();
    onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'Enter') {
        handleNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handleSkip]);

  const phases = [
    { label: t('tutorial.phase1'), desc: t('tutorial.phase1_desc'), current: true },
    { label: t('tutorial.phase2'), desc: t('tutorial.phase2_desc'), current: false },
    { label: t('tutorial.phase3'), desc: t('tutorial.phase3_desc'), current: false },
    { label: t('tutorial.phase4'), desc: t('tutorial.phase4_desc'), current: false },
    { label: t('tutorial.phase5'), desc: t('tutorial.phase5_desc'), current: false },
  ];

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        {/* Screen 1: Welcome */}
        {screen === 0 && (
          <div className="tutorial-screen">
            <div className="tutorial-icon">🎙️</div>
            <h2 className="tutorial-title">{t('tutorial.welcome_title')}</h2>
            <p className="tutorial-text">{t('tutorial.welcome_text')}</p>
            <div className="tutorial-feature-list">
              <div className="tutorial-feature">📅 {t('tutorial.phase2')}</div>
              <div className="tutorial-feature">📊 {t('tutorial.phase3')}</div>
              <div className="tutorial-feature">📋 {t('tutorial.phase4')}</div>
              <div className="tutorial-feature">🐦 {t('tutorial.phase5')}</div>
            </div>
          </div>
        )}

        {/* Screen 2: What's coming */}
        {screen === 1 && (
          <div className="tutorial-screen">
            <h2 className="tutorial-title">{t('tutorial.features_title')}</h2>
            <div className="tutorial-phases">
              {phases.map((phase, i) => (
                <div key={i} className={`tutorial-phase-row${phase.current ? ' tutorial-phase-current' : ''}`}>
                  <div className="tutorial-phase-number">{i + 1}</div>
                  <div className="tutorial-phase-info">
                    <span className="tutorial-phase-label">{phase.label}</span>
                    {phase.current && (
                      <span className="tutorial-phase-badge">{t('tutorial.current_phase')}</span>
                    )}
                    <span className="tutorial-phase-desc">{phase.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screen 3: Settings */}
        {screen === 2 && (
          <div className="tutorial-screen">
            <div className="tutorial-icon">⚙️</div>
            <h2 className="tutorial-title">{t('tutorial.settings_title')}</h2>
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

        {/* Progress dots */}
        <div className="tutorial-dots">
          {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
            <span key={i} className={`tutorial-dot${i === screen ? ' tutorial-dot-active' : ''}`} />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="tutorial-actions">
          <button className="tutorial-btn-skip" onClick={handleSkip} type="button">
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
