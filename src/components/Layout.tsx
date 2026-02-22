import { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import EpisodesPage from './pages/EpisodesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TopicsPage from './pages/TopicsPage';
import BirdPage from './pages/BirdPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import { getSetting } from '../lib/settings';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'stats' | 'settings';

export default function Layout() {
  const [devMode, setDevMode] = useState(false);
  const [activePage, setActivePage] = useState<Page>('bird');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Transcription state lifted to Layout so Sidebar badge can reflect it
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    getSetting('developer_mode').then(v => {
      const isDev = v === 'true';
      setDevMode(isDev);
      // Default landing page depends on mode
      setActivePage(isDev ? 'episodes' : 'bird');
    });
  }, []);

  const handleDevModeChange = useCallback((next: boolean) => {
    setDevMode(next);
    // When switching to host mode, redirect away from dev-only pages
    if (!next && (activePage === 'episodes' || activePage === 'analytics' || activePage === 'topics')) {
      setActivePage('bird');
    }
  }, [activePage]);

  const handleTranscriptionStateChange = useCallback(
    (isProcessing: boolean, count: number) => {
      setTranscriptionActive(isProcessing);
      setQueueCount(count);
    },
    []
  );

  const renderPage = () => {
    switch (activePage) {
      case 'episodes':
        return (
          <EpisodesPage
            onTranscriptionStateChange={handleTranscriptionStateChange}
          />
        );
      case 'analytics':
        return <AnalyticsPage />;
      case 'topics':
        return <TopicsPage />;
      case 'bird':
        return <BirdPage />;
      case 'stats':
        return <StatsPage />;
      case 'settings':
        return <SettingsPage onDevModeChange={handleDevModeChange} />;
      default:
        return <BirdPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        transcriptionActive={transcriptionActive}
        queueCount={queueCount}
        devMode={devMode}
      />
      <div className="content-area">
        <div className="content-scroll">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
