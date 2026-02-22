import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { getSetting, setSetting } from '../../lib/settings';
import ModelManager from '../ModelManager/ModelManager';
import DiarizationModelManager from '../ModelManager/DiarizationModelManager';
import { parseWordGroups, type WordGroup } from './StatsPage';

// ─── OpenAI Settings Section ─────────────────────────────────────────────────

function OpenAISettingsSection() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<boolean>('has_openai_key_configured')
      .then(configured => setIsConfigured(configured))
      .catch(() => setIsConfigured(false));

    getSetting('openai_api_key').then(val => {
      setApiKey(val ?? '');
    });
  }, []);

  async function handleSave() {
    await setSetting('openai_api_key', apiKey);
    setIsConfigured(apiKey.trim().length > 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('pages.settings.openai_title')}</h3>
      <p className="settings-row-desc" style={{ marginBottom: 12 }}>{t('pages.settings.openai_desc')}</p>

      <div className="settings-row">
        <span className="settings-row-label">{t('pages.settings.openai_api_key')}</span>
        <span className="settings-row-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isConfigured !== null && (
            <span
              className={`settings-status-dot ${isConfigured ? 'settings-status-ok' : 'settings-status-error'}`}
            />
          )}
          {isConfigured
            ? t('pages.settings.openai_key_configured')
            : t('pages.settings.openai_key_not_configured')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={t('pages.settings.openai_api_key_placeholder')}
          className="settings-input"
          style={{ flex: 1 }}
        />
        <button className="btn-outline" onClick={handleSave} type="button">
          {t('pages.settings.openai_key_saved')}
        </button>
        {saved && (
          <span className="host-settings-saved">{t('pages.settings.openai_key_saved')}</span>
        )}
      </div>
    </div>
  );
}

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

export default function SettingsPage({ onDevModeChange }: { onDevModeChange?: (v: boolean) => void }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('...');
  const [dbStatus, setDbStatus] = useState<'ok' | 'error' | 'checking'>('checking');
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [variantInputs, setVariantInputs] = useState<Record<number, string>>({});

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

    getSetting('developer_mode').then((val) => {
      setDevMode(val === 'true');
    });

    getSetting('innuendo_words').then((val) => {
      setGroups(parseWordGroups(val));
    });
  }, []);

  async function handleLaunchAtLoginToggle() {
    const next = !launchAtLogin;
    setLaunchAtLogin(next);
    await setSetting('launchAtLogin', next ? 'true' : 'false');
  }

  async function handleDevModeToggle() {
    const next = !devMode;
    setDevMode(next);
    await setSetting('developer_mode', next ? 'true' : 'false');
    onDevModeChange?.(next);
  }

  async function saveGroups(next: WordGroup[]) {
    setGroups(next);
    await setSetting('innuendo_words', JSON.stringify(next));
  }

  async function handleAddGroup() {
    const label = newGroupLabel.trim();
    if (!label || groups.some(g => g.label === label)) return;
    setNewGroupLabel('');
    await saveGroups([...groups, { label, words: [] }]);
  }

  async function handleRemoveGroup(idx: number) {
    await saveGroups(groups.filter((_, i) => i !== idx));
  }

  async function handleAddVariant(groupIdx: number) {
    const word = (variantInputs[groupIdx] ?? '').trim();
    if (!word) return;
    const g = groups[groupIdx];
    if (g.words.includes(word)) return;
    const next = groups.map((gr, i) => i === groupIdx ? { ...gr, words: [...gr.words, word] } : gr);
    setVariantInputs(v => ({ ...v, [groupIdx]: '' }));
    await saveGroups(next);
  }

  async function handleRemoveVariant(groupIdx: number, word: string) {
    const next = groups.map((gr, i) => i === groupIdx ? { ...gr, words: gr.words.filter(w => w !== word) } : gr);
    await saveGroups(next);
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

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('pages.settings.dev_mode')}</div>
            <div className="settings-row-desc">{t('pages.settings.dev_mode_desc')}</div>
          </div>
          <button
            className={`settings-toggle${devMode ? ' settings-toggle-on' : ''}`}
            onClick={handleDevModeToggle}
            aria-pressed={devMode}
            type="button"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </div>
      </div>

      {/* Wort-Tracker */}
      <div className="settings-section">
        <h3 className="settings-section-title">{t('pages.settings.innuendo_title')}</h3>
        <p className="settings-row-desc" style={{ marginBottom: 12 }}>{t('pages.settings.innuendo_desc')}</p>

        {groups.length === 0 && (
          <p className="settings-row-desc" style={{ marginBottom: 12 }}>{t('pages.settings.innuendo_empty')}</p>
        )}

        {groups.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: '0.9rem' }}>{group.label}</strong>
              <button type="button" onClick={() => handleRemoveGroup(gi)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '1rem', padding: '0 2px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {group.words.map(word => (
                <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--color-border)', borderRadius: 12, fontSize: '0.8rem' }}>
                  {word}
                  <button type="button" onClick={() => handleRemoveVariant(gi, word)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, opacity: 0.5, fontSize: '0.9rem' }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={variantInputs[gi] ?? ''}
                onChange={e => setVariantInputs(v => ({ ...v, [gi]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddVariant(gi); }}
                placeholder={t('pages.settings.innuendo_word_placeholder')}
                className="settings-input"
                style={{ flex: 1, fontSize: '0.85rem', padding: '4px 8px' }}
              />
              <button className="btn-outline" onClick={() => handleAddVariant(gi)} type="button" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                {t('pages.settings.innuendo_add_variant')}
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            type="text"
            value={newGroupLabel}
            onChange={e => setNewGroupLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddGroup(); }}
            placeholder={t('pages.settings.innuendo_group_placeholder')}
            className="settings-input"
            style={{ flex: 1 }}
          />
          <button className="btn-outline" onClick={handleAddGroup} type="button">
            {t('pages.settings.innuendo_new_group')}
          </button>
        </div>
      </div>

      {/* Transcription / Model Manager */}
      <ModelManager />

      {/* Diarization Model Manager */}
      <DiarizationModelManager />

      {/* OpenAI Settings */}
      <OpenAISettingsSection />

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
