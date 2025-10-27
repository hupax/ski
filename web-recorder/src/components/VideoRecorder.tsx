import { useEffect, useRef } from 'react';
import { RecordingState } from '../types';
import { UI_TEXT } from '../config/constants';

interface VideoRecorderProps {
  state: RecordingState;
  stream: MediaStream | null;
  onStart: () => void;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export function VideoRecorder({
  state,
  stream,
  onStart,
  onStop,
  onPause,
  onResume,
}: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update video element srcObject when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const canStart = state === RecordingState.IDLE || state === RecordingState.STOPPED;
  const isRecording = state === RecordingState.RECORDING;
  const isPaused = state === RecordingState.PAUSED;

  const getButtonText = () => {
    if (state === RecordingState.REQUESTING_PERMISSION) {
      return '请求权限中...';
    }
    if (isRecording) {
      return UI_TEXT.BTN_STOP;
    }
    if (isPaused) {
      return UI_TEXT.BTN_RESUME;
    }
    return UI_TEXT.BTN_START;
  };

  const handleMainButtonClick = () => {
    if (canStart) {
      onStart();
    } else if (isRecording) {
      onStop();
    } else if (isPaused && onResume) {
      onResume();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">视频录制</h2>

      {/* Video Preview */}
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">摄像头预览</p>
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 right-4">
            <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1.5 rounded-full">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-semibold">REC</span>
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex space-x-3">
        {/* Main Button (Start/Stop/Resume) */}
        <button
          onClick={handleMainButtonClick}
          disabled={state === RecordingState.REQUESTING_PERMISSION}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : canStart || isPaused
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {getButtonText()}
        </button>

        {/* Pause Button */}
        {isRecording && onPause && (
          <button
            onClick={onPause}
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors"
          >
            {UI_TEXT.BTN_PAUSE}
          </button>
        )}
      </div>

      {/* Info Message */}
      {state === RecordingState.IDLE && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">{UI_TEXT.IDLE}</p>
        </div>
      )}
    </div>
  );
}
