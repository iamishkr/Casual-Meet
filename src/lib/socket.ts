import { io, Socket } from 'socket.io-client';
import { getAuthToken, getServerUrl, DEFAULT_SERVER_URL, isCapacitor } from './api';

export function getSocketUrl(): string {
  const envSocket = (import.meta as any).env?.VITE_SOCKET_URL;
  if (envSocket) return envSocket;

  const serverUrl = getServerUrl();
  if (serverUrl) return serverUrl;

  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.port === '3000' &&
    !isCapacitor
  ) {
    return 'http://localhost:5000';
  }

  return DEFAULT_SERVER_URL;
}

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(overrideToken?: string): Socket {
  const token = overrideToken || getAuthToken();

  if (socket) {
    if (socket.connected) {
      return socket;
    }
    socket.disconnect();
    socket = null;
  }

  socket = io(getSocketUrl(), {
    auth: {
      token: token || '',
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    // Socket successfully connected
  });

  socket.on('connect_error', (_err) => {
    // Graceful error handle; socket.io will auto-reconnect
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinChatRoom(chatId: string): void {
  if (socket && socket.connected && chatId) {
    socket.emit('chat.join', chatId);
  }
}

export function leaveChatRoom(chatId: string): void {
  if (socket && socket.connected && chatId) {
    socket.emit('chat.leave', chatId);
  }
}

export function emitTyping(chatId: string, targetUserId: string, typing: boolean): void {
  if (socket && socket.connected) {
    socket.emit(typing ? 'typing.start' : 'typing.stop', { chatId, targetUserId });
  }
}

export function emitChatRead(chatId: string): void {
  if (socket && socket.connected && chatId) {
    socket.emit('chat.read', { chatId });
  }
}
