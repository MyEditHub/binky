import DOMPurify from 'dompurify';
import type { BirdProfile } from '../../hooks/useBirds';

interface BirdInfoPanelProps {
  bird: BirdProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BirdInfoPanel({ bird, isOpen, onClose }: BirdInfoPanelProps) {
  return (
    <div className={`bird-info-panel${isOpen ? ' bird-info-panel-open' : ''}`}>
      <button className="bird-panel-close" onClick={onClose}>✕</button>
      {bird && (
        <>
          <h2 className="bird-panel-name">{bird.name_de}</h2>
          {bird.name_sci && <p className="bird-panel-sci">{bird.name_sci}</p>}
          {bird.content_html && (
            <div
              className="bird-profile-content"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(bird.content_html, {
                  ALLOWED_TAGS: ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
                  ALLOWED_ATTR: [],
                }) as string,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
