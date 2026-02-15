import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiarizationModel } from '../../hooks/useDiarizationModel';

export default function DiarizationModelManager() {
  const { t } = useTranslation();
  const {
    segmentationDownloaded,
    embeddingDownloaded,
    allDownloaded,
    downloading,
    downloadProgress,
    loading,
    error,
    downloadModels,
    deleteModels,
  } = useDiarizationModel();

  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDownloadClick() {
    void downloadModels();
  }

  function handleDeleteClick() {
    setConfirmDelete(true);
  }

  function handleConfirmDelete() {
    setConfirmDelete(false);
    void deleteModels();
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">
        {t('pages.settings.diarization_models')}
      </h3>

      <div className="settings-row">
        <span className="settings-row-label">
          {t('pages.settings.diarization_desc')}
        </span>
      </div>

      {/* Model status rows */}
      {loading ? (
        <div className="settings-row">
          <span className="settings-row-value">{t('common.loading')}</span>
        </div>
      ) : (
        <>
          <div className="settings-row">
            <span className="settings-row-label">
              {t('pages.settings.diarization_segmentation')}
            </span>
            <span
              className={
                segmentationDownloaded
                  ? 'model-current-badge'
                  : 'settings-row-value model-none'
              }
            >
              {segmentationDownloaded ? (
                <>
                  <span className="model-checkmark">✓</span>{' '}
                  {t('pages.settings.diarization_downloaded')}
                </>
              ) : (
                t('pages.settings.diarization_not_downloaded')
              )}
            </span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">
              {t('pages.settings.diarization_embedding')}
            </span>
            <span
              className={
                embeddingDownloaded
                  ? 'model-current-badge'
                  : 'settings-row-value model-none'
              }
            >
              {embeddingDownloaded ? (
                <>
                  <span className="model-checkmark">✓</span>{' '}
                  {t('pages.settings.diarization_downloaded')}
                </>
              ) : (
                t('pages.settings.diarization_not_downloaded')
              )}
            </span>
          </div>
        </>
      )}

      <div className="model-manager">
        {/* Size info */}
        <div className="settings-row">
          <span className="settings-row-label" style={{ color: 'var(--text-muted, #888)', fontSize: '0.85em' }}>
            {t('pages.settings.diarization_size_info')}
          </span>
        </div>

        {/* Confirm delete dialog */}
        {confirmDelete && (
          <div className="model-confirm-box model-confirm-danger">
            <p>{t('pages.settings.diarization_delete_confirm')}</p>
            <div className="model-confirm-actions">
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
              >
                {t('pages.settings.diarization_delete')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmDelete(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Download progress */}
        {downloading && (
          <div className="model-progress-container">
            <div className="model-progress-label">
              {t('pages.settings.diarization_downloading', {
                percent: downloadProgress,
              })}
            </div>
            <div className="model-progress-bar">
              <div
                className="model-progress-fill"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {error && <div className="model-error">{error}</div>}

        {/* Action buttons */}
        {!confirmDelete && (
          <div className="model-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleDownloadClick}
              disabled={downloading || loading || allDownloaded}
            >
              {downloading
                ? t('pages.settings.diarization_downloading', {
                    percent: downloadProgress,
                  })
                : t('pages.settings.diarization_download')}
            </button>
            {(segmentationDownloaded || embeddingDownloaded) && !downloading && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteClick}
              >
                {t('pages.settings.diarization_delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
