import React from 'react';

interface SpeakerBlockProps {
  displayName: string;
  color: string;
  children: React.ReactNode;
}

export default function SpeakerBlock({
  displayName,
  color,
  children,
}: SpeakerBlockProps) {
  return (
    <div
      className="speaker-block"
      style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: 'solid' }}
    >
      <div className="speaker-block-label" style={{ color }}>
        {displayName}
      </div>
      <p className="speaker-block-text">
        {children}
      </p>
    </div>
  );
}
