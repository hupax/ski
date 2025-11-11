import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '../types';
import { UI_TEXT } from '../config/constants';
import MarkdownRenderer from './MarkdownRenderer';

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
        className="flex-1 overflow-y-auto space-y-6 min-h-[400px] max-h-[600px] pr-2"
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
              className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            >
              {/* Window Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-300">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-full">
                    窗口 #{result.windowIndex}
                  </span>
                  {result.content && (
                    <span className="text-xs text-gray-500 font-mono">
                      {result.content.length} 字符
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {formatTimestamp(result.timestamp)}
                </span>
              </div>

              {/* Analysis Content - Markdown Rendered */}
              <div className="markdown-content">
                {result.content ? (
                  <MarkdownRenderer
                    content={result.content}
                    className="text-sm"
                  />
                ) : (
                  <div className="flex items-center space-x-2 text-gray-400 italic">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>分析中...</span>
                  </div>
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
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                Session #{sessionId}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
