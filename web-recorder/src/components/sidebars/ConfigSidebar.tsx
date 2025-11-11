import { AIModel, AnalysisMode, StorageType, AppMode } from '../../types';
import type { RecordingConfig, AppMode as AppModeType } from '../../types';

interface ConfigSidebarProps {
  config: RecordingConfig;
  onChange: (config: RecordingConfig) => void;
  disabled?: boolean;
  appMode: AppModeType;
  onAppModeChange: (mode: AppModeType) => void;
}

export function ConfigSidebar({
  config,
  onChange,
  disabled = false,
  appMode,
  onAppModeChange
}: ConfigSidebarProps) {
  const handleAIModelChange = (model: AIModel) => {
    onChange({ ...config, aiModel: model });
  };

  const handleAnalysisModeChange = (mode: AnalysisMode) => {
    onChange({ ...config, analysisMode: mode });
  };

  const handleKeepVideoChange = (keepVideo: boolean) => {
    onChange({ ...config, keepVideo });
  };

  const handleStorageTypeChange = (storageType: StorageType) => {
    onChange({ ...config, storageType });
  };

  return (
    <div className="p-4 space-y-6">
      {/* App Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Mode
        </label>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onAppModeChange(AppMode.RECORD)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              appMode === AppMode.RECORD
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="font-semibold">📹 Live Recording</div>
            <div className="text-xs mt-1 opacity-80">
              Use camera to record video in real-time
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAppModeChange(AppMode.TEST)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              appMode === AppMode.TEST
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="font-semibold">🧪 Test Mode</div>
            <div className="text-xs mt-1 opacity-80">
              Upload local chunk files for testing
            </div>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* AI Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          AI Model
        </label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAIModelChange(AIModel.QWEN)}
            className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-150 ${
              config.aiModel === AIModel.QWEN
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Qwen
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAIModelChange(AIModel.GEMINI)}
            className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-150 ${
              config.aiModel === AIModel.GEMINI
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Gemini
          </button>
        </div>
      </div>

      {/* Storage Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Storage Service
        </label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.COS)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              config.storageType === StorageType.COS
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">Tencent COS</div>
            <div className="text-xs mt-1 opacity-80">
              Recommended for China deployment
            </div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.OSS)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              config.storageType === StorageType.OSS
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">Alibaba OSS</div>
            <div className="text-xs mt-1 opacity-80">
              Works well with Qwen
            </div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.MINIO)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              config.storageType === StorageType.MINIO
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">MinIO (Self-hosted)</div>
            <div className="text-xs mt-1 opacity-80">
              For local development
            </div>
          </button>
        </div>
      </div>

      {/* Analysis Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Analysis Mode
        </label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAnalysisModeChange(AnalysisMode.SLIDING_WINDOW)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              config.analysisMode === AnalysisMode.SLIDING_WINDOW
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">Semi Real-time</div>
            <div className="text-xs mt-1 opacity-80">
              Analyze while recording (Recommended)
            </div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAnalysisModeChange(AnalysisMode.FULL)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 text-left ${
              config.analysisMode === AnalysisMode.FULL
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">Full Analysis</div>
            <div className="text-xs mt-1 opacity-80">
              Analyze after recording completes
            </div>
          </button>
        </div>
      </div>

      {/* Keep Video Option */}
      <div>
        <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors duration-150">
          <input
            type="checkbox"
            checked={config.keepVideo}
            onChange={(e) => handleKeepVideoChange(e.target.checked)}
            disabled={disabled}
            className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700">
              Keep video files
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {config.keepVideo
                ? 'Videos will be retained on the server'
                : 'Videos will be deleted after analysis'}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
