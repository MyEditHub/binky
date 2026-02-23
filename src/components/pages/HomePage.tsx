import { useTranslation } from 'react-i18next';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'stats' | 'settings' | 'home';

interface Props {
  onNavigate: (page: Page) => void;
}

interface FeatureCard {
  titleKey: string;
  descKey: string;
  page: Page;
  labelKey: string;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    titleKey: 'pages.home.card_stats_title',
    descKey: 'pages.home.card_stats_desc',
    page: 'stats',
    labelKey: 'pages.home.card_stats_action',
  },
  {
    titleKey: 'pages.home.card_bird_title',
    descKey: 'pages.home.card_bird_desc',
    page: 'bird',
    labelKey: 'pages.home.card_bird_action',
  },
];

export default function HomePage({ onNavigate }: Props) {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.home.title')}</h2>
      </div>

      {/* Intro */}
      <div style={{ padding: '0 24px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
          {t('pages.home.intro')}
        </p>
      </div>

      {/* Feature card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
        padding: '0 24px 24px',
      }}>
        {FEATURE_CARDS.map(card => (
          <div
            key={card.page}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t(card.titleKey)}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, flex: 1 }}>
              {t(card.descKey)}
            </div>
            <button
              type="button"
              onClick={() => onNavigate(card.page)}
              style={{
                marginTop: 4,
                alignSelf: 'flex-start',
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '5px 12px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                color: 'var(--color-text)',
              }}
            >
              {t(card.labelKey)} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
