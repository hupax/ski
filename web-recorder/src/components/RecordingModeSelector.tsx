import { UploadIcon, VideoIcon, PlayIcon } from './icons'
import { AnalysisMode } from '../types'

interface RecordingModeSelectorProps {
  onModeSelect: (mode: 'upload' | 'full' | 'sliding_window') => void
}

export function RecordingModeSelector({ onModeSelect }: RecordingModeSelectorProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 py-16">
      {/* Title */}
      <h1 className="text-2xl font-normal text-gray-900 mb-12">
        Choose Recording Mode
      </h1>

      {/* Mode cards container */}
      <div className="w-full max-w-3xl space-y-4">
        {/* Upload Mode */}
        <button
          onClick={() => onModeSelect('upload')}
          className="w-full flex items-start gap-6 px-8 py-6 rounded-2xl bg-white border border-gray-200
                     hover:border-gray-300 hover:shadow-md
                     transition-all duration-200 cursor-pointer group text-left"
        >
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
            <UploadIcon width={24} height={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Local Video
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Upload pre-recorded video chunks for testing. Useful for debugging and development.
              Supports .webm format.
            </p>
          </div>
        </button>

        {/* Full Analysis Mode */}
        <button
          onClick={() => onModeSelect('full')}
          className="w-full flex items-start gap-6 px-8 py-6 rounded-2xl bg-white border border-gray-200
                     hover:border-gray-300 hover:shadow-md
                     transition-all duration-200 cursor-pointer group text-left"
        >
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-purple-50 group-hover:bg-purple-100 transition-colors">
            <VideoIcon width={24} height={24} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Full Analysis
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Record video and analyze the entire recording after it's complete. Best for comprehensive
              analysis of the full context.
            </p>
          </div>
        </button>

        {/* Sliding Window Mode - Recommended */}
        <button
          onClick={() => onModeSelect('sliding_window')}
          className="w-full flex items-start gap-6 px-8 py-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50
                     border-2 border-green-300
                     hover:border-green-400 hover:shadow-lg
                     transition-all duration-200 cursor-pointer group text-left relative overflow-hidden"
        >
          {/* Recommended badge */}
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-200 rounded-full">
              Recommended
            </span>
          </div>

          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-green-100 group-hover:bg-green-200 transition-colors">
            <PlayIcon width={24} height={24} className="text-green-700" />
          </div>
          <div className="flex-1 pr-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Semi Real-time Analysis
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Analyze video in overlapping windows while recording. Get near real-time results with
              smooth action continuity. Ideal for live demonstrations and presentations.
            </p>
            <div className="mt-3 text-xs text-green-700 font-medium">
              Fastest feedback • Best accuracy • Continuous analysis
            </div>
          </div>
        </button>
      </div>

      {/* Help text */}
      <div className="mt-8 text-sm text-gray-500 text-center max-w-xl">
        After selecting a mode, you can start recording immediately. Video will be processed
        using AI to generate detailed text transcripts of your actions.
      </div>
    </div>
  )
}
