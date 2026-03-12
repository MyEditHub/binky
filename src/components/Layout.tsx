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
import SearchPage from './pages/SearchPage';

type Page = 'episodes' | 'analytics' | 'topics' | 'bird' | 'stats' | 'settings' | 'home' | 'search';

export default function Layout() {
  const [devMode, setDevMode] = useState(false);
  const [activePage, setActivePage] = useState<Page>('bird');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assemblyAIPanelOpen, setAssemblyAIPanelOpen] = useState(false);

  // Transcription state lifted to Layout so Sidebar badge can reflect it
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  // Pending deep-link navigation from Search → EpisodesPage transcript viewer
  const [pendingTranscriptNav, setPendingTranscriptNav] = useState<{
    episodeId: number;
    startMs: number | null;
    title: string;
  } | null>(null);

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
    function handleNavigateTopics() { setActivePage('topics'); }
    function handleNavigateToTranscript(e: Event) {
      const { episodeId, startMs, title } = (e as CustomEvent<{ episodeId: number; startMs: number | null; title: string }>).detail;
      setPendingTranscriptNav({ episodeId, startMs, title });
      setActivePage('episodes');
    }
    function handleNavigateToEpisodeTopics() {
      setActivePage('topics');
    }
    window.addEventListener('navigate-topics', handleNavigateTopics);
    window.addEventListener('navigate-to-transcript', handleNavigateToTranscript);
    window.addEventListener('navigate-to-episode-topics', handleNavigateToEpisodeTopics);
    return () => {
      window.removeEventListener('navigate-topics', handleNavigateTopics);
      window.removeEventListener('navigate-to-transcript', handleNavigateToTranscript);
      window.removeEventListener('navigate-to-episode-topics', handleNavigateToEpisodeTopics);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        setDevMode(prev => {
          const next = !prev;
          setSetting('developer_mode', next ? 'true' : 'false');
          if (!next && ['episodes', 'analytics'].includes(activePageRef.current)) {
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
            // @ts-expect-error Plan 02 adds these props to EpisodesPage
            pendingTranscriptNav={pendingTranscriptNav}
            onTranscriptNavConsumed={() => setPendingTranscriptNav(null)}
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
      case 'search':
        return <SearchPage />;
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
