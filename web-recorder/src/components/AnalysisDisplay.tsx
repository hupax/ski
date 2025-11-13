import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '../types';
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
  const contentEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (contentEndRef.current && results.length > 0) {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results]);

  // Combine all results into one content (like Wrangler does)
  const combinedContent = results.map(r => r.content).join('\n\n');

  return (
    <div className="h-full bg-white overflow-y-auto main-scrollbar">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <article className="p-8 md:p-12">
            {combinedContent ? (
              <>
                <MarkdownRenderer content={combinedContent} />
                <div ref={contentEndRef} />
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-gray-400 py-12">
                <div>
                  <p className="text-sm">
                    {sessionId
                      ? 'Waiting for analysis results...'
                      : 'Start recording to see analysis results'}
                  </p>
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
