import { PlayIcon, PauseIcon, StopIcon } from '../icons';
import { RecordingState } from '../../types';

interface RecordingSidebarProps {
  state: RecordingState;
  sessionId: number | null;
  chunkIndex: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function RecordingSidebar({
  state,
  sessionId,
  chunkIndex,
  onStart,
  onPause,
  onResume,
  onStop
}: RecordingSidebarProps) {
  const isIdle = state === RecordingState.IDLE || state === RecordingState.STOPPED;
  const isRecording = state === RecordingState.RECORDING;
  const isPaused = state === RecordingState.PAUSED;
  const isRequestingPermission = state === RecordingState.REQUESTING_PERMISSION;

  const getStateText = () => {
    switch (state) {
      case RecordingState.IDLE:
        return 'Ready';
      case RecordingState.REQUESTING_PERMISSION:
        return 'Requesting permission...';
      case RecordingState.READY:
        return 'Ready';
      case RecordingState.RECORDING:
        return 'Recording';
      case RecordingState.PAUSED:
        return 'Paused';
      case RecordingState.STOPPED:
        return 'Stopped';
      case RecordingState.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStateColor = () => {
    switch (state) {
      case RecordingState.RECORDING:
        return 'bg-red-100 text-red-700';
      case RecordingState.PAUSED:
        return 'bg-yellow-100 text-yellow-700';
      case RecordingState.STOPPED:
      case RecordingState.IDLE:
        return 'bg-gray-100 text-gray-700';
      case RecordingState.ERROR:
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Status Display */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Status</span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStateColor()}`}
          >
            {getStateText()}
          </span>
        </div>

        {sessionId !== null && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Session ID:</span>
              <span className="font-semibold text-gray-900">{sessionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chunk:</span>
              <span className="font-semibold text-gray-900">{chunkIndex}</span>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="mt-3 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">Recording...</span>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="space-y-3">
        {isIdle && (
          <button
            onClick={onStart}
            disabled={isRequestingPermission}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-150 flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayIcon className="w-5 h-5" />
            <span>{isRequestingPermission ? 'Requesting...' : 'Start Recording'}</span>
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={onPause}
              className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-all duration-150 flex items-center justify-center space-x-2 shadow-sm"
            >
              <PauseIcon className="w-5 h-5" />
              <span>Pause</span>
            </button>
            <button
              onClick={onStop}
              className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold transition-all duration-150 flex items-center justify-center space-x-2 shadow-sm"
            >
              <StopIcon className="w-5 h-5" />
              <span>Stop Recording</span>
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-150 flex items-center justify-center space-x-2 shadow-sm"
            >
              <PlayIcon className="w-5 h-5" />
              <span>Resume</span>
            </button>
            <button
              onClick={onStop}
              className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold transition-all duration-150 flex items-center justify-center space-x-2 shadow-sm"
            >
              <StopIcon className="w-5 h-5" />
              <span>Stop Recording</span>
            </button>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
        <div className="text-xs text-blue-800 space-y-1">
          <div className="font-semibold mb-2">💡 Tips:</div>
          <div>• Click "Start Recording" to request camera access</div>
          <div>• You can pause/resume recording anytime</div>
          <div>• Stopping will end the current session</div>
          <div>• Real-time analysis results appear on the right</div>
        </div>
      </div>
    </div>
  );
}
