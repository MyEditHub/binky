import { useState } from 'react';
import type { UsedBirdEntry } from '../../hooks/useBirds';

interface BirdHistoryProps {
  history: UsedBirdEntry[];
  onReset: () => void;
}

export default function BirdHistory({ history, onReset }: BirdHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReset = () => {
    if (window.confirm('Alle Vögel als unbenutzt markieren und Verlauf löschen?')) {
      onReset();
    }
  };

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
          {history.length > 0 && (
            <button className="btn-outline" onClick={handleReset} style={{ marginTop: 8 }}>
              Alle zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
