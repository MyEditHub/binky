import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import Database from '@tauri-apps/plugin-sql';
import { getSetting, setSetting } from '../../lib/settings';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('...');
  const [dbStatus, setDbStatus] = useState<'ok' | 'error' | 'checking'>('checking');
  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  useEffect(() => {
    // Load app version
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion('?'));

    // Check database connection
    Database.load('sqlite:binky.db')
      .then(() => setDbStatus('ok'))
      .catch(() => setDbStatus('error'));

    // Load launch-at-login preference
    getSetting('launchAtLogin').then((val) => {
      setLaunchAtLogin(val === 'true');
    });
  }, []);

  async function handleLaunchAtLoginToggle() {
    const next = !launchAtLogin;
    setLaunchAtLogin(next);
    await setSetting('launchAtLogin', next ? 'true' : 'false');
  }

  async function handleOpenWebsite() {
    try {
      await openUrl('https://www.nettgefluester.de');
    } catch (err) {
      console.warn('Could not open website:', err);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.settings.title')}</h2>
      </div>

      {/* App Information */}
      <div className="settings-section">
        <h3 className="settings-section-title">{t('pages.settings.app_info')}</h3>

        <div className="settings-row">
          <span className="settings-row-label">{t('pages.settings.version_label')}</span>
          <span className="settings-row-value">v{version}</span>
        </div>

        <div className="settings-row">
          <span className="settings-row-label">{t('pages.settings.database_label')}</span>
          <span className="settings-row-value">
            {dbStatus === 'checking' && t('common.loading')}
            {dbStatus === 'ok' && (
              <>
                <span className="settings-status-dot settings-status-ok" />
                {t('pages.settings.database_connected')}
              </>
            )}
            {dbStatus === 'error' && (
              <>
                <span className="settings-status-dot settings-status-error" />
                {t('pages.settings.database_error')}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Preferences */}
      <div className="settings-section">
        <h3 className="settings-section-title">{t('pages.settings.preferences')}</h3>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('pages.settings.launch_at_login')}</div>
            <div className="settings-row-desc">{t('pages.settings.launch_at_login_desc')}</div>
          </div>
          <button
            className={`settings-toggle${launchAtLogin ? ' settings-toggle-on' : ''}`}
            onClick={handleLaunchAtLoginToggle}
            aria-pressed={launchAtLogin}
            type="button"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </div>
      </div>

      {/* About */}
      <div className="settings-section">
        <h3 className="settings-section-title">{t('pages.settings.about')}</h3>

        <div className="settings-row">
          <span className="settings-row-label">{t('app.title')}</span>
          <span className="settings-row-value">v{version}</span>
        </div>

        <div className="settings-row">
          <span className="settings-row-label settings-about-desc">
            {t('pages.settings.about_desc')}
          </span>
        </div>

        <div className="settings-row">
          <button
            className="settings-link-btn"
            onClick={handleOpenWebsite}
            type="button"
          >
            {t('pages.settings.open_website')} ↗
          </button>
        </div>
      </div>
    </div>
  );
}
