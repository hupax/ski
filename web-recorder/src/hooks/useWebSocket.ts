import { useState, useEffect, useCallback, useRef } from 'react';
import { getWebSocketClient } from '../services/websocketClient';
import type { AnalysisResult, WebSocketMessage } from '../types';

interface UseWebSocketReturn {
  isConnected: boolean;
  results: AnalysisResult[];
  error: string | null;
  clearResults: () => void;
}

/**
 * Custom hook for WebSocket connection and message handling
 */
export function useWebSocket(sessionId: number | null): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsClientRef = useRef(getWebSocketClient());
  const subscribedSessionIdRef = useRef<number | null>(null);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'analysis_result') {
      const result: AnalysisResult = {
        windowIndex: message.windowIndex,
        content: message.content,
        timestamp: message.timestamp,
      };

      setResults((prev) => {
        // Append content to existing window or create new entry
        const existingIndex = prev.findIndex(
          (r) => r.windowIndex === message.windowIndex
        );

        if (existingIndex >= 0) {
          // Append content to existing window result
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: updated[existingIndex].content + message.content,
            timestamp: message.timestamp,
          };
          return updated;
        } else {
          // Add new window result
          return [...prev, result];
        }
      });
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  useEffect(() => {
    const client = wsClientRef.current;

    if (!client.isConnected()) {
      client.connect(
        () => {
          setIsConnected(true);
          setError(null);
          console.log('WebSocket connected successfully');
        },
        (err) => {
          setIsConnected(false);
          setError(err.message);
          console.error('WebSocket connection error:', err);
        }
      );
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
      // client.disconnect();
    };
  }, []);

  /**
   * Subscribe to session topic when sessionId changes
   */
  useEffect(() => {
    if (!sessionId || !isConnected) {
      return;
    }

    // Only subscribe if session ID changed
    if (sessionId !== subscribedSessionIdRef.current) {
      wsClientRef.current.subscribe(sessionId, handleMessage);
      subscribedSessionIdRef.current = sessionId;
      console.log('Subscribed to session:', sessionId);

      // DON'T clear results - we want to keep accumulating results for the same session
      // setResults([]);
    }

    return () => {
      // Don't unsubscribe on unmount - keep subscription active
      // wsClientRef.current.unsubscribe();
    };
  }, [sessionId, isConnected, handleMessage]);

  /**
   * Clear all results
   */
  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    isConnected,
    results,
    error,
    clearResults,
  };
}
