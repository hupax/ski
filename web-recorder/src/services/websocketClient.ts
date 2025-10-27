import { Client } from '@stomp/stompjs';
import type { StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_BASE_URL, WS_ENDPOINTS } from '../config/constants';
import type { WebSocketMessage } from '../types';

export type MessageCallback = (message: WebSocketMessage) => void;

/**
 * WebSocket client using STOMP protocol
 */
export class WebSocketClient {
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private sessionId: number | null = null;
  private messageCallback: MessageCallback | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(onConnected?: () => void, onError?: (error: Error) => void): void {
    if (this.client && this.client.active) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket:', WS_BASE_URL);

    this.client = new Client({
      // Use SockJS as WebSocket implementation
      webSocketFactory: () => new SockJS(`${WS_BASE_URL}${WS_ENDPOINTS.CONNECT}`),

      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        console.log('WebSocket connected');
        if (onConnected) {
          onConnected();
        }
      },

      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers.message);
        console.error('Details:', frame.body);
        if (onError) {
          onError(new Error(frame.headers.message));
        }
      },

      onWebSocketError: (event) => {
        console.error('WebSocket error:', event);
        if (onError) {
          onError(new Error('WebSocket connection error'));
        }
      },

      debug: () => {
        // Uncomment for detailed debugging
        // console.log('STOMP Debug:', str);
      },
    });

    this.client.activate();
  }

  /**
   * Subscribe to session topic to receive analysis results
   */
  subscribe(sessionId: number, callback: MessageCallback): void {
    if (!this.client || !this.client.active) {
      console.error('Cannot subscribe: WebSocket not connected');
      return;
    }

    // Unsubscribe from previous session if any
    this.unsubscribe();

    this.sessionId = sessionId;
    this.messageCallback = callback;

    const destination = WS_ENDPOINTS.SESSION_TOPIC(sessionId);
    console.log('Subscribing to:', destination);

    this.subscription = this.client.subscribe(destination, (message) => {
      try {
        const data: WebSocketMessage = JSON.parse(message.body);
        console.log('Received WebSocket message:', data);

        if (this.messageCallback) {
          this.messageCallback(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    console.log('Subscribed to session:', sessionId);
  }

  /**
   * Unsubscribe from current session topic
   */
  unsubscribe(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
      console.log('Unsubscribed from session:', this.sessionId);
      this.sessionId = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.unsubscribe();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
      console.log('WebSocket disconnected');
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.active;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): number | null {
    return this.sessionId;
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Get WebSocket client singleton instance
 */
export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }
  return wsClient;
}
