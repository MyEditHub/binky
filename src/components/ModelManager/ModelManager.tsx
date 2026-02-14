import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModelManager } from '../../hooks/useModelManager';

interface WhisperModel {
  name: string;
  sizeLabel: string;
  descKey: string;
  recommended?: boolean;
  memoryWarning?: boolean;
}

const WHISPER_MODELS: WhisperModel[] = [
  { name: 'tiny', sizeLabel: '75 MB', descKey: 'model_tiny_desc' },
  { name: 'base', sizeLabel: '142 MB', descKey: 'model_base_desc' },
  {
    name: 'small',
    sizeLabel: '466 MB',
    descKey: 'model_small_desc',
    recommended: true,
  },
  { name: 'medium', sizeLabel: '1,5 GB', descKey: 'model_medium_desc' },
  {
    name: 'large-v3',
    sizeLabel: '2,9 GB',
    descKey: 'model_large_desc',
    memoryWarning: true,
  },
  {
    name: 'large-v3-turbo',
    sizeLabel: '1,5 GB',
    descKey: 'model_turbo_desc',
  },
];

const LANGUAGE_OPTIONS = [{ value: 'de', label: 'Deutsch (de)' }];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export default function ModelManager() {
  const { t } = useTranslation();
  const {
    currentModel,
    modelSize,
    downloading,
    downloadProgress,
    loading,
    error,
    downloadModel,
    deleteModel,
  } = useModelManager();

  const [selectedModel, setSelectedModel] = useState('small');
  const [language, setLanguage] = useState('de');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  function handleDownloadClick() {
    if (currentModel && currentModel !== selectedModel) {
      setConfirmReplace(true);
    } else {
      void downloadModel(selectedModel);
    }
  }

  function handleConfirmReplace() {
    setConfirmReplace(false);
    void downloadModel(selectedModel);
  }

  function handleDeleteClick() {
    setConfirmDelete(true);
  }

  function handleConfirmDelete() {
    setConfirmDelete(false);
    void deleteModel();
  }

  const selectedModelInfo = WHISPER_MODELS.find((m) => m.name === selectedModel);

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">
        {t('pages.settings.transcription')}
      </h3>

      {/* Current model status */}
      {loading ? (
        <div className="settings-row">
          <span className="settings-row-label">
            {t('pages.settings.model_label')}
          </span>
          <span className="settings-row-value">{t('common.loading')}</span>
        </div>
      ) : currentModel ? (
        <div className="settings-row">
          <span className="settings-row-label">
            {t('pages.settings.model_label')}
          </span>
          <span className="model-current-badge">
            <span className="model-checkmark">✓</span>{' '}
            {t('pages.settings.model_current', {
              model: currentModel,
              size: modelSize ? formatBytes(modelSize) : '',
            })}
          </span>
        </div>
      ) : (
        <div className="settings-row">
          <span className="settings-row-label">
            {t('pages.settings.model_label')}
          </span>
          <span className="settings-row-value model-none">
            {t('pages.settings.model_none')}
          </span>
        </div>
      )}

      {/* Model selection cards */}
      <div className="model-manager">
        <div className="model-list">
          {WHISPER_MODELS.map((model) => (
            <button
              key={model.name}
              type="button"
              className={`model-card${selectedModel === model.name ? ' model-card-selected' : ''}${model.recommended ? ' model-card-recommended' : ''}`}
              onClick={() => setSelectedModel(model.name)}
              disabled={downloading}
            >
              <div className="model-card-header">
                <span className="model-card-name">{model.name}</span>
                <span className="model-card-size">{model.sizeLabel}</span>
                {model.recommended && (
                  <span className="model-badge-recommended">
                    {t('pages.settings.model_recommended')}
                  </span>
                )}
                {currentModel === model.name && (
                  <span className="model-badge-downloaded">✓</span>
                )}
              </div>
              <div className="model-card-desc">
                {t(`pages.settings.${model.descKey}`)}
              </div>
            </button>
          ))}
        </div>

        {/* Memory warning for large-v3 */}
        {selectedModelInfo?.memoryWarning && (
          <div className="model-warning">
            {t('pages.settings.model_memory_warning')}
          </div>
        )}

        {/* Confirm replace dialog */}
        {confirmReplace && (
          <div className="model-confirm-box">
            <p>{t('pages.settings.model_replace_warning')}</p>
            <div className="model-confirm-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmReplace}
              >
                {t('pages.settings.model_download')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmReplace(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Confirm delete dialog */}
        {confirmDelete && (
          <div className="model-confirm-box model-confirm-danger">
            <p>{t('pages.settings.model_delete_confirm')}</p>
            <div className="model-confirm-actions">
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
              >
                {t('pages.settings.model_delete')}
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
              {t('pages.settings.model_downloading', {
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
        {!confirmReplace && !confirmDelete && (
          <div className="model-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleDownloadClick}
              disabled={downloading || loading}
            >
              {downloading
                ? t('pages.settings.model_downloading', {
                    percent: downloadProgress,
                  })
                : t('pages.settings.model_download')}
            </button>
            {currentModel && !downloading && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteClick}
              >
                {t('pages.settings.model_delete')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Language selection */}
      <div className="settings-row">
        <span className="settings-row-label">
          {t('pages.settings.language_label')}
        </span>
        <select
          className="model-language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
