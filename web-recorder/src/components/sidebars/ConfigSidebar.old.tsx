import { AIModel, AnalysisMode, StorageType, AppMode } from '../../types';
import type { RecordingConfig, AppMode as AppModeType } from '../../types';
import { UI_TEXT } from '../../config/constants';

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
          运行模式
        </label>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onAppModeChange(AppMode.RECORD)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              appMode === AppMode.RECORD
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="font-semibold">📹 实时录制</div>
            <div className="text-xs mt-1 opacity-80">
              使用摄像头实时录制视频
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAppModeChange(AppMode.TEST)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              appMode === AppMode.TEST
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="font-semibold">🧪 测试模式</div>
            <div className="text-xs mt-1 opacity-80">
              上传本地chunks文件模拟录制
            </div>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* AI Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {UI_TEXT.CONFIG_AI_MODEL}
        </label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAIModelChange(AIModel.QWEN)}
            className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all ${
              config.aiModel === AIModel.QWEN
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Qwen (通义千问)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAIModelChange(AIModel.GEMINI)}
            className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all ${
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
          {UI_TEXT.CONFIG_STORAGE_TYPE}
        </label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.COS)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              config.storageType === StorageType.COS
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">COS (腾讯云)</div>
            <div className="text-xs mt-1 opacity-80">
              国内部署首选
            </div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.OSS)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              config.storageType === StorageType.OSS
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">OSS (阿里云)</div>
            <div className="text-xs mt-1 opacity-80">
              适合配合Qwen使用
            </div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.MINIO)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              config.storageType === StorageType.MINIO
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">MinIO (自建)</div>
            <div className="text-xs mt-1 opacity-80">
              本地开发测试
            </div>
          </button>
        </div>
      </div>

      {/* Analysis Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {UI_TEXT.CONFIG_ANALYSIS_MODE}
        </label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAnalysisModeChange(AnalysisMode.SLIDING_WINDOW)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              config.analysisMode === AnalysisMode.SLIDING_WINDOW
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">半实时模式</div>
            <div className="text-xs mt-1 opacity-80">
              边录边分析，实时查看结果（推荐）
            </div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAnalysisModeChange(AnalysisMode.FULL)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all text-left ${
              config.analysisMode === AnalysisMode.FULL
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-semibold">整体分析</div>
            <div className="text-xs mt-1 opacity-80">
              录制完成后一次性分析，更连贯但需等待
            </div>
          </button>
        </div>
      </div>

      {/* Keep Video Option */}
      <div>
        <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={config.keepVideo}
            onChange={(e) => handleKeepVideoChange(e.target.checked)}
            disabled={disabled}
            className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700">
              {UI_TEXT.CONFIG_KEEP_VIDEO}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {config.keepVideo
                ? '视频将保留在服务器供后续回溯'
                : '分析完成后自动删除视频（节省存储空间）'}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
