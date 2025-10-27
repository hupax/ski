import { RecordingState } from '../types';

interface StatusIndicatorProps {
  state: RecordingState;
  sessionId: number | null;
  chunkIndex: number;
  error: string | null;
}

export function StatusIndicator({
  state,
  sessionId,
  chunkIndex,
  error,
}: StatusIndicatorProps) {
  const getStateColor = () => {
    switch (state) {
      case RecordingState.IDLE:
        return 'bg-gray-500';
      case RecordingState.REQUESTING_PERMISSION:
        return 'bg-yellow-500 animate-pulse';
      case RecordingState.READY:
        return 'bg-green-500';
      case RecordingState.RECORDING:
        return 'bg-red-500 animate-pulse';
      case RecordingState.PAUSED:
        return 'bg-yellow-500';
      case RecordingState.STOPPED:
        return 'bg-blue-500';
      case RecordingState.ERROR:
        return 'bg-red-700';
      default:
        return 'bg-gray-500';
    }
  };

  const getStateText = () => {
    switch (state) {
      case RecordingState.IDLE:
        return '待机中';
      case RecordingState.REQUESTING_PERMISSION:
        return '请求摄像头权限...';
      case RecordingState.READY:
        return '准备就绪';
      case RecordingState.RECORDING:
        return '录制中';
      case RecordingState.PAUSED:
        return '已暂停';
      case RecordingState.STOPPED:
        return '已停止';
      case RecordingState.ERROR:
        return '错误';
      default:
        return '未知状态';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4">
        {/* Status Indicator */}
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 rounded-full ${getStateColor()}`} />
          <span className="text-lg font-semibold text-gray-800">{getStateText()}</span>
        </div>

        {/* Session Info */}
        {sessionId && (
          <div className="ml-auto flex items-center space-x-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">Session:</span>{' '}
              <span className="font-mono text-blue-600">#{sessionId}</span>
            </div>
            {state === RecordingState.RECORDING && (
              <div>
                <span className="font-medium">Chunks:</span>{' '}
                <span className="font-mono text-green-600">{chunkIndex}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">
            <span className="font-semibold">错误:</span> {error}
          </p>
        </div>
      )}

      {/* Recording Info */}
      {state === RecordingState.RECORDING && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">
            视频每 30 秒自动分段上传并开始分析
          </p>
        </div>
      )}
    </div>
  );
}
