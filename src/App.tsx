import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Tutorial from './components/Tutorial';
import { isFirstLaunch } from './lib/settings';
import { checkForUpdates } from './lib/updater';

function App() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);

  useEffect(() => {
    // Check first launch and trigger background update check
    async function init() {
      const firstLaunch = await isFirstLaunch();
      setShowTutorial(firstLaunch);
      setTutorialChecked(true);

      // Non-blocking update check in background
      checkForUpdates().catch((err) => {
        console.warn('Background update check failed (non-fatal):', err);
      });
    }

    init();
  }, []);

  // Don't render until we know whether to show the tutorial
  if (!tutorialChecked) {
    return null;
  }

  return (
    <>
      <Layout />
      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} />
      )}
    </>
  );
}

export default App;
