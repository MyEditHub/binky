import { useState, useCallback } from 'react';
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

  // Transcription state lifted to Layout so Sidebar badge can reflect it
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

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
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <EpisodesPage
            onTranscriptionStateChange={handleTranscriptionStateChange}
          />
        );
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
      />
      <div className="content-area">
        <div className="content-scroll">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
