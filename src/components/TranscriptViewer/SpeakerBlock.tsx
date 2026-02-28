import React from 'react';

interface SpeakerBlockProps {
  displayName: string;
  color: string;
  text: string;
  searchQuery?: string;
  isActiveMatch?: (globalIdx: number) => boolean;
  matchOffset?: number;
}

/** Split text into segments: plain text and highlighted matches. */
function highlightText(
  text: string,
  query: string,
  isActive: (globalIdx: number) => boolean,
  offset: number,
): React.ReactNode {
  if (!query) {
    return <>{text}</>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let idx = 0;
  let matchIdx = offset;

  while (idx < text.length) {
    const found = lowerText.indexOf(lowerQuery, idx);
    if (found === -1) {
      parts.push(text.slice(idx));
      break;
    }
    if (found > idx) {
      parts.push(text.slice(idx, found));
    }
    const active = isActive(matchIdx);
    parts.push(
      <mark
        key={matchIdx}
        className={`transcript-highlight${active ? ' transcript-highlight-active' : ''}`}
        data-match-index={matchIdx}
      >
        {text.slice(found, found + query.length)}
      </mark>,
    );
    matchIdx++;
    idx = found + query.length;
  }

  return <>{parts}</>;
}

export default function SpeakerBlock({
  displayName,
  color,
  text,
  searchQuery,
  isActiveMatch,
  matchOffset = 0,
}: SpeakerBlockProps) {
  const activeMatchFn = isActiveMatch ?? (() => false);

  return (
    <div
      className="speaker-block"
      style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: 'solid' }}
    >
      <div className="speaker-block-label" style={{ color }}>
        {displayName}
      </div>
      <p className="speaker-block-text">
        {searchQuery
          ? highlightText(text, searchQuery, activeMatchFn, matchOffset)
          : text}
      </p>
    </div>
  );
}
