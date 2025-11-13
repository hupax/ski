// Updated WebSocket hook that uses Zustand stores
import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { WS_BASE_URL } from '../config/constants'
import { useAnalysisStore } from '../stores'
import type { WebSocketMessage } from '../types'

/**
 * Custom hook for WebSocket connection using Zustand stores
 */
export function useWebSocketWithStore(sessionId: number | null) {
  const { setIsConnected, addResult, setIsAnalyzing } = useAnalysisStore()
  const clientRef = useRef<Client | null>(null)

  useEffect(() => {
    if (!sessionId) {
      // Disconnect if no session
      if (clientRef.current?.connected) {
        clientRef.current.deactivate()
      }
      setIsConnected(false)
      return
    }

    // Create STOMP client
    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
      debug: (str) => {
        console.log('[WebSocket]', str)
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('WebSocket connected for session:', sessionId)
        setIsConnected(true)

        // Subscribe to session-specific topic (must match backend: /topic/session/{sessionId})
        client.subscribe(`/topic/session/${sessionId}`, (message) => {
          try {
            const data: WebSocketMessage = JSON.parse(message.body)
            console.log('Received analysis result:', data)

            // Add result to store
            addResult({
              windowIndex: data.windowIndex,
              content: data.content,
              timestamp: data.timestamp,
            })

            setIsAnalyzing(false)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        })

        setIsAnalyzing(true)
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        setIsAnalyzing(false)
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message'], frame.body)
        setIsConnected(false)
        setIsAnalyzing(false)
      },
    })

    client.activate()
    clientRef.current = client

    // Cleanup on unmount or sessionId change
    return () => {
      if (client.connected) {
        console.log('Deactivating WebSocket client')
        client.deactivate()
      }
    }
  }, [sessionId, setIsConnected, addResult, setIsAnalyzing])

  return {
    // No need to return anything since we're using stores
  }
}
