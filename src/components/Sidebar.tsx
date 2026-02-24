import { useTranslation } from 'react-i18next';
import QueueBadge from './TranscriptionQueue/QueueBadge';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'stats' | 'settings' | 'home';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  transcriptionActive?: boolean;
  queueCount?: number;
  devMode?: boolean;
}

interface NavItem {
  id: Page;
  labelKey: string;
  collapsedLabel: string;
  disabled: boolean;
  devOnly?: boolean;
  disabledTooltipKey?: string;
}

export default function Sidebar({
  activePage,
  onNavigate,
  isCollapsed,
  onToggle,
  transcriptionActive = false,
  queueCount = 0,
  devMode = false,
}: SidebarProps) {
  const { t } = useTranslation();

  const allNavItems: NavItem[] = [
    {
      id: 'home',
      labelKey: 'nav.home',
      collapsedLabel: 'Ho',
      disabled: false,
    },
    {
      id: 'bird',
      labelKey: 'nav.bird',
      collapsedLabel: 'Vo',
      disabled: false,
    },
    {
      id: 'stats',
      labelKey: 'nav.stats',
      collapsedLabel: 'St',
      disabled: false,
      devOnly: false,
    },
    {
      id: 'episodes',
      labelKey: 'nav.episodes',
      collapsedLabel: 'Ep',
      disabled: false,
      devOnly: true,
    },
    {
      id: 'analytics',
      labelKey: 'nav.analytics',
      collapsedLabel: 'An',
      disabled: false,
      devOnly: true,
    },
    {
      id: 'topics',
      labelKey: 'nav.topics',
      collapsedLabel: 'Th',
      disabled: false,
      devOnly: true,
    },
    {
      id: 'settings',
      labelKey: 'nav.settings',
      collapsedLabel: 'Ei',
      disabled: false,
    },
  ];

  const navItems = allNavItems.filter(item => devMode || !item.devOnly);

  const handleClick = (item: NavItem) => {
    if (!item.disabled) {
      onNavigate(item.id);
    }
  };

  return (
    <div className={`sidebar${isCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && <h1 className="sidebar-title">{t('app.title')}</h1>}
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={isCollapsed ? 'Menü öffnen' : 'Menü schließen'}
          type="button"
        >
          {isCollapsed ? '›' : '‹'}
        </button>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'nav-item-active' : ''} ${
              item.disabled ? 'nav-item-disabled' : ''
            } ${isCollapsed ? 'nav-item-collapsed' : ''}`}
            onClick={() => handleClick(item)}
            title={
              isCollapsed
                ? t(item.labelKey)
                : item.disabled && item.disabledTooltipKey
                ? t(item.disabledTooltipKey)
                : undefined
            }
            disabled={item.disabled}
          >
            {!isCollapsed && <span className="nav-item-label">{t(item.labelKey)}</span>}
            {isCollapsed && <span className="nav-item-label nav-item-label-collapsed">{item.collapsedLabel}</span>}
            {item.id === 'episodes' && (transcriptionActive || queueCount > 0) && (
              <QueueBadge isActive={transcriptionActive} count={queueCount} />
            )}
            {item.id === 'settings' && devMode && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', marginLeft: 'auto', flexShrink: 0 }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
