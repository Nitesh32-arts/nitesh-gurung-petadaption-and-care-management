/**
 * WebSocket hook for real-time chat. Connects to one conversation (otherUserId).
 * Falls back to polling if WS fails or is unavailable.
 * REST send + this hook for receive = real-time updates without changing permissions.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

function getWsBaseUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL.replace(/^http/, 'ws');
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}`;
}

export function useChatWebSocket(otherUserId, accessToken, options = {}) {
  const { onMessage, onOpen, onClose, enabled = true } = options;
  const [isConnected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (!otherUserId || !accessToken || !enabled) return;

    const base = getWsBaseUrl();
    const token = typeof accessToken === 'string' ? accessToken.trim().replace(/^["']|["']$/g, '') : '';
    const url = `${base}/ws/chat/${otherUserId}/?token=${encodeURIComponent(token)}`;
    let ws;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      setConnectionError(e?.message || 'WebSocket failed');
      setConnected(false);
      return;
    }

    wsRef.current = ws;
    setConnectionError(null);

    ws.onopen = () => {
      setConnected(true);
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onClose?.();
      wsRef.current = null;
      if (enabled && otherUserId) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      setConnectionError('WebSocket error');
    };
  }, [otherUserId, accessToken, enabled, onOpen, onClose]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [connect]);

  return { isConnected, connectionError, send };
}
