import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './Sidebar';
import EpisodesPage from './pages/EpisodesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TopicsPage from './pages/TopicsPage';
import BirdPage from './pages/BirdPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import HomePage from './pages/HomePage';
import AssemblyAIDevPanel from './AssemblyAIDevPanel';
import { getSetting, setSetting } from '../lib/settings';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'stats' | 'settings' | 'home';

export default function Layout() {
  const [devMode, setDevMode] = useState(false);
  const [activePage, setActivePage] = useState<Page>('bird');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assemblyAIPanelOpen, setAssemblyAIPanelOpen] = useState(false);

  // Transcription state lifted to Layout so Sidebar badge can reflect it
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  // Keep a ref to activePage so the keyboard handler doesn't go stale
  const activePageRef = useRef(activePage);
  useEffect(() => { activePageRef.current = activePage; }, [activePage]);

  useEffect(() => {
    getSetting('developer_mode').then(v => {
      const isDev = v === 'true';
      setDevMode(isDev);
      setActivePage(isDev ? 'episodes' : 'home');
    });
  }, []);

  // ⌘⇧D — toggle developer mode (hidden shortcut, not shown in UI)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        setDevMode(prev => {
          const next = !prev;
          setSetting('developer_mode', next ? 'true' : 'false');
          if (!next && ['episodes', 'analytics', 'topics'].includes(activePageRef.current)) {
            setActivePage('home');
          }
          return next;
        });
      }
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        setAssemblyAIPanelOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      case 'home':
        return <HomePage onNavigate={setActivePage} />;
      case 'bird':
        return <BirdPage />;
      case 'stats':
        return <StatsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage onNavigate={setActivePage} />;
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
      {import.meta.env.DEV && (
        <AssemblyAIDevPanel
          open={assemblyAIPanelOpen}
          onClose={() => setAssemblyAIPanelOpen(false)}
        />
      )}
    </div>
  );
}
