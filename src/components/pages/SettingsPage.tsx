import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import Database from '@tauri-apps/plugin-sql';
import { getSetting, setSetting } from '../../lib/settings';
import ModelManager from '../ModelManager/ModelManager';
import DiarizationModelManager from '../ModelManager/DiarizationModelManager';

// ─── Host Settings Section ──────────────────────────────────────────────────

function HostSettingsSection() {
  const { t } = useTranslation();
  const [host0Name, setHost0Name] = useState('');
  const [host1Name, setHost1Name] = useState('');
  const [host0Color, setHost0Color] = useState('#d97757');
  const [host1Color, setHost1Color] = useState('#5B8C5A');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      getSetting('host_0_name'),
      getSetting('host_1_name'),
      getSetting('host_0_color'),
      getSetting('host_1_color'),
    ]).then(([n0, n1, c0, c1]) => {
      setHost0Name(n0 ?? 'Sprecher 1');
      setHost1Name(n1 ?? 'Sprecher 2');
      setHost0Color(c0 ?? '#d97757');
      setHost1Color(c1 ?? '#5B8C5A');
    });
  }, []);

  async function handleSave() {
    await Promise.all([
      setSetting('host_0_name', host0Name),
      setSetting('host_1_name', host1Name),
      setSetting('host_0_color', host0Color),
      setSetting('host_1_color', host1Color),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('pages.settings.hosts_title')}</h3>
      <p className="settings-row-desc" style={{ marginBottom: 12 }}>{t('pages.settings.hosts_desc')}</p>

      <div className="host-settings-row">
        <label>{t('pages.settings.host_0_label')}</label>
        <input
          type="text"
          value={host0Name}
          onChange={e => setHost0Name(e.target.value)}
          className="settings-input"
          style={{ flex: 1 }}
        />
        <input
          type="color"
          value={host0Color}
          onChange={e => setHost0Color(e.target.value)}
          style={{ width: 36, height: 28, padding: 2, border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }}
        />
      </div>

      <div className="host-settings-row">
        <label>{t('pages.settings.host_1_label')}</label>
        <input
          type="text"
          value={host1Name}
          onChange={e => setHost1Name(e.target.value)}
          className="settings-input"
          style={{ flex: 1 }}
        />
        <input
          type="color"
          value={host1Color}
          onChange={e => setHost1Color(e.target.value)}
          style={{ width: 36, height: 28, padding: 2, border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
        <button className="btn-outline" onClick={handleSave}>{t('pages.settings.hosts_save')}</button>
        {saved && <span className="host-settings-saved">{t('pages.settings.hosts_saved')}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('...');
  const [dbStatus, setDbStatus] = useState<'ok' | 'error' | 'checking'>('checking');
  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion('?'));

    Database.load('sqlite:binky.db')
      .then(() => setDbStatus('ok'))
      .catch(() => setDbStatus('error'));

    getSetting('launchAtLogin').then((val) => {
      setLaunchAtLogin(val === 'true');
    });
  }, []);

  async function handleLaunchAtLoginToggle() {
    const next = !launchAtLogin;
    setLaunchAtLogin(next);
    await setSetting('launchAtLogin', next ? 'true' : 'false');
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

      {/* Transcription / Model Manager */}
      <ModelManager />

      {/* Diarization Model Manager */}
      <DiarizationModelManager />

      {/* Host Settings */}
      <HostSettingsSection />

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
      </div>
    </div>
  );
}
