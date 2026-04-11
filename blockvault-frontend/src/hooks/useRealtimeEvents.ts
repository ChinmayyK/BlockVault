/**
 * React hook for BlockVault real-time WebSocket events.
 *
 * Connects to the Flask-SocketIO backend using the authenticated user's
 * JWT. Automatically manages connection lifecycle (connect on auth,
 * disconnect on logout) and provides helpers for room management.
 *
 * Usage:
 *   const { isConnected, lastEvent } = useRealtimeEvents();
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getApiBase } from '@/lib/getApiBase';
import toast from 'react-hot-toast';

// Event type constants (must match backend Events class)
export const RealtimeEvents = {
  FILE_SHARED: 'file:shared',
  FILE_UPLOAD_COMPLETE: 'file:upload_complete',
  SIGNATURE_REQUESTED: 'signature:requested',
  SIGNATURE_COMPLETED: 'signature:completed',
  PROOF_PROGRESS: 'proof:progress',
  PROOF_COMPLETE: 'proof:complete',
  CASE_UPDATED: 'case:updated',
  NOTIFICATION_NEW: 'notification:new',
  PRESENCE_UPDATE: 'presence:update',
} as const;

export type RealtimeEvent = (typeof RealtimeEvents)[keyof typeof RealtimeEvents];

interface RealtimeState {
  isConnected: boolean;
  lastEvent: { type: string; data: unknown; timestamp: number } | null;
  connectionError: string | null;
}

/**
 * Hook that manages WebSocket connection and event handling.
 *
 * Automatically:
 * - Connects when the user is authenticated
 * - Disconnects on logout
 * - Invalidates TanStack Query caches on relevant events
 * - Shows toast notifications for key events
 */
export function useRealtimeEvents(): RealtimeState & {
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
} {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef<any>(null);
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastEvent: null,
    connectionError: null,
  });

  // Event handlers that invalidate TanStack Query caches
  const handleEvent = useCallback(
    (eventType: string, data: unknown) => {
      setState((prev) => ({
        ...prev,
        lastEvent: { type: eventType, data, timestamp: Date.now() },
      }));

      // Invalidate relevant query caches based on event type
      switch (eventType) {
        case RealtimeEvents.FILE_SHARED:
        case RealtimeEvents.FILE_UPLOAD_COMPLETE:
          queryClient.invalidateQueries({ queryKey: ['files'] });
          if (eventType === RealtimeEvents.FILE_SHARED) {
            toast.success('📁 A file was shared with you', { duration: 4000 });
          }
          break;

        case RealtimeEvents.SIGNATURE_REQUESTED:
          queryClient.invalidateQueries({ queryKey: ['signatures'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast('✍️ New signature request', { icon: '📝', duration: 5000 });
          break;

        case RealtimeEvents.SIGNATURE_COMPLETED:
          queryClient.invalidateQueries({ queryKey: ['signatures'] });
          toast.success('✅ Document signed', { duration: 3000 });
          break;

        case RealtimeEvents.PROOF_PROGRESS:
          // Don't invalidate for progress, just update state
          break;

        case RealtimeEvents.PROOF_COMPLETE:
          queryClient.invalidateQueries({ queryKey: ['files'] });
          toast.success('🔐 ZK proof generation complete', { duration: 4000 });
          break;

        case RealtimeEvents.CASE_UPDATED:
          queryClient.invalidateQueries({ queryKey: ['cases'] });
          break;

        case RealtimeEvents.NOTIFICATION_NEW:
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
          break;
      }
    },
    [queryClient]
  );

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (!isAuthenticated || !user?.jwt) {
      // Disconnect if not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setState((prev) => ({ ...prev, isConnected: false }));
      }
      return;
    }

    // Dynamic import to avoid bundling socket.io-client if unused
    let cancelled = false;

    const connect = async () => {
      try {
        const { io } = await import('socket.io-client');

        if (cancelled) return;

        const apiBase = getApiBase();
        const socket = io(apiBase, {
          auth: { token: user.jwt },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 10000,
        });

        socket.on('connect', () => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              isConnected: true,
              connectionError: null,
            }));
          }
        });

        socket.on('disconnect', () => {
          if (!cancelled) {
            setState((prev) => ({ ...prev, isConnected: false }));
          }
        });

        socket.on('connect_error', (err: Error) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              isConnected: false,
              connectionError: err.message,
            }));
          }
        });

        // Register handlers for all event types
        Object.values(RealtimeEvents).forEach((eventType) => {
          socket.on(eventType, (data: unknown) => {
            handleEvent(eventType, data);
          });
        });

        socketRef.current = socket;
      } catch {
        // socket.io-client not installed — silently degrade
        console.debug('[useRealtimeEvents] socket.io-client not available');
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, user?.jwt, handleEvent]);

  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit('join', { room });
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit('leave', { room });
  }, []);

  return { ...state, joinRoom, leaveRoom };
}
