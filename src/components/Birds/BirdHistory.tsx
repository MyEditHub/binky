import { useState } from 'react';
import Database from '@tauri-apps/plugin-sql';
import type { UsedBirdEntry } from '../../hooks/useBirds';

interface BirdHistoryProps {
  history: UsedBirdEntry[];
  onReset: () => void;
  onRefresh: () => void;
}

export default function BirdHistory({ history, onReset, onRefresh }: BirdHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEpisode, setManualEpisode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);

  const handleReset = () => {
    if (window.confirm('Alle Vögel als unbenutzt markieren und Verlauf löschen?')) {
      onReset();
    }
  };

  async function handleManualAdd() {
    const name = manualName.trim();
    if (!name) return;
    setManualError(null);
    setManualLoading(true);
    try {
      const db = await Database.load('sqlite:binky.db');
      const rows = await db.select<{ id: number; nabu_url: string }[]>(
        'SELECT id, nabu_url FROM birds WHERE name = ?',
        [name]
      );
      if (rows.length === 0) {
        setManualError(`„${name}" nicht in Datenbank — zuerst über den Randomizer laden`);
        return;
      }
      const { id, nabu_url } = rows[0];
      await db.execute(
        "UPDATE birds SET used = 1, used_date = date('now') WHERE id = ?",
        [id]
      );
      await db.execute(
        "INSERT INTO bird_used_history (bird_id, bird_name_de, bird_nabu_url, episode_title, used_date) VALUES (?, ?, ?, ?, date('now'))",
        [id, name, nabu_url, manualEpisode.trim() || null]
      );
      setManualName('');
      setManualEpisode('');
      onRefresh();
    } catch (e) {
      setManualError(String(e));
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="bird-history">
      <div className="bird-history-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>Verlauf ({history.length} Vögel)</h3>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </div>
      {isExpanded && (
        <div className="bird-history-list">
          {history.length === 0 ? (
            <div className="bird-history-empty">Noch keine Vögel verwendet.</div>
          ) : (
            history.map(entry => (
              <div key={entry.id} className="bird-history-entry">
                <span className="bird-history-entry-name">{entry.bird_name_de}</span>
                {entry.episode_title && (
                  <span className="bird-history-entry-episode">{entry.episode_title}</span>
                )}
                <span className="bird-history-entry-date">{entry.used_date}</span>
              </div>
            ))
          )}

          {/* Manual add */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: 6, opacity: 0.7 }}>
              Vogel manuell als benutzt erfassen
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={manualName}
                onChange={e => { setManualName(e.target.value); setManualError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') void handleManualAdd(); }}
                placeholder="Vogelname (Deutsch)"
                className="settings-input"
                style={{ flex: '1 1 140px', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                value={manualEpisode}
                onChange={e => setManualEpisode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleManualAdd(); }}
                placeholder="Folge (optional)"
                className="settings-input"
                style={{ flex: '1 1 120px', fontSize: '0.85rem' }}
              />
              <button
                className="btn-outline"
                onClick={() => void handleManualAdd()}
                disabled={manualLoading || !manualName.trim()}
                type="button"
                style={{ fontSize: '0.85rem' }}
              >
                {manualLoading ? '…' : 'Erfassen'}
              </button>
            </div>
            {manualError && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: 4 }}>
                {manualError}
              </div>
            )}
          </div>

          <button className="btn-outline" onClick={handleReset} style={{ marginTop: 12 }}>
            Alle zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
