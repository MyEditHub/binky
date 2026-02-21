import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import Layout from './components/Layout';
import Tutorial from './components/Tutorial';
import UpdateBanner from './components/UpdateBanner';
import { isFirstLaunch, getSetting, setSetting } from './lib/settings';

function App() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [postUpdateVersion, setPostUpdateVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function init() {
      // Check first launch
      const firstLaunch = await isFirstLaunch();
      setShowTutorial(firstLaunch);

      // Detect post-update: compare stored version to current version
      try {
        const currentVersion = await getVersion();
        const lastKnownVersion = await getSetting('lastKnownVersion');

        if (lastKnownVersion && lastKnownVersion !== currentVersion) {
          // Version changed since last launch — show post-update banner
          setPostUpdateVersion(currentVersion);
        }

        // Always update the stored version
        await setSetting('lastKnownVersion', currentVersion);
      } catch (err) {
        console.warn('Post-update detection failed (non-fatal):', err);
      }

      setTutorialChecked(true);
    }

    init();
  }, []);

  // Don't render until we know whether to show the tutorial
  if (!tutorialChecked) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <UpdateBanner postUpdateVersion={postUpdateVersion} />
      <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        <Layout />
      </div>
      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} />
      )}
    </div>
  );
}

export default App;
