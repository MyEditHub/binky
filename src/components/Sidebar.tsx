import { useTranslation } from 'react-i18next';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  id: Page;
  labelKey: string;
  icon: string;
  disabled: boolean;
  disabledTooltipKey?: string;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
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
      disabled: true,
      disabledTooltipKey: 'nav_disabled.analytics',
    },
    {
      id: 'topics',
      labelKey: 'nav.topics',
      icon: '📝',
      disabled: true,
      disabledTooltipKey: 'nav_disabled.topics',
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
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">{t('app.title')}</h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'nav-item-active' : ''} ${
              item.disabled ? 'nav-item-disabled' : ''
            }`}
            onClick={() => handleClick(item)}
            title={item.disabled && item.disabledTooltipKey ? t(item.disabledTooltipKey) : undefined}
            disabled={item.disabled}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
