import { useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { extractHostNameCandidates, isHighConfidence } from '../../lib/hostDetection';
import { HostProfile } from '../../hooks/useAnalytics';
import { useTranslation } from 'react-i18next';

interface Props {
  hostProfile: HostProfile;
  onConfirm: (profile: HostProfile) => Promise<void>;
}

export default function HostConfirmation({ hostProfile, onConfirm }: Props) {
  const { t } = useTranslation();
  const [host0Name, setHost0Name] = useState(hostProfile.host0Name);
  const [host1Name, setHost1Name] = useState(hostProfile.host1Name);
  const [host0Color, setHost0Color] = useState(hostProfile.host0Color);
  const [host1Color, setHost1Color] = useState(hostProfile.host1Color);
  const [candidates, setCandidates] = useState<
    Array<{ name: string; count: number; confidence: number }>
  >([]);
  const [autoConfirmed, setAutoConfirmed] = useState(false);

  useEffect(() => {
    // Load transcript text and auto-detect names
    Database.load('sqlite:binky.db')
      .then((db) =>
        db.select<Array<{ full_text: string }>>(`
          SELECT t.full_text FROM transcripts t
          JOIN episodes e ON e.id = t.episode_id
          WHERE e.diarization_status IN ('done', 'solo')
          AND t.full_text IS NOT NULL
          LIMIT 1
        `)
      )
      .then((rows) => {
        if (rows.length > 0 && rows[0].full_text) {
          const detected = extractHostNameCandidates(rows[0].full_text);
          setCandidates(detected);
          if (detected.length >= 2) {
            setHost0Name(detected[0].name);
            setHost1Name(detected[1].name);
          }
          // Auto-confirm if high confidence
          if (isHighConfidence(detected)) {
            const profile: HostProfile = {
              host0Name: detected[0].name,
              host1Name: detected[1].name,
              host0Color: hostProfile.host0Color,
              host1Color: hostProfile.host1Color,
              confirmed: true,
            };
            onConfirm(profile);
            setAutoConfirmed(true);
          }
        }
      })
      .catch(console.error);
  }, []);

  if (autoConfirmed) return null;

  const handleConfirm = () => {
    onConfirm({ host0Name, host1Name, host0Color, host1Color, confirmed: true });
  };

  return (
    <div className="host-confirm-card">
      <h3>{t('pages.analytics.host_confirm_title')}</h3>
      <p>{t('pages.analytics.host_confirm_desc')}</p>
      <div className="host-confirm-row">
        <label>Host 1</label>
        <input
          type="text"
          value={host0Name}
          onChange={(e) => setHost0Name(e.target.value)}
          className="host-settings-name-input"
        />
        <input
          type="color"
          value={host0Color}
          onChange={(e) => setHost0Color(e.target.value)}
          className="host-settings-color-input"
        />
        {candidates[0] && (
          <span className="host-confidence-indicator">{candidates[0].count}x erkannt</span>
        )}
      </div>
      <div className="host-confirm-row">
        <label>Host 2</label>
        <input
          type="text"
          value={host1Name}
          onChange={(e) => setHost1Name(e.target.value)}
          className="host-settings-name-input"
        />
        <input
          type="color"
          value={host1Color}
          onChange={(e) => setHost1Color(e.target.value)}
          className="host-settings-color-input"
        />
        {candidates[1] && (
          <span className="host-confidence-indicator">{candidates[1].count}x erkannt</span>
        )}
      </div>
      <button className="btn-primary" onClick={handleConfirm}>
        {t('pages.analytics.host_confirm_btn')}
      </button>
    </div>
  );
}
