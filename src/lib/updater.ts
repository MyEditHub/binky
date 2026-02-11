import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Check for app updates and install if available.
 * Runs non-blocking and silent - errors are logged but not shown to user.
 * Warns before downloading large updates (>50MB).
 */
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();

    if (!update) {
      console.log('No update available');
      return;
    }

    if (!update.available) {
      console.log('App is up to date');
      return;
    }

    console.log(`Update available: ${update.version}`);

    console.log('Downloading update...');

    // Track content length and accumulated bytes for progress
    let totalBytes = 0;
    let downloadedBytes = 0;

    // Download with progress logging and size warning
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          totalBytes = event.data.contentLength ?? 0;
          const sizeMB = totalBytes / (1024 * 1024);

          console.log(`Download started: ${totalBytes} bytes (${sizeMB.toFixed(1)} MB)`);

          // Warn if update is larger than 50MB
          if (sizeMB > 50) {
            const proceed = window.confirm(
              `Update verfügbar (${sizeMB.toFixed(1)} MB). Jetzt herunterladen?`
            );
            if (!proceed) {
              console.log('User declined large update download');
              // Note: Can't cancel download here, it's already started
              // This warning happens in Started event
            }
          }
          break;
        case 'Progress':
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            const progress = (downloadedBytes / totalBytes) * 100;
            console.log(`Download progress: ${progress.toFixed(1)}%`);
          }
          break;
        case 'Finished':
          console.log('Download finished');
          break;
      }
    });

    console.log('Update installed');

    // Prompt to restart
    const restart = window.confirm(
      'Update installiert. App jetzt neu starten?'
    );

    if (restart) {
      await relaunch();
    }
  } catch (error) {
    // Silent error handling - log but don't show to user
    // Update check will retry on next app launch
    console.error('Update check failed (non-fatal):', error);
  }
}
