import { useTranslation } from 'react-i18next';
import QueueBadge from './TranscriptionQueue/QueueBadge';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  transcriptionActive?: boolean;
  queueCount?: number;
}

interface NavItem {
  id: Page;
  labelKey: string;
  icon: string;
  disabled: boolean;
  disabledTooltipKey?: string;
}

export default function Sidebar({
  activePage,
  onNavigate,
  isCollapsed,
  onToggle,
  transcriptionActive = false,
  queueCount = 0,
}: SidebarProps) {
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    {
      id: 'episodes',
      labelKey: 'nav.episodes',
      icon: '🎙️',
      disabled: false,
    },
    {
      id: 'analytics',
      labelKey: 'nav.analytics',
      icon: '📊',
      disabled: false,
    },
    {
      id: 'topics',
      labelKey: 'nav.topics',
      icon: '📝',
      disabled: false,
    },
    {
      id: 'bird',
      labelKey: 'nav.bird',
      icon: '🦜',
      disabled: true,
      disabledTooltipKey: 'nav_disabled.bird',
    },
    {
      id: 'settings',
      labelKey: 'nav.settings',
      icon: '⚙️',
      disabled: false,
    },
  ];

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
