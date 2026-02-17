import { useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';

interface Episode {
  title: string;
  publish_date: string;
}

interface EpisodeDropdownProps {
  onSelect: (episodeTitle: string | null) => void;
  onCancel: () => void;
}

export default function EpisodeDropdown({ onSelect, onCancel }: EpisodeDropdownProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    Database.load('sqlite:binky.db').then(db =>
      db.select<Episode[]>('SELECT title, publish_date FROM episodes ORDER BY publish_date DESC LIMIT 20')
    ).then(setEpisodes).catch(() => {});
  }, []);

  return (
    <div className="bird-episode-dropdown">
      <button className="bird-episode-option" onClick={() => onSelect(null)}>
        Ohne Episode verknüpfen
      </button>
      {episodes.map(ep => (
        <button
          key={ep.title}
          className="bird-episode-option"
          onClick={() => onSelect(ep.title)}
        >
          {ep.title} <span style={{ opacity: 0.6, fontSize: '0.8em' }}>{ep.publish_date}</span>
        </button>
      ))}
      <button
        className="bird-episode-option"
        onClick={onCancel}
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        Abbrechen
      </button>
    </div>
  );
}
