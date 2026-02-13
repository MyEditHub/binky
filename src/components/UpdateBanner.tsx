import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type BannerState =
  | 'hidden'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'post-update';

interface UpdateBannerProps {
  /** Version to show in the post-update "Jetzt auf vX.Y.Z" banner. Pass undefined to skip post-update mode. */
  postUpdateVersion?: string;
}

export default function UpdateBanner({ postUpdateVersion }: UpdateBannerProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<BannerState>(
    postUpdateVersion ? 'post-update' : 'hidden'
  );
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [pendingUpdate, setPendingUpdate] = useState<Awaited<ReturnType<typeof check>> | null>(null);

  // Auto-dismiss post-update banner after 10 seconds
  useEffect(() => {
    if (state !== 'post-update') return;
    const timer = setTimeout(() => setState('hidden'), 10_000);
    return () => clearTimeout(timer);
  }, [state]);

  // Check for updates on mount (non-blocking)
  useEffect(() => {
    if (postUpdateVersion) return; // Skip check if showing post-update banner

    let cancelled = false;

    async function poll() {
      try {
        const update = await check();
        if (cancelled) return;
        if (update?.available) {
          setUpdateVersion(update.version ?? '');
          setPendingUpdate(update);
          setState('available');
        }
      } catch (err) {
        // Silent – update check failures are non-fatal
        console.warn('UpdateBanner: update check failed (non-fatal):', err);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [postUpdateVersion]);

  async function handleDownload() {
    if (!pendingUpdate) return;
    setState('downloading');
    setDownloadPercent(0);

    let totalBytes = 0;
    let downloadedBytes = 0;

    try {
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              setDownloadPercent(Math.round((downloadedBytes / totalBytes) * 100));
            }
            break;
          case 'Finished':
            setDownloadPercent(100);
            break;
        }
      });
      setState('ready');
    } catch (err) {
      console.error('UpdateBanner: download failed:', err);
      setState('available'); // Fall back to available so user can retry
    }
  }

  async function handleRestart() {
    try {
      await relaunch();
    } catch (err) {
      console.error('UpdateBanner: relaunch failed:', err);
    }
  }

  if (state === 'hidden') return null;

  if (state === 'post-update') {
    return (
      <div className="update-banner">
        <span className="update-banner-text">
          <span className="update-banner-version">
            {t('update.post_update', { version: postUpdateVersion })}
          </span>
        </span>
        <button
          className="update-banner-close"
          onClick={() => setState('hidden')}
          type="button"
          aria-label={t('common.close')}
        >
          ×
        </button>
      </div>
    );
  }

  if (state === 'available') {
    return (
      <div className="update-banner">
        <span className="update-banner-text">
          {t('update.available', { version: updateVersion })}
        </span>
        <button className="update-banner-btn" onClick={handleDownload} type="button">
          {t('update.download')}
        </button>
        <button
          className="update-banner-btn-secondary"
          onClick={() => setState('hidden')}
          type="button"
        >
          {t('update.later')}
        </button>
      </div>
    );
  }

  if (state === 'downloading') {
    return (
      <div className="update-banner">
        <span className="update-banner-text">
          {t('update.downloading', { percent: downloadPercent })}
        </span>
        <div className="update-progress-bar">
          <div className="update-progress-fill" style={{ width: `${downloadPercent}%` }} />
        </div>
      </div>
    );
  }

  // state === 'ready'
  return (
    <div className="update-banner">
      <span className="update-banner-text">{t('update.ready')}</span>
      <button className="update-banner-btn" onClick={handleRestart} type="button">
        {t('update.restart')}
      </button>
      <button
        className="update-banner-btn-secondary"
        onClick={() => setState('hidden')}
        type="button"
      >
        {t('update.restart_later')}
      </button>
    </div>
  );
}
