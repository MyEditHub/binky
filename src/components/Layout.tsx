import { useState } from 'react';
import Sidebar from './Sidebar';
import EpisodesPage from './pages/EpisodesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TopicsPage from './pages/TopicsPage';
import BirdPage from './pages/BirdPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'settings';

export default function Layout() {
  const [activePage, setActivePage] = useState<Page>('episodes');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'episodes':
        return <EpisodesPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'topics':
        return <TopicsPage />;
      case 'bird':
        return <BirdPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <EpisodesPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="content-area">
        <div className="content-scroll">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
