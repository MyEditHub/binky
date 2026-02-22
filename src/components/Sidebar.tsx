import { useTranslation } from 'react-i18next';
import QueueBadge from './TranscriptionQueue/QueueBadge';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'stats' | 'settings';

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
  icon: string;
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
      id: 'bird',
      labelKey: 'nav.bird',
      icon: '🦜',
      disabled: false,
    },
    {
      id: 'stats',
      labelKey: 'nav.stats',
      icon: '📊',
      disabled: false,
      devOnly: false,
    },
    {
      id: 'episodes',
      labelKey: 'nav.episodes',
      icon: '🎙️',
      disabled: false,
      devOnly: true,
    },
    {
      id: 'analytics',
      labelKey: 'nav.analytics',
      icon: '📈',
      disabled: false,
      devOnly: true,
    },
    {
      id: 'topics',
      labelKey: 'nav.topics',
      icon: '📝',
      disabled: false,
      devOnly: true,
    },
    {
      id: 'settings',
      labelKey: 'nav.settings',
      icon: '⚙️',
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
            <span className="nav-item-icon">{item.icon}</span>
            {!isCollapsed && <span>{t(item.labelKey)}</span>}
            {item.id === 'episodes' && (transcriptionActive || queueCount > 0) && (
              <QueueBadge isActive={transcriptionActive} count={queueCount} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
