import { AIModel, AnalysisMode, StorageType, AppMode } from '../types';
import type { RecordingConfig, AppMode as AppModeType } from '../types';
import { UI_TEXT } from '../config/constants';

interface ConfigPanelProps {
  config: RecordingConfig;
  onChange: (config: RecordingConfig) => void;
  disabled?: boolean;
  appMode: AppModeType;
  onAppModeChange: (mode: AppModeType) => void;
}

export function ConfigPanel({ config, onChange, disabled = false, appMode, onAppModeChange }: ConfigPanelProps) {
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
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">录制配置</h2>

      {/* App Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          运行模式
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onAppModeChange(AppMode.RECORD)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              appMode === AppMode.RECORD
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } cursor-pointer`}
          >
            📹 实时录制
          </button>
          <button
            type="button"
            onClick={() => onAppModeChange(AppMode.TEST)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              appMode === AppMode.TEST
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } cursor-pointer`}
          >
            🧪 测试模式
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {appMode === AppMode.RECORD
            ? '使用摄像头实时录制视频'
            : '上传本地chunks文件模拟录制（用于快速测试）'}
        </p>
      </div>

      {/* AI Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {UI_TEXT.CONFIG_AI_MODEL}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAIModelChange(AIModel.QWEN)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.aiModel === AIModel.QWEN
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            Qwen (通义千问)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAIModelChange(AIModel.GEMINI)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.aiModel === AIModel.GEMINI
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            Gemini
          </button>
        </div>
      </div>

      {/* Storage Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {UI_TEXT.CONFIG_STORAGE_TYPE}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.MINIO)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.storageType === StorageType.MINIO
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            MinIO (自建)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.OSS)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.storageType === StorageType.OSS
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            OSS (阿里云)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStorageTypeChange(StorageType.COS)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.storageType === StorageType.COS
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            COS (腾讯云)
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {config.storageType === StorageType.COS
            ? '推荐：腾讯云对象存储，国内部署首选'
            : config.storageType === StorageType.OSS
            ? '阿里云对象存储，适合配合Qwen使用'
            : '自建MinIO存储，适合本地开发测试'}
        </p>
      </div>

      {/* Analysis Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {UI_TEXT.CONFIG_ANALYSIS_MODE}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAnalysisModeChange(AnalysisMode.SLIDING_WINDOW)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.analysisMode === AnalysisMode.SLIDING_WINDOW
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            半实时模式
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAnalysisModeChange(AnalysisMode.FULL)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              config.analysisMode === AnalysisMode.FULL
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            整体分析
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {config.analysisMode === AnalysisMode.SLIDING_WINDOW
            ? '边录边分析，实时查看结果（推荐）'
            : '录制完成后一次性分析，更连贯但需等待'}
        </p>
      </div>

      {/* Keep Video Option */}
      <div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.keepVideo}
            onChange={(e) => handleKeepVideoChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-700">
            {UI_TEXT.CONFIG_KEEP_VIDEO}
          </span>
        </label>
        <p className="ml-8 mt-1 text-xs text-gray-500">
          {config.keepVideo
            ? '视频将保留在服务器供后续回溯'
            : '分析完成后自动删除视频（节省存储空间）'}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">当前配置</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>
            • AI 模型:{' '}
            <span className="font-semibold">
              {config.aiModel === AIModel.QWEN ? 'Qwen (通义千问)' : 'Gemini'}
            </span>
          </li>
          <li>
            • 存储服务:{' '}
            <span className="font-semibold">
              {config.storageType === StorageType.COS
                ? 'COS (腾讯云)'
                : config.storageType === StorageType.OSS
                ? 'OSS (阿里云)'
                : 'MinIO (自建)'}
            </span>
          </li>
          <li>
            • 分析模式:{' '}
            <span className="font-semibold">
              {config.analysisMode === AnalysisMode.SLIDING_WINDOW
                ? '半实时模式'
                : '整体分析'}
            </span>
          </li>
          <li>
            • 视频保留:{' '}
            <span className="font-semibold">{config.keepVideo ? '是' : '否'}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
