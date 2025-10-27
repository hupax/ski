import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '../types';
import { UI_TEXT } from '../config/constants';

interface AnalysisDisplayProps {
  results: AnalysisResult[];
  isConnected: boolean;
  sessionId: number | null;
}

export function AnalysisDisplay({
  results,
  isConnected,
  sessionId,
}: AnalysisDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new results arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [results]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          {UI_TEXT.ANALYSIS_TITLE}
        </h2>

        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>
      </div>

      {/* Results Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 min-h-[400px] max-h-[600px]"
      >
        {results.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">
                {sessionId
                  ? UI_TEXT.ANALYSIS_CONNECTED
                  : UI_TEXT.ANALYSIS_EMPTY}
              </p>
            </div>
          </div>
        ) : (
          results.map((result, index) => (
            <div
              key={`${result.windowIndex}-${index}`}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
            >
              {/* Window Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  窗口 #{result.windowIndex}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(result.timestamp)}
                </span>
              </div>

              {/* Analysis Content */}
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {result.content || (
                  <span className="text-gray-400 italic">分析中...</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      {results.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>共 {results.length} 个分析窗口</span>
            {sessionId && (
              <span className="font-mono text-xs">
                Session #{sessionId}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
