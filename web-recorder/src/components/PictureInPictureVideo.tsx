import { useEffect, useRef, useState } from 'react';
import { MinimizeIcon, MaximizeIcon, CloseIcon, StopIcon, PauseIcon, PlayIcon } from './icons';

interface PictureInPictureVideoProps {
  stream: MediaStream | null;
  isRecording?: boolean;
  isPaused?: boolean;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export function PictureInPictureVideo({
  stream,
  isRecording = false,
  isPaused = false,
  onStop,
  onPause,
  onResume
}: PictureInPictureVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream || isHidden) {
    return null;
  }

  return (
    <div
      className={`
        fixed transition-all duration-200 ease-in-out
        ${
          isMinimized
            ? 'bottom-4 right-4 w-48 h-36'
            : 'bottom-8 right-8 w-80 h-60'
        }
        bg-black rounded-lg shadow-2xl overflow-hidden
        border-2 ${isRecording ? 'border-red-500' : 'border-gray-700'}
        z-50
      `}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-3 left-3 flex items-center space-x-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>Recording</span>
        </div>
      )}

      {/* Paused Indicator */}
      {isPaused && (
        <div className="absolute top-3 left-3 flex items-center space-x-2 bg-yellow-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
          <PauseIcon className="w-3 h-3" />
          <span>Paused</span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="absolute top-3 right-3 flex items-center space-x-1">
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded transition-colors duration-150 backdrop-blur-sm"
          title={isMinimized ? 'Maximize' : 'Minimize'}
        >
          {isMinimized ? (
            <MaximizeIcon className="w-4 h-4" />
          ) : (
            <MinimizeIcon className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setIsHidden(true)}
          className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded transition-colors duration-150 backdrop-blur-sm"
          title="Hide"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Control Bar - Recording Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="text-white text-xs opacity-80">
            {isMinimized ? 'Preview' : 'Camera Preview'}
          </div>

          {/* Recording Control Buttons */}
          <div className="flex items-center space-x-2">
            {/* Pause/Resume Button */}
            {isRecording && onPause && (
              <button
                onClick={onPause}
                className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors duration-150"
                title="Pause recording"
              >
                <PauseIcon className="w-4 h-4" />
              </button>
            )}

            {isPaused && onResume && (
              <button
                onClick={onResume}
                className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-150"
                title="Resume recording"
              >
                <PlayIcon className="w-4 h-4" />
              </button>
            )}

            {/* Stop Button */}
            {(isRecording || isPaused) && onStop && (
              <button
                onClick={onStop}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-150"
                title="Stop recording"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
